package com.motoxplus.api.gst;

import static org.assertj.core.api.Assertions.assertThat;

import com.motoxplus.api.gst.GstinLookup.Outcome;
import com.motoxplus.api.notify.FakeHttp;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CashfreeGstinLookupTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void activeRegistrationIsActiveWithRegistryDetails() throws Exception {
        try (FakeHttp http = new FakeHttp()) {
            http.respond(200, """
                    {"valid": true, "GSTIN": "27AAPFU0939F1ZV", "gst_in_status": "Active",
                     "legal_name_of_business": "ACME AUTO PARTS PRIVATE LIMITED", "trade_name_of_business": "ACME",
                     "principal_place_address": "12 MG Road, Pune, Maharashtra, 411001", "message": "GSTIN Exists"}
                    """);
            var r = new CashfreeGstinLookup("id", "secret", http.url(), json).lookup("27AAPFU0939F1ZV");
            assertThat(r.outcome()).isEqualTo(Outcome.ACTIVE);
            assertThat(r.legalName()).isEqualTo("ACME AUTO PARTS PRIVATE LIMITED");
            assertThat(r.tradeName()).isEqualTo("ACME");
            assertThat(r.registrationStatus()).isEqualTo("Active");
            assertThat(r.principalAddress()).contains("Pune");
            assertThat(http.last().path()).isEqualTo("/gstin");
            assertThat(http.last().header("x-client-id")).isEqualTo("id");
            assertThat(http.last().header("x-client-secret")).isEqualTo("secret");
            assertThat(http.last().bodyText()).contains("\"GSTIN\":\"27AAPFU0939F1ZV\"");
        }
    }

    @Test
    void cancelledIsInactiveAndUnknownIsNotFound() throws Exception {
        try (FakeHttp http = new FakeHttp()) {
            var lookup = new CashfreeGstinLookup("id", "secret", http.url(), json);
            http.respond(200, "{\"valid\": true, \"gst_in_status\": \"Cancelled\"}");
            assertThat(lookup.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.INACTIVE);
            http.respond(200, "{\"valid\": false, \"message\": \"GSTIN does not exist\"}");
            assertThat(lookup.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.NOT_FOUND);
        }
    }

    @Test
    void anythingUnclearIsUnavailableNeverValid() throws Exception {
        try (FakeHttp http = new FakeHttp()) {
            var lookup = new CashfreeGstinLookup("id", "secret", http.url(), json);
            http.respond(401, "{\"message\": \"authentication failed\"}");
            assertThat(lookup.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.UNAVAILABLE);
            http.respond(500, "{}");
            assertThat(lookup.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.UNAVAILABLE);
            http.respond(200, "{\"valid\": true}"); // no status: can't call it active
            assertThat(lookup.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.UNAVAILABLE);
            http.respond(200, "not json");
            assertThat(lookup.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.UNAVAILABLE);
        }
        var unconfigured = new CashfreeGstinLookup("", "", "http://127.0.0.1:1", json);
        assertThat(unconfigured.isConfigured()).isFalse();
        assertThat(unconfigured.lookup("27AAPFU0939F1ZV").outcome()).isEqualTo(Outcome.UNAVAILABLE);
    }
}
