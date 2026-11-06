package com.motoxplus.api.marketplace.common;

import java.util.List;

/** Pagination envelope used by every list endpoint under /api/v1: {@code {items, page, size, total, totalPages}}. */
public record PageResponse<T>(List<T> items, int page, int size, long total, int totalPages) {
    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public static <T> PageResponse<T> of(List<T> items, int page, int size, long total) {
        int pages = size == 0 ? 0 : (int) ((total + size - 1) / size);
        return new PageResponse<>(items, page, size, total, pages);
    }

    /** Clamps client-supplied paging params: size is 1..MAX_SIZE. */
    public static int clampSize(Integer size) {
        if (size == null) return DEFAULT_SIZE;
        return Math.max(1, Math.min(size, MAX_SIZE));
    }

    /** Pages are 0-based. */
    public static int clampPage(Integer page) {
        return page == null ? 0 : Math.max(0, page);
    }
}
