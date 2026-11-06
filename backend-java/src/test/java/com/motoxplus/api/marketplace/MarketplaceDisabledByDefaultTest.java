package com.motoxplus.api.marketplace;

import static org.assertj.core.api.Assertions.assertThat;

import com.motoxplus.api.IntegrationTestBase;
import org.junit.jupiter.api.Test;

/** Deploying the jar without MARKETPLACE_ENABLED must not wire (or migrate) anything marketplace-related. */
class MarketplaceDisabledByDefaultTest extends IntegrationTestBase {

    @Test
    void noMarketplaceBeansExistUnlessEnabled() {
        assertThat(ctx.containsBean("perm")).isFalse();
        assertThat(ctx.containsBean("flyway")).isFalse();
        assertThat(ctx.getBeanNamesForType(com.motoxplus.api.marketplace.iam.IamController.class)).isEmpty();
        assertThat(ctx.getEnvironment().getProperty("marketplace.enabled")).isEqualTo("false");
    }
}
