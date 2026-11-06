package com.motoxplus.api.config;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Refuses to adopt an existing database as Flyway baseline V1 unless Prisma itself says that database has
 * applied every migration V1 contains. Without this, pointing the jar at a database that is one Prisma
 * migration behind would silently record "V1 applied" for a schema that is missing columns.
 * Runs only on the baseline event (existing, non-empty database with no Flyway history); an empty database
 * simply executes V1 and never reaches this.
 */
@Component
@ConditionalOnProperty(name = "app.db.baseline-guard", havingValue = "true", matchIfMissing = true)
public class BaselineGuard implements Callback {
    static final String EXPECTED_RESOURCE = "/db/prisma-baseline-migrations.txt";

    @Override
    public boolean supports(Event event, Context context) {
        return event == Event.BEFORE_BASELINE;
    }

    @Override
    public boolean canHandleInTransaction(Event event, Context context) {
        return true;
    }

    @Override
    public void handle(Event event, Context context) {
        try {
            verify(context.getConnection(), expectedMigrations());
        } catch (IOException | SQLException e) {
            throw new IllegalStateException("BaselineGuard could not verify the database: " + e.getMessage(), e);
        }
    }

    @Override
    public String getCallbackName() {
        return "BaselineGuard";
    }

    static void verify(Connection c, List<String> expected) throws SQLException {
        Set<String> applied = new LinkedHashSet<>();
        try (PreparedStatement ps = c.prepareStatement("""
                SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL""");
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            if (!rs.getBoolean(1)) {
                throw new IllegalStateException("Refusing to baseline: this database has tables but no Prisma "
                        + "migration table (_prisma_migrations), so it cannot be proven to match baseline V1.");
            }
        }
        try (PreparedStatement ps = c.prepareStatement("""
                SELECT migration_name FROM public."_prisma_migrations"
                 WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL""");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) applied.add(rs.getString(1));
        }
        List<String> missing = new ArrayList<>(expected);
        missing.removeAll(applied);
        if (!missing.isEmpty()) {
            throw new IllegalStateException("Refusing to baseline: Prisma has not applied these migrations that "
                    + "baseline V1 includes: " + missing + ". Run `prisma migrate deploy` first, then retry.");
        }
    }

    static List<String> expectedMigrations() throws IOException {
        try (InputStream in = BaselineGuard.class.getResourceAsStream(EXPECTED_RESOURCE)) {
            if (in == null) throw new IOException("missing classpath resource " + EXPECTED_RESOURCE);
            List<String> out = new ArrayList<>();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) if (!line.isBlank()) out.add(line.trim());
            }
            return out;
        }
    }
}
