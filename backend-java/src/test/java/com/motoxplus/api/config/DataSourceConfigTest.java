package com.motoxplus.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.zaxxer.hikari.HikariConfig;
import org.junit.jupiter.api.Test;

class DataSourceConfigTest {
    @Test
    void convertsAPrismaStyleUrlToJdbcAndDropsPrismaOnlyParams() {
        HikariConfig cfg = DataSourceConfig.toHikariConfig(
                "postgresql://motoxplus:s3cret@db.internal:5433/motoxplus?schema=public&connection_limit=5&sslmode=require");
        assertThat(cfg.getJdbcUrl()).isEqualTo("jdbc:postgresql://db.internal:5433/motoxplus?sslmode=require");
        assertThat(cfg.getUsername()).isEqualTo("motoxplus");
        assertThat(cfg.getPassword()).isEqualTo("s3cret");
    }

    @Test
    void decodesPercentEncodedCredentialsAndDefaultsThePort() {
        HikariConfig cfg = DataSourceConfig.toHikariConfig("postgres://us%40er:p%40ss%2Fw%3Ard@localhost/mydb");
        assertThat(cfg.getJdbcUrl()).isEqualTo("jdbc:postgresql://localhost:5432/mydb");
        assertThat(cfg.getUsername()).isEqualTo("us@er");
        assertThat(cfg.getPassword()).isEqualTo("p@ss/w:rd");
    }
}
