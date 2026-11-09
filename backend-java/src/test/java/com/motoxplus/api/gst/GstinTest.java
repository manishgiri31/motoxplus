package com.motoxplus.api.gst;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GstinTest {
    @Test
    void acceptsRealGstinsWithACorrectCheckDigit() {
        assertThat(Gstin.isWellFormed("27AAPFU0939F1ZV")).isTrue();
        assertThat(Gstin.isWellFormed("29AAGCB7383J1Z4")).isTrue();
    }

    @Test
    void rejectsPatternMatchesWithAWrongCheckDigit() {
        assertThat(Gstin.isWellFormed("27AAPFU0939F1ZW")).isFalse();
        assertThat(Gstin.isWellFormed("22AAAAA0000A1Z6")).isFalse();
    }

    @Test
    void rejectsBadStateCodesAndShapes() {
        String body = "AAPFU0939F1Z";
        assertThat(Gstin.isWellFormed("00" + body + Gstin.checkChar("00" + body))).isFalse();
        assertThat(Gstin.isWellFormed("45" + body + Gstin.checkChar("45" + body))).isFalse();
        assertThat(Gstin.isWellFormed("27aapfu0939f1zv")).isFalse();
        assertThat(Gstin.isWellFormed(null)).isFalse();
        assertThat(Gstin.normalize(" 27aapfu 0939f1zv ")).isEqualTo("27AAPFU0939F1ZV");
    }
}
