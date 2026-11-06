# MotoXPlus Java API (Spring Boot)

The Java port of the Next.js backend (`../src/app/api`). It runs **beside** the Next.js app against the
**same PostgreSQL database and Redis**, and issues/accepts the **same JWTs, cookies and JSON shapes**.
Because of that, routes move over one group at a time with no frontend change and no logout of
existing users. Nothing in the Next.js app was modified or removed.

Stack: Java 17, Spring Boot 4.1, Spring Security, Spring Data JPA (Hibernate 7), Redis (Lettuce), jjwt.

## Run

```bash
cd backend-java
export DATABASE_URL="postgresql://user:pass@localhost:5432/motoxplus"   # same value the Next.js app uses
export JWT_SECRET="<same value as the Next.js app>"                      # >= 32 bytes; no fallback, boot fails without it
export REDIS_URL="redis://localhost:6379"                                # optional; same Redis => shared rate limits
export COOKIE_SECURE=true                                                # production (HTTPS)
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
./mvnw package && java -jar target/motoxplus-api-0.0.1-SNAPSHOT.jar      # production jar
```

Listens on `PORT` (default 8080). **Bind it to 127.0.0.1 / firewall it**: client IPs come from
`X-Real-IP` set by Nginx, which a direct caller could forge.

## Test

```bash
./mvnw test
```

`AuthFlowIntegrationTest` starts a throwaway PostgreSQL (no Docker) and loads
`src/test/resources/prisma-schema.sql`, generated from `../prisma/schema.prisma`, so JPA mappings are
checked against the real Prisma tables. Regenerate after any Prisma schema change:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > backend-java/src/test/resources/prisma-schema.sql
```
(keep the 5-line comment header at the top of that file).

## Ground rules for porting more routes

- **Prisma owns the schema.** Hibernate is `ddl-auto=none`; never add migrations here. Map only the columns you use.
- Timestamps are UTC `LocalDateTime` (`Time.utcNow()`); do **not** set `hibernate.jdbc.time_zone`.
- Row ids are app-generated (`Cuid.next()`), as Prisma's `@default(cuid())` is client-side.
- Errors go through `ApiException` -> `{"error": "...", "code": "...", "retryAfterSeconds": n}`.
- Rate limits: add a class to `RateLimitBudgets` (same numbers as `rate-limit-budgets.ts`) and call
  `RateLimitEnforcer.enforce(req, CLASS, identifier)`. Keys match the Node app's Redis keyspace.
- Anything not whitelisted in `SecurityConfig` requires a valid session (deny by default).
- Port the Node test next to the route; keep message strings identical (the web UI shows them).

## Cutover (per route group)

1. Deploy this jar on 127.0.0.1:8080.
2. In `nginx.conf` add a `location` for the migrated paths with `proxy_pass http://127.0.0.1:8080;`
   (and `proxy_set_header X-Real-IP $remote_addr;`). Roll back by deleting the `location`.
3. Delete the Node route only after the Java one has run in production for a while.

Example for the already-ported auth endpoints:

```nginx
location ~ ^/api/auth/(login|refresh|logout|me|sessions)$ { proxy_pass http://127.0.0.1:8080; }
location /api/health { proxy_pass http://127.0.0.1:8080; }
```

## Status: 166 Node routes, 12 ported

| Done | Route |
|---|---|
| yes | `GET /api/categories`, `GET /api/products/search` (public; search gains a 120/min per-IP limit and treats `%`/`_` as literal text) |
| yes | `GET /api/part-categories` (public supplier parts catalogue) + `PartCategoryValidator` (category-id validation for vendor/seller registration endpoints) |
| yes | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET/DELETE /api/auth/sessions` |
| yes | `GET /api/health`, `/api/health/live`, `/api/health/ready` (readiness also reports Redis) |
| yes | Platform: JWT (interoperable with Node), bcrypt, Redis rate limiter, DB lockout, body-size cap, deny-by-default security |

Remaining route groups (count): admin 73, auth 12 (OTP, register, password reset, NextAuth), upload 8,
vendors 7, vendor 6, orders 6, crm 6, procurement 5, payments 5, mobile 5, products 2 (list, by id), dealer 3,
webhooks 2, staff 2, shipping 2, files 2, cart 2, admins 2, vehicles/schemes/contact/dev 1 each, categories
(POST, admin).

Known gaps to close before the frontend can drop Node entirely:

- **NextAuth session cookie.** Node login also mints an encrypted NextAuth cookie that `src/middleware.ts`
  and ~50 server-rendered pages (`getServerSession`) rely on. Java does not, so until those pages are
  changed to use `/api/auth/me`, **login must stay on the Node route**.
- **53 pages/layouts read the database directly through Prisma** rather than via an API; each needs a Java
  endpoint (or stays on Node) before Prisma can be removed.
- Business logic with money/tax impact (orders, payments, schemes, GST, refunds) has 44 Node test files that
  must be ported alongside the code.

## Marketplace module (`/api/v1`) - off by default

Design: `docs/marketplace/PHASE-0-AUDIT.md`; phase notes: `docs/marketplace/PHASE-1.md`.

* `MARKETPLACE_ENABLED=true` turns it on. Unset/false (default): no marketplace bean, endpoint or migration exists.
* When on, Flyway migrates **only** schema `marketplace` (own history table `marketplace.flyway_schema_history`,
  `clean` disabled). Prisma still owns `public`; do not run `prisma db push` / `migrate reset` against a shared database.
* Money in `marketplace.*` is integer paise (`Money`); never `double`.
* Authorisation is database-driven (`marketplace.role_permission`), checked with
  `@PreAuthorize("@perm.has('...')")` on controllers and `PermissionService.require(...)` in services.
* `SWAGGER_ENABLED=true` enables Swagger UI; the OpenAPI JSON at `/api/v1/openapi` always requires authentication.
