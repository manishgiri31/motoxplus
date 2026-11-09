package com.motoxplus.api.gst;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@EnableScheduling
public class GstConfig {
    private static final Logger log = LoggerFactory.getLogger(GstConfig.class);

    @Bean
    public GstinLookup gstinLookup(
            @Value("${app.gst.cashfree.client-id:}") String clientId,
            @Value("${app.gst.cashfree.client-secret:}") String clientSecret,
            @Value("${app.gst.cashfree.base-url:https://api.cashfree.com/verification}") String baseUrl,
            JsonMapper json) {
        GstinLookup lookup = new CashfreeGstinLookup(clientId, clientSecret, baseUrl, json);
        if (!lookup.isConfigured()) {
            log.warn("[GSTIN] {} is not configured; new dealer GSTINs are saved unverified (PENDING) until it is",
                    lookup.name());
        }
        return lookup;
    }
}
