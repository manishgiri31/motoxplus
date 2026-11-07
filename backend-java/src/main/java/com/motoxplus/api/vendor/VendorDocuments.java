package com.motoxplus.api.vendor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Which KYC documents a vendor uploads (public."VendorDocumentType"), and which are mandatory. */
public final class VendorDocuments {
    private VendorDocuments() {}

    public static final String PAN = "PAN_CARD";
    public static final String GST = "GST_CERTIFICATE";
    public static final String BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION";
    public static final String BANK_PROOF = "CANCELLED_CHEQUE";
    public static final String ADDRESS_PROOF = "ADDRESS_PROOF";

    /** Types a vendor may upload during onboarding, with their labels (BANK_STATEMENT/OTHER stay admin-only). */
    public static final Map<String, String> LABELS = Map.of(
            PAN, "PAN card",
            GST, "GST certificate",
            BUSINESS_REGISTRATION, "Business registration proof",
            BANK_PROOF, "Cancelled cheque or bank proof",
            ADDRESS_PROOF, "Business address proof");

    public static final List<String> ORDER = List.of(PAN, GST, BUSINESS_REGISTRATION, BANK_PROOF, ADDRESS_PROOF);

    public static final long MAX_BYTES = 5L * 1024 * 1024;

    /** PAN and bank proof always; the GST certificate whenever a GSTIN was given. Aadhaar is never asked for. */
    public static List<String> required(boolean hasGstin) {
        List<String> r = new ArrayList<>(List.of(PAN, BANK_PROOF));
        if (hasGstin) r.add(1, GST);
        return r;
    }

    public static boolean uploadable(String type) { return LABELS.containsKey(type); }
}
