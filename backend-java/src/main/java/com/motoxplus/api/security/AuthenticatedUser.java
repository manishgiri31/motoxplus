package com.motoxplus.api.security;

/** The verified caller, available to controllers via {@code @AuthenticationPrincipal}. */
public record AuthenticatedUser(String userId, String email, String role, String sessionId) {}
