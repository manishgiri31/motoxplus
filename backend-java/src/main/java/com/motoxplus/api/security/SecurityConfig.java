package com.motoxplus.api.security;

import com.motoxplus.api.auth.SessionService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtService jwt, SessionService sessions) throws Exception {
        http
                // Stateless JSON API authenticated by SameSite=Lax cookies / Bearer tokens, like the Next.js app.
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Same-origin behind Nginx; no cross-origin access is intended.
                .cors(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/health/**", "/actuator/health/**").permitAll()
                        // Public read-only catalog endpoints (the storefront browses without logging in).
                        .requestMatchers(HttpMethod.GET, "/api/categories", "/api/products/search", "/api/part-categories").permitAll()
                        // Logout must always succeed (it just clears cookies); refresh authenticates by refresh token.
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/refresh", "/api/auth/logout").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> writeJson(res, 401, "Unauthorized"))
                        .accessDeniedHandler((req, res, ex) -> writeJson(res, 403, "Forbidden")))
                .addFilterBefore(new JwtAuthFilter(jwt, sessions), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * No user store: authentication is entirely JWT-based. Declaring this bean stops Spring Boot
     * from generating a default user with a random password it prints to the log.
     */
    @Bean
    UserDetailsService noUserDetails() {
        return username -> { throw new UsernameNotFoundException("password login is handled by /api/auth/login"); };
    }

    private static void writeJson(jakarta.servlet.http.HttpServletResponse res, int status, String message) throws java.io.IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
