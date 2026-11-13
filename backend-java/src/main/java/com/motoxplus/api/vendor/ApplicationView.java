package com.motoxplus.api.vendor;

import com.motoxplus.api.common.Time;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** JSON shape of an application, shared by the vendor's own screens and the admin review screen. */
public final class ApplicationView {
    private ApplicationView() {}

    public static Map<String, Object> of(VendorSnapshot v) {
        ApplicationState state = v.state();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vendorId", v.vendorId());
        m.put("vendorCode", v.vendorCode());
        m.put("state", state.name());
        m.put("editable", v.profileEditable());
        m.put("profileComplete", !v.profilePending());

        Map<String, Object> account = new LinkedHashMap<>();
        account.put("fullName", v.fullName());
        account.put("email", v.email());
        account.put("mobile", v.mobile());
        account.put("emailVerified", v.emailVerified());
        account.put("mobileVerified", v.mobileVerified());
        m.put("account", account);

        var b = v.business();
        Map<String, Object> business = new LinkedHashMap<>();
        business.put("businessName", b.businessName());
        business.put("businessType", b.businessType());
        business.put("pan", b.pan());
        business.put("gstin", b.gstin());
        business.put("address", b.address());
        business.put("state", b.state());
        business.put("city", b.city());
        business.put("pincode", b.pincode());
        m.put("business", v.businessComplete() ? business : null);

        m.put("categories", v.categoriesComplete()
                ? Map.of("categoryIds", v.categoryIds(), "vehicleSegments", v.vehicleSegments())
                : null);

        if (v.bank() == null) {
            m.put("bank", null);
        } else {
            Map<String, Object> bank = new LinkedHashMap<>();
            bank.put("accountHolder", v.bank().accountHolder());
            bank.put("bankName", v.bank().bankName());
            bank.put("ifsc", v.bank().ifsc());
            bank.put("accountNumberLast4", v.bank().last4());
            m.put("bank", bank);
        }

        List<Map<String, Object>> docs = new ArrayList<>();
        for (var d : v.documents()) {
            Map<String, Object> dm = new LinkedHashMap<>();
            dm.put("id", d.id());
            dm.put("documentType", d.documentType());
            dm.put("label", VendorDocuments.LABELS.getOrDefault(d.documentType(), d.documentType()));
            dm.put("fileName", d.fileName());
            dm.put("fileSize", d.fileSize());
            dm.put("uploadedAt", Time.iso(d.uploadedAt()));
            docs.add(dm);
        }
        m.put("documents", docs);
        m.put("requiredDocuments", VendorDocuments.required(v.hasGstin()));
        m.put("missingDocuments", v.missingDocuments());

        boolean submitted = v.application().submittedAt() != null || (state == ApplicationState.ACTIVE && !v.profilePending());
        m.put("steps", List.of(
                step("account", true),
                step("email", v.emailVerified()),
                step("mobile", v.mobileVerified()),
                step("business", v.businessComplete()),
                step("categories", v.categoriesComplete()),
                step("bank", v.bankComplete()),
                step("documents", v.missingDocuments().isEmpty()),
                step("review", submitted)));

        m.put("submittedAt", iso(v.application().submittedAt()));
        m.put("agreementVersion", v.application().agreementVersion());
        if (v.application().decision() == null) {
            m.put("decision", null);
        } else {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("decision", v.application().decision());
            d.put("reason", v.application().decisionReason());
            d.put("decidedAt", iso(v.application().decidedAt()));
            m.put("decision", d);
        }
        m.put("createdAt", Time.iso(v.createdAt()));
        return m;
    }

    private static Map<String, Object> step(String id, boolean done) {
        return Map.of("id", id, "done", done);
    }

    public static String iso(OffsetDateTime t) {
        return t == null ? null : Time.iso(t.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
    }
}
