package com.motoxplus.api.auth;

import com.motoxplus.api.common.PhoneUtil;
import java.util.Locale;

/** A login identifier: an Indian mobile number or an email (port of identity.ts). */
public record Identifier(Kind kind, String value) {
    public enum Kind { MOBILE, EMAIL }

    /** Single place that decides whether raw input is a mobile number or an email. */
    public static Identifier resolve(String raw) {
        String mobile = PhoneUtil.normalizeIndianMobile(raw);
        if (mobile != null) return new Identifier(Kind.MOBILE, mobile);
        return new Identifier(Kind.EMAIL, raw.trim().toLowerCase(Locale.ROOT));
    }

    public boolean isMobile() {
        return kind == Kind.MOBILE;
    }
}
