# Hosting on Exoscale (S3)

One small VM in Geneva runs Bern Life for the three of us: Postgres, the web app and Caddy for
HTTPS, from `infra/exoscale/compose.yaml`. Only port 443 is open to everyone; SSH is open to one
IP; the database is reachable on the compose network only. Sign-up stays invite-only.

## What runs where

| | |
|---|---|
| VM | `bernlife-prod`, zone CH-GVA-2, Ubuntu 24.04 LTS, Standard Medium (2 vCPU, 4 GB), 50 GB disk, 2 GB swap |
| Address | `https://<ip-with-dashes>.sslip.io` (sslip.io maps the name to the IP; a real domain only needs `SITE_HOST` changed); the address is shared in Messages, not here |
| Code | `/opt/bernlife`, copied from git (tracked files only) |
| Settings | `/opt/bernlife/infra/exoscale/.env` (mode 600): `SITE_HOST`, `POSTGRES_PASSWORD` (generated on the VM, never printed), `DEMO_FIXTURES` |
| Backups | `/var/backups/bernlife`, nightly at 02:15 UTC, 14 days kept, root only |

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
printf "SITE_HOST=<ip-with-dashes>.sslip.io\nPOSTGRES_PASSWORD=%s\nDEMO_FIXTURES=1\n" \
  "$(openssl rand -hex 24)" > .env
docker compose up -d --build
echo "15 2 * * * root /opt/bernlife/infra/exoscale/backup.sh" | sudo tee /etc/cron.d/bernlife-backup
```

Caddy gets the certificate by itself; port 80 stays closed, so it uses the TLS-ALPN challenge on
443 after the HTTP one fails (a line in its log, not an error).

## Day to day

| Task | Command (on the VM, in `/opt/bernlife/infra/exoscale`) |
|---|---|
| Invite someone | `./invite.sh 1` prints a one-time code, valid 7 days |
| Deploy a new `main` | copy the files again (above), then `docker compose up -d --build` |
| Status and logs | `docker compose ps`, `docker compose logs -f web` |
| Backup now | `sudo ./backup.sh` |
| Restore a backup | `sudo sh -c 'gunzip -c /var/backups/bernlife/<file>.sql.gz' \| docker compose exec -T db psql -U bernlife -d bernlife` (into an empty database) |
| New SSH IP | Exoscale portal → Security Groups → `bernlife-web` → edit the port 22 rule |

## Not done yet

- **Search:** the engine needs the released bundle. Until then `DEMO_FIXTURES=1` shows the invented
  fixtures, labelled DEMO. With the bundle: copy it to the VM, add the engine's `load` and `serve`
  from `compose.yaml`, set `ENGINE_URL`, drop `DEMO_FIXTURES`.
- **Off-VM backup copy:** needs an SOS bucket and a key allowed to write to it (Peter's decision);
  the nightly file would then be copied there after `backup.sh`.
- **Credentials:** Peter holds the account; a compute-only IAM key for Yaseen replaces the master
  login for day-to-day work.
