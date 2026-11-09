package com.motoxplus.api.vendor.warehouse;

import com.motoxplus.api.delhivery.DelhiveryClient;
import java.time.LocalDateTime;

/** One public."DelhiveryWarehouse" row. */
public record Warehouse(String id, String ownerType, String vendorId, String delhiveryName, Details details, String gstin,
                        String status, String lastError, String lastErrorCode, int attempts, LocalDateTime attemptStartedAt,
                        LocalDateTime activatedAt, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";
    public static final String FAILED = "FAILED";

    /** A PENDING attempt older than this was abandoned (process died mid-call) and may be retried. */
    public static final long STALE_ATTEMPT_SECONDS = 120;

    public record Details(String address, String pin, String city, String state, String phone, String email,
                          String returnAddress, String returnPin, String returnCity, String returnState) {}

    public boolean active() { return ACTIVE.equals(status); }

    /** Delhivery definitely has no warehouse under this name, so the details (and so the name) may still change. */
    public boolean editable() {
        return FAILED.equals(status) && !"UNCERTAIN".equals(lastErrorCode);
    }

    public boolean stale(LocalDateTime nowUtc) {
        return PENDING.equals(status) && (attemptStartedAt == null || attemptStartedAt.plusSeconds(STALE_ATTEMPT_SECONDS).isBefore(nowUtc));
    }

    public boolean retryable(LocalDateTime nowUtc) {
        return FAILED.equals(status) || stale(nowUtc);
    }

    DelhiveryClient.WarehouseRequest toRequest() {
        Details d = details;
        return new DelhiveryClient.WarehouseRequest(delhiveryName, d.address(), d.pin(), d.city(), d.state(), d.phone(), d.email(),
                d.returnAddress(), d.returnPin(), d.returnCity(), d.returnState(), gstin);
    }
}
