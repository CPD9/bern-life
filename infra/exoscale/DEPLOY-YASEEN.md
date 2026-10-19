# Deploy of 19 Oct 2026 (handoff)

The VM's port 22 accepts one /32 only (#99), so this deploy could not be run from the build
machine. Everything below is the procedure in [`../exoscale.md`](../exoscale.md) "Deploy search
from the bundle", with the values of this deploy filled in.

## What is deployed

- **Code:** `main` at the commit that pins `bundle-20261019-3` in `bundle.lock` (this PR or later).
- **Bundle:** asset `bundle-20261019-3.tar.gz`, sha256
  `c57afcbacd448ae2779641b82886deadc408ae48174950337c3ea076ff31f4bb`, 16,765,188 bytes, release
  `bundle-20261019-3` on `CPD9/bern-life`. It holds 3,351 pages and 3,484 profiles.
- **Mode:** replay, as today. Leave `LLM_CALL_BUDGET` unset in the VM's `.env`: the engine then makes
  no live call at all, even for signed-in users. `TRUST_PROXY=1` is set by `compose.yaml` for the web
  app behind Caddy; nothing to add.

## Before you start

1. Allow your own IP on port 22 in the Exoscale security group of `bernlife-prod` (#99), then check
   `ssh -o ConnectTimeout=8 ubuntu@151.145.197.170 true`.
2. The database migrations added since the last deploy are applied by the `migrate` service on
   `up`, and the code tar cannot roll them back. Step 1 below (backup) is therefore not optional.
   To see which migrations are pending before you start:

   ```bash
   cd /opt/bernlife/infra/exoscale
   docker compose run --rm --entrypoint bunx migrate prisma migrate status
   ```

## Steps

Run steps 1 to 7 of "Deploy search from the bundle" in `../exoscale.md`, in order. Notes per step:

- **1 (VM, backup):** note the backup folder and the code file it prints.
- **2 (your machine):** `make fetch` downloads and checks the asset above; `scp` it to the VM.
- **3 (your machine):** copy the tracked files of `main`.
- **4 (VM):** `fetch_bundle.py --archive` must print
  `bundle-20261019-3 verified and unpacked to /opt/bernlife/data/bundle`.
- **5 (VM):** `DEMO_FIXTURES=0`, and both compose files must parse.
- **6 (VM):** `docker compose up -d --build --wait`. The web image now creates `/data/uploads` owned
  by the app's user, so a new uploads volume is writable; an uploads volume created by an older
  image needs the one-time `chown` in `../exoscale.md` ("Back up and restore").
- **7 (VM):** `python3 -m infra.check_hosted --url https://151-145-197-170.sslip.io` must pass with
  mode `replay`, snapshot `bundle-20261019-3`, 3,351 pages and 3,484 profiles. Then sign in, ask
  "glucose sensors" in Ask, and check that the answer carries source links and no DEMO label.

## If something fails

- Back to the DEMO fixtures at once: `/opt/bernlife/infra/exoscale/demo.sh`.
- Full revert to the code that ran before: the "full revert" right after step 7 in
  `../exoscale.md`, with the code file from step 1. Restoring the database from the step-1 backup is in "Back up and restore".
