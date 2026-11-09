package com.motoxplus.api.marketplace.commission;

import java.time.OffsetDateTime;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * The marketplace commission rules, read from marketplace.commission_rate: configuration, never constants in code.
 * Rules are effective-dated and append-only, so a change is an INSERT with a later effective_from.
 *
 * <p>Configuration only. Phase 4 reads the sale commission for the vendor's payout estimate; taking commission, holding
 * COD advances, refunds and payouts are settlement (Phase 6-7), which must apply the rules exactly as documented on the
 * table in V4__vendor_listings.sql. In short: commission is taken only when the order is delivered end to end and paid,
 * never on a cancellation; a cancelled COD order's advance goes to MotoXPlus; on a return the vendor pays nothing,
 * MotoXPlus keeps {@code returnDeductionBp} of the customer's refund and pays Delhivery's return charges out of it.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class CommissionRates {
    /** When the commission is taken and a COD advance unlocks. */
    public enum SettlesOn { DELIVERED_AND_PAID }

    /** Where a cancelled COD order's advance goes. */
    public enum CodAdvanceOnCancel { TO_MOTOXPLUS }

    /** Who pays Delhivery for a return: out of the deduction MotoXPlus keeps. */
    public enum ReturnShippingPaidFrom { RETURN_DEDUCTION }

    /** One set of rules. Percentages are basis points: 1500 = 15%. */
    public record Rules(String id, int saleCommissionBp, SettlesOn settlesOn, int codAdvanceBp, CodAdvanceOnCancel codAdvanceOnCancel,
                        int returnDeductionBp, ReturnShippingPaidFrom returnShippingPaidFrom, OffsetDateTime effectiveFrom) {}

    private final JdbcTemplate jdbc;

    public CommissionRates(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The rules in force now. Fails loudly if none are configured: a sale must never default to 0% silently. */
    public Rules current() {
        return jdbc.query("""
                        SELECT id, sale_commission_bp, settles_on, cod_advance_bp, cod_advance_on_cancel, return_deduction_bp,
                               return_shipping_paid_from, effective_from
                        FROM marketplace.commission_rate
                        WHERE effective_from <= now()
                        ORDER BY effective_from DESC
                        LIMIT 1
                        """,
                        (rs, i) -> new Rules(rs.getString(1), rs.getInt(2), SettlesOn.valueOf(rs.getString(3)), rs.getInt(4),
                                CodAdvanceOnCancel.valueOf(rs.getString(5)), rs.getInt(6),
                                ReturnShippingPaidFrom.valueOf(rs.getString(7)), rs.getObject(8, OffsetDateTime.class)))
                .stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("No commission rules configured in marketplace.commission_rate"));
    }
}
