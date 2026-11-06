package com.motoxplus.api.marketplace.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class PageResponseTest {
    @Test
    void clampsClientPagingParameters() {
        assertThat(PageResponse.clampSize(null)).isEqualTo(20);
        assertThat(PageResponse.clampSize(0)).isEqualTo(1);
        assertThat(PageResponse.clampSize(-5)).isEqualTo(1);
        assertThat(PageResponse.clampSize(10_000)).isEqualTo(100);
        assertThat(PageResponse.clampPage(null)).isZero();
        assertThat(PageResponse.clampPage(-3)).isZero();
        assertThat(PageResponse.clampPage(4)).isEqualTo(4);
    }

    @Test
    void computesTotalPages() {
        assertThat(PageResponse.of(List.of(), 0, 20, 0).totalPages()).isZero();
        assertThat(PageResponse.of(List.of(1), 0, 20, 1).totalPages()).isEqualTo(1);
        assertThat(PageResponse.of(List.of(1), 0, 20, 41).totalPages()).isEqualTo(3);
    }
}
