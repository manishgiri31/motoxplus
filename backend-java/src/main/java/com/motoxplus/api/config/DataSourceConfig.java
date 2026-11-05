package com.motoxplus.api.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Reads the same {@code DATABASE_URL} the Next.js/Prisma app uses
 * ({@code postgresql://user:pass@host:5432/db?schema=public}) so both services
 * can be pointed at one database with one env var. JDBC wants the credentials
 * separate from the URL and rejects Prisma-only query params like "schema".
 */
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource(@Value("${DATABASE_URL:}") String databaseUrl) {
        if (databaseUrl.isBlank()) {
            throw new IllegalStateException("DATABASE_URL must be set (postgresql://user:pass@host:5432/db)");
        }
        HikariConfig cfg = toHikariConfig(databaseUrl);
        cfg.setPoolName("motoxplus-api");
        cfg.setMaximumPoolSize(10);
        cfg.setMinimumIdle(2);
        return new HikariDataSource(cfg);
    }

    static HikariConfig toHikariConfig(String databaseUrl) {
        URI uri = URI.create(databaseUrl.replaceFirst("^postgres(ql)?:", "postgresql:"));
        if (uri.getHost() == null) {
            throw new IllegalStateException("DATABASE_URL has no host");
        }
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String db = uri.getPath() == null ? "" : uri.getPath();

        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                .append(uri.getHost()).append(':').append(port).append(db);

        // Keep real JDBC params (sslmode...), drop Prisma-only ones.
        String query = uri.getRawQuery();
        if (query != null) {
            StringBuilder kept = new StringBuilder();
            for (String pair : query.split("&")) {
                String key = pair.split("=", 2)[0];
                if (key.equals("schema") || key.equals("connection_limit") || key.equals("pgbouncer")
                        || key.equals("pool_timeout") || key.equals("connect_timeout")) {
                    continue;
                }
                if (kept.length() > 0) kept.append('&');
                kept.append(pair);
            }
            if (kept.length() > 0) jdbc.append('?').append(kept);
        }

        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(jdbc.toString());
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            String[] parts = userInfo.split(":", 2);
            cfg.setUsername(URLDecoder.decode(parts[0], StandardCharsets.UTF_8));
            if (parts.length > 1) {
                cfg.setPassword(URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
            }
        }
        return cfg;
    }
}
