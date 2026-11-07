package com.motoxplus.api.notify.otp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

/**
 * Chooses the mobile OTP channel from SMS_PROVIDER, exactly like src/lib/sms/index.ts: "whatsapp" or "msg91"
 * (default). Twilio and Fast2SMS exist in Node but are not configured anywhere, so they are not ported.
 *
 * Differs from Node on purpose: when the chosen provider has no credentials, Node reports success without
 * sending. Here the send fails ("not configured"), so nobody is told a code is on its way when it is not.
 * Only with {@code app.sms.log-unsent-otp=true} (local development) is the code written to the log instead.
 */
@Configuration
public class OtpSenders {
    private static final Logger log = LoggerFactory.getLogger(OtpSenders.class);

    static boolean isPlaceholder(String v) {
        return v == null || v.isBlank() || v.startsWith("your_") || v.contains("_here");
    }

    /** Normalises a 10-digit Indian mobile (or one already carrying +91) to E.164. */
    public static String toE164India(String mobile) {
        String m = mobile.replaceAll("\\s", "");
        return m.startsWith("+91") ? m : "+91" + m;
    }

    @Bean
    public OtpSender otpSender(
            @Value("${app.sms.provider:msg91}") String provider,
            @Value("${app.sms.log-unsent-otp:false}") boolean logUnsentOtp,
            @Value("${app.sms.whatsapp.access-token:}") String waToken,
            @Value("${app.sms.whatsapp.phone-number-id:}") String waPhoneId,
            @Value("${app.sms.whatsapp.template-name:login_otp}") String waTemplate,
            @Value("${app.sms.whatsapp.template-language:en}") String waLanguage,
            @Value("${app.sms.whatsapp.graph-base-url:https://graph.facebook.com/v25.0}") String waBaseUrl,
            @Value("${app.sms.msg91.auth-key:}") String msg91Key,
            @Value("${app.sms.msg91.otp-template-id:}") String msg91Template,
            @Value("${app.sms.msg91.base-url:https://control.msg91.com}") String msg91BaseUrl,
            JsonMapper json) {
        OtpSender chosen = "whatsapp".equalsIgnoreCase(provider.trim())
                ? new WhatsAppOtpSender(waToken, waPhoneId, waTemplate, waLanguage, waBaseUrl, json)
                : new Msg91OtpSender(msg91Key, msg91Template, msg91BaseUrl, json);
        if (!chosen.isConfigured()) {
            log.warn("[OTP] SMS provider '{}' is not configured; mobile OTPs will not be delivered", chosen.name());
            if (logUnsentOtp) return new LoggingOtpSender(chosen.name());
        }
        return chosen;
    }

    /** Development stand-in: prints the code instead of sending it. Never enable in production. */
    static final class LoggingOtpSender implements OtpSender {
        private final String provider;

        LoggingOtpSender(String provider) { this.provider = provider; }

        @Override public String name() { return provider + "(log-only)"; }

        @Override public boolean isConfigured() { return false; }

        @Override public Result send(String e164Mobile, String code) {
            log.warn("[OTP] {} not configured - OTP for {}: {}", provider, e164Mobile, code);
            return Result.ok("dev-log");
        }
    }
}
