package com.motoxplus.api.delhivery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.motoxplus.api.delhivery.DelhiveryClient.Outcome;
import com.motoxplus.api.delhivery.DelhiveryClient.WarehouseRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** DelhiveryClient against a local fake server: no real Delhivery call is ever made. */
class DelhiveryClientTest {
    static final FakeDelhivery FAKE = start();
    static final JsonMapper JSON = JsonMapper.builder().build();

    private static FakeDelhivery start() {
        try {
            return new FakeDelhivery();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @AfterAll
    static void stop() { FAKE.close(); }

    @BeforeEach
    void reset() { FAKE.reset(); }

    private static DelhiveryClient client(boolean writes, DelhiveryWarehouseSpec spec) {
        return new DelhiveryClient(FAKE.url() + "/", FakeDelhivery.TOKEN, writes, spec, JSON);
    }

    private static WarehouseRequest req(String name) {
        return new WarehouseRequest(name, "Plot 4, Okhla Phase 2", "110020", "New Delhi", "Delhi", "9876543210", "a@b.in",
                "Plot 4, Okhla Phase 2", "110020", "New Delhi", "Delhi", null);
    }

    @Test
    void createsAWarehouseAndReturnsTheNameDelhiveryConfirmed() {
        var r = client(true, FAKE.spec()).createWarehouse(req("VND-VND12345678-110020"));

        assertThat(r.outcome()).isEqualTo(Outcome.CREATED);
        assertThat(r.name()).isEqualTo("VND-VND12345678-110020");
        assertThat(FAKE.creates()).singleElement().satisfies(c -> {
            assertThat(c.authorization()).isEqualTo("Token " + FakeDelhivery.TOKEN);
            assertThat(c.body()).contains("\"name\":\"VND-VND12345678-110020\"", "\"pin\":\"110020\"");
        });
    }

    @Test
    void sendsNothingWhileWritesAreOff() {
        var r = client(false, FAKE.spec()).createWarehouse(req("VND-VND12345678-110020"));

        assertThat(r.outcome()).isEqualTo(Outcome.NOT_SENT);
        assertThat(r.message()).contains("DELHIVERY_ALLOW_WRITES");
        assertThat(FAKE.calls).isEmpty();
    }

    @Test
    void sendsNothingUntilTheEndpointIsCopiedFromThePortalCurl() {
        var r = client(true, DelhiveryWarehouseSpec.UNCONFIGURED).createWarehouse(req("VND-VND12345678-110020"));

        assertThat(DelhiveryWarehouseSpec.WAREHOUSE_CREATE_PATH).isEqualTo("TODO_FROM_PORTAL_CURL");
        assertThat(r.outcome()).isEqualTo(Outcome.NOT_SENT);
        assertThat(r.message()).contains("not configured", "create path", "exists error text", "name length limit");
        assertThat(FAKE.calls).isEmpty();
    }

    @Test
    void refusesANameOverTheConfirmedLengthLimit() {
        var r = client(true, new DelhiveryWarehouseSpec(FakeDelhivery.CREATE_PATH, FakeDelhivery.EXISTS_ERROR, 10))
                .createWarehouse(req("VND-VND12345678-110020"));

        assertThat(r.outcome()).isEqualTo(Outcome.NOT_SENT);
        assertThat(FAKE.calls).isEmpty();
    }

    @Test
    void theExactAlreadyExistsErrorMeansActiveButALookAlikeDoesNot() {
        FAKE.createReplies.add(new FakeDelhivery.Reply(400, "{\"success\":false,\"error\":\"" + FakeDelhivery.EXISTS_ERROR + "\"}"));
        FAKE.createReplies.add(new FakeDelhivery.Reply(400, "{\"success\":false,\"error\":\"Warehouse already exists in another account\"}"));
        var c = client(true, FAKE.spec());

        assertThat(c.createWarehouse(req("VND-VND12345678-110020")).outcome()).isEqualTo(Outcome.ALREADY_EXISTS);
        assertThat(c.createWarehouse(req("VND-VND12345678-110020")).outcome()).isEqualTo(Outcome.REJECTED);
    }

    @Test
    void classifiesFailuresBySafeNextStep() {
        var c = client(true, FAKE.spec());
        FAKE.createReplies.add(new FakeDelhivery.Reply(400, "{\"success\":false,\"error\":\"Invalid pin\"}"));
        FAKE.createReplies.add(new FakeDelhivery.Reply(502, "Bad gateway"));
        FAKE.createReplies.add(new FakeDelhivery.Reply(200, "{\"success\":false,\"rmk\":\"phone invalid\"}"));
        FAKE.createReplies.add(new FakeDelhivery.Reply(200, "<html>ok</html>"));
        FAKE.createReplies.add(new FakeDelhivery.Reply(401, "{\"detail\":\"Invalid token\"}"));

        assertThat(c.createWarehouse(req("A")).outcome()).isEqualTo(Outcome.REJECTED);   // definitely not created
        assertThat(c.createWarehouse(req("A")).outcome()).isEqualTo(Outcome.UNCERTAIN);  // may have been created
        assertThat(c.createWarehouse(req("A")).outcome()).isEqualTo(Outcome.REJECTED);
        assertThat(c.createWarehouse(req("A")).outcome()).isEqualTo(Outcome.UNCERTAIN);  // 2xx without a success flag
        assertThat(c.createWarehouse(req("A")).outcome()).isEqualTo(Outcome.NOT_SENT);   // auth problem, nothing created
    }

    @Test
    void theTokenNeverAppearsInAMessage() {
        FAKE.createReplies.add(new FakeDelhivery.Reply(400, "{\"error\":\"bad request for token " + FakeDelhivery.TOKEN + "\"}"));

        var r = client(true, FAKE.spec()).createWarehouse(req("VND-VND12345678-110020"));

        assertThat(r.message()).doesNotContain(FakeDelhivery.TOKEN).contains("****cdef");
        assertThat(DelhiveryClient.mask(FakeDelhivery.TOKEN)).isEqualTo("****cdef");
        assertThat(DelhiveryClient.mask("short")).isEqualTo("****");
        assertThat(DelhiveryClient.mask(null)).isEqualTo("(unset)");
    }

    @Test
    void readsPincodeCapabilityFromTheCapturedShape() {
        FAKE.pins.put("110020", FakeDelhivery.postal("110020", "Y"));
        FAKE.pins.put("793001", FakeDelhivery.postal("793001", "N"));
        FAKE.pins.put("999999", "");
        var c = client(false, FAKE.spec());

        assertThat(c.pinCapability("110020")).hasValueSatisfying(p -> {
            assertThat(p.pickup()).isTrue();
            assertThat(p.district()).isEqualTo("New Delhi");
        });
        assertThat(c.pinCapability("793001")).hasValueSatisfying(p -> assertThat(p.pickup()).isFalse());
        assertThat(c.pinCapability("999999")).isEmpty();
        assertThat(FAKE.calls).allSatisfy(call -> assertThat(call.query()).startsWith("filter_codes="));
    }

    @Test
    void serviceabilityWithoutATokenIsUnavailableNotUnserviceable() {
        var c = new DelhiveryClient(FAKE.url(), "", false, FAKE.spec(), JSON);
        assertThatThrownBy(() -> c.pinCapability("110020")).isInstanceOf(DelhiveryClient.UnavailableException.class);
        assertThat(FAKE.calls).isEmpty();
    }
}
