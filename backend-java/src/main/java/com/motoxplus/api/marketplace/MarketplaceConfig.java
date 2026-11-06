package com.motoxplus.api.marketplace;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/**
 * Switches the marketplace module on (MARKETPLACE_ENABLED=true). Off by default: no marketplace bean, endpoint
 * or Flyway migration exists unless explicitly enabled, so deploying the jar cannot touch the database.
 * {@code @PreAuthorize} is only honoured when enabled, which is fine because only marketplace code uses it.
 */
@Configuration
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
@EnableMethodSecurity
public class MarketplaceConfig {
}
