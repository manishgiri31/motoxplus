package com.motoxplus.api.delhivery;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class DelhiveryConfig {
    private static final Logger log = LoggerFactory.getLogger(DelhiveryConfig.class);

    @Bean
    public DelhiveryClient delhiveryClient(
            @Value("${app.delhivery.base-url:}") String baseUrl,
            @Value("${app.delhivery.token:}") String token,
            @Value("${app.delhivery.allow-writes:false}") boolean allowWrites,
            @Value("${app.delhivery.warehouse.create-path:" + DelhiveryWarehouseSpec.TODO + "}") String createPath,
            @Value("${app.delhivery.warehouse.exists-error:" + DelhiveryWarehouseSpec.TODO + "}") String existsError,
            @Value("${app.delhivery.warehouse.name-max-length:0}") int nameMaxLength,
            JsonMapper json) {
        var spec = new DelhiveryWarehouseSpec(createPath, existsError, nameMaxLength);
        var client = new DelhiveryClient(baseUrl, token, allowWrites, spec, json);
        log.info("[Delhivery] base={} token={} writes={} warehouseApi={}", baseUrl.isBlank() ? "(unset)" : baseUrl,
                DelhiveryClient.mask(token), allowWrites ? "ON" : "off",
                spec.complete() ? "configured" : "NOT configured (missing: " + spec.missing() + ")");
        return client;
    }
}
