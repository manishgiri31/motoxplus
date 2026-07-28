/**
 * Runs exactly once when the Next.js server process starts (both `next dev`
 * and `next start`/PM2), before any request is served — the actual "boot"
 * hook, unlike src/lib/env.ts's validation which only fires the first time
 * something imports it (via prisma.ts/auth.ts), which in practice means
 * "on the first request that happens to hit a route using Prisma," not
 * necessarily at startup. Kept as a defense-in-depth secondary check.
 *
 * The Node-only logic lives in a SEPARATE module (./instrumentation-node),
 * imported dynamically behind a literal `=== "nodejs"` comparison — not just
 * inlined here behind a runtime `if`. That distinction matters: Next.js's
 * build system statically replaces `process.env.NEXT_RUNTIME` with a literal
 * string per compilation target (via DefinePlugin), so for the Edge target
 * this condition becomes the always-false `"edge" === "nodejs"`. Because the
 * unreachable branch is a *dynamic import of another module* rather than
 * inline code, webpack's dead-code elimination can drop the entire import
 * — and everything it pulls in — before ever trying to resolve its
 * dependencies. That's what actually keeps `ioredis` (which needs Node's
 * stream/crypto/dns/net, unavailable on Edge) out of the Edge bundle.
 *
 * A `!==`-guarded early `return` around the same inline code (the previous
 * shape of this file) type-checks and behaves identically at runtime, but
 * does NOT prevent webpack from eagerly resolving a dynamic `import()` sitting
 * inside the "live" branch — dynamic imports are treated as code-splitting
 * points independent of the surrounding control flow. That gap broke both
 * `next dev` (every middleware-matched route runs the Edge bundle, so
 * `/login`, `/register`, and all of `/dealer|/vendor|/admin` 500'd) and
 * `next build` (webpack tried to bundle ioredis for every target it compiles,
 * not only the one that would actually execute this code).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
