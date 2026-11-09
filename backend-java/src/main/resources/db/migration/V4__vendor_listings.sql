-- V4: vendor product listings (Phase 4, docs/marketplace/VENDOR-LISTINGS-PHASE-4.md).
--
-- A listing is the vendor's own record of something they sell: identity, the three prices (decision V5), stock,
-- photos (PRIVATE bucket) and seller-reported fitment. It is the source of truth. While a listing is LIVE and its
-- vendor is APPROVED, the Java API projects it onto one public."Product" row (source = 'VENDOR') so the existing
-- storefront and search show it without any change to them. Nothing in this file alters an existing table, column,
-- row or index.
--
-- Money is whole paise in bigint (PHASE-0-AUDIT §6); commission is basis points (1500 = 15%).

-- ---------------------------------------------------------------------------
-- Commission rules. CONFIGURATION ONLY: nothing in this phase takes, holds, refunds or pays out money. Settlement and
-- payouts (Phase 6-7) must apply these rules. Effective-dated and append-only: a change is a new row, so the rules that
-- applied to a past order can always be recovered. The rules in force are the row with the latest effective_from <= now().
--
--   Sale            MotoXPlus takes sale_commission_bp of the sale, only once the order is delivered end to end AND the
--                   customer's payment is complete (settles_on). Nothing is taken on a cancelled order.
--   100% prepaid    After delivery the commission is deducted and the rest goes to the vendor.
--   Advance + COD   The customer pays cod_advance_bp up front. It shows in the vendor's virtual balance, locked until the
--                   order is delivered and paid. COD completed: the vendor gets the sale minus the commission (85%),
--                   MotoXPlus the commission (15%). Cancelled: the advance goes straight to MotoXPlus (cod_advance_on_cancel).
--   Returns         The vendor pays nothing. MotoXPlus keeps return_deduction_bp of the order value, prepaid and COD alike,
--                   and the rest goes back to the customer. Delhivery's return charges are paid out of the part MotoXPlus
--                   keeps (return_shipping_paid_from).
--
-- The text rules list only the behaviour settlement is built for; add a value together with the code that handles it.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.commission_rate (
    id                        text PRIMARY KEY,
    sale_commission_bp        integer NOT NULL CHECK (sale_commission_bp BETWEEN 0 AND 10000),
    settles_on                text    NOT NULL CHECK (settles_on IN ('DELIVERED_AND_PAID')),
    cod_advance_bp            integer NOT NULL CHECK (cod_advance_bp BETWEEN 0 AND 10000),
    cod_advance_on_cancel     text    NOT NULL CHECK (cod_advance_on_cancel IN ('TO_MOTOXPLUS')),
    -- Taken from the customer's refund; never charged to the vendor.
    return_deduction_bp       integer NOT NULL CHECK (return_deduction_bp BETWEEN 0 AND 10000),
    return_shipping_paid_from text    NOT NULL CHECK (return_shipping_paid_from IN ('RETURN_DEDUCTION')),
    effective_from            timestamptz NOT NULL UNIQUE,
    note                      text CHECK (note IS NULL OR length(note) <= 500),
    created_at                timestamptz NOT NULL DEFAULT now(),
    created_by                text
);
CREATE TRIGGER commission_rate_no_update_delete
    BEFORE UPDATE OR DELETE ON marketplace.commission_rate
    FOR EACH ROW EXECUTE FUNCTION marketplace.forbid_mutation();

INSERT INTO marketplace.commission_rate (id, sale_commission_bp, settles_on, cod_advance_bp, cod_advance_on_cancel,
                                         return_deduction_bp, return_shipping_paid_from, effective_from, note) VALUES
    ('commission-launch', 1500, 'DELIVERED_AND_PAID', 2000, 'TO_MOTOXPLUS', 2000, 'RETURN_DEDUCTION', '2026-01-01T00:00:00Z',
     'Launch rules: 15% commission once delivered and paid; 20% COD advance (to MotoXPlus if cancelled); '
     || '20% kept on a return, Delhivery return charges paid from it; vendor pays nothing on returns.');

-- ---------------------------------------------------------------------------
-- Listings. Drafts may be incomplete; the LIVE check below is the database's own guarantee that nothing incomplete
-- is ever live (photos are counted in code, they live in their own table).
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.vendor_listing (
    id                 text PRIMARY KEY,
    vendor_id          text NOT NULL REFERENCES public."Vendor" (id) ON DELETE RESTRICT,
    -- Set on first publish; the storefront row this listing drives. Kept when unpublished so the URL survives.
    product_id         text UNIQUE REFERENCES public."Product" (id) ON DELETE RESTRICT,
    status             text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LIVE', 'UNPUBLISHED')),

    title              text NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
    description        text CHECK (description IS NULL OR length(description) <= 5000),
    brand              text CHECK (brand IS NULL OR length(brand) BETWEEN 1 AND 80),
    category_id        text REFERENCES public."Category" (id) ON DELETE RESTRICT,
    part_number        text CHECK (part_number IS NULL OR length(part_number) BETWEEN 2 AND 60),
    sku                text CHECK (sku IS NULL OR length(sku) BETWEEN 1 AND 60),
    hsn_code           text CHECK (hsn_code IS NULL OR hsn_code ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$'),
    gst_rate           numeric(5, 2) NOT NULL DEFAULT 18 CHECK (gst_rate BETWEEN 0 AND 40),
    moq                integer NOT NULL DEFAULT 1 CHECK (moq BETWEEN 1 AND 10000),
    warranty           text CHECK (warranty IS NULL OR length(warranty) <= 80),
    country_of_origin  text NOT NULL DEFAULT 'India' CHECK (length(country_of_origin) BETWEEN 2 AND 60),
    weight_grams       integer CHECK (weight_grams IS NULL OR weight_grams BETWEEN 1 AND 100000),

    -- Pricing: set by the vendor. MRP >= retail >= dealer > 0 whenever the prices involved are present.
    mrp_paise          bigint CHECK (mrp_paise IS NULL OR mrp_paise > 0),
    retail_price_paise bigint CHECK (retail_price_paise IS NULL OR retail_price_paise > 0),
    dealer_price_paise bigint CHECK (dealer_price_paise IS NULL OR dealer_price_paise > 0),

    -- Counted stock (units on hand, as declared by the vendor).
    stock_quantity     integer CHECK (stock_quantity IS NULL OR stock_quantity BETWEEN 0 AND 1000000),

    first_published_at timestamptz,
    published_at       timestamptz,
    unpublished_at     timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    created_by         text NOT NULL,
    updated_by         text NOT NULL,

    CONSTRAINT vendor_listing_sku_per_vendor UNIQUE (vendor_id, sku),
    CONSTRAINT vendor_listing_mrp_ge_retail CHECK (mrp_paise IS NULL OR retail_price_paise IS NULL OR mrp_paise >= retail_price_paise),
    CONSTRAINT vendor_listing_retail_ge_dealer CHECK (retail_price_paise IS NULL OR dealer_price_paise IS NULL OR retail_price_paise >= dealer_price_paise),
    CONSTRAINT vendor_listing_mrp_ge_dealer CHECK (mrp_paise IS NULL OR dealer_price_paise IS NULL OR mrp_paise >= dealer_price_paise),
    CONSTRAINT vendor_listing_live_is_complete CHECK (status <> 'LIVE' OR (
        product_id IS NOT NULL AND brand IS NOT NULL AND category_id IS NOT NULL AND part_number IS NOT NULL
        AND sku IS NOT NULL AND hsn_code IS NOT NULL AND mrp_paise IS NOT NULL AND retail_price_paise IS NOT NULL
        AND dealer_price_paise IS NOT NULL AND stock_quantity >= 1 AND published_at IS NOT NULL))
);
-- The vendor's own listing screen: newest first, per vendor.
CREATE INDEX vendor_listing_by_vendor ON marketplace.vendor_listing (vendor_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Photos, in the PRIVATE bucket. stored_url is always r2-private://<key>; the bytes are only ever served by the
-- Java API (to the owner, or to anyone once the listing is live). sort_order 0 is the primary photo.
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.vendor_listing_image (
    id          text PRIMARY KEY,
    listing_id  text    NOT NULL REFERENCES marketplace.vendor_listing (id) ON DELETE CASCADE,
    object_key  text    NOT NULL UNIQUE,
    stored_url  text    NOT NULL CHECK (stored_url LIKE 'r2-private://%'),
    mime_type   text    NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes  integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
    sha256      text    NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    file_name   text    NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
    sort_order  integer NOT NULL CHECK (sort_order >= 0),
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  text    NOT NULL
);
CREATE INDEX vendor_listing_image_by_listing ON marketplace.vendor_listing_image (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- Seller-reported fitment. Projected to public."ProductCompatibility" as confidence UNVERIFIED / source IMPORTED,
-- never as confirmed compatibility (rule: never publish unverified fitment as confirmed).
-- ---------------------------------------------------------------------------
CREATE TABLE marketplace.vendor_listing_fitment (
    listing_id text     NOT NULL REFERENCES marketplace.vendor_listing (id) ON DELETE CASCADE,
    vehicle_id text     NOT NULL REFERENCES public."Vehicle" (id) ON DELETE CASCADE,
    year_from  smallint CHECK (year_from IS NULL OR year_from BETWEEN 1950 AND 2100),
    year_to    smallint CHECK (year_to IS NULL OR year_to BETWEEN 1950 AND 2100),
    PRIMARY KEY (listing_id, vehicle_id),
    CHECK (year_from IS NULL OR year_to IS NULL OR year_from <= year_to)
);
