package com.motoxplus.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/**
 * Proves the database takeover is safe to rehearse:
 *  - baseline V1 (the 17 concatenated Prisma migrations) builds exactly the tables/columns/types that
 *    Prisma's own generated schema describes, plus the hand-written CHECK constraints that generated schema lacks;
 *  - the whole chain (V1 -> V2) applies to an empty database;
 *  - BaselineGuard refuses to adopt a database Prisma has not fully migrated.
 */
class BaselineMigrationTest {
    static EmbeddedPostgres pg;
    static int dbCounter = 0;

    @BeforeAll
    static void start() throws Exception {
        pg = EmbeddedPostgres.builder().start();
    }

    @AfterAll
    static void stop() throws Exception {
        pg.close();
    }

    private static synchronized DataSource freshDatabase() throws SQLException {
        String name = "t" + (++dbCounter);
        try (Connection c = pg.getPostgresDatabase().getConnection(); Statement s = c.createStatement()) {
            s.execute("CREATE DATABASE " + name);
        }
        try {
            return pg.getDatabase("postgres", name);
        } catch (Exception e) {
            throw new SQLException(e);
        }
    }

    private static Flyway flyway(DataSource ds, String target) {
        return Flyway.configure().dataSource(ds)
                .schemas("public").defaultSchema("public").createSchemas(false)
                .locations("classpath:db/migration").target(target).cleanDisabled(true).load();
    }

    private static List<String> columns(DataSource ds) {
        return new JdbcTemplate(ds).queryForList("""
                SELECT table_name || '.' || column_name || ' ' || udt_name || ' null=' || is_nullable
                  FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name NOT IN ('flyway_schema_history', '_prisma_migrations')
                 ORDER BY 1""", String.class);
    }

    @Test
    void baselineBuildsTheSameTablesAndColumnsAsPrismasGeneratedSchema() throws Exception {
        DataSource fromBaseline = freshDatabase();
        flyway(fromBaseline, "1").migrate();

        DataSource fromPrisma = freshDatabase();
        try (Connection c = fromPrisma.getConnection()) {
            ScriptUtils.executeSqlScript(c, new ClassPathResource("prisma-schema.sql"));
        }

        List<String> a = columns(fromBaseline);
        List<String> b = columns(fromPrisma);
        assertThat(a).isNotEmpty();
        TreeSet<String> onlyBaseline = new TreeSet<>(a);
        onlyBaseline.removeAll(b);
        TreeSet<String> onlyPrisma = new TreeSet<>(b);
        onlyPrisma.removeAll(a);
        assertThat(onlyBaseline).as("columns only in baseline V1 (test resource prisma-schema.sql may be stale?)").isEmpty();
        assertThat(onlyPrisma).as("columns only in Prisma's generated schema (baseline V1 is missing them)").isEmpty();
    }

    @Test
    void baselineKeepsTheHandWrittenCheckConstraintsPrismaCannotGenerate() throws Exception {
        DataSource ds = freshDatabase();
        flyway(ds, "1").migrate();
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        // "exactly one owner" (dealer XOR customer) checks on Order / Cart / Invoice / PaymentSubmission.
        List<String> checks = jdbc.queryForList("""
                SELECT conrelid::regclass::text FROM pg_constraint
                 WHERE contype = 'c' AND connamespace = 'public'::regnamespace
                   AND pg_get_constraintdef(oid) ILIKE '%customerId%' AND pg_get_constraintdef(oid) ILIKE '%dealerId%'""", String.class);
        assertThat(checks).as("dealer/customer exclusivity CHECKs").isNotEmpty();
    }

    @Test
    void wholeChainAppliesToAnEmptyDatabase() throws Exception {
        DataSource ds = freshDatabase();
        var result = flyway(ds, "latest").migrate();
        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isEqualTo(6); // V1 baseline script + V2 marketplace + V3 vendor onboarding + V4 listings + V5 customer type/GSTIN + V6 Delhivery warehouses
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM public.\"Order\"", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM marketplace.permission", Integer.class)).isEqualTo(23); // 22 from V2 + vendor.warehouse.manage (V6)
    }

    // ---- BaselineGuard ----------------------------------------------------------------------------

    @Test
    void guardRefusesADatabaseWithoutPrismasMigrationTable() throws Exception {
        DataSource ds = freshDatabase();
        flyway(ds, "1").migrate(); // has tables, but no _prisma_migrations
        try (Connection c = ds.getConnection()) {
            assertThatThrownBy(() -> BaselineGuard.verify(c, BaselineGuard.expectedMigrations()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("no Prisma migration table");
        }
    }

    @Test
    void guardNamesTheMigrationsPrismaHasNotApplied() throws Exception {
        DataSource ds = freshDatabase();
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        createPrismaTable(jdbc);
        List<String> expected = BaselineGuard.expectedMigrations();
        assertThat(expected).hasSize(17);
        // Everything applied except the last, plus one rolled back and one unfinished.
        for (String m : expected.subList(0, expected.size() - 1)) insertApplied(jdbc, m);
        List<String> missing = new ArrayList<>(List.of(expected.get(expected.size() - 1)));
        try (Connection c = ds.getConnection()) {
            assertThatThrownBy(() -> BaselineGuard.verify(c, expected))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining(missing.get(0));
        }
        jdbc.update("UPDATE _prisma_migrations SET rolled_back_at = now() WHERE migration_name = ?", expected.get(0));
        insertApplied(jdbc, expected.get(expected.size() - 1));
        try (Connection c = ds.getConnection()) {
            assertThatThrownBy(() -> BaselineGuard.verify(c, expected))
                    .as("a rolled-back migration does not count as applied")
                    .hasMessageContaining(expected.get(0));
        }
    }

    @Test
    void guardPassesWhenPrismaAppliedEverything() throws Exception {
        DataSource ds = freshDatabase();
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        createPrismaTable(jdbc);
        List<String> expected = BaselineGuard.expectedMigrations();
        for (String m : expected) insertApplied(jdbc, m);
        try (Connection c = ds.getConnection()) {
            BaselineGuard.verify(c, expected); // no exception
        }
    }

    @Test
    void baselineOnAnExistingPrismaDatabaseIsRecordedNotExecuted() throws Exception {
        DataSource ds = freshDatabase();
        // Simulate production: schema built by Prisma, its migration table fully populated, no Flyway history.
        try (Connection c = ds.getConnection()) {
            ScriptUtils.executeSqlScript(c, new ClassPathResource("prisma-schema.sql"));
        }
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        createPrismaTable(jdbc);
        for (String m : BaselineGuard.expectedMigrations()) insertApplied(jdbc, m);
        jdbc.update("INSERT INTO \"User\" (id, name, email, password, \"updatedAt\") VALUES ('keep', 'Keep Me', 'k@e.test', 'x', now())");

        var result = Flyway.configure().dataSource(ds)
                .schemas("public").defaultSchema("public").createSchemas(false)
                .locations("classpath:db/migration").baselineOnMigrate(true).baselineVersion("1")
                .callbacks(new BaselineGuard()).cleanDisabled(true).load().migrate();

        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).as("only V2..V6 run; V1 is adopted, not executed").isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT name FROM \"User\" WHERE id = 'keep'", String.class)).isEqualTo("Keep Me");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM public.flyway_schema_history WHERE type = 'BASELINE' AND version = '1'", Integer.class)).isEqualTo(1);
    }

    private static void createPrismaTable(JdbcTemplate jdbc) {
        jdbc.execute("""
                CREATE TABLE public._prisma_migrations (
                    id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
                    migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
                    started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0)""");
    }

    private static void insertApplied(JdbcTemplate jdbc, String name) {
        jdbc.update("INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) "
                + "VALUES (?, 'x', now(), ?, 1)", java.util.UUID.randomUUID().toString(), name);
    }
}
