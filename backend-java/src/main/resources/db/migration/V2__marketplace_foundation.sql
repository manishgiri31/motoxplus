-- Marketplace foundation (V2). Everything lives in schema "marketplace" and is fully qualified; nothing here touches "public".
-- Timestamps are timestamptz (the legacy Prisma tables use zone-less UTC; new tables are zone-aware).
-- No FK to "public"."User" yet: actors are stored as plain text ids; vendor tables (next phase) add real FKs.
CREATE SCHEMA IF NOT EXISTS marketplace;

-- ---------------------------------------------------------------------------
-- Database-driven RBAC: role -> permission. Roles are the strings carried in the JWT (User.role).
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.permission (
    code        text PRIMARY KEY CHECK (code ~ '^[a-z]+(\.[a-z_]+)+$'),
    description text NOT NULL
);

CREATE TABLE marketplace.role_permission (
    role            text NOT NULL,
    permission_code text NOT NULL REFERENCES marketplace.permission (code) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (role, permission_code)
);
CREATE INDEX role_permission_by_permission ON marketplace.role_permission (permission_code);

-- ---------------------------------------------------------------------------
-- Audit log: append-only (see trigger below).
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.audit_log (
    id            text PRIMARY KEY,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    actor_user_id text,
    actor_role    text,
    action        text NOT NULL,
    entity_type   text NOT NULL,
    entity_id     text,
    vendor_id     text,
    ip            text,
    details       jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_entity ON marketplace.audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_log_actor ON marketplace.audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX audit_log_vendor ON marketplace.audit_log (vendor_id, occurred_at DESC) WHERE vendor_id IS NOT NULL;

CREATE FUNCTION marketplace.forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% on marketplace.% is not allowed: table is append-only', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_log_no_update_delete
    BEFORE UPDATE OR DELETE ON marketplace.audit_log
    FOR EACH ROW EXECUTE FUNCTION marketplace.forbid_mutation();
CREATE TRIGGER audit_log_no_truncate
    BEFORE TRUNCATE ON marketplace.audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Idempotency keys for checkout / payment / shipping-event style operations.
-- A row is claimed (IN_PROGRESS) before the work runs and completed with the stored response afterwards.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.idempotency_key (
    scope           text        NOT NULL,
    idem_key        text        NOT NULL CHECK (length(idem_key) BETWEEN 8 AND 200),
    request_hash    text        NOT NULL,
    status          text        NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
    response_status integer,
    response_body   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    expires_at      timestamptz NOT NULL,
    PRIMARY KEY (scope, idem_key),
    CHECK ((status = 'COMPLETED') = (response_status IS NOT NULL))
);
CREATE INDEX idempotency_key_expiry ON marketplace.idempotency_key (expires_at);

-- ---------------------------------------------------------------------------
-- Transactional outbox: written in the same transaction as the state change; a relay (later phase)
-- delivers events so a crash never loses "payment captured" / "shipment event" style facts.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.outbox_event (
    id             text PRIMARY KEY,
    created_at     timestamptz NOT NULL DEFAULT now(),
    aggregate_type text        NOT NULL,
    aggregate_id   text        NOT NULL,
    event_type     text        NOT NULL,
    payload        jsonb       NOT NULL,
    attempts       integer     NOT NULL DEFAULT 0,
    processed_at   timestamptz
);
CREATE INDEX outbox_event_pending ON marketplace.outbox_event (created_at) WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Seed permissions. Roles that are NOT listed get nothing: in particular the existing procurement
-- "VENDOR" role (a supplier MotoXPlus buys from) has no marketplace permission at all.
-- SELLER / SELLER_STAFF are the marketplace roles (decision D1); the matching Prisma UserRole enum
-- values are added in Phase 2 together with the vendor tables.
-- ---------------------------------------------------------------------------
INSERT INTO marketplace.permission (code, description) VALUES
    ('vendor.profile.view',            'View own vendor profile and verification status'),
    ('vendor.profile.update',          'Update own vendor profile'),
    ('vendor.product.view',            'View own product listings'),
    ('vendor.product.create',          'Create product listings'),
    ('vendor.product.update',          'Edit own product listings'),
    ('vendor.inventory.update',        'Adjust own inventory'),
    ('vendor.order.view',              'View own vendor orders'),
    ('vendor.order.manage',            'Accept, reject and prepare own vendor orders'),
    ('vendor.settlement.view',         'View own settlements and financial reports'),
    ('vendor.analytics.view',          'View own analytics'),
    ('vendor.staff.manage',            'Manage own vendor staff accounts'),
    ('marketplace.vendor.view',        'View all vendors'),
    ('marketplace.vendor.approve',     'Approve, reject, suspend and reactivate vendors'),
    ('marketplace.product.approve',    'Approve, reject and suspend product listings'),
    ('marketplace.order.manage',       'View and manage all marketplace orders, returns and disputes'),
    ('marketplace.shipment.manage',    'Select couriers, create shipments and schedule pickups'),
    ('marketplace.commission.manage',  'Configure commission rules'),
    ('marketplace.settlement.approve', 'Approve vendor settlements'),
    ('marketplace.refund.process',     'Process refunds'),
    ('marketplace.settings.manage',    'Manage platform marketplace settings'),
    ('marketplace.audit.view',         'View the marketplace audit log'),
    ('marketplace.rbac.view',          'View roles and permissions');

-- Administrators: every marketplace.* permission (no hidden bypass in code; SUPER_ADMIN is explicit data too).
INSERT INTO marketplace.role_permission (role, permission_code)
SELECT r.role, p.code
FROM (VALUES ('SUPER_ADMIN'), ('ADMIN')) AS r(role)
CROSS JOIN marketplace.permission p
WHERE p.code LIKE 'marketplace.%';

INSERT INTO marketplace.role_permission (role, permission_code) VALUES
    ('ACCOUNTS', 'marketplace.settlement.approve'),
    ('ACCOUNTS', 'marketplace.commission.manage'),
    ('ACCOUNTS', 'marketplace.refund.process'),
    ('SUPPORT',  'marketplace.order.manage'),
    ('SUPPORT',  'marketplace.vendor.view'),
    ('DISPATCH', 'marketplace.shipment.manage'),
    ('DISPATCH', 'marketplace.order.manage'),
    ('SELLER', 'vendor.profile.view'),
    ('SELLER', 'vendor.profile.update'),
    ('SELLER', 'vendor.product.view'),
    ('SELLER', 'vendor.product.create'),
    ('SELLER', 'vendor.product.update'),
    ('SELLER', 'vendor.inventory.update'),
    ('SELLER', 'vendor.order.view'),
    ('SELLER', 'vendor.order.manage'),
    ('SELLER', 'vendor.settlement.view'),
    ('SELLER', 'vendor.analytics.view'),
    ('SELLER', 'vendor.staff.manage'),
    ('SELLER_STAFF', 'vendor.profile.view'),
    ('SELLER_STAFF', 'vendor.product.view'),
    ('SELLER_STAFF', 'vendor.inventory.update'),
    ('SELLER_STAFF', 'vendor.order.view'),
    ('SELLER_STAFF', 'vendor.order.manage');
