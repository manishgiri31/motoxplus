package com.motoxplus.api.vendor.warehouse;

import com.motoxplus.api.common.IndianStates;
import com.motoxplus.api.common.PhoneUtil;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.delhivery.DelhiveryClient;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.marketplace.iam.PermissionService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A vendor's Delhivery pickup warehouse: submit details, provision on Delhivery, retry.
 *
 * <pre>
 * submit:  validate -> PIN serviceable for pickup? -> name VND-code-PIN free in our DB? -> row PENDING (the claim)
 *          -> Delhivery create -> ACTIVE (name saved) | FAILED (lastError, lastErrorCode)
 * retry:   claim FAILED/abandoned row -> same name, same details -> Delhivery create -> ACTIVE | FAILED
 * </pre>
 *
 * <p>Idempotency: one row per vendor (unique vendorId), the name is reserved before Delhivery sees it (unique
 * delhiveryName), and an attempt is a conditional UPDATE that only one caller can win. A retry re-sends the same name,
 * and Delhivery's exact "already exists" answer means an earlier attempt of ours succeeded, so the row goes ACTIVE.
 *
 * <p>The Delhivery call is made outside any database transaction, so no lock is held while waiting on the network.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class WarehouseService {
    static final String MANAGE = "vendor.warehouse.manage";
    private static final Logger log = LoggerFactory.getLogger(WarehouseService.class);
    private static final Pattern PIN = Pattern.compile("^[1-9][0-9]{5}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    private final WarehouseRepository warehouses;
    private final DelhiveryClient delhivery;
    private final VendorContext vendors;
    private final PermissionService perms;
    private final AuditLogService audit;
    private final TransactionTemplate tx;

    public WarehouseService(WarehouseRepository warehouses, DelhiveryClient delhivery, VendorContext vendors,
                            PermissionService perms, AuditLogService audit, TransactionTemplate tx) {
        this.warehouses = warehouses;
        this.delhivery = delhivery;
        this.vendors = vendors;
        this.perms = perms;
        this.audit = audit;
        this.tx = tx;
    }

    private VendorSnapshot vendor(AuthenticatedUser user) {
        VendorSnapshot v = vendors.active(user);
        perms.require(user, MANAGE);
        return v;
    }

    // ------------------------------------------------------------------ read

    public Map<String, Object> get(AuthenticatedUser user) {
        VendorSnapshot v = vendor(user);
        return view(v, warehouses.byVendor(v.vendorId()).orElse(null));
    }

    // ------------------------------------------------------------------ submit

    public Map<String, Object> submit(AuthenticatedUser user, WarehouseInput in, String ip) {
        VendorSnapshot v = vendor(user);
        Warehouse.Details d = clean(in);
        Optional<Warehouse> existing = warehouses.byVendor(v.vendorId());
        existing.ifPresent(w -> {
            if (w.active()) {
                throw new ApiException(HttpStatus.CONFLICT, "Your pickup warehouse is already set up. Contact MotoXPlus to change it",
                        "WAREHOUSE_ACTIVE", null);
            }
            if (!w.editable()) {
                throw new ApiException(HttpStatus.CONFLICT, w.retryable(Time.utcNow())
                        ? "Delhivery may already have this warehouse, so its details can't change now. Retry the setup instead"
                        : "Your warehouse is being set up. Check back in a minute", "WAREHOUSE_LOCKED", null);
            }
        });

        String name = WarehouseNames.forVendor(v.vendorCode(), d.pin());
        String tooLong = WarehouseNames.lengthProblem(name, delhivery.spec().nameMaxLength());
        if (tooLong != null) throw FieldErrorsException.invalid("pin", tooLong);

        checkPickupServiceable(d.pin());

        String exceptId = existing.map(Warehouse::id).orElse(null);
        if (warehouses.nameTaken(name, exceptId)) throw nameTaken(name);

        String gstin = v.hasGstin() ? v.business().gstin() : null;
        String id;
        try {
            id = tx.execute(s -> {
                String rowId;
                if (existing.isEmpty()) {
                    rowId = warehouses.insertPending(v.vendorId(), name, d, gstin);
                } else {
                    rowId = existing.get().id();
                    if (!warehouses.replaceAndClaim(rowId, name, d, gstin)) throw inProgress();
                }
                Map<String, Object> details = new LinkedHashMap<>();
                details.put("delhiveryName", name);
                details.put("pin", d.pin());
                details.put("replaced", existing.isPresent());
                audit.record(user, "vendor.warehouse.submitted", "warehouse", rowId, v.vendorId(), ip, details);
                return rowId;
            });
        } catch (DuplicateKeyException e) {
            // Lost a race: either this vendor's row was just created by a parallel submit, or the name is now held.
            if (warehouses.byVendor(v.vendorId()).isPresent() && existing.isEmpty()) throw inProgress();
            throw nameTaken(name);
        }
        return view(v, provision(user, v, id, ip));
    }

    // ------------------------------------------------------------------ retry

    public Map<String, Object> retry(AuthenticatedUser user, String ip) {
        VendorSnapshot v = vendor(user);
        Warehouse w = warehouses.byVendor(v.vendorId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Add your pickup warehouse first", "NO_WAREHOUSE", null));
        if (w.active()) return view(v, w); // idempotent: nothing to do
        if (!warehouses.claimRetry(w.id())) throw inProgress();
        tx.executeWithoutResult(s -> audit.record(user, "vendor.warehouse.retried", "warehouse", w.id(), v.vendorId(), ip,
                Map.of("delhiveryName", w.delhiveryName(), "attempt", w.attempts() + 1)));
        return view(v, provision(user, v, w.id(), ip));
    }

    // ------------------------------------------------------------------ gate used by listings

    /** Throws unless the vendor's warehouse is ACTIVE. Products cannot go live (or be shipped) without one. */
    public static ApiException notActive(String status) {
        String msg = status == null
                ? "Add your pickup warehouse before publishing products"
                : "Your pickup warehouse isn't ready yet (" + status.toLowerCase() + "). Products can go live once it is active";
        return new ApiException(HttpStatus.CONFLICT, msg, "WAREHOUSE_NOT_ACTIVE", null);
    }

    // ------------------------------------------------------------------ internals

    /** One Delhivery attempt for a row this caller has claimed (status PENDING). */
    private Warehouse provision(AuthenticatedUser user, VendorSnapshot v, String id, String ip) {
        Warehouse w = warehouses.byId(id).orElseThrow();
        DelhiveryClient.CreateResult r;
        try {
            r = delhivery.createWarehouse(w.toRequest());
        } catch (RuntimeException e) {
            log.warn("[Warehouse] {} create threw {}", w.delhiveryName(), e.getClass().getSimpleName());
            r = new DelhiveryClient.CreateResult(DelhiveryClient.Outcome.UNCERTAIN, w.delhiveryName(),
                    "Unexpected error while calling Delhivery", null);
        }
        DelhiveryClient.CreateResult result = r;
        tx.executeWithoutResult(s -> {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("delhiveryName", result.name());
            details.put("outcome", result.outcome().name());
            if (result.httpStatus() != null) details.put("httpStatus", result.httpStatus());
            if (result.outcome().active()) {
                warehouses.markActive(id, result.name());
                audit.record(user, "vendor.warehouse.activated", "warehouse", id, v.vendorId(), ip, details);
            } else {
                warehouses.markFailed(id, result.outcome().name(), result.message());
                details.put("error", result.message());
                audit.record(user, "vendor.warehouse.failed", "warehouse", id, v.vendorId(), ip, details);
            }
        });
        return warehouses.byId(id).orElseThrow();
    }

    private void checkPickupServiceable(String pin) {
        Optional<DelhiveryClient.PinCapability> cap;
        try {
            cap = delhivery.pinCapability(pin);
        } catch (DelhiveryClient.UnavailableException e) {
            log.warn("[Warehouse] serviceability check for {} unavailable: {}", pin, e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "We couldn't check this PIN with Delhivery right now. Please try again in a few minutes",
                    "SERVICEABILITY_UNAVAILABLE", 60L);
        }
        if (cap.isEmpty()) throw FieldErrorsException.invalid("pin", "Delhivery doesn't serve this PIN code");
        if (!cap.get().pickup()) throw FieldErrorsException.invalid("pin", "Delhivery doesn't collect parcels from this PIN code");
    }

    static Warehouse.Details clean(WarehouseInput in) {
        WarehouseInput i = in != null ? in : new WarehouseInput(null, null, null, null, null, null, null, null, null, null, null);
        Map<String, String> e = new LinkedHashMap<>();
        String address = text(i.address(), "address", 5, 300, e);
        String pin = pin(i.pin(), "pin", e);
        String city = text(i.city(), "city", 2, 80, e);
        String state = state(i.state(), "state", e);
        String phone = PhoneUtil.normalizeIndianMobile(i.phone());
        if (phone == null) e.put("phone", "Enter a 10-digit Indian mobile number");
        String email = line(i.email()).toLowerCase();
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) e.put("email", "Enter a valid email address");

        boolean same = !Boolean.FALSE.equals(i.returnSameAsPickup());
        String rAddress = same ? address : text(i.returnAddress(), "returnAddress", 5, 300, e);
        String rPin = same ? pin : pin(i.returnPin(), "returnPin", e);
        String rCity = same ? city : text(i.returnCity(), "returnCity", 2, 80, e);
        String rState = same ? state : state(i.returnState(), "returnState", e);

        if (!e.isEmpty()) throw FieldErrorsException.invalid(e);
        return new Warehouse.Details(address, pin, city, state, phone, email, rAddress, rPin, rCity, rState);
    }

    private static String text(String v, String field, int min, int max, Map<String, String> e) {
        String s = line(v);
        if (s.length() < min) e.put(field, s.isEmpty() ? "Required" : "Too short");
        else if (s.length() > max) e.put(field, "Keep it under " + max + " characters");
        return s;
    }

    private static String pin(String v, String field, Map<String, String> e) {
        String s = line(v);
        if (!PIN.matcher(s).matches()) e.put(field, "Enter a 6-digit PIN code");
        return s;
    }

    private static String state(String v, String field, Map<String, String> e) {
        String s = line(v);
        if (!IndianStates.ALL.contains(s)) e.put(field, "Choose a state");
        return s;
    }

    private static String line(String s) {
        return s == null ? "" : s.strip().replaceAll("\\s+", " ");
    }

    private static ApiException inProgress() {
        return new ApiException(HttpStatus.CONFLICT, "Your warehouse is being set up. Check back in a minute", "WAREHOUSE_IN_PROGRESS", null);
    }

    private static ApiException nameTaken(String name) {
        return new ApiException(HttpStatus.CONFLICT, "Warehouse name " + name + " is already registered. Contact MotoXPlus support",
                "WAREHOUSE_NAME_TAKEN", null);
    }

    /** What the vendor's warehouse screen needs: the row (if any), what can be done next, and a prefill. */
    Map<String, Object> view(VendorSnapshot v, Warehouse w) {
        Map<String, Object> m = new LinkedHashMap<>();
        var now = Time.utcNow();
        if (w == null) {
            m.put("warehouse", null);
            m.put("canSubmit", true);
            m.put("canRetry", false);
        } else {
            Map<String, Object> wm = new LinkedHashMap<>();
            wm.put("status", w.status());
            wm.put("delhiveryName", w.delhiveryName());
            wm.put("details", w.details());
            wm.put("gstin", w.gstin());
            wm.put("lastError", w.lastError());
            wm.put("lastErrorCode", w.lastErrorCode());
            wm.put("attempts", w.attempts());
            wm.put("activatedAt", w.activatedAt() == null ? null : Time.iso(w.activatedAt()));
            wm.put("updatedAt", w.updatedAt() == null ? null : Time.iso(w.updatedAt()));
            m.put("warehouse", wm);
            m.put("canSubmit", w.editable());
            m.put("canRetry", w.retryable(now));
        }
        Map<String, Object> prefill = new LinkedHashMap<>();
        var b = v.business();
        prefill.put("address", b.address());
        prefill.put("pin", b.pincode());
        prefill.put("city", b.city());
        prefill.put("state", b.state());
        prefill.put("phone", PhoneUtil.normalizeIndianMobile(v.mobile()));
        prefill.put("email", v.email());
        m.put("prefill", prefill);
        m.put("vendorCode", v.vendorCode());
        m.put("states", IndianStates.ALL);
        return m;
    }
}
