package com.motoxplus.api;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.sql.Connection;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Shared setup for end-to-end tests: ONE throwaway PostgreSQL (no Docker) built from the project's own
 * Prisma schema, so JPA mappings and hand-written SQL are checked against the tables Prisma really
 * creates. Identical configuration across subclasses lets Spring reuse a single application context.
 */
@SpringBootTest
public abstract class IntegrationTestBase {
    protected static final String JWT_SECRET = "test-secret-test-secret-test-secret-1234";
    // bcryptjs.hashSync("S3cret!pass", 10) - a hash exactly as the Node app stored it.
    protected static final String PASSWORD = "S3cret!pass";
    protected static final String NODE_BCRYPT_HASH = "$2b$10$8PG2PHVlnEctuV0l1faYqOalqmFfz/v29RNJ39B6QJmA/UcRO64Xq";

    static final EmbeddedPostgres PG = startPostgres();

    private static EmbeddedPostgres startPostgres() {
        try {
            EmbeddedPostgres pg = EmbeddedPostgres.builder().start();
            try (Connection c = pg.getPostgresDatabase().getConnection()) {
                ScriptUtils.executeSqlScript(c, new ClassPathResource("prisma-schema.sql"));
            }
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try { pg.close(); } catch (IOException ignored) { }
            }));
            return pg;
        } catch (Exception e) {
            throw new IllegalStateException("could not start embedded PostgreSQL", e);
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("DATABASE_URL", () -> "postgresql://postgres@localhost:" + PG.getPort() + "/postgres");
        r.add("app.jwt.secret", () -> JWT_SECRET);
        // Nothing listens here: proves everything keeps working (fail-open) when Redis is down.
        r.add("spring.data.redis.url", () -> "redis://localhost:6390");
    }

    @Autowired protected WebApplicationContext ctx;
    @Autowired protected DataSource dataSource;
    @Autowired protected com.motoxplus.api.web.BodySizeFilter bodySizeFilter;
    @Autowired protected com.motoxplus.api.ratelimit.RateLimiter limiter;

    protected MockMvc mvc;
    protected JdbcTemplate jdbc;

    @BeforeEach
    void setUpMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).addFilters(bodySizeFilter).build();
        jdbc = new JdbcTemplate(dataSource);
    }
}
