# Hosting on Exoscale (S3)

One small VM in Geneva runs Bern Life for the three of us: Postgres, the engine replaying the
snapshot bundle (no GPU, no model key), the web app and Caddy for HTTPS, from
`infra/exoscale/compose.yaml`. Only port 443 is open to everyone; SSH is open to one IP; the
database and the engine are reachable on the compose network only. Sign-up stays invite-only.
Apertus on your own GPUs, or the whole app with no network at all: [`sovereign.md`](sovereign.md).

## What runs where

| | |
|---|---|
| VM | `bernlife-prod`, zone CH-GVA-2, Ubuntu 24.04 LTS, Standard Medium (2 vCPU, 4 GB), 50 GB disk, 2 GB swap |
| Address | `https://<ip-with-dashes>.sslip.io` (sslip.io maps the name to the IP; a real domain only needs `SITE_HOST` changed); the address is shared in Messages, not here |
| Code | `/opt/bernlife`, copied from git (tracked files only) |
| Settings | `/opt/bernlife/infra/exoscale/.env` (mode 600): `SITE_HOST`, `POSTGRES_PASSWORD` (generated on the VM, never printed), `DEMO_FIXTURES=0` |
| Bundle | `/opt/bernlife/data/bundle`, the version in `bundle.lock`, copied by scp (the VM holds no GitHub token) |
| Backups | `/var/backups/bernlife`, one folder per night at 02:15 UTC (database, uploads, Caddy's certificate), 14 days kept, root only; no copy off the VM yet |

Caddy sends the security headers of `web/next.config.ts` (Content-Security-Policy, X-Frame-Options,
Permissions-Policy, Cross-Origin-Opener-Policy, X-Content-Type-Options, Referrer-Policy) plus HSTS.
Its Content-Security-Policy is a default only, so an uploaded PDF keeps its own `sandbox` policy.
With `trusted_proxies` unset, Caddy replaces any `X-Forwarded-For` a client sends with the address
it sees. That is why `compose.yaml` sets `TRUST_PROXY=1` for the web app, which then counts sign-in
and engine limits per real address. Anywhere without such a proxy, leave it unset: the header would
be the client's own word, so every request counts as one address instead.

## Cost (CHF per month, Peter's credits)

| Item | About |
|---|---|
| Standard Medium VM | 34 (≈ €34 by third-party trackers; the portal shows the exact price) |
| 50 GB disk | a few francs |
| Off-VM backup copy (SOS bucket, not set up yet) | under 1 |

Stopping the VM stops the compute charge; deleting it stops all charges.

## Set up from nothing

In the Exoscale portal:

1. Compute → SSH Keys: add the public half of a key made for this server
   (`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_bernlife_exoscale`).
2. Compute → Security Groups: `bernlife-web` with inbound TCP 443 from `0.0.0.0/0` and TCP 22
   from your own IP (`/32`) only.
3. Compute → Instances: the VM in the table above, with that security group and key.

On the VM (`ssh -i ~/.ssh/id_ed25519_bernlife_exoscale ubuntu@<ip>`):

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get -y install unattended-upgrades ufw ca-certificates curl git
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
  | sudo tee /etc/ssh/sshd_config.d/10-bernlife.conf && sudo sshd -t && sudo systemctl reload ssh
sudo ufw default deny incoming && sudo ufw allow 22/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile \
  && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# Docker from Docker's repository: https://docs.docker.com/engine/install/ubuntu/
sudo usermod -aG docker ubuntu   # then log in again
sudo mkdir -p /opt/bernlife && sudo chown ubuntu:ubuntu /opt/bernlife
```

From a clone on your machine, copy the tracked files (never a `.env`):

```bash
git ls-files | COPYFILE_DISABLE=1 tar -czf - -T - | ssh ubuntu@<ip> 'tar -xzf - -C /opt/bernlife'
```

On the VM:

```bash
cd /opt/bernlife/infra/exoscale
umask 077
printf "SITE_HOST=<ip-with-dashes>.sslip.io\nPOSTGRES_PASSWORD=%s\nDEMO_FIXTURES=0\n" \
  "$(openssl rand -hex 24)" > .env
# Install the bundle first: steps 2 and 4 of "Deploy search from the bundle" below.
docker compose up -d --build --wait
echo "15 2 * * * root /opt/bernlife/infra/exoscale/backup.sh" | sudo tee /etc/cron.d/bernlife-backup
```

Caddy gets the certificate by itself; port 80 stays closed, so it uses the TLS-ALPN challenge on
443 after the HTTP one fails (a line in its log, not an error).

## Deploy search from the bundle

The VM runs what `make run` runs locally: `migrate`, then `load` puts the bundle into Postgres,
`serve` answers from it in replay mode, and the web app joins `serve`'s network (the engine takes
searches from loopback only). Steps in order; each says where it runs. `ssh` and `scp` take
`-i ~/.ssh/id_ed25519_bernlife_exoscale`; the tarball is the `asset` named in `bundle.lock`.

1. **VM: back up what runs now.** The database, uploads and certificate, then the code tree with
   its `.env` (root only, next to the nightly folders). Note the two names it prints, the backup
   folder and the code file, for a full revert.

   ```bash
   cd /opt/bernlife/infra/exoscale
   docker compose version   # 2.24.4 or later, for the DEMO rollback's override file
   sudo ./backup.sh && sudo ls -t /var/backups/bernlife | head -1
   sudo tar -czf "/var/backups/bernlife/code-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" \
     -C /opt --exclude=bernlife/data bernlife && sudo ls -t /var/backups/bernlife | head -1
   ```

2. **Your machine: get the verified tarball and copy it over.** `make fetch` checks the download
   against `bundle.lock`'s sha256 and keeps it in the data folder's `downloads/`, under the name in
   `bundle.lock`'s `asset`.

   ```bash
   make fetch
   asset="$(python3 -c 'import json; print(json.load(open("bundle.lock"))["asset"])')"
   scp "${BERNLIFE_DATA_DIR:-data}/downloads/$asset" ubuntu@<ip>:
   ```

3. **Your machine: copy the tracked files** of the `main` that pins that bundle (the command from
   the set-up; it never copies `.env` or `data/`).

   ```bash
   git ls-files | COPYFILE_DISABLE=1 tar -czf - -T - | ssh ubuntu@<ip> 'tar -xzf - -C /opt/bernlife'
   ```

4. **VM: install the bundle.** `--archive` puts the copied tarball through the same checks as a
   download: its sha256 against `bundle.lock`, then every file against `manifest.json`; the bundle
   in `data/bundle` is replaced only after both pass. `umask 022` keeps it readable by the
   engine's user inside the container.

   ```bash
   cd /opt/bernlife
   asset="$(python3 -c 'import json; print(json.load(open("bundle.lock"))["asset"])')"
   (umask 022 && python3 infra/fetch_bundle.py --archive ~/"$asset") && rm ~/"$asset"
   ```

   It prints `<version> verified and unpacked to /opt/bernlife/data/bundle`, with the version in
   `bundle.lock`; anything else is a refusal, and nothing was replaced.

5. **VM: switch the settings off DEMO and check that both compose files parse.**

   ```bash
   cd /opt/bernlife/infra/exoscale
   sed -i 's/^DEMO_FIXTURES=.*/DEMO_FIXTURES=0/' .env
   docker compose config --quiet && docker compose -f compose.yaml -f compose.demo.yaml config --quiet
   ```

6. **VM: build and start.** The first start downloads the embedding model into the `models`
   volume before `serve` answers (up to 10 minutes); `--wait` returns when `web` is healthy.

   ```bash
   docker compose up -d --build --wait || docker compose logs --tail 50 load serve web
   ```

7. **VM: health check.** It asks `https://<site>/api/health`, which travels through Caddy, the web
   app, the engine and the database, and passes only on replay mode, the version in `bundle.lock`
   and the page and profile counts in the bundle's manifest. The DEMO fixtures fail it, and so does
   live mode, which this VM must never be in (`--mode live` is for a stack meant to call models).
   When the engine reports them, it also prints its status, uptime and failed model calls in the
   last hour per role and marker.

   ```bash
   cd /opt/bernlife
   python3 -m infra.check_hosted --url "https://$(sed -n 's/^SITE_HOST=//p' infra/exoscale/.env)"
   ```

   Then sign in and run one search in Ask: results carry source links, and no DEMO label shows.

**Rollback to DEMO, one command** (VM, any time). It stops the engine and restarts the web app on
its own network with the invented fixtures, labelled DEMO; the database and accounts stay.

```bash
/opt/bernlife/infra/exoscale/demo.sh
```

Back to search afterwards: `docker compose up -d --wait` in `infra/exoscale`. A **full revert** to
the code that ran before step 1: `sudo mv /opt/bernlife /opt/bernlife.search`, then
`sudo tar -xzf /var/backups/bernlife/<code file from step 1> -C /opt`, then
`docker compose up -d --build --remove-orphans` in `/opt/bernlife/infra/exoscale`.

## Day to day

| Task | Command (on the VM, in `/opt/bernlife/infra/exoscale`) |
|---|---|
| Invite someone | `./invite.sh 1` prints a one-time code, valid 7 days |
| Deploy a new `main` | back up (step 1 above), copy the files again, then `docker compose up -d --build --wait` |
| New bundle in `bundle.lock` | steps 1 to 4 and 7 above, with `docker compose up -d --build --wait --force-recreate load serve web` as step 6 |
| Status and logs | `docker compose ps`, `docker compose logs -f web serve` |
| Web app unreachable after `serve` restarted on its own | `docker compose up -d --force-recreate web` (it shares `serve`'s network, which a restart replaces). A slow database does not cause this: `serve` waits up to two minutes for it instead of exiting |
| Backup now | `sudo ./backup.sh` |
| Restore a backup | "Back up and restore" below |
| Watch uptime | From your machine, in a clone with `make fetch` done: `python3 -m infra.check_hosted --url https://<site> --watch`. One line per check every 30 s (time, HTTP status, mode, status, failures in the last hour per role and marker, ms); it exits 1 after 3 failed checks in a row (`--interval`, `--max-failures`). A `degraded` status is shown, not counted |
| New SSH IP | Exoscale portal → Security Groups → `bernlife-web` → edit the port 22 rule (one `/32`; never write the IP in git, issues or chat) |

## Changes to access

| Date | Change |
|---|---|
| 2026-10-19 | Port 22 moved from the home network to the venue network (#99); the old rule removed. Only 443 public and 22 from that one `/32`; the database stays closed. |

## Back up and restore

`backup.sh` (nightly from cron, or `sudo ./backup.sh`) writes one folder per run,
`/var/backups/bernlife/bernlife-<UTC time>/`, kept 14 days:

| File | Holds | Taken by |
|---|---|---|
| `db.sql.gz` | the whole database: accounts, documents' rows, the loaded bundle | `pg_dump` in `db` |
| `uploads.tar.gz` | the uploaded documents, one file per sha256 (volume `uploads`, `/data/uploads` in `web`) | `tar` in `web` |
| `caddy-data.tar.gz` | Caddy's `/data` (volume `caddy-data`): the certificate, its private key, the ACME account | `tar` in `caddy` |

The folder appears only when all three are written; a `bernlife-<time>.part` folder is a run that
failed. It holds personal data and private keys, so it stays root only. A document's file and its
row restore together, from the same folder. An account or document deleted in the app stays in
the backups for up to 14 days, and a restore brings back everything deleted after that backup was
taken: delete it again in the app after a restore.

Uploads need the `uploads` volume to be owned by `node`, the web app's user. `web/Dockerfile`
creates `/data/uploads` for `node`, and Docker copies that owner into a new, empty volume, so a
volume made from this image is writable. A volume made from an older image is owned by root: the
app cannot write an upload, and `uploads.tar.gz` stays empty. Fix it once:

```bash
docker compose exec -T -u 0 web chown node /data/uploads
```

**Restore**, on the VM in `/opt/bernlife/infra/exoscale`. The dump goes into an empty database,
before `migrate` runs: on a new VM (set up as above up to `docker compose up`, the folder copied to
`/var/backups/bernlife`), or on this one after `sudo ./backup.sh`, `docker compose down` and
`docker volume rm bernlife-prod_pgdata`.

```bash
b=/var/backups/bernlife/bernlife-<time>
docker compose up -d --wait db
sudo gunzip -c "$b/db.sql.gz" \
  | docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U bernlife -d bernlife
docker compose up -d --build --wait      # migrate applies only what the dump lacks
# As root, since the folder may be root's (above); then the files go back to the app's user.
sudo cat "$b/uploads.tar.gz" | docker compose exec -T -u 0 web tar -xzf - -C /data/uploads
docker compose exec -T -u 0 web chown -R node /data/uploads
sudo cat "$b/caddy-data.tar.gz" | docker compose exec -T caddy tar -xzf - -C /data
docker compose restart caddy             # serves the restored certificate
```

### Restore drill (proves a backup restores, without touching the live database)

On the VM in `/opt/bernlife/infra/exoscale`, about a minute. It restores the newest folder's
`db.sql.gz` into a scratch database next to the live one, compares the row count of every table,
checks that both archives read, and drops the scratch database.

```bash
sudo ./backup.sh </dev/null
b=/var/backups/bernlife/$(sudo ls -t /var/backups/bernlife | grep -E '^bernlife-[0-9TZ]+$' | head -1)
docker compose exec -T db psql -U bernlife -d postgres -qc 'CREATE DATABASE restore_drill' </dev/null
sudo gunzip -c "$b/db.sql.gz" \
  | docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U bernlife -d restore_drill >/dev/null
Q="select string_agg(t || '=' || n, ' ' order by t) from (select relname t,
  (xpath('/row/c/text()', query_to_xml('select count(*) c from public.' || quote_ident(relname),
  false, true, '')))[1]::text n from pg_class where relkind = 'r'
  and relnamespace = 'public'::regnamespace) x"
live=$(docker compose exec -T db psql -U bernlife -d bernlife -Atc "$Q" </dev/null)
drill=$(docker compose exec -T db psql -U bernlife -d restore_drill -Atc "$Q" </dev/null)
[ "$live" = "$drill" ] && echo "row counts match" || printf 'MISMATCH\n%s\n%s\n' "$live" "$drill"
sudo tar -tzf "$b/uploads.tar.gz" >/dev/null && sudo tar -tzf "$b/caddy-data.tar.gz" >/dev/null \
  && echo "archives read"
docker compose exec -T db psql -U bernlife -d postgres -qc 'DROP DATABASE restore_drill' </dev/null
```

`</dev/null` keeps `docker compose` from reading the rest of a pasted script as its input. Rows
written between the backup and the count (a new account, a message) show as a mismatch: run it
again, or at a quiet moment.

| Date | Backup | Result |
|---|---|---|
| 2026-10-19 | `bernlife-20261019T071437Z` | restored in 7 s; all 28 tables match the live database (8 migrations, 3,351 pages, 3,484 profiles); `uploads.tar.gz` (no uploads yet) and `caddy-data.tar.gz` (1 certificate) read |

### Uptime watch

From a machine that stays on (a laptop only while it is awake): it checks the site every 30
seconds and exits, with a non-zero status, after 3 failures in a row.

```bash
python3 -m infra.check_hosted --url https://<site> --watch --interval 30 --max-failures 3
```

### Off-VM copy to Exoscale SOS (not provisioned)

Today nothing leaves the VM, so losing the VM loses its backups. This is the copy Peter would set
up; no bucket, key or passphrase exists, and none of it has run. The bucket stays in CH-GVA-2, so
the data stays in Switzerland, and each folder is encrypted on the VM before it leaves, because it
holds accounts, documents and Caddy's private key.

Copies are kept 14 days, as on the VM, so a deletion in the app leaves the bucket within 14 days
too. The bucket expires them itself with a lifecycle rule, because the key on the VM may only write:
whoever takes the VM cannot erase the copies, and the VM cannot prune them either. Bucket lifecycle
is in Early Access at Exoscale and their support enables it on request; without it, do not set up
this copy, since nothing else would expire it.

Once: a private bucket with that rule, and an IAM key whose role may only write objects to it
(portal → IAM). On the VM, as root, `exo config` stores that key for the `exo` CLI, and a
passphrase goes into `/root/bernlife-backup.pass` (mode 600). Keep the passphrase off the VM too, in
Peter's password manager: without it the copy cannot be read once the VM is gone.

```bash
exo storage mb sos://bernlife-backups --zone ch-gva-2
echo '{"Rules": [{"ID": "expire-after-14-days", "Status": "Enabled", "Filter": {"Prefix": ""},
  "Expiration": {"Days": 14}}]}' > expire-14-days.json
exo storage bucket lifecycle set sos://bernlife-backups expire-14-days.json
exo storage bucket lifecycle show sos://bernlife-backups
```

After `backup.sh`, as root. Each step writes a file and the next starts only when it succeeded, so
an archive cut short is never encrypted and sent. `gpg --symmetric` adds an integrity check, so a
copy that was cut or altered fails to decrypt; the `.sha256` file records the copy that left the VM.

```bash
run="$(ls -d /var/backups/bernlife/bernlife-*Z | tail -1 | xargs basename)" && cd /root \
  && tar -cf "$run.tar" -C /var/backups/bernlife "$run" \
  && gpg --batch --pinentry-mode loopback --passphrase-file /root/bernlife-backup.pass \
       --symmetric --cipher-algo AES256 -o "$run.tar.gpg" "$run.tar" \
  && sha256sum "$run.tar.gpg" > "$run.tar.gpg.sha256" \
  && exo storage upload "$run.tar.gpg" sos://bernlife-backups/ \
  && exo storage upload "$run.tar.gpg.sha256" sos://bernlife-backups/ \
  && rm "$run.tar" "$run.tar.gpg" "$run.tar.gpg.sha256"
```

To restore from it, as root in an empty folder: `exo storage download` both
`sos://bernlife-backups/<run>.tar.gpg` and `sos://bernlife-backups/<run>.tar.gpg.sha256`, then

```bash
sha256sum -c <run>.tar.gpg.sha256 \
  && gpg --batch --pinentry-mode loopback --passphrase-file <passphrase file> \
       -o <run>.tar -d <run>.tar.gpg \
  && tar -xf <run>.tar -C /var/backups/bernlife
```

and then the restore above.

## Not done yet

- **Off-VM backup copy:** needs an SOS bucket with lifecycle enabled by Exoscale, a key allowed to
  write to it and a passphrase (Peter's decision); the commands are under "Back up and restore".
  Not provisioned.
- **Credentials:** Peter holds the account; a compute-only IAM key for Yaseen replaces the master
  login for day-to-day work.
