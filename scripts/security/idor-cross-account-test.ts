/**
 * Cross-account IDOR regression script.
 *
 * Creates two DEALER accounts (A, B) and one ADMIN account directly via
 * Prisma, gives dealer A an order, then — as dealer B, and as an
 * unauthenticated caller — attempts to read/mutate dealer A's resources
 * through every owner-scoped route this audit covered. Every attempt must
 * come back 401/403/404; a 200 on any of them is a regression.
 *
 * Requires a running app (`npm run dev` or the prod server) reachable at
 * BASE_URL, and a reachable database (same one the app is using).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/security/idor-cross-account-test.ts
 *
 * Exits non-zero if any case fails, so it can be wired into CI once a
 * disposable test database/app instance is available there.
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = "Test-Pass-1234!";
const prisma = new PrismaClient();

const MARK = "security-test"; // recognizable prefix so cleanup never touches real data

interface Session {
  cookie: string;
}

async function getSetCookies(res: Response): Promise<string[]> {
  // Node 20+ undici exposes getSetCookie(); fall back to the single-value
  // header if an older runtime is used to run this script.
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(...cookieLists: string[][]): string {
  const jar = new Map<string, string>();
  for (const list of cookieLists) {
    for (const raw of list) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// Custom JWT login (mx_access/mx_refresh cookies) — covers every route gated
// via getCurrentUserId (orders, cart, payments/create-order, payments/verify,
// cancel, tracking, cancellation-preview).
async function loginCustomJwt(identifier: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identifier, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Custom JWT login failed for ${identifier}: ${res.status} ${await res.text()}`);
  const cookies = await getSetCookies(res);
  return { cookie: mergeCookies(cookies) };
}

// NextAuth credentials login (session cookie) — covers routes gated via
// getServerSession (admin/*, orders/[id] PATCH, payments/upi/submit).
async function loginNextAuth(identifier: string): Promise<Session> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfCookies = await getSetCookies(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken,
    identifier,
    password: PASSWORD,
    redirect: "false",
    json: "true",
  });

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: mergeCookies(csrfCookies),
    },
    body: body.toString(),
    redirect: "manual",
  });
  const loginCookies = await getSetCookies(loginRes);
  const cookie = mergeCookies(csrfCookies, loginCookies);
  if (!cookie.includes("next-auth.session-token") && !cookie.includes("__Secure-next-auth.session-token")) {
    throw new Error(`NextAuth login failed for ${identifier}: no session cookie set (status ${loginRes.status})`);
  }
  return { cookie };
}

interface Case {
  name: string;
  method: string;
  path: string;
  session?: Session; // omit for unauthenticated
  body?: unknown;
  expect: number[]; // any status in this list counts as a pass
}

async function runCase(c: Case): Promise<{ name: string; pass: boolean; status: number; detail?: string }> {
  const res = await fetch(`${BASE_URL}${c.path}`, {
    method: c.method,
    headers: {
      "Content-Type": "application/json",
      ...(c.session ? { Cookie: c.session.cookie } : {}),
    },
    body: c.body ? JSON.stringify(c.body) : undefined,
  });
  const pass = c.expect.includes(res.status);
  let detail: string | undefined;
  if (!pass) {
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text().catch(() => "");
    }
  }
  return { name: c.name, pass, status: res.status, detail };
}

async function main() {
  console.log(`[idor-test] target: ${BASE_URL}`);

  const hashed = await bcrypt.hash(PASSWORD, 10);

  // --- Fixtures ---------------------------------------------------------
  await cleanup(); // in case a previous run crashed before cleanup

  const userA = await prisma.user.create({
    data: {
      name: "IDOR Test Dealer A", email: `${MARK}-dealer-a@motoxplus.test`, password: hashed,
      role: "DEALER", isActive: true, emailVerified: new Date(), mobileVerified: true,
      mobileNumber: "9000000001",
    },
  });
  const dealerA = await prisma.dealer.create({
    data: { userId: userA.id, companyName: "IDOR Test Co A", ownerName: "Dealer A", phone: "9000000001", state: "MH", city: "Pune", status: "ACTIVE" },
  });

  const userB = await prisma.user.create({
    data: {
      name: "IDOR Test Dealer B", email: `${MARK}-dealer-b@motoxplus.test`, password: hashed,
      role: "DEALER", isActive: true, emailVerified: new Date(), mobileVerified: true,
      mobileNumber: "9000000002",
    },
  });
  await prisma.dealer.create({
    data: { userId: userB.id, companyName: "IDOR Test Co B", ownerName: "Dealer B", phone: "9000000002", state: "MH", city: "Pune", status: "ACTIVE" },
  });

  const adminUser = await prisma.user.create({
    data: {
      name: "IDOR Test Admin", email: `${MARK}-admin@motoxplus.test`, password: hashed,
      role: "ADMIN", isActive: true, emailVerified: new Date(), mobileVerified: true,
      mobileNumber: "9000000003",
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `${MARK}-${crypto.randomUUID().slice(0, 8)}`,
      dealerId: dealerA.id,
      subtotal: 1000, gstAmount: 180, shippingCost: 0, grandTotal: 1180,
      paymentType: "FULL_100", amountDue: 1180, amountPaid: 0,
      status: "PENDING", paymentStatus: "PENDING", stockReserved: false,
      deliveryPincode: "411001",
    },
  });

  console.log(`[idor-test] fixtures ready: dealerA order=${order.id}`);

  // --- Sessions -----------------------------------------------------------
  const bJwt = await loginCustomJwt(userB.email);
  const bNextAuth = await loginNextAuth(userB.email);
  const adminNextAuth = await loginNextAuth(adminUser.email);

  // --- Cases ----------------------------------------------------------------
  const cases: Case[] = [
    // Dealer B attempting to reach dealer A's order via every owner-scoped route
    { name: "GET  /api/orders/[id]              (dealer B -> dealer A's order)", method: "GET", path: `/api/orders/${order.id}`, session: bJwt, expect: [403] },
    { name: "GET  /api/orders/[id]/tracking      (dealer B -> dealer A's order)", method: "GET", path: `/api/orders/${order.id}/tracking`, session: bJwt, expect: [403] },
    { name: "GET  /api/orders/[id]/cancellation-preview (dealer B)", method: "GET", path: `/api/orders/${order.id}/cancellation-preview`, session: bJwt, expect: [403, 404] },
    { name: "POST /api/orders/[id]/cancel        (dealer B -> dealer A's order)", method: "POST", path: `/api/orders/${order.id}/cancel`, session: bJwt, body: { reasonCode: "OTHER" }, expect: [403] },
    { name: "GET  /api/payments/upi/[orderId]    (dealer B -> dealer A's order)", method: "GET", path: `/api/payments/upi/${order.id}`, session: bJwt, expect: [403, 404] },
    { name: "POST /api/payments/create-order     (dealer B -> dealer A's order)", method: "POST", path: `/api/payments/create-order`, session: bJwt, body: { orderId: order.id }, expect: [403, 400] },
    { name: "POST /api/payments/upi/submit       (dealer B -> dealer A's order)", method: "POST", path: `/api/payments/upi/submit`, session: bNextAuth, body: { orderId: order.id, payerName: "x", payerEmail: "x@x.com", utrNumber: "123456789012", paymentMethod: "UPI", screenshotUrl: "https://example.com/x.png" }, expect: [403, 404] },

    // Admin-only route reachable by a DEALER session — role check, not ownership
    { name: "PATCH /api/orders/[id]              (dealer B, admin-only route)", method: "PATCH", path: `/api/orders/${order.id}`, session: bNextAuth, body: { status: "PROCESSING" }, expect: [401, 403] },
    { name: "GET  /api/admin/stats               (dealer B)", method: "GET", path: `/api/admin/stats`, session: bNextAuth, expect: [401, 403] },
    { name: "GET  /api/admin/users/[id]          (dealer B -> dealer A's user record)", method: "GET", path: `/api/admin/users/${userA.id}`, session: bNextAuth, expect: [401, 403] },

    // Sanity check: admin CAN reach admin routes (proves the 403s above are
    // real authorization failures, not the route being broken/misconfigured)
    { name: "GET  /api/admin/stats               (admin — should succeed)", method: "GET", path: `/api/admin/stats`, session: adminNextAuth, expect: [200] },

    // Unauthenticated
    { name: "GET  /api/orders/[id]               (no session)", method: "GET", path: `/api/orders/${order.id}`, expect: [401] },
    { name: "GET  /api/admin/stats               (no session)", method: "GET", path: `/api/admin/stats`, expect: [401, 403] },
  ];

  const results = [];
  for (const c of cases) results.push(await runCase(c));

  console.log("\n[idor-test] results:");
  let failures = 0;
  for (const r of results) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  (${r.status})  ${r.name}${r.pass ? "" : `  -- ${r.detail}`}`);
    if (!r.pass) failures++;
  }

  console.log(`\n[idor-test] ${results.length - failures}/${results.length} passed`);
  await cleanup();
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: MARK } } });
  await prisma.dealer.deleteMany({ where: { user: { email: { startsWith: MARK } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: MARK } } });
}

main()
  .catch(async (err) => {
    console.error("[idor-test] fatal error:", err);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
