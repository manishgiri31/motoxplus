package com.motoxplus.api.marketplace.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

class MoneyTest {

    @Test
    void convertsLegacyFloatRupeesToExactPaise() {
        assertThat(Money.fromRupees(180.0).paise()).isEqualTo(18_000);
        assertThat(Money.fromRupees(0.1 + 0.2).paise()).isEqualTo(30);      // 0.30000000000000004
        assertThat(Money.fromRupees(1.005).paise()).isEqualTo(101);          // HALF_UP on the decimal text
        assertThat(Money.fromRupees(-2.5).paise()).isEqualTo(-250);
        assertThatThrownBy(() -> Money.fromRupees(Double.NaN)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.fromRupees(Double.POSITIVE_INFINITY)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void commissionOfEightPercentOnOneThousandRupeesIsEighty() {
        assertThat(Money.fromRupees(1000).percentBp(800)).isEqualTo(Money.fromRupees(80));
    }

    @Test
    void percentRoundsHalfUpToAPaisa() {
        assertThat(Money.ofPaise(6).percentBp(800).paise()).isZero();   // 0.48 paise
        assertThat(Money.ofPaise(7).percentBp(800).paise()).isEqualTo(1); // 0.56 paise
        assertThat(Money.ofPaise(125).percentBp(400).paise()).isEqualTo(5); // exactly 5.0
        assertThat(Money.ofPaise(1).percentBp(5_000).paise()).isEqualTo(1); // 0.5 rounds up
        assertThatThrownBy(() -> Money.ofPaise(100).percentBp(-1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void arithmeticIsExactAndOverflowFails() {
        assertThat(Money.ofPaise(100).plus(Money.ofPaise(50)).minus(Money.ofPaise(25)).paise()).isEqualTo(125);
        assertThat(Money.ofPaise(250).times(3).paise()).isEqualTo(750);
        assertThat(Money.ofPaise(5).negate().isNegative()).isTrue();
        assertThatThrownBy(() -> Money.ofPaise(Long.MAX_VALUE).plus(Money.ofPaise(1))).isInstanceOf(ArithmeticException.class);
    }

    @Test
    void allocationNeverCreatesOrLosesAPaisa() {
        List<Money> parts = Money.ofPaise(100).allocate(1, 1, 1);
        assertThat(parts).extracting(Money::paise).containsExactly(34L, 33L, 33L);

        // 49 rupees shipping over three vendor orders weighted by order value
        List<Money> ship = Money.fromRupees(49).allocate(18_000, 16_500, 17_500);
        assertThat(ship.stream().mapToLong(Money::paise).sum()).isEqualTo(4_900);

        assertThat(Money.ofPaise(-100).allocate(1, 1, 1)).extracting(Money::paise).containsExactly(-34L, -33L, -33L);
        assertThat(Money.ofPaise(10).allocate(0, 1, 0)).extracting(Money::paise).containsExactly(0L, 10L, 0L);
        assertThat(Money.ZERO.allocate(3, 2)).extracting(Money::paise).containsExactly(0L, 0L);
    }

    @Test
    void allocationAlwaysSumsToTheTotal() {
        Random rnd = new Random(42);
        for (int run = 0; run < 2_000; run++) {
            int n = 1 + rnd.nextInt(6);
            long[] w = new long[n];
            boolean any = false;
            for (int i = 0; i < n; i++) { w[i] = rnd.nextInt(5) == 0 ? 0 : 1 + rnd.nextInt(100_000); any |= w[i] > 0; }
            if (!any) w[0] = 1;
            long total = rnd.nextInt(2_000_000) - 1_000_000;
            List<Money> parts = Money.ofPaise(total).allocate(w);
            assertThat(parts.stream().mapToLong(Money::paise).sum()).isEqualTo(total);
            for (int i = 0; i < n; i++) if (w[i] == 0) assertThat(parts.get(i).paise()).isZero();
        }
    }

    @Test
    void allocationRejectsBadWeights() {
        assertThatThrownBy(() -> Money.ofPaise(1).allocate()).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.ofPaise(1).allocate(0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.ofPaise(1).allocate(1, -1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rupeesViewHasTwoDecimals() {
        assertThat(Money.ofPaise(18_005).rupees().toPlainString()).isEqualTo("180.05");
        assertThat(Money.ofPaise(18_005)).hasToString("INR 180.05");
    }
}
