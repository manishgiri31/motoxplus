-- V3: vendor self-registration, onboarding and manual approval (docs/marketplace/VENDOR-ONBOARDING-PHASE-0.md).
--
-- Decision V1: there is ONE vendor concept, public."Vendor" + role VENDOR + /vendor/*. Nothing here creates a
-- second seller entity. Decision V2: approval is manual; this schema records what the vendor submitted, the
-- automated checks, and every admin decision (verification history = marketplace.audit_log rows for the vendor).
--
-- Additive only. The single change to "public" is one new enum value; no column, row or constraint is altered.

-- Address proof was missing from the document types ("business address proof, where required").
ALTER TYPE public."VendorDocumentType" ADD VALUE IF NOT EXISTS 'ADDRESS_PROOF';

-- ---------------------------------------------------------------------------
-- Onboarding state that public."Vendor" has no column for. The application STATE itself is derived (see
-- VendorApplicationState in code) from these timestamps, the user's verification flags and Vendor.status, so it
-- can never drift from the facts it describes.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.vendor_application (
    vendor_id           text PRIMARY KEY REFERENCES public."Vendor" (id) ON DELETE CASCADE,
    business_type       text CHECK (business_type IN ('MANUFACTURER', 'WHOLESALER', 'DISTRIBUTOR', 'STOCKIST', 'RETAILER', 'OTHER')),
    business_saved_at   timestamptz,
    categories_saved_at timestamptz,
    submitted_at        timestamptz,
    agreement_version   text,
    -- Last admin decision on this application (history lives in marketplace.audit_log).
    decision            text CHECK (decision IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')),
    decision_reason     text CHECK (decision_reason IS NULL OR length(decision_reason) <= 1000),
    decided_at          timestamptz,
    decided_by          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vendor_application_decision_complete CHECK (
        (decision IS NULL AND decided_at IS NULL) OR (decision IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE INDEX vendor_application_submitted ON marketplace.vendor_application (submitted_at DESC) WHERE submitted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Payout bank account. The number is AES-256-GCM encrypted with ENCRYPTION_KEY in the same "iv.tag.cipher"
-- base64 envelope as src/lib/crypto/encryption.ts, so either backend can read it. Only the last 4 digits are
-- ever returned to the vendor; admins reveal the full number through an audited endpoint.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.vendor_bank_account (
    vendor_id          text PRIMARY KEY REFERENCES public."Vendor" (id) ON DELETE CASCADE,
    account_holder     text NOT NULL CHECK (length(account_holder) BETWEEN 2 AND 120),
    bank_name          text NOT NULL CHECK (length(bank_name) BETWEEN 2 AND 100),
    ifsc               text NOT NULL CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    account_number_enc text NOT NULL,
    account_last4      text NOT NULL CHECK (account_last4 ~ '^[0-9]{4}$'),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- What the vendor agreed to, which version, when and from where. Append-only.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.vendor_agreement_acceptance (
    id          text PRIMARY KEY,
    vendor_id   text NOT NULL REFERENCES public."Vendor" (id) ON DELETE CASCADE,
    user_id     text NOT NULL,
    agreement   text NOT NULL CHECK (agreement IN ('TERMS', 'VENDOR_AGREEMENT', 'GENUINE_PRODUCTS', 'ACCURATE_INFORMATION')),
    version     text NOT NULL CHECK (length(version) BETWEEN 1 AND 64),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    ip          text,
    user_agent  text
);
CREATE INDEX vendor_agreement_by_vendor ON marketplace.vendor_agreement_acceptance (vendor_id, accepted_at DESC);
CREATE TRIGGER vendor_agreement_no_update_delete
    BEFORE UPDATE OR DELETE ON marketplace.vendor_agreement_acceptance
    FOR EACH ROW EXECUTE FUNCTION marketplace.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Permissions. Decision V1 replaces the SELLER / SELLER_STAFF roles planned in V2 with the existing VENDOR role.
-- Approval is still enforced separately in code (Vendor.status = APPROVED); a role grant is not activation.
-- ---------------------------------------------------------------------------
INSERT INTO marketplace.role_permission (role, permission_code)
SELECT 'VENDOR', permission_code FROM marketplace.role_permission WHERE role = 'SELLER'
ON CONFLICT DO NOTHING;
DELETE FROM marketplace.role_permission WHERE role IN ('SELLER', 'SELLER_STAFF');
-- Reviewing applications: ADMIN / SUPER_ADMIN approve (marketplace.vendor.approve), SUPPORT may view (both seeded in V2).
