package com.motoxplus.api.vendor.listings;

import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.marketplace.commission.CommissionRates;
import com.motoxplus.api.marketplace.common.PageResponse;
import com.motoxplus.api.marketplace.iam.PermissionService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Vendor listings: create, edit, publish, unpublish.
 *
 * <p>Access is Phase 2's rule for selling features: the vendor is resolved from the login only
 * ({@link VendorContext#active}: role VENDOR, account APPROVED, contact details verified), plus the database
 * permission for the action. Every query is scoped to that vendor's id, so another vendor's listing answers 404.
 *
 * <p>Publishing has no review queue: a listing that passes {@link ListingRules#publishProblems} goes live at once and is
 * projected to the storefront ({@link ProductProjection}). Every create, edit, publish and unpublish is written to
 * marketplace.audit_log in the same transaction as the change.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ListingService {
    static final String VIEW = "vendor.product.view";
    static final String CREATE = "vendor.product.create";
    static final String UPDATE = "vendor.product.update";

    private final ListingRepository listings;
    private final ProductProjection projection;
    private final VendorContext vendors;
    private final PermissionService perms;
    private final CommissionRates commission;
    private final AuditLogService audit;
    private final TransactionTemplate tx;

    public ListingService(ListingRepository listings, ProductProjection projection, VendorContext vendors, PermissionService perms,
                          CommissionRates commission, AuditLogService audit, TransactionTemplate tx) {
        this.listings = listings;
        this.projection = projection;
        this.vendors = vendors;
        this.perms = perms;
        this.commission = commission;
        this.audit = audit;
        this.tx = tx;
    }

    /** The approved vendor making this request, holding {@code permission}. */
    VendorSnapshot vendor(AuthenticatedUser user, String permission) {
        VendorSnapshot v = vendors.active(user);
        perms.require(user, permission);
        return v;
    }

    // ------------------------------------------------------------------ reads

    /** Everything the listing screens need besides the listings: tab counts, categories, commission, limits. */
    public Map<String, Object> overview(AuthenticatedUser user) {
        VendorSnapshot v = vendor(user, VIEW);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("counts", listings.counts(v.vendorId()));
        m.put("categories", listings.listableCategories(v.vendorId()));
        m.put("commission", Map.of("saleCommissionBp", commission.current().saleCommissionBp()));
        m.put("gstRates", ListingRules.GST_RATES);
        m.put("limits", Map.of("maxImages", ListingRules.MAX_IMAGES, "maxImageBytes", ListingRules.MAX_IMAGE_BYTES,
                "maxFitment", ListingRules.MAX_FITMENT));
        return m;
    }

    public PageResponse<Map<String, Object>> list(AuthenticatedUser user, String status, String q, int page, int size) {
        VendorSnapshot v = vendor(user, VIEW);
        String s = parseStatus(status);
        String query = q == null || q.isBlank() ? null : ListingRules.line(q);
        if (query != null && query.length() > 100) query = query.substring(0, 100);
        PageResponse<ListingRepository.Summary> p = listings.page(v.vendorId(), s, query, page, size);
        return new PageResponse<>(p.items().stream().map(ListingView::summary).toList(), p.page(), p.size(), p.total(), p.totalPages());
    }

    public Map<String, Object> get(AuthenticatedUser user, String listingId) {
        VendorSnapshot v = vendor(user, VIEW);
        return ListingView.detail(owned(v, listingId));
    }

    public List<ListingRepository.VehicleOption> vehicles(AuthenticatedUser user, String q) {
        vendor(user, VIEW);
        String query = ListingRules.line(q);
        if (query.length() < 2) return List.of();
        return listings.searchVehicles(query.length() > 60 ? query.substring(0, 60) : query, 12);
    }

    // ------------------------------------------------------------------ writes

    public Map<String, Object> create(AuthenticatedUser user, ListingInput in, String ip) {
        VendorSnapshot v = vendor(user, CREATE);
        ListingRules.Cleaned c = ListingRules.clean(nonNull(in));
        Map<String, String> e = new LinkedHashMap<>(c.errors());
        checkReferences(v.vendorId(), c.draft(), null, e);
        if (!e.isEmpty()) throw FieldErrorsException.invalid(ListingRules.ordered(e));

        String id = tx.execute(s -> {
            String newId;
            try {
                newId = listings.insert(v.vendorId(), user.userId(), c.draft());
            } catch (DuplicateKeyException ex) {
                throw skuConflict();
            }
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("title", c.draft().title());
            details.put("fields", filledFields(c.draft()));
            audit.record(user, "vendor.listing.created", "listing", newId, v.vendorId(), ip, details);
            return newId;
        });
        return ListingView.detail(owned(v, id));
    }

    /**
     * Saves the vendor's edit. A draft may stay incomplete; a LIVE listing must still pass every publish rule, and the
     * storefront product is updated in the same transaction (so the edit is live as soon as it is saved).
     */
    public Map<String, Object> update(AuthenticatedUser user, String listingId, ListingInput in, String ip) {
        VendorSnapshot v = vendor(user, UPDATE);
        ListingRules.Cleaned c = ListingRules.clean(nonNull(in));
        Map<String, String> e = new LinkedHashMap<>(c.errors());
        checkReferences(v.vendorId(), c.draft(), listingId, e);

        tx.executeWithoutResult(s -> {
            Listing before = listings.lock(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
            if (before.live()) {
                ListingRules.publishProblems(c.draft(), before.images().size()).forEach(e::putIfAbsent);
            }
            if (!e.isEmpty()) {
                throw before.live()
                        ? new FieldErrorsException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                                "This listing is live, so every required detail must stay filled in", ListingRules.ordered(e))
                        : FieldErrorsException.invalid(ListingRules.ordered(e));
            }
            try {
                listings.update(listingId, user.userId(), c.draft());
            } catch (DuplicateKeyException ex) {
                throw skuConflict();
            }
            if (before.live()) {
                Listing after = listings.find(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
                projection.publish(after, v.vendorCode());
            }
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("changed", changedFields(before.draft(), c.draft()));
            details.put("live", before.live());
            Map<String, Object> prices = priceChanges(before.draft(), c.draft());
            if (!prices.isEmpty()) details.put("prices", prices);
            if (!Objects.equals(before.draft().stock(), c.draft().stock())) {
                details.put("stock", fromTo(before.draft().stock(), c.draft().stock()));
            }
            audit.record(user, "vendor.listing.updated", "listing", listingId, v.vendorId(), ip, details);
        });
        return ListingView.detail(owned(v, listingId));
    }

    /** Publish-on-valid: no review queue. Re-publishing an unpublished listing reuses its storefront product and URL. */
    public Map<String, Object> publish(AuthenticatedUser user, String listingId, String ip) {
        VendorSnapshot v = vendor(user, UPDATE);
        tx.executeWithoutResult(s -> {
            Listing l = listings.lock(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
            if (l.live()) return; // already live: nothing to do, nothing to audit

            Map<String, String> problems = new LinkedHashMap<>(ListingRules.publishProblems(l.draft(), l.images().size()));
            // The draft was valid when saved, but the catalogue can change underneath it.
            checkReferences(v.vendorId(), l.draft(), l.id(), problems);
            if (!problems.isEmpty()) {
                Map<String, String> ordered = ListingRules.ordered(problems);
                String msg = ordered.size() == 1 ? ordered.values().iterator().next()
                        : ordered.size() + " things to finish before this listing can go live";
                throw new FieldErrorsException(HttpStatus.BAD_REQUEST, "LISTING_INCOMPLETE", msg, ordered);
            }

            String productId = projection.publish(l, v.vendorCode());
            listings.markLive(l.id(), productId, user.userId());
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("productId", productId);
            details.put("firstPublish", l.firstPublishedAt() == null);
            details.put("mrp", ListingView.rupees(l.draft().mrpPaise()));
            details.put("retailPrice", ListingView.rupees(l.draft().retailPaise()));
            details.put("dealerPrice", ListingView.rupees(l.draft().dealerPaise()));
            details.put("stock", l.draft().stock());
            details.put("images", l.images().size());
            audit.record(user, "vendor.listing.published", "listing", l.id(), v.vendorId(), ip, details);
        });
        return ListingView.detail(owned(v, listingId));
    }

    public Map<String, Object> unpublish(AuthenticatedUser user, String listingId, String ip) {
        VendorSnapshot v = vendor(user, UPDATE);
        tx.executeWithoutResult(s -> {
            Listing l = listings.lock(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
            if (!l.live()) throw new ApiException(HttpStatus.CONFLICT, "Only a live listing can be unpublished", "NOT_LIVE", null);
            projection.hide(l.productId());
            listings.markUnpublished(l.id(), user.userId());
            audit.record(user, "vendor.listing.unpublished", "listing", l.id(), v.vendorId(), ip, Map.of("productId", l.productId()));
        });
        return ListingView.detail(owned(v, listingId));
    }

    // ------------------------------------------------------------------ helpers

    Listing owned(VendorSnapshot v, String listingId) {
        return listings.find(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Listing not found", "NOT_FOUND", null);
    }

    private static FieldErrorsException skuConflict() {
        return FieldErrorsException.conflict("sku", "You already use this SKU on another listing");
    }

    /** Checks that need the database: category allowed for this vendor, SKU free, vehicles still active. */
    private void checkReferences(String vendorId, ListingRules.Draft d, String listingId, Map<String, String> e) {
        if (d.categoryId() != null && !e.containsKey("categoryId") && !listings.categoryListable(vendorId, d.categoryId())) {
            e.put("categoryId", "Choose one of the categories approved for your account");
        }
        if (d.sku() != null && !e.containsKey("sku") && listings.skuTaken(vendorId, d.sku(), listingId)) {
            e.put("sku", "You already use this SKU on another listing");
        }
        if (!d.fitment().isEmpty() && !e.containsKey("fitment")) {
            Set<String> wanted = new HashSet<>();
            d.fitment().forEach(f -> wanted.add(f.vehicleId()));
            if (!listings.activeVehicles(wanted).containsAll(wanted)) {
                e.put("fitment", "Some of these vehicles are no longer available. Remove them and save again");
            }
        }
    }

    private static ListingInput nonNull(ListingInput in) {
        return in != null ? in : new ListingInput(null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null);
    }

    private static String parseStatus(String s) {
        if (s == null || s.isBlank() || s.equalsIgnoreCase("ALL")) return null;
        String u = s.trim().toUpperCase(Locale.ROOT);
        if (!Set.of(Listing.DRAFT, Listing.LIVE, Listing.UNPUBLISHED).contains(u)) throw FieldErrorsException.invalid("status", "Unknown status");
        return u;
    }

    static List<String> filledFields(ListingRules.Draft d) {
        return changedFields(new ListingRules.Draft(null, null, null, null, null, null, null, null, 0, null, null, null, null,
                null, null, null, List.of()), d);
    }

    static List<String> changedFields(ListingRules.Draft a, ListingRules.Draft b) {
        List<String> out = new ArrayList<>();
        diff(out, "title", a.title(), b.title());
        diff(out, "description", a.description(), b.description());
        diff(out, "brand", a.brand(), b.brand());
        diff(out, "categoryId", a.categoryId(), b.categoryId());
        diff(out, "partNumber", a.partNumber(), b.partNumber());
        diff(out, "sku", a.sku(), b.sku());
        diff(out, "hsnCode", a.hsnCode(), b.hsnCode());
        if (a.gstRate() == null ? b.gstRate() != null : b.gstRate() == null || a.gstRate().compareTo(b.gstRate()) != 0) out.add("gstRate");
        if (a.moq() != b.moq()) out.add("moq");
        diff(out, "stock", a.stock(), b.stock());
        diff(out, "warranty", a.warranty(), b.warranty());
        diff(out, "countryOfOrigin", a.countryOfOrigin(), b.countryOfOrigin());
        diff(out, "weightGrams", a.weightGrams(), b.weightGrams());
        diff(out, "mrp", a.mrpPaise(), b.mrpPaise());
        diff(out, "retailPrice", a.retailPaise(), b.retailPaise());
        diff(out, "dealerPrice", a.dealerPaise(), b.dealerPaise());
        if (!new HashSet<>(a.fitment()).equals(new HashSet<>(b.fitment()))) out.add("fitment");
        return out;
    }

    private static void diff(List<String> out, String field, Object a, Object b) {
        if (!Objects.equals(a, b)) out.add(field);
    }

    private static Map<String, Object> priceChanges(ListingRules.Draft a, ListingRules.Draft b) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (!Objects.equals(a.mrpPaise(), b.mrpPaise())) m.put("mrp", fromTo(ListingView.rupees(a.mrpPaise()), ListingView.rupees(b.mrpPaise())));
        if (!Objects.equals(a.retailPaise(), b.retailPaise())) {
            m.put("retailPrice", fromTo(ListingView.rupees(a.retailPaise()), ListingView.rupees(b.retailPaise())));
        }
        if (!Objects.equals(a.dealerPaise(), b.dealerPaise())) {
            m.put("dealerPrice", fromTo(ListingView.rupees(a.dealerPaise()), ListingView.rupees(b.dealerPaise())));
        }
        return m;
    }

    private static Map<String, Object> fromTo(Object from, Object to) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("from", from);
        m.put("to", to);
        return m;
    }
}
