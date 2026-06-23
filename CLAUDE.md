# Totallydifferent — CLAUDE.md

Premium clothing & hair e-commerce. Backend-first, API-first, agent-driven.

## Stack
| Layer | Tool |
|---|---|
| Hosting | Vercel (serverless, Node 20) |
| Database | Supabase — project `ekmgnrnlhksqywdmftcs` (sa-east-1) |
| Payments | Paystack (ZAR only, verify-before-confirm, 3× retry) |
| Email | Resend (fire-and-forget — never blocks order flow) |

## Build Order & Status
1. ✅ Schema + seed data (`products` ×5, `product_variants` ×12, `orders`)
2. ✅ API contract (10 endpoints defined)
3. ✅ Backend logic — all 5 engines + Communication Engine
4. ✅ Tests + validation — 35 tests, 0 failures (`npm test`)
5. ⬜ UI system (card-based, checkout flow)
6. ⬜ Animations (bounce add-to-cart, slide transitions, CTA loading state)
7. ⬜ Final polish

## API Contract
| Method | Path | Engine | Notes |
|---|---|---|---|
| GET | /api/products | Product | ?category=clothing\|hair, ?subcategory= |
| GET | /api/products/:id | Product | 404 when not found |
| POST | /api/cart/validate | Cart | Server-side price recompute |
| POST | /api/checkout/init | Payment | Returns Paystack auth URL |
| GET | /api/checkout/confirm | Payment | Verifies, confirms, decrements stock, sends email |
| GET | /api/orders/:ref | Order | Public order lookup |
| POST | /api/payments/webhook | Payment | HMAC-verified Paystack webhook |
| GET | /api/admin/products | Admin | Bearer <SUPABASE_SERVICE_KEY> |
| POST | /api/admin/products | Admin | Bearer required |
| PATCH | /api/admin/orders/:ref | Admin | Bearer required |

## DB Schema (Supabase)
```
products          — id(text PK), name, category(clothing|hair), base_price, currency(ZAR), images[], is_active, is_featured
product_variants  — id(uuid PK), product_id(FK), label, size, colour, volume, price_override, stock, sku(unique)
orders            — id(uuid PK), order_ref(unique), buyer_name, buyer_email, items(jsonb), subtotal, shipping_fee, total, status, paystack_ref
```

### Supabase RPCs
- `decrement_stock(variant_id, qty)` — atomically decrements stock, never goes negative
- `touch_updated_at()` — trigger function, fires on orders UPDATE

## Hard Rules (never break)
1. **Never trust client prices** — always call `recomputeTotal()` server-side
2. **Stock decrements ONLY** inside `decrementStock()` after `verifyPaystackTx()` passes
3. **Supabase service key is server-only** — never in any HTML/JS file served to the browser
4. **Never commit `.env`**
5. **Admin routes require** `Authorization: Bearer <SUPABASE_SERVICE_KEY>`
6. **Order ref format:** `TD-{timestamp}-{3chars}` — never change
7. **Email is fire-and-forget** — `sendEmail()` errors must never block a confirmed order
8. **Shipping:** free ≥ R750, else flat R80
9. **Currency:** ZAR only — reject Paystack responses with wrong currency

## Key Files
```
api/index.js    — all 5 engines (Product, Cart, Payment, Order, Admin) + webhook
api/shared.js   — sb(), calcShipping(), recomputeTotal(), verifyPaystackTx(),
                  decrementStock(), sendEmail(), orderConfirmHtml()
vercel.json     — API rewrite /api/(.*) → /api/index.js ONLY
                  NEVER add /(.*) → index.html (breaks API routing)
tests/unit.test.js  — pure logic: calcShipping, HMAC, order ref format
tests/api.test.js   — route handler tests (Supabase mocked, no real network)
```

## Running Tests
```bash
npm test   # runs all 35 tests, must pass before any push to main
```

## Environment Variables
See `.env.example`. Add all to Vercel → Settings → Environment Variables.

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

## Sibling Project
Pulsify — different Supabase project, same Vercel/GitHub account.
Do NOT mix env vars between the two projects.

## Owner
Thabiso Collins Engane — thacollin2@gmail.com
