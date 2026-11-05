package com.motoxplus.api;

import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
// Repositories are grouped as nested interfaces in domain.Repositories; Spring Data skips those by default.
@EnableJpaRepositories(considerNestedRepositories = true)
public class MotoxplusApiApplication {

	public static void main(String[] args) {
		// All stored timestamps are UTC wall-clock values (see Time). Pinning the JVM zone also removes
		// any DST-gap ambiguity when the JDBC driver converts LocalDateTime on the way to PostgreSQL.
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(MotoxplusApiApplication.class, args);
	}

}
