package com.motoxplus.api.gst;

/** A GST registry lookup (a GSP / KYC provider in front of the GSTN taxpayer search). */
public interface GstinLookup {

    enum Outcome {
        /** Registered and currently active. */
        ACTIVE,
        /** Registered, but cancelled / suspended / otherwise not active. */
        INACTIVE,
        /** The registry has no such GSTIN. */
        NOT_FOUND,
        /** No definite answer (provider not configured, down, timed out, auth failure, unexpected reply). */
        UNAVAILABLE
    }

    record Result(Outcome outcome, String legalName, String tradeName, String registrationStatus,
                  String principalAddress) {
        public static Result unavailable() { return new Result(Outcome.UNAVAILABLE, null, null, null, null); }
        public static Result notFound() { return new Result(Outcome.NOT_FOUND, null, null, null, null); }
    }

    String name();

    boolean isConfigured();

    /** Never throws; any failure is {@link Outcome#UNAVAILABLE}. */
    Result lookup(String gstin);
}
