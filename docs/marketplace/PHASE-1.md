# Phase 1 - Java foundation (marketplace)

**Status:** implemented, 87/87 Java tests passing (60 pre-existing + 27 new). Nothing committed. No real database touched.

## Decisions applied (from the Phase 0 recommendations - confirm or correct)
| ID | Applied as |
|---|---|
| D1 | Marketplace roles `SELLER` / `SELLER_STAFF` seeded in `marketplace.role_permission`. The existing procurement `VENDOR` role has **no** marketplace permission (tested). Prisma `UserRole` enum NOT yet changed - done in Phase 2 with the vendor tables. |
| D2 | Kept Spring Boot 4.1.2. **Still Java 17**: only JDK 17 is installed here; moving to 21 is an environment step (install JDK 21, set `java.version`), not done. |
| D3 | Flyway owns schema `marketplace` only. |
| D4 | `Money` = whole paise (`long`), HALF_UP, exact allocation across parties. |

## Files created
- `backend-java/src/main/resources/db/marketplace/V1__foundation.sql`
- `.../marketplace/common/Money.java`, `PageResponse.java`
- `.../marketplace/iam/PermissionService.java`, `IamController.java`
- `.../marketplace/audit/AuditLogService.java`
- `.../marketplace/idempotency/IdempotencyService.java`
- `.../marketplace/outbox/OutboxService.java`
- `.../marketplace/MarketplaceConfig.java`
- Tests: `MoneyTest`, `PageResponseTest`, `MarketplaceFoundationIntegrationTest`, `MarketplaceDisabledByDefaultTest`

## Files modified
- `backend-java/pom.xml` - `spring-boot-starter-flyway`, `flyway-database-postgresql`, `springdoc-openapi-starter-webmvc-api:3.0.0`
- `backend-java/src/main/resources/application.properties` - `marketplace.enabled`, Flyway and springdoc settings
- `.../web/GlobalExceptionHandler.java` - `AccessDeniedException` -> 403 JSON, `@Valid` failures -> 400 `VALIDATION_FAILED`
- `backend-java/README.md` - marketplace section

## Database changes (schema `marketplace` only; `public` untouched)
`permission`, `role_permission` (22 permissions seeded), `audit_log` (append-only via trigger: UPDATE/DELETE/TRUNCATE rejected),
`idempotency_key`, `outbox_event`.

## APIs
- `GET /api/v1/me/permissions` - caller's role and permission codes
- `GET /api/v1/admin/rbac/roles` - requires `marketplace.rbac.view`
- `GET /api/v1/openapi` - OpenAPI JSON (authenticated)

## Tests
Real throwaway PostgreSQL, Flyway applied. Covers: migration applied and `public` has no Flyway tables; permission
code format constraint; seeded role->permission matrix; 401/200/403 behaviour; service-level guard; audit immutability and
commit/rollback with the audited action; outbox atomicity; idempotency (replay, key reuse 422, scopes, failure release,
concurrent duplicate 409 with single execution, expired-lease takeover, key validation); marketplace beans absent when disabled.

## Environment variables
`MARKETPLACE_ENABLED` (default false), `SWAGGER_ENABLED` (default false). Existing: `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `COOKIE_SECURE`.

## Known limitations
- Java 17, not 21 (see D2). Local tests use embedded PostgreSQL, not Testcontainers (no Docker installed).
- Permission cache is per-process (30 s TTL); fine for one instance.
- Outbox has no relay yet (first consumer arrives with payments/shipping). Idempotency expired-row cleanup job not yet written.
- `SELLER`/`SELLER_STAFF` cannot log in until Phase 2 adds them to Prisma's `UserRole`.
- Not verified: Flyway against a restored production dump, or the `prisma db push` interaction on a scratch DB (Phase 0 section 7, item 2).
- Nginx `/api/v1/` proxy and the web-to-JWT bridge (D8) not set up.
