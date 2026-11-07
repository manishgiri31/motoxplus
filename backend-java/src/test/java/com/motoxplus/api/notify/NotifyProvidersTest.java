package com.motoxplus.api.notify;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.motoxplus.api.notify.email.EmailService;
import com.motoxplus.api.notify.otp.Msg91OtpSender;
import com.motoxplus.api.notify.otp.OtpSenders;
import com.motoxplus.api.notify.otp.WhatsAppOtpSender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class NotifyProvidersTest {
    private final JsonMapper json = JsonMapper.builder().build();
    private FakeHttp fake;

    @BeforeEach void start() throws Exception { fake = new FakeHttp(); }

    @AfterEach void stop() { fake.close(); }

    // ---------- email ----------

    @Test
    void emailPostsToResendWithAuthAndIdempotencyKey() {
        fake.respond(200, "{\"id\":\"em_1\"}");
        var email = new EmailService("re_key", "noreply@motoxplus.com", fake.url(), json);
        var r = email.send("a@b.com", "Verify", "<p>hi</p>", "verify:u1");

        assertThat(r).isEqualTo(new EmailService.Result("em_1", false));
        var req = fake.last();
        assertThat(req.method()).isEqualTo("POST");
        assertThat(req.path()).isEqualTo("/emails");
        assertThat(req.header("Authorization")).isEqualTo("Bearer re_key");
        assertThat(req.header("Idempotency-Key")).isEqualTo("verify:u1");
        JsonNode body = json.readTree(req.bodyText());
        assertThat(body.get("from").asString()).isEqualTo("MOTOXPLUS India <noreply@motoxplus.com>");
        assertThat(body.get("to").asString()).isEqualTo("a@b.com");
    }

    @Test
    void emailSkipsWhenNotConfiguredAndThrowsOnResendError() {
        assertThat(new EmailService("", "x@y.com", fake.url(), json).send("a@b.com", "s", "h").skipped()).isTrue();
        assertThat(fake.requests).isEmpty();

        fake.respond(401, "{\"message\":\"API key is invalid\"}");
        var email = new EmailService("bad", "noreply@motoxplus.com", fake.url(), json);
        assertThatThrownBy(() -> email.send("a@b.com", "s", "h")).hasMessage("API key is invalid");
    }

    // ---------- WhatsApp ----------

    @Test
    void whatsappSendsTheCopyCodeTemplate() {
        fake.respond(200, "{\"messages\":[{\"id\":\"wamid.1\"}]}");
        var wa = new WhatsAppOtpSender("tok", "pn1", "login_otp", "en", fake.url(), json);
        var r = wa.send("+919876543210", "482913");

        assertThat(r.delivered()).isTrue();
        assertThat(r.messageId()).isEqualTo("wamid.1");
        var req = fake.last();
        assertThat(req.path()).isEqualTo("/pn1/messages");
        assertThat(req.header("Authorization")).isEqualTo("Bearer tok");
        JsonNode body = json.readTree(req.bodyText());
        assertThat(body.get("to").asString()).isEqualTo("919876543210");
        assertThat(body.at("/template/name").asString()).isEqualTo("login_otp");
        assertThat(body.at("/template/components/0/parameters/0/text").asString()).isEqualTo("482913");
        assertThat(body.at("/template/components/1/sub_type").asString()).isEqualTo("url");
        assertThat(body.at("/template/components/1/parameters/0/text").asString()).isEqualTo("482913");
    }

    @Test
    void whatsappMapsMetaErrorsToSafeMessages() {
        fake.respond(400, "{\"error\":{\"code\":132001,\"message\":\"template login_otp does not exist\"}}");
        var wa = new WhatsAppOtpSender("tok", "pn1", null, null, fake.url(), json);
        var r = wa.send("+919876543210", "482913");
        assertThat(r.delivered()).isFalse();
        assertThat(r.error()).isEqualTo("WhatsApp template not found or not approved");

        assertThat(new WhatsAppOtpSender("", "pn1", null, null, fake.url(), json).isConfigured()).isFalse();
        assertThat(wa.send("9876543210", "1").error()).isEqualTo("Recipient number must be in E.164 format");
    }

    // ---------- MSG91 ----------

    @Test
    void msg91SendsKeyInHeaderNotUrl() {
        fake.respond(200, "{\"type\":\"success\",\"request_id\":\"r1\"}");
        var m = new Msg91OtpSender("auth-key", "tpl-1", fake.url(), json);
        var r = m.send("+919876543210", "123456");

        assertThat(r.delivered()).isTrue();
        var req = fake.last();
        assertThat(req.path()).isEqualTo("/api/v5/otp");
        assertThat(req.query()).contains("template_id=tpl-1", "mobile=919876543210", "otp=123456").doesNotContain("auth-key");
        assertThat(req.header("authkey")).isEqualTo("auth-key");

        fake.respond(200, "{\"type\":\"error\",\"message\":\"bad template\"}");
        assertThat(m.send("+919876543210", "123456").delivered()).isFalse();
    }

    @Test
    void e164Normalisation() {
        assertThat(OtpSenders.toE164India("98765 43210")).isEqualTo("+919876543210");
        assertThat(OtpSenders.toE164India("+919876543210")).isEqualTo("+919876543210");
    }
}
