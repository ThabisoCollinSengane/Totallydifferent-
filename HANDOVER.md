# Totallydifferent — Handover & Upgrade Guide

Premium clothing & hair e-commerce for South Africa. Backend-first, API-first.
This document is a handover for any developer (or AI assistant like GitHub Copilot)
picking up the project for review or further upgrades.

- **Live site:** https://totallydifferent.vercel.app
- **Repo:** https://github.com/ThabisoCollinSengane/Totallydifferent-
- **Owner:** Thabiso Collins Engane — thacollin2@gmail.com

---

## 1. Stack at a glance

| Layer | Tool | Notes |
|---|---|---|
| Hosting | Vercel (serverless, Node 20) | Production deploys from `main` |
| Database | Supabase — project `ekmgnrnlhksqywdmftcs` (sa-east-1) | Postgres + RPCs |
| Payments | Paystack (ZAR only) | verify-before-confirm, 3× retry |
| Email | Resend | fire-and-forget — never blocks the order flow |
| Frontend | Vanilla HTML/CSS/JS (no framework) | single-page store in `apps/store/index.html` |

---

## 2. Repository map

```
api/
  index.js          All 5 engines (Product, Cart, Payment, Order, Admin) + Paystack webhook
  shared.js         sb(), calcShipping(), recomputeTotal(), verifyPaystackTx(),
                    decrementStock(), sendEmail(), orderConfirmHtml()
apps/
  store/index.html  Storefront SPA (catalog, brands, cart, checkout entry)
  admin/index.html  Admin dashboard (product/order management, password login)
  checkout/confirm.html  Post-payment confirmation page
assets/
  brands/           Brand logos + lifestyle hero photos
  products/         Product photography
  hair/             Hair category imagery
tests/
  unit.test.js      Pure logic (shipping, HMAC, order-ref format)
  api.test.js       Route handlers (Supabase mocked — no real network)
vercel.json         Rewrite /api/(.*) → /api/index.js ONLY
```

> **vercel.json rule:** never add a `/(.*) → index.html` catch-all — it breaks API routing.

---

## 3. API contract

| Method | Path | Engine | Notes |
|---|---|---|---|
| GET | /api/brands | Product | Active brands, ordered by `sort` |
| GET | /api/products | Product | `?category=clothing\|hair`, `?subcategory=`, `?brand=` |
| GET | /api/products/:id | Product | 404 when not found |
| POST | /api/cart/validate | Cart | Server-side price recompute |
| POST | /api/checkout/init | Payment | Returns Paystack auth URL |
| GET | /api/checkout/confirm | Payment | Verifies → confirms → decrements stock → emails |
| GET | /api/orders/:ref | Order | Public order lookup |
| POST | /api/payments/webhook | Payment | HMAC-verified Paystack webhook |
| GET | /api/admin/products | Admin | `Authorization: Bearer <SUPABASE_SERVICE_KEY>` |
| POST | /api/admin/products | Admin | Bearer required |
| PATCH | /api/admin/orders/:ref | Admin | Bearer required |

---

## 4. Database schema (Supabase)

```
brands            id(text PK), name, tagline, story, gender, hero_image, logo_image,
                  theme_bg, theme_accent, theme_text, glow(bool), sort(int), is_active
products          id(text PK), name, category(clothing|hair), subcategory, brand_id(FK),
                  base_price, currency(ZAR), images[], is_active, is_featured
product_variants  id(uuid PK), product_id(FK), label, size, colour, volume,
                  price_override, stock, sku(unique)
orders            id(uuid PK), order_ref(unique), buyer_name, buyer_email, items(jsonb),
                  subtotal, shipping_fee, total, status, paystack_ref
```

**RPCs**
- `decrement_stock(variant_id, qty)` — atomic, never goes negative
- `touch_updated_at()` — trigger on `orders` UPDATE

---

## 5. Brand system & the floating banner (frontend)

The storefront is brand-led for the Clothing category. All logic lives in
`apps/store/index.html`.

**Brand cards (Clothing landing):** each card is themed with the brand's
`theme_bg / theme_accent / theme_text` and runs a slideshow — logo first
(`bl-slide--logo`, lingers ~5s), then cross-fades through the brand's product
photos. Built in `brandCardHTML()` / `initBrandSlideshows()`.

**Floating brand banner (per brand clicked):** when a brand is opened
(`openBrand()`), a pinned, glassy banner (`.brand-bar`) shows the brand
**logo + name + tagline** and stays on top (CSS `position: sticky`) as you scroll
the catalog — styled after pulsefy.co.za. The lifestyle hero photo below
(`.banner-hero.has-hero`) is clean and carries only the brand story.
Theme CSS vars cascade into the bar so it recolours per brand automatically.

Key element IDs (kept stable so JS keeps working): `banner-logo`, `banner-name`,
`banner-tag`, `banner-story`, `theme-banner`, `banner-hero`.

### How to add / edit a brand
1. Insert a row in the Supabase `brands` table (set `theme_*`, `sort`, `is_active`).
2. Drop logo + hero images into `assets/brands/` and point `logo_image` /
   `hero_image` at `/assets/brands/<file>`.
3. Add the brand's products with a matching `brand_id`.
No code change is required — the storefront renders from `/api/brands`.

---

## 6. Hard rules (never break)

1. **Never trust client prices** — always `recomputeTotal()` server-side.
2. **Stock decrements ONLY** in `decrementStock()` *after* `verifyPaystackTx()` passes.
3. **Supabase service key is server-only** — never in any browser-served HTML/JS.
4. **Never commit `.env`.**
5. **Admin routes require** `Authorization: Bearer <SUPABASE_SERVICE_KEY>`.
6. **Order ref format:** `TD-{timestamp}-{3chars}` — never change.
7. **Email is fire-and-forget** — `sendEmail()` errors must never block a confirmed order.
8. **Shipping:** free ≥ R750, else flat R80.
9. **Currency:** ZAR only — reject Paystack responses with the wrong currency.

---

## 7. Environment variables

See `.env.example`. Add all in Vercel → Settings → Environment Variables.

| Var | Required | Used in |
|---|---|---|
| SUPABASE_URL | Yes | shared.js |
| SUPABASE_ANON_KEY | Yes | shared.js |
| SUPABASE_SERVICE_KEY | Yes | shared.js, admin auth |
| PAYSTACK_SECRET_KEY | Yes | Payment engine |
| PAYSTACK_PUBLIC_KEY | UI only | — |
| APP_URL | Yes | Paystack callback URL |
| RESEND_API_KEY | Optional | Communication engine |
| RESEND_FROM | Optional | Email from address |
| ADMIN_USERNAME / ADMIN_PASSWORD | Yes | Admin login |

---

## 8. Local development & testing

```bash
npm install
npm test          # 50 unit + API + integration tests (mock Supabase, no network)
npm run test:e2e  # opt-in Playwright E2E (see below)
```

`npm test` mocks Supabase — no real network or credentials needed. It runs
`tests/unit.test.js`, `tests/api.test.js`, and `tests/integration.test.js`
(cross-cutting flows: pricing, R750 free-shipping threshold, stock guard,
confirm short-circuit).

**End-to-end (Playwright):** opt-in, not part of `npm test`.
```bash
npm install
npx playwright install chromium
npm run test:e2e                              # targets production by default
BASE_URL=http://localhost:3000 npm run test:e2e   # or a local/preview URL
```
Specs live in `tests/e2e/`; config in `playwright.config.js`. They run against
`BASE_URL` (production by default), so no local server is required.

**Error monitoring:** `api/shared.js` exports `captureError()`, called by the
top-level handler guard in `api/index.js`. It always logs to stderr and, when
`SENTRY_DSN` is set, also reports to Sentry (fire-and-forget — never blocks a
request). The storefront loads the Sentry browser SDK only when
`window.SENTRY_DSN` is set, so it's a no-op until you opt in.

---

## 9. Deployment

- Push to `main` → Vercel auto-builds and deploys production.
- Feature work happens on `claude/*` branches → PR → squash-merge into `main`.
- After merge, verify production: site root returns 200, `/api/brands` returns
  the brand list, and changed assets serve with the expected `content-length`.

---

## 10. Suggested next upgrades

Already shipped from the upgrade plan: live search, wishlist, persistent cart,
product recommendations, WebP images (~50% lighter) with original fallback,
immutable CDN cache headers, hero value-prop + CTA, server + browser error
monitoring (Sentry-ready), and integration + E2E test coverage.

Still open opportunities, not committed work:

- **UI polish (build step 5–7):** add-to-cart bounce, slide transitions,
  CTA loading states — see `CLAUDE.md` build order.
- **AVIF images:** add AVIF alongside WebP for a further size cut.
- **Product detail page:** richer galleries, size guides, related-product logic.
- **Price/size filters:** structured facets on top of the text search.
- **Accessibility:** focus states, ARIA on the cart/checkout flow, alt text audit.
- **SEO:** per-brand/product meta tags, Open Graph images, sitemap.
- **Analytics:** a lightweight privacy-friendly analytics tracker.
- **Admin UX:** inline stock editing, order status workflow, low-stock alerts.

---

## 11. Reviewing this project (for GitHub Copilot / reviewers)

- Read this file first, then `CLAUDE.md` (build status & rules).
- Entry points: `api/index.js` (backend), `apps/store/index.html` (frontend).
- Run `npm test` to confirm the baseline (50 passing).
- Live site to click through: https://totallydifferent.vercel.app
- Repo to review: https://github.com/ThabisoCollinSengane/Totallydifferent-
