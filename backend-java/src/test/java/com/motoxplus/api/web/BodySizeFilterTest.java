package com.motoxplus.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;

class BodySizeFilterTest {

    private static MockHttpServletRequest req(String method, String uri, int contentLength) {
        MockHttpServletRequest r = new MockHttpServletRequest(method, uri);
        r.setContent(new byte[contentLength]);
        return r;
    }

    @Test
    void multipartUploadEndpointsGetTheUploadLimitEverythingElseStaysAt16Kb() {
        assertThat(BodySizeFilter.limitFor(req("POST", "/api/v1/vendors/me/listings/cabc123/images", 0))).isEqualTo(BodySizeFilter.UPLOAD_MAX_BYTES);
        assertThat(BodySizeFilter.limitFor(req("POST", "/api/v1/vendors/me/application/documents", 0))).isEqualTo(BodySizeFilter.UPLOAD_MAX_BYTES);

        assertThat(BodySizeFilter.limitFor(req("PUT", "/api/v1/vendors/me/listings/cabc123", 0))).isEqualTo(BodySizeFilter.JSON_BODY_MAX_BYTES);
        assertThat(BodySizeFilter.limitFor(req("POST", "/api/v1/vendors/me/listings", 0))).isEqualTo(BodySizeFilter.JSON_BODY_MAX_BYTES);
        assertThat(BodySizeFilter.limitFor(req("POST", "/api/v1/vendors/me/listings/a/b/images", 0))).isEqualTo(BodySizeFilter.JSON_BODY_MAX_BYTES);
        assertThat(BodySizeFilter.limitFor(req("PUT", "/api/v1/vendors/me/listings/cabc123/images", 0))).isEqualTo(BodySizeFilter.JSON_BODY_MAX_BYTES);
    }

    @Test
    void aBrowserSizedPhotoUploadPassesAndAnOversizedOneIsRefusedBeforeParsing() throws Exception {
        BodySizeFilter filter = new BodySizeFilter();

        // A real browser sends Content-Length; a 2MB photo must not be refused by the 16KB JSON cap.
        MockHttpServletResponse ok = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req("POST", "/api/v1/vendors/me/listings/c1/images", 2 * 1024 * 1024), ok, chain);
        assertThat(ok.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();

        MockHttpServletResponse tooBig = new MockHttpServletResponse();
        filter.doFilter(req("POST", "/api/v1/vendors/me/listings/c1/images", (int) BodySizeFilter.UPLOAD_MAX_BYTES + 1), tooBig, new MockFilterChain());
        assertThat(tooBig.getStatus()).isEqualTo(413);

        MockHttpServletResponse json = new MockHttpServletResponse();
        filter.doFilter(req("PUT", "/api/v1/vendors/me/listings/c1", 17 * 1024), json, new MockFilterChain());
        assertThat(json.getStatus()).isEqualTo(413);
    }
}
