# Database takeover: Prisma → Flyway (runbook)

**Decision (2026-11-06):** one backend, in Java. Flyway owns the whole database; Prisma migrations are frozen.
**Status:** implemented and tested locally against throwaway PostgreSQL only. **Not yet run against any real database.**

## What was built (`backend-java`)
| Piece | Purpose |
|---|---|
| `db/migration/V1__baseline_from_prisma.sql` | The 17 Prisma migrations concatenated in order (includes the hand-written dealer/customer `CHECK`s that `schema.prisma` cannot express). **Never executed on an existing DB**; only on an empty one. |
| `db/migration/V2__marketplace_foundation.sql` | Schema `marketplace`: permissions, audit log (append-only), idempotency keys, outbox. |
| `config/BaselineGuard` | Before Flyway adopts an existing DB as V1, requires Prisma's own `_prisma_migrations` to list all 17 migrations as finished and not rolled back. Otherwise it refuses and names what is missing. |
| `DB_MIGRATE` env (default `false`) | Flyway runs only when this is `true`. Deploying the jar alone never changes a database. |
| `MARKETPLACE_ENABLED` env (default `false`) | Turns on the marketplace beans/endpoints. Needs V2 applied first. |

Local proof (`BaselineMigrationTest`, 7 tests): V1 on an empty DB yields exactly the tables/columns/types of Prisma's generated schema; the CHECK constraints are present; V1→V2 applies on an empty DB; the guard rejects a DB without/behind Prisma's table; on a populated "production-like" DB V1 is *recorded, not executed*, existing rows survive and only V2 runs.

## Known trap (found while testing)
`spring.flyway.create-schemas` **must stay `false`**. With `true`, Flyway skips its non-empty-database check and would re-run V1 against production (`type "UserRole" already exists`, or worse). V2 creates `marketplace` itself.

## Cutover procedure (VPS, Ubuntu 24.04)
Do steps 1–5 on a **restored copy first**, then repeat on production in a quiet window.

1. **Backup:** `scripts/db/backup.sh` (see `BACKUP.md`). Confirm the file restores.
2. **Prisma at head:** `npx prisma migrate status` must say "Database schema is up to date". The newest baseline migration is `20261105000000_vendor_part_categories`; if it is not applied in production yet, apply it with `npx prisma migrate deploy` now (this is the last Prisma migration ever run). The guard enforces this.
3. **Schema-drift check (not possible on the dev PC: no `pg_dump`):** build the V1 schema in a scratch DB and compare with production.
   ```bash
   createdb mx_baseline && psql mx_baseline -f backend-java/src/main/resources/db/migration/V1__baseline_from_prisma.sql
   pg_dump --schema-only --no-owner --no-privileges mx_baseline > /tmp/baseline.sql
   pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > /tmp/prod.sql
   diff <(grep -v '^--' /tmp/baseline.sql) <(grep -v '^--' /tmp/prod.sql)   # expect only ordering/comment noise
   ```
   Any real difference = drift. Stop, fix by hand-written migration, and re-test. Do not baseline over drift.
4. **Migrate once, on purpose:**
   ```bash
   DB_MIGRATE=true DATABASE_URL=... JWT_SECRET=... java -jar motoxplus-api.jar   # starts, migrates, then stop it (Ctrl-C) or leave it running with DB_MIGRATE unset on next deploy
   ```
5. **Verify:** `SELECT version, type, success FROM public.flyway_schema_history;` → `1 BASELINE t`, `2 SQL t`. `SELECT count(*) FROM marketplace.permission;` → 22. Row counts of `"User"`, `"Order"`, `"Product"` unchanged.
6. **From now on:** no `prisma migrate deploy`, no `prisma db push`, no `prisma migrate reset` (CI check to add). Schema changes = new `V3+` file. While Node still reads the DB, mirror the change in `prisma/schema.prisma` by hand and run `prisma generate`.

## Rollback
V2 only *adds* the `marketplace` schema. To undo (before any marketplace data matters):
`DROP SCHEMA marketplace CASCADE; DELETE FROM public.flyway_schema_history WHERE version = '2';`
Dropping `public.flyway_schema_history` returns the DB to its pre-takeover state. Nothing in `public` was modified.

## Not covered yet
- Running against a real restored production dump (needs `pg_restore`, absent on the dev PC; the dump on disk is also from August, before 12 of the 17 migrations).
- CI guard that fails on any new `prisma/migrations/*` directory.
- Removing Prisma from the Next.js app (blocked until its 165 routes and 53 direct-DB pages are ported).
