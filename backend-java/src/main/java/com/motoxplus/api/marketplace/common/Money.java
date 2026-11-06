package com.motoxplus.api.marketplace.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Exact INR amount held as whole paise in a {@code long}. All marketplace money (orders, commission,
 * ledger, settlements) uses this; floating point is only ever accepted at the boundary with the legacy
 * Prisma tables ({@link #fromRupees(double)}), which store money as {@code Float}.
 * Rounding is always HALF_UP, matching {@code roundToPaise()} in the Node code.
 */
public record Money(long paise) implements Comparable<Money> {
    public static final Money ZERO = new Money(0);

    public static Money ofPaise(long paise) { return new Money(paise); }

    /** Legacy boundary: a rupee figure from a Float column. Rounds to the nearest paisa (HALF_UP). */
    public static Money fromRupees(double rupees) {
        if (Double.isNaN(rupees) || Double.isInfinite(rupees)) {
            throw new IllegalArgumentException("rupees must be a finite number");
        }
        return fromRupees(BigDecimal.valueOf(rupees));
    }

    public static Money fromRupees(BigDecimal rupees) {
        return new Money(rupees.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact());
    }

    public BigDecimal rupees() { return BigDecimal.valueOf(paise, 2); }

    public Money plus(Money o) { return new Money(Math.addExact(paise, o.paise)); }

    public Money minus(Money o) { return new Money(Math.subtractExact(paise, o.paise)); }

    public Money times(long quantity) { return new Money(Math.multiplyExact(paise, quantity)); }

    public Money negate() { return new Money(Math.negateExact(paise)); }

    public boolean isNegative() { return paise < 0; }

    /** {@code basisPoints}/10,000 of this amount (800 bp = 8%), rounded HALF_UP to a paisa. */
    public Money percentBp(int basisPoints) {
        if (basisPoints < 0) throw new IllegalArgumentException("basisPoints must be >= 0");
        BigDecimal v = BigDecimal.valueOf(paise).multiply(BigDecimal.valueOf(basisPoints))
                .divide(BigDecimal.valueOf(10_000), 0, RoundingMode.HALF_UP);
        return new Money(v.longValueExact());
    }

    /**
     * Splits this amount in proportion to {@code weights} so the parts add up to exactly this amount
     * (largest-remainder method). Used for shipping/discount/payment allocation across vendor orders,
     * where independent rounding would otherwise create or lose a paisa.
     */
    public List<Money> allocate(long... weights) {
        if (weights.length == 0) throw new IllegalArgumentException("weights must not be empty");
        long total = 0;
        for (long w : weights) {
            if (w < 0) throw new IllegalArgumentException("weights must be >= 0");
            total = Math.addExact(total, w);
        }
        if (total == 0) throw new IllegalArgumentException("weights must not all be zero");

        long sign = Long.signum(paise);
        long abs = Math.abs(paise);
        long[] parts = new long[weights.length];
        long[] remainder = new long[weights.length];
        long assigned = 0;
        for (int i = 0; i < weights.length; i++) {
            BigDecimal[] qr = BigDecimal.valueOf(abs).multiply(BigDecimal.valueOf(weights[i]))
                    .divideAndRemainder(BigDecimal.valueOf(total));
            parts[i] = qr[0].longValueExact();
            remainder[i] = qr[1].longValueExact();
            assigned += parts[i];
        }
        // Hand the leftover paise (always < number of non-zero weights) to the largest remainders.
        long leftover = abs - assigned;
        Integer[] order = new Integer[weights.length];
        for (int i = 0; i < order.length; i++) order[i] = i;
        java.util.Arrays.sort(order, (a, b) -> {
            int byRemainder = Long.compare(remainder[b], remainder[a]);
            return byRemainder != 0 ? byRemainder : Integer.compare(a, b);
        });
        for (int k = 0; k < leftover; k++) parts[order[k]]++;

        List<Money> out = new ArrayList<>(weights.length);
        for (long p : parts) out.add(new Money(sign * p));
        return out;
    }

    @Override public int compareTo(Money o) { return Long.compare(paise, o.paise); }

    @Override public String toString() { return "INR " + rupees().toPlainString(); }
}
