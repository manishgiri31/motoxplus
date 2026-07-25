"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself (rare, but error.tsx alone
// can't — a boundary can't catch errors from the layout it's nested inside).
// Must render its own <html>/<body> since it replaces the whole root layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: 420, fontSize: 14, color: "#6b7280" }}>
            MOTOXPLUS hit an unexpected error. Please try again in a moment.
          </p>
          <button
            onClick={() => reset()}
            style={{ borderRadius: 6, background: "#dc2626", color: "#fff", padding: "8px 16px", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
