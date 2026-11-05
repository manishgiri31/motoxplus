package com.motoxplus.api.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PhoneUtilTest {
    @Test
    void acceptsEveryCommonWayOfTypingTheSameNumber() {
        assertThat(PhoneUtil.normalizeIndianMobile("9876543210")).isEqualTo("9876543210");
        assertThat(PhoneUtil.normalizeIndianMobile("+91 98765 43210")).isEqualTo("9876543210");
        assertThat(PhoneUtil.normalizeIndianMobile("919876543210")).isEqualTo("9876543210");
        assertThat(PhoneUtil.normalizeIndianMobile("09876543210")).isEqualTo("9876543210");
        assertThat(PhoneUtil.normalizeIndianMobile(" 98765-43210 ")).isEqualTo("9876543210");
    }

    @Test
    void rejectsNonMobileInput() {
        assertThat(PhoneUtil.normalizeIndianMobile("1234567890")).isNull(); // must start 6-9
        assertThat(PhoneUtil.normalizeIndianMobile("98765")).isNull();
        assertThat(PhoneUtil.normalizeIndianMobile("dealer@motoxplus.com")).isNull();
        assertThat(PhoneUtil.normalizeIndianMobile("")).isNull();
        assertThat(PhoneUtil.normalizeIndianMobile(null)).isNull();
    }
}
