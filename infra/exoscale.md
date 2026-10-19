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
   app, the engine and the database, and passes only on replay or live mode, the version in
   `bundle.lock` and the page and profile counts in the bundle's manifest. The DEMO fixtures fail
   it. When the engine reports them, it also prints its status, uptime and failures in the last
   hour.

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
| Watch uptime | From your machine, in a clone with `make fetch` done: `python3 -m infra.check_hosted --url https://<site> --watch`. One line per check every 30 s (time, HTTP status, mode, status, ms); it exits 1 after 3 failed checks in a row (`--interval`, `--max-failures`). A `degraded` status is shown, not counted |
| New SSH IP | Exoscale portal → Security Groups → `bernlife-web` → edit the port 22 rule |

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
row restore together, from the same folder.

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
sudo cat "$b/uploads.tar.gz" | docker compose exec -T web tar -xzf - -C /data/uploads
sudo cat "$b/caddy-data.tar.gz" | docker compose exec -T caddy tar -xzf - -C /data
docker compose restart caddy             # serves the restored certificate
```

### Off-VM copy to Exoscale SOS (not provisioned)

Today nothing leaves the VM, so losing the VM loses its backups. This is the copy Peter would set
up; no bucket, key or passphrase exists, and none of it has run. The bucket stays in CH-GVA-2, so
the data stays in Switzerland, and each folder is encrypted on the VM before it leaves, because it
holds accounts, documents and Caddy's private key.

Once: a private bucket, and an IAM key whose role may only write objects to it (portal → IAM). On
the VM, as root, `exo config` stores that key for the `exo` CLI, and a passphrase goes into
`/root/bernlife-backup.pass` (mode 600). Keep the passphrase off the VM too, in Peter's password
manager: without it the copy cannot be read once the VM is gone.

```bash
exo storage mb sos://bernlife-backups --zone ch-gva-2
```

After `backup.sh`, as root:

```bash
cd /var/backups/bernlife && run="$(ls -d bernlife-*Z | tail -1)"
tar -cf - "$run" | openssl enc -aes-256-cbc -pbkdf2 -pass file:/root/bernlife-backup.pass \
  -out "/root/$run.tar.enc"
exo storage upload "/root/$run.tar.enc" sos://bernlife-backups/ && rm "/root/$run.tar.enc"
```

To restore from it: `exo storage download sos://bernlife-backups/<run>.tar.enc`, then
`openssl enc -d -aes-256-cbc -pbkdf2 -pass file:<passphrase file> -in <run>.tar.enc | sudo tar -xf - -C /var/backups/bernlife`,
then the restore above.

## Not done yet

- **Off-VM backup copy:** needs an SOS bucket, a key allowed to write to it and a passphrase
  (Peter's decision); the commands are under "Back up and restore". Not provisioned.
- **Credentials:** Peter holds the account; a compute-only IAM key for Yaseen replaces the master
  login for day-to-day work.
