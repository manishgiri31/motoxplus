package com.motoxplus.api.notify.otp;

/** Delivers a one-time code to a mobile number (port of the SMSProvider.sendOTP contract in src/lib/sms). */
public interface OtpSender {
    /** Outcome of one send. {@code error} is safe to log and to show to the user; it never contains the code or a credential. */
    record Result(boolean delivered, String messageId, String error) {
        public static Result ok(String messageId) { return new Result(true, messageId, null); }
        public static Result failed(String error) { return new Result(false, null, error); }
    }

    String name();

    boolean isConfigured();

    /** @param e164Mobile "+91XXXXXXXXXX" */
    Result send(String e164Mobile, String code);
}
