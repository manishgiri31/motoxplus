package com.motoxplus.api.vendor.warehouse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class WarehouseNamesTest {
    @Test
    void isVndCodePinInUppercaseWithOnlyLettersDigitsAndHyphens() {
        assertThat(WarehouseNames.forVendor("VND12345678", "110020")).isEqualTo("VND-VND12345678-110020");
        assertThat(WarehouseNames.forVendor("vnd_12.34 56", "110020")).isEqualTo("VND-VND123456-110020");
        assertThat(WarehouseNames.forVendor("VND--12", "560001")).isEqualTo("VND-VND-12-560001");
    }

    @Test
    void refusesInputsThatCannotMakeAValidName() {
        assertThatThrownBy(() -> WarehouseNames.forVendor("", "110020")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> WarehouseNames.forVendor("VND1", "11002")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> WarehouseNames.forVendor("@@@", "110020")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void checksLengthOnlyAgainstAConfirmedLimit() {
        String name = "VND-VND12345678-110020"; // 22 characters
        assertThat(WarehouseNames.lengthProblem(name, 22)).isNull();
        assertThat(WarehouseNames.lengthProblem(name, 21)).contains("22 characters", "allows 21");
        assertThat(WarehouseNames.lengthProblem(name, 0)).isNull(); // unconfirmed: the client refuses to send instead
    }
}
