# MOTOXPLUS Marketplace — Frontend Phase 0 Audit & Proposal

**Status:** For approval. No frontend code changed. **Date:** 2026-11-05.
**Method:** read-only inspection of `src/app` (routes/layouts), `src/components`, `tailwind.config.ts`, `globals.css`, `middleware.ts`,
`lib/auth/*`, `next.config.mjs`, `package.json`, plus the Java backend's `/api/v1` surface from Phase 1.
**Not done:** I did not run the app or look at rendered pages (it needs a database), so visual judgements below come from code and tokens, not screenshots.
Companion document: `PHASE-0-AUDIT.md` (backend). Backend decisions D1–D9 there still apply.

---

## 0. Where your prompt and the repository disagree

| # | Prompt says | Repo reality | Consequence |
|---|---|---|---|
| F1 | Brand: red `#E11D2A`, near-black `#0A0A0B`, **Space Grotesk** + Inter | The site was re-themed on 29 Oct to an **Apple-Store look** (`apple-store-design-system.md`). Token `--red` is literally `#0071E3` (blue), accent `#0071E3`, canvas `#F5F5F7`, fonts **Inter + IBM Plex Mono** (Schibsted Grotesk was loaded then removed; Space Grotesk was never added). Light theme is *forced* (`forcedTheme="light"`). | Following the prompt = a visible brand change from the current site. Needs your call (decision F1). |
| F2 | Next.js **14** | **Next 15.5.21**, React 18, Tailwind 3.4, `next-auth` 4, Prisma 6. | No problem; async `searchParams` already used. Prompt text should say 15. |
| F3 | `/vendor/*` = marketplace seller portal; `/admin/vendors` = vendor management; `/become-a-vendor` | **All of these already exist and mean *procurement suppliers*** (`/vendor/{dashboard,products,products/new,purchase-orders,payments,invoices,profile}`, `/admin/vendors{,/new,/[id]}`, `/become-vendor` = "Supply to MotoXPlus": raw materials, packaging, printing, logistics…). `middleware.ts` and `/vendor/layout.tsx` hard-code role `VENDOR` → supplier portal. | Same collision as backend D1. Reusing the paths would break the live supplier portal (rule 22.1/22.2/22.18). Needs a naming decision (F2-decision). |
| F4 | Centralised API client + **TanStack Query** "if compatible" | **No client data layer exists.** 85 files call `fetch()` directly; no React Query/SWR; `lib/api.ts` is *server-side* response helpers (`{data}` / `{error, code}`), not a client. No chart library installed. | Greenfield data layer. Query is compatible (React 18 + Next 15); adding it is justified by the amount of server-state in seller/admin screens. Charts need a decision (see §8). |
| F5 | "Frontend must talk to Java through a centralised client; no second auth system" | Browser login **already sets httpOnly `mx_access` (15 min) + `mx_refresh` (7 d) cookies, `SameSite=Lax`, path `/`** alongside the NextAuth cookie (`lib/auth/web-session.ts`). Java's filter reads exactly `mx_access`. | **Good news:** same-origin `fetch('/api/v1/…', {credentials:'include'})` is already authenticated. No token in JS, no bridge route, no CORS. This resolves backend D8. |
| F6 | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1` | CSP is `connect-src 'self' …razorpay… r2`; Java has CORS **disabled** by design. | Use a **relative** base `/api/v1`, with Nginx (prod) and a Next `rewrites()` (dev) proxying to `127.0.0.1:8080`. An absolute cross-origin URL would be blocked by CSP and by Java. |
| F7 | Public routes `/cart`, `/checkout`, `/orders`, `/account` | Cart/checkout/orders live **under** `/account/*` (B2C) and `/dealer/*` (B2B); `middleware` bounces roles between portals. | Add thin top-level `/cart` and `/checkout` that resolve by role and redirect, rather than duplicating pages. |
| F8 | "Show real automotive imagery / realistic data" | Home page is driven by `src/data/store-products.json` (a static curated list), and its product links go to `/products?search=…`, not to product pages. | Marketplace home must read live API data; the static JSON stays as editorial/marketing content only. |

---

## 1. Existing frontend architecture

* **Next.js App Router**, server components by default; most list pages are RSC that read Prisma directly (backend README counts 53 such pages), interactive screens are large client components (`product-catalog.tsx` 1,158 lines, `product-detail-client.tsx` 874).
* **Layout shells:** root (`Providers`: NextAuth `SessionProvider`, next-themes, framer-motion `MotionConfig reducedMotion="user"`, toploader, toaster) → `(public)` (Navbar, Footer, skip-link, WhatsApp/APK buttons) · `/account`, `/dealer`, `/vendor`, `/admin` each with `layout.tsx` using `getServerSession` + `PortalShell` + a role sidebar.
* **Styling:** Tailwind 3 + CSS custom properties; Radix primitives; `lucide-react`; `framer-motion` (used sparingly: `Reveal`).
* **Fonts:** self-hosted (`next/font/local`) so builds never hit Google: Inter VF, IBM Plex Mono, Geist (legacy fallback).
* **Images:** `next/image`, R2 bucket whitelisted in `next.config.mjs` + CSP.
* **Tests:** Vitest only, **53 `.test.ts`, 0 `.test.tsx`** (no component tests); Playwright is a devDependency but no e2e suite found.

## 2. Existing route inventory (92 pages)

| Area | Routes |
|---|---|
| Public `(public)` | `/`, `/products`, `/products/[slug]`, `/vehicles`, `/vehicles/[category]`, `/vehicles/[category]/[slug]`, `/about`, `/contact`, `/become-dealer`, `/become-vendor` *(supplier)*, `/terms`, `/privacy`, `/cancellation-policy`; root-level catch route `/[brand]/[vehicle]/[category]` |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify-mobile`, `/pending-approval` |
| B2C `/account` | `cart`, `checkout`, `orders`, `orders/[id]`, `orders/[id]/pay-upi`, `invoices/[id]` |
| B2B `/dealer` | `dashboard`, `products`, `cart`, `checkout`, `orders`, `orders/[id]`, `…/pay-upi`, `…/tracking`, `invoices`, `invoices/[id]`, `documents`, `profile` |
| Supplier `/vendor` | `dashboard`, `products`, `products/new`, `purchase-orders`, `payments`, `invoices`, `profile` |
| Admin `/admin` (≈45) | dashboard, dealers, vendors (suppliers), products (+import/consolidate), orders, invoices, payments, refunds, reviews, schemes, vehicles (+manufacturers/sections/types), crm, procurement, staff, admins, settings |

**Missing vs your list:** `/marketplace`, `/categories/[slug]`, `/brands/[slug]`, `/search`, top-level `/cart` `/checkout` `/orders`, all seller screens (registration wizard, onboarding, verification, pending-approval, inventory, shipments, returns, settlements, analytics, documents, support), and every `/admin/marketplace*` screen. Routing risk: the root `[brand]/[vehicle]/[category]` catch route is 3 segments; new top-level static segments (`/marketplace`, `/search`, `/cart`) win over it, and 2-segment `/categories/[slug]`, `/brands/[slug]` don't match it, so there is no collision — but any future 3-segment top-level path would be swallowed by it.

## 3. Existing reusable components (keep and extend)

| Need in your list | Exists | Verdict |
|---|---|---|
| DataTable | `ui/data-table.tsx` — server-component-friendly (pre-rendered cells, string hrefs), skeleton, aria-sort, caption, tabular nums | **Reuse.** Add a client variant with callbacks for sortable/selectable interactive tables (the file already anticipates it). |
| Pagination, FilterBar | `ui/pagination.tsx`, `ui/filter-chips.tsx` | Reuse; align to the Java envelope `{items,page,size,total,totalPages}` (page is **0-based**). |
| PageHeader, EmptyState, Skeleton, Spinner, StatCard | present | Reuse. Add `ErrorState` (missing). |
| StatusBadge | `ui/status-badge.tsx` driven by `lib/status.ts` domains; icon+label, never colour-only | Reuse; add domains: `vendor`, `listing`, `vendorOrder`, `settlement`, `shipment`. Do **not** invent a parallel badge. |
| Button, Card, Dialog, Field/inputs, Toast | `ui/*` (two button families: `ui/button` for portals, `store/button` for storefront) | Reuse; Dialog → `ConfirmationDialog` wrapper. |
| Numeral / technical labels | `ui/numeral.tsx`, `ui/technical.tsx` (Eyebrow, mono SKU) | Reuse for price/SKU typography. |
| Portal shell/sidebar | `portal/portal-shell.tsx` + three role sidebars | Reuse the shell; new `seller-sidebar`, `marketplace-admin-sidebar`. |
| Navbar/Footer | `layout/navbar.tsx` (169 lines, Apple-style, "Become a Dealer" CTA) | Extend (search, vehicle selector, cart, vendor CTA) — don't replace. |
| Product card | `store/product-card.tsx` (marketing-style, takes `StoreProduct`), catalogue card inside `product-catalog.tsx` | **New** `OfferProductCard` needed (seller, offers, stock, dual price). Don't bend the marketing card. |
| Vehicle selection / fitment | `vehicles/variant-selector.tsx`, `vehicle-card/grid`, `parts-diagram`, `lib/vehicle/compatibility.ts`, catalogue filters `?vehicle&variant&section` | **Reuse as-is** (rule 22.3). Wrap in a `VehicleSelector` that only emits those query params. |
| Document upload | `dealer/document-uploader.tsx` (R2, signed URLs, audit) | Reuse the pattern for KYC `FileUpload`. |
| Tracking | `shipping/tracking-timeline.tsx`, `pincode-checker.tsx`, `shipping-estimate.tsx` | Reuse for buyer/seller tracking views. |
| Forms | react-hook-form + zod + `@hookform/resolvers` already dependencies | Use for all wizards. |
| Charts | **none** | See §8. |
| Image gallery/zoom | none dedicated (`product-detail-client` has its own) | New `ImageGallery`, extract from detail page only if it simplifies. |

## 4. Existing design system (what is actually in the code)

Three overlapping layers, which is the main design-debt finding:
1. **Industrial ramp** (`--carbon-0…1000`, remapped Tailwind colour ramps with WCAG-aware 300/400/500 steps; ~726 opacity-modifier call sites depend on the `rgb(var(--x) / <alpha-value>)` form — must not be converted to hex).
2. **v2 semantic tokens** `paper / card / ink / muted / line / brand(red)` — plain hex vars, no opacity modifier; `--red` now holds the Apple blue.
3. **Store (Apple) palette** `store.*` + 17/28px type scale + `rounded-store-card` + apple easing — used by home/navbar/footer.

Other facts: light-only; type = Inter/IBM Plex Mono; a status system with icon+label; reduced-motion respected; skip-link present; semantic table markup. Quality is already above "default shadcn". Weaknesses I can see from code (to be confirmed visually): the storefront (Apple look) and the portals (industrial/`paper` look) are two visual languages; `--red` naming is now misleading and will confuse anyone adding the brand red.

## 5. Existing authentication flow

```
Login (/api/auth/login | login-otp | NextAuth credentials)
  └─ establishWebSession(): UserSession row + 3 httpOnly cookies
        mx_access (15m JWT HS256, iss motoxplus-api)  ── read by Java JwtAuthFilter
        mx_refresh (7d)                               ── /api/auth/refresh (Node) and /api/auth/refresh (Java) rotate
        next-auth.session-token (8h prod)             ── read by middleware.ts + getServerSession()
Page gating:  middleware.ts (role→portal redirects, email/mobile verification, vendor APPROVED check) + each layout's getServerSession()
API gating:   getCurrentUserId(req) accepts NextAuth cookie OR mx_access OR Bearer
```
Implications: (a) page protection stays NextAuth/middleware (cheap, existing) while data calls go to Java with `mx_access`; (b) the 15-minute access token needs a **single-flight refresh-then-retry on 401** in the API client; (c) roles are strings in the token — the UI may *hide* things from `/api/v1/me/permissions`, never *grant* them; (d) `SELLER`/`SELLER_STAFF` don't exist in the DB enum yet (backend Phase 2), so seller route guards can't be tested end-to-end until then; (e) `middleware.ts` matcher must be extended for any new protected prefix (`/seller`, `/cart`, `/checkout`).

## 6. Existing API integration

* Next route handlers under `/api/**` (165), unversioned, shapes inconsistent (`{data}` helper vs raw objects vs `{error}` only). Client code calls them with ad-hoc `fetch` + local loading/error state.
* Java (`/api/v1`, Phase 1): `GET /me/permissions`, `GET /admin/rbac/roles`, OpenAPI at `/api/v1/openapi`; errors `{error, code?, retryAfterSeconds?, fieldErrors?}`; paging `{items,page,size,total,totalPages}`; money in **integer paise** (`Money`) — the UI needs one `formatPaise()` and must never divide floats for arithmetic.
* Existing storefront pricing: server resolves channel (`lib/pricing/channel.ts`); guest sees B2B display, `CUSTOMER` sees B2C (MRP-only). Marketplace price display must come from the offers API with the buyer type decided server-side (rule 22.4/22.8).

---

## 7. Missing marketplace screens (gap list by phase)

| Phase | Missing |
|---|---|
| Design system | `ErrorState`, `ConfirmationDialog`, `FileUpload`, `ImageGallery`, `PriceDisplay` (MRP/retail/dealer/discount, paise-aware), `CompatibilityBadge`, `Breadcrumbs`, `SearchBar`, `NotificationDropdown`, `Stepper`, client `DataTable` variant, chart primitives, new status domains |
| Public | `/marketplace`, offer-aware product page (seller comparison), `/categories/[slug]`, `/brands/[slug]`, `/search`, unified `/cart` `/checkout` with multi-seller grouping, order timeline with sub-orders/shipments |
| Acquisition | seller landing, registration wizard (6 steps), onboarding/verification/pending-approval/rejected/suspended states |
| Seller portal | dashboard, products list + 7-step add wizard + CSV/Excel bulk upload, inventory, orders (+tabs), order detail, shipments/pickup flow, returns, payments, settlements, analytics, profile, documents, support |
| Admin | marketplace overview, vendor list/detail, KYC/document review, listing moderation (duplicate check, reject-with-reason, request changes), marketplace orders (+sub-orders), shipments, commissions editor, settlements approval, returns/disputes, analytics, settings |

**Blocked on backend:** almost every seller/admin/offer screen needs Phase 2–7 APIs that don't exist yet (only RBAC introspection does). Screens can be built against the OpenAPI contract with typed mocks **in development only** (rule 20), but cannot be marked "done" until the endpoints exist.

---

## 8. Proposed folder structure

Follows your layout, adapted to what exists (don't create parallel `components/shared` next to `components/ui`):

```
src/
  lib/api/                      client.ts (fetch wrapper: base /api/v1, credentials, 401→refresh→retry once,
                                  AbortSignal, ApiError{status,code,fieldErrors}, paise helpers import)
                                auth.api.ts  catalog.api.ts  seller.api.ts  inventory.api.ts  order.api.ts
                                shipping.api.ts  settlement.api.ts  admin.api.ts   (types generated from /api/v1/openapi)
  lib/money.ts                  formatPaise(), no float arithmetic
  hooks/                        useMe, usePermissions, useSellerProducts, useSellerOrders, useOffers, useSettlements …
                                (thin TanStack Query wrappers; keys centralised in lib/api/keys.ts)
  components/ui/                (existing) + ErrorState, ConfirmationDialog, FileUpload, Stepper, Breadcrumbs, PriceDisplay …
  components/market/            OfferProductCard, SellerOffers, VehicleSelector, CompatibilityBadge, ImageGallery, CartGroup
  components/seller/            SellerSidebar, SellerMetrics, SellerProductTable, ProductFormWizard, OnboardingStepper …
  components/marketplace-admin/ VendorApprovalCard, DocumentReviewPanel, ListingModerationTable, CommissionEditor …
  app/(public)/marketplace|search|categories|brands|become-a-seller
  app/seller/…                  (see F3 decision)
  app/admin/marketplace/…       (nested under one prefix: keeps admin nav and permissions separable from existing admin)
```

## 9. Migration and integration strategy

1. **Strangler, additive only.** New routes, new components, one new dependency; no existing page is edited except: navbar (links), `middleware.ts` (matcher + seller rules), `status.ts` (new domains), admin sidebar (one entry).
2. **Namespace** (F3 decision): seller area at `/seller/*`, admin at `/admin/marketplace/*`, landing at `/become-a-seller`; existing `/vendor/*`, `/admin/vendors`, `/become-vendor` stay untouched and keep serving suppliers. Rename supplier UI copy to "Supplier" later, optional. (If you insist on `/vendor/*`, the supplier portal must be moved first — a breaking change I'd advise against.)
3. **API access:** one client; relative `/api/v1`; Nginx `location /api/v1/ → 127.0.0.1:8080`; dev `rewrites()` in `next.config.mjs`. No new env secrets; `NEXT_PUBLIC_API_BASE_URL` defaults to `/api/v1`.
4. **Data layer:** add `@tanstack/react-query` (one provider in `Providers`). Server components may call Java server-side by forwarding the incoming cookies for SEO pages (marketplace/product/offer pages need SSR + metadata).
5. **Guards:** NextAuth/middleware gates *pages*; every screen also handles API 401/403 (session expiry → login with return URL; 403 → Forbidden state) because backend is the authority. Seller state pages (`pending`, `rejected`, `suspended`) driven by `GET /vendors/me` status, not by client-held role.
6. **Cart/checkout:** keep existing B2C/B2B cart+checkout flows working; marketplace cart is a new Java-backed cart (grouped by seller) behind a flag; `/cart` and `/checkout` redirect by role until the marketplace cart replaces them. Feature flag `NEXT_PUBLIC_MARKETPLACE_ENABLED` (and backend `MARKETPLACE_ENABLED`) so nothing is visible in production until ready.
7. **Charts:** recommend a small SVG-first approach (Recharts adds ~90 KB gz; the dashboards need only line/bar/sparkline). Decision F5 below. The `dataviz` guidance will be applied when building them.
8. **Testing:** add `@testing-library/react` + jsdom to Vitest (component tests: wizard validation, status badges, price display, API client 401-retry); Playwright (already installed) for 4–5 critical flows against a seeded test DB; accessibility checks with axe in those flows.
9. **Seed data:** dev-only fixtures behind `NODE_ENV !== 'production'`; production code paths never contain sample vendors, prices, stock or reviews.

## 10. Roadmap

| Phase | Deliverable | Depends on | Can start now? |
|---|---|---|---|
| F1 Design system | Tokens decision, new primitives, status domains, API client + Query provider, `/api/v1` proxy, storybook-style `/dev/ui` page | Decision F1 | **Yes** |
| F2 Public marketplace | Marketplace home, offer card, product page + seller comparison, search, categories/brands, vehicle selector, cart/checkout | Backend Phase 3–4 (offers, cart, checkout) | UI against OpenAPI mocks; ship dark behind flag |
| F3 Seller acquisition | Landing, registration wizard, KYC, state pages | Backend Phase 2 | Landing page yes; wizard needs APIs |
| F4 Seller portal | Dashboard, products, inventory, orders, shipments, settlements, analytics | Backend Phases 3, 5, 6 | After 2 |
| F5 Admin marketplace | Vendors, KYC review, moderation, orders, commissions, settlements, analytics | Backend Phases 2–7 | After 2 |
| F6 Integration | Replace mocks, refresh handling, permission-driven UI, webhook-driven refresh (polling/`refetchOnFocus` — no websockets planned) | Backend phases | — |
| F7 Hardening | Responsive pass on real phones, a11y, perf budgets, e2e | all | — |

Order recommendation: F1 now → F3 landing → build F2/F4/F5 screen-by-screen **in step with** backend Phases 2→3→4→5/6→7, so no screen is built against an API that later changes.

---

## 11. Decisions needed from you

| ID | Decision | My recommendation |
|---|---|---|
| **F1** | Brand: adopt the prompt's red/near-black + Space Grotesk, or keep the current Apple-store look? | The site was deliberately restyled on 29 Oct, and the prompt (5 Nov) asks for a different identity. I'd **apply your new brand** (red `#E11D2A` accent on CTAs/prices/active states, near-black chrome, Space Grotesk headings, Inter body) as one coherent token set **scoped via a root class to the marketplace + seller + marketplace-admin areas first**, then roll it to the rest of the site once you've seen it. Avoids re-theming 90 existing pages in one go. Requires self-hosting Space Grotesk (OFL licence) like the other fonts. Also rename the misleading `--red` var. |
| **F2** | Seller namespace given existing supplier `/vendor/*`. | `/seller/*`, `/admin/marketplace/*`, `/become-a-seller`; leave supplier pages alone. Matches backend `SELLER` role (D1). |
| **F3** | Add TanStack Query. | Yes (single dependency, justified by seller/admin server-state). |
| **F4** | API base: relative `/api/v1` (proxy) vs absolute `NEXT_PUBLIC_API_BASE_URL`. | Relative; the prompt's absolute localhost URL would be blocked by CSP and Java's disabled CORS. |
| **F5** | Charts: hand-rolled SVG vs Recharts. | Small SVG components (line/bar/sparkline, accessible, ~no bundle cost). |
| **F6** | Mock data for screens ahead of the backend. | Dev-only typed fixtures behind a flag, never in production bundles; or hold seller/admin screens until their APIs exist. I recommend building in lock-step with backend phases. |
| **F7** | Public `/products` route: the marketplace shares the catalogue URL space. | Keep `/products` and `/products/[slug]` as canonical and make them **offer-aware** when `MARKETPLACE_ENABLED`; `/marketplace` is the curated landing, not a second catalogue. |

*Unverified:* rendered appearance/responsiveness of existing pages; real mobile behaviour; contents of `product-catalog.tsx` internals beyond its size; whether `AUDIT/*.md` contain frontend findings that overlap.
