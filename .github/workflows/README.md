# GitHub Actions Workflows

All workflows SSH into the production VPS using four shared secrets:

| Secret | Purpose |
|---|---|
| `VPS_HOST` | VPS hostname/IP |
| `VPS_USER` | SSH user (must have `sudo` for `restart-nginx`/`restart-postgres`/`tail-nginx-logs` in server-tools.yml) |
| `VPS_SSH_KEY` | Private key for that user |
| `VPS_PORT` | SSH port |
| `SLACK_WEBHOOK_URL` | Optional. If unset, every workflow just skips the Slack step and logs a note instead of failing. |

All destructive/mutating workflows (`deploy`, `rollback`, `restore`, `import-products`, `backup`, `seed`, `server-tools`) share one concurrency group, **`production-deploy`**, so at most one of them touches the VPS/database at a time. `health.yml` is intentionally excluded — it's read-only and runs every 15 minutes, so serializing it behind the others would just create monitoring gaps for no safety benefit.

The app directory on the VPS is always `/var/www/motoxplus`.

---

## deploy.yml

**Purpose:** Deploy the exact commit pushed to `main` — migrate, build, reload, verify.

**Trigger:** `push` to `main`, or manual `workflow_dispatch` (still restricted to `main` — see below).

**Required secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`, `SLACK_WEBHOOK_URL` (optional).

**Inputs:** none.

**Flow:** `validate_secrets` (also asserts `github.ref == refs/heads/main`, since `workflow_dispatch` doesn't restrict the branch selector on its own) → `typecheck_lint` (parallel, runner-side, no secrets needed) → `deploy` (SSH: checkout exact SHA → `npm ci` → `prisma generate` → `prisma migrate deploy` → `npm run build` → `pm2 reload` → poll `localhost:3000/api/health`) → `verify` (poll `https://motoxplus.com` for HTTP 200) → `diagnostics` (only runs if `deploy` or `verify` failed) → `notify`.

**Outputs:** `deployment-manifest-<sha>` artifact on success (sha/ref/actor/timestamp). `deploy-diagnostics-<sha>` artifact on failure (PM2 logs, PM2 describe, Nginx error log tail, and the install/migrate/build log files captured during the failed run).

**Failure behavior — deliberately NO automatic rollback.** By the time `prisma migrate deploy` has run, the schema may have already changed. Automatically reverting the code at that point would leave older code pointed at a newer schema — its own failure mode, often worse than a known-bad-but-consistent state. On any failure (build, migration, health check, or the public-site check), the workflow just fails loudly, uploads diagnostics, and notifies. Nothing on the VPS is touched further.

**Recovery procedure:** Look at the failed run's `deploy-diagnostics-<sha>` artifact and the printed logs. Decide whether to fix forward (push a new commit) or roll back. To roll back, run **rollback.yml** with the previous known-good commit (each deploy writes it to `/var/www/motoxplus/.deploy_prev_sha` as a breadcrumb).

---

## rollback.yml

**Purpose:** Manually roll back to a specific prior commit.

**Trigger:** `workflow_dispatch` only.

**Required secrets:** the four VPS secrets, `SLACK_WEBHOOK_URL` (optional).

**Inputs:** `commit` (required, string) — must match `^[0-9a-fA-F]{7,40}$`.

**Flow:** `validate_inputs` (format-checks the commit, checks secrets) → `rollback` (SSH: `git fetch`, then `git rev-parse --verify` to confirm the commit actually exists before doing anything destructive, then checkout/`npm ci`/`prisma generate`/build/`pm2 reload`/health-poll) → `notify`.

**Note:** deliberately does **not** run `prisma migrate deploy` — rolling back code should not run forward migrations.

**Outputs:** none (no artifacts).

**Failure behavior:** fails loudly if the commit doesn't exist, if the build fails, or if the app doesn't become healthy within 15 attempts (60s). Notifies with duration and a link to the run.

**Recovery procedure:** check `pm2 logs motoxplus` / `pm2 describe motoxplus` on the VPS. If the target commit itself is broken, roll back again to an earlier one.

---

## backup.yml

**Purpose:** Nightly database backup to Cloudflare R2 with integrity + checksum verification.

**Trigger:** `schedule` (`0 1 * * *` — 1 AM UTC daily), or manual `workflow_dispatch`.

**Required secrets:** the four VPS secrets. (R2 credentials — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — are read from the VPS's own `.env`, not GitHub secrets.)

**Inputs:** none.

**Flow:** `pg_dump --format=custom` (compressed, structured archive — required for `pg_restore --list` to work at all; a plain-SQL dump cannot be validated this way) → size sanity check → `pg_restore --list` integrity check (rejects a corrupt archive **before** it's ever uploaded) → compute local SHA-256, write a companion `.sha256` file → upload both to R2 → verify the object exists and its size matches → **download it back down and re-hash it**, comparing to the local checksum (an S3 ETag is not a reliable checksum once multipart upload kicks in, so this download-and-compare is the only unambiguous check) → prune local and remote backups older than 30 days.

**Outputs:** `db-backups/motoxplus-db-<timestamp>.dump` and `.dump.sha256` in R2. No GitHub artifacts.

**Failure behavior:** fails before ever uploading if the dump is too small or fails `pg_restore --list`; fails after upload if the checksum doesn't match.

**Recovery procedure:** re-run manually (`workflow_dispatch`). If R2 credentials are the problem, check the VPS's `.env`, not GitHub secrets.

---

## restore.yml

**Purpose:** Restore the database from a specific R2 backup. **This overwrites live data.**

**Trigger:** `workflow_dispatch` only.

**Required secrets:** the four VPS secrets, `SLACK_WEBHOOK_URL` (optional).

**Inputs:**
- `backup_filename` (required, string) — must exactly match `motoxplus-db-<timestamp>.dump` (strict regex allow-list; this value is interpolated into shell commands and an S3 key on the VPS, so it's validated before anything else runs).
- `confirm` (required, string) — must be typed exactly as `RESTORE`, or the workflow aborts immediately. This is the "never overwrite production without explicit confirmation" gate.

**Flow:** `validate_inputs` (confirmation + filename format + secrets) → `restore` (SSH: download the backup + its `.sha256` from R2 → verify checksum → verify integrity with `pg_restore --list` → `pg_restore --clean --if-exists` into the live database → `npx prisma validate` + `npx prisma migrate status`) → `notify`.

**Outputs:** none (no artifacts).

**Failure behavior:** refuses to restore at all if the checksum or integrity check fails — nothing touches the live database until both pass. If `pg_restore` itself fails partway, the database is left in whatever partial state `--clean --if-exists` reached; there's no automatic re-restore.

**Recovery procedure:** if the restore leaves the database in a bad partial state, run `restore.yml` again with a known-good backup filename. If the schema and the restored data disagree (`prisma migrate status` warns about drift), review manually — `restore.yml` will not silently reconcile that for you.

---

## import-products.yml

**Purpose:** Import a product catalog file from `imports/<type>.xlsx` (or `.csv`).

**Trigger:** `workflow_dispatch` only.

> **Currently a no-op.** `npm run import <type>` does not exist yet in `package.json`. This was previously wired to run automatically on every push touching `imports/**`, but a workflow that fails on every relevant push is worse than no workflow — and since it shares the `production-deploy` concurrency group, a stuck/failing run would have blocked deploys, backups, and everything else behind it. It's now manual-only, and the job checks for the importer script before attempting to use it — if missing, it prints a `::warning::` explanation and exits 0 (success) rather than failing.
>
> **TODO:** implement a script at e.g. `prisma/import.ts` that reads `imports/<type>.xlsx` and upserts the corresponding products, following the pattern already used by `prisma/seed-cables.ts` (MX-prefixed SKUs, category upsert, retry-on-transient-connection-error). Wire it up as `npm run import` (taking the type as `argv[2]`). Nothing in this workflow needs to change once that exists.

**Required secrets:** the four VPS secrets, `SLACK_WEBHOOK_URL` (optional).

**Inputs:** `type` (required, string) — matches a file under `imports/`, e.g. `cables` for `imports/cables.xlsx`.

**Flow:** `validate_secrets` → `import` (SSH: pull latest `main`, check the importer script exists, check the input file exists, run `npm run import <type>` if both checks pass) → `notify`.

**Outputs:** none.

**Failure behavior:** only fails if the importer exists and errors while running. Missing importer/missing input file are both graceful no-ops (exit 0), not failures.

**Recovery procedure:** none needed for the no-op case. Once the importer exists, treat failures like any other seed/import failure — check the SSH step log.

---

## seed.yml

**Purpose:** Run one or more of this project's database seed scripts on demand.

**Trigger:** `workflow_dispatch` only.

**Required secrets:** the four VPS secrets, `SLACK_WEBHOOK_URL` (optional).

**Inputs:** `target` — dropdown: `cables` (`db:seed-cables`), `mudguards` (`db:seed-mudguard`), or `all` (runs `db:seed`, `db:seed-cables`, `db:seed-mudguard`, `db:seed-vehicles`, `db:seed-descriptions` in sequence).

**Flow:** `validate_secrets` → `seed` (SSH, runs the selected `npm run db:seed-*` script(s), stops on the first failure) → `notify`.

**Outputs:** none.

**Failure behavior:** stops immediately if any individual seed script fails (`set -euo pipefail`); later scripts in an `all` run do not execute.

**Recovery procedure:** re-run with the same target — all of this project's seed scripts are upsert-based (keyed on unique SKU/slug), so re-running is safe and won't create duplicates.

---

## health.yml

**Purpose:** Continuous monitoring — fails loudly (and only then) if something is actually broken.

**Trigger:** `schedule` (`*/15 * * * *` — every 15 minutes), or manual `workflow_dispatch`.

**Required secrets:** the four VPS secrets. No Slack on success — see below.

**Inputs:** none.

**Flow:** checks `https://motoxplus.com` (HTTP 200) → checks (over SSH, all in one pass, not stopping at the first failure so every component gets checked): `localhost:3000/api/health`, the `motoxplus` PM2 process is online, Nginx is active, PostgreSQL is active, disk usage `< 90%`, memory usage `< 90%`.

**Outputs:** none.

**Failure behavior:** fails the Action if *any* check fails, with `::error::` annotations naming which one(s). Deliberately does **not** send a Slack message on success — this runs every 15 minutes, and a success ping that frequent would just be alert-fatigue noise. The failure Slack message is still sent (if configured).

**Recovery procedure:** depends on which check failed — see **server-tools.yml** for on-demand restarts (`restart-pm2`, `restart-nginx`, `restart-postgres`) and log tailing.

---

## server-tools.yml

**Purpose:** Run one predefined, safe operational command on the VPS on demand.

**Trigger:** `workflow_dispatch` only.

**Required secrets:** the four VPS secrets, `SLACK_WEBHOOK_URL` (optional).

**Inputs:** `command` — dropdown, one of: `restart-pm2`, `restart-nginx`, `restart-postgres`, `clear-next-cache`, `clear-pm2-logs`, `tail-pm2-logs`, `tail-nginx-logs`, `disk-usage`, `memory-usage`, `uptime`.

**Flow:** `validate_secrets` → `run_command` (SSH, runs exactly the selected command — a fixed `case` statement, not free-text shell execution) → `notify`.

**Outputs:** none.

**Failure behavior:** fails if the selected command itself errors (e.g. `systemctl restart` fails, or the app doesn't come back after `restart-pm2`'s reload/restart fallback).

**Recovery procedure:** re-run the same tool, or escalate to **rollback.yml** if `restart-pm2` reveals the currently-deployed code itself is broken.

---

## Security notes (apply across all 8 workflows)

- **No hardcoded credentials.** Every VPS/R2 credential is a GitHub secret or read from the VPS's own `.env` at runtime — never committed, never printed.
- **No direct interpolation of untrusted input into shell text.** Every `workflow_dispatch` string/choice input (`commit`, `backup_filename`, `confirm`, `type`, `target`, `command`) is passed through a step's `env:` block and referenced as a quoted shell variable (`"$VAR"`), never as `${{ inputs.x }}` pasted directly into a `run:`/`script:` body — the latter is a classic GitHub Actions script-injection vector, since the substitution happens before the shell ever parses the line.
- **Free-text inputs are validated before use:** `rollback.yml`'s `commit` must match a SHA-shaped regex and is confirmed to exist via `git rev-parse --verify` before any destructive checkout; `restore.yml`'s `backup_filename` must match the exact backup-naming pattern, and its `confirm` input must be the literal string `RESTORE`.
- **Minimal permissions:** every workflow declares `permissions: contents: read` at the top level (and per-job where relevant) — none of them need write access to the repository.
- **`timeout-minutes` on every job**, so a hung SSH session or stuck command can't block the shared `production-deploy` concurrency queue indefinitely.
- **`deploy.yml`'s SSH private key is written to a local file only inside the `diagnostics` job** (needed for a plain `ssh`/`scp` fallback the marketplace action doesn't support), with `umask 077` + `chmod 600`, and is deleted before the artifact upload step runs — never included in any uploaded artifact.
