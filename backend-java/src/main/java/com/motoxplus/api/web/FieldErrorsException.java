package com.motoxplus.api.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * A request that failed business validation on specific fields. Rendered by GlobalExceptionHandler as
 * {@code {error, code, fieldErrors: {field: message}}}, the shape src/lib/api/client.ts already reads, so forms can
 * show each message next to its field.
 */
public class FieldErrorsException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    public FieldErrorsException(HttpStatus status, String code, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = Map.copyOf(new LinkedHashMap<>(fieldErrors));
    }

    /** 400 VALIDATION_FAILED; the first field's message doubles as the summary. */
    public static FieldErrorsException invalid(Map<String, String> fieldErrors) {
        String first = fieldErrors.values().stream().findFirst().orElse("Validation failed");
        return new FieldErrorsException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", first, fieldErrors);
    }

    public static FieldErrorsException invalid(String field, String message) {
        return invalid(Map.of(field, message));
    }

    /** 409 for "already registered" style conflicts on a specific field. */
    public static FieldErrorsException conflict(String field, String message) {
        return new FieldErrorsException(HttpStatus.CONFLICT, "CONFLICT", message, Map.of(field, message));
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public Map<String, String> fieldErrors() { return fieldErrors; }
}
