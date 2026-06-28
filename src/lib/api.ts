/**
 * Standardized API response helpers.
 * All API routes should use these functions for consistent response shapes.
 *
 * Success: { data: T }
 * Error:   { error: string, code?: string }
 * List:    { data: T[], pagination: { page, pageSize, total, totalPages } }
 */

import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function apiError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return apiError(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "Forbidden"): NextResponse {
  return apiError(message, 403, "FORBIDDEN");
}

export function notFound(resource = "Resource"): NextResponse {
  return apiError(`${resource} not found`, 404, "NOT_FOUND");
}

export function badRequest(message: string, code?: string): NextResponse {
  return apiError(message, 400, code ?? "BAD_REQUEST");
}

export function conflict(message: string): NextResponse {
  return apiError(message, 409, "CONFLICT");
}

export function tooManyRequests(message = "Too many requests"): NextResponse {
  return apiError(message, 429, "TOO_MANY_REQUESTS");
}

export function serverError(
  err: unknown,
  context?: string,
  meta?: Record<string, unknown>
): NextResponse {
  logError(context ?? "Internal server error", err, meta);
  return apiError("Internal server error", 500, "INTERNAL_ERROR");
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta
): NextResponse {
  return NextResponse.json({ data, pagination });
}

/** Parse and validate pagination params from URL search params. */
export function parsePagination(
  params: URLSearchParams,
  defaultPageSize = 20,
  maxPageSize = 100
): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(params.get("pageSize") ?? String(defaultPageSize), 10) || defaultPageSize)
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
