package com.motoxplus.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIpTest {
    @Test
    void prefersXRealIpWhichNginxOverwrites() {
        var req = new MockHttpServletRequest();
        req.addHeader("X-Real-IP", "203.0.113.7");
        req.addHeader("X-Forwarded-For", "6.6.6.6, 203.0.113.7");
        assertThat(ClientIp.resolve(req)).isEqualTo("203.0.113.7");
    }

    @Test
    void clientCannotForgeIdentityViaTheFirstForwardedHop() {
        // Nginx appends the real address; anything before it is attacker-controlled.
        var req = new MockHttpServletRequest();
        req.addHeader("X-Forwarded-For", "1.2.3.4, 198.51.100.9");
        assertThat(ClientIp.resolve(req)).isEqualTo("198.51.100.9");
    }

    @Test
    void returnsUnknownSoCallersSkipThePerIpBucketInsteadOfSharingOne() {
        assertThat(ClientIp.resolve(new MockHttpServletRequest())).isEqualTo(ClientIp.UNKNOWN);
        var blank = new MockHttpServletRequest();
        blank.addHeader("X-Real-IP", "  ");
        assertThat(ClientIp.resolve(blank)).isEqualTo(ClientIp.UNKNOWN);
    }

    @Test
    void classifiesDevice() {
        var phone = new MockHttpServletRequest();
        phone.addHeader("User-Agent", "Mozilla/5.0 (iPhone) Mobile Safari");
        assertThat(ClientIp.deviceInfo(phone)).isEqualTo("Mobile");
        var desktop = new MockHttpServletRequest();
        desktop.addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0)");
        assertThat(ClientIp.deviceInfo(desktop)).isEqualTo("Desktop");
    }
}
