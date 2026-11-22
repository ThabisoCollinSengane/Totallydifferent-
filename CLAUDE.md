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
4. ✅ Tests + validation — 50 tests, 0 failures (`npm test`)
5. ⬜ UI system (card-based, checkout flow)
6. ✅ Animations (bounce add-to-cart, slide transitions, CTA loading state) — see "Design & motion skills"
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
products          — id(text PK), name, category(clothing|hair), base_price, compare_at_price, currency(ZAR), images[], is_active, is_featured
product_variants  — id(uuid PK), product_id(FK), label, size, colour, volume, price_override, compare_at_price, stock, sku(unique)
```
`compare_at_price` is the "was" price shown struck through — a product is on sale
(and appears in the storefront's **Discounts%** tab) when it is greater than the
price actually charged. It is presentational only: `recomputeTotal()` still
charges `price_override ?? base_price`, so a discount can never alter a total.
```
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
npm test   # runs all 50 tests, must pass before any push to main
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

**How the owner reads results:** mostly on a phone, where `.md` file links do not open. Give feedback,
reviews and summaries as plain text in the chat (or a shareable page/doc), never only as a link to a
`.md` file. Files in the repo are fine as records, but the chat reply must carry the content.

## Agent Team (`.claude/agents/`)
| Agent | Use it for | Edits code? |
|---|---|---|
| `researcher` | Anything across the business — all brands and hair, suppliers, pricing, competitors, trends, channels, delivery, funding, SA law/IP, what to test next — cited briefs in `docs/research/` | No |
| `checkout-guardian` | **Required** for any change to `api/`, `vercel.json`, checkout, prices, stock, Paystack or keys — audits the 9 Hard Rules | No |
| `qa-tester` | Runs `npm test`, adds missing tests, runs Playwright E2E on request | Tests only |
| `code-reviewer` | General pre-merge review: bugs, XSS, auth, data safety | No |
| `ux-reviewer` | Mobile-first UI, conversion, accessibility, brand check for `apps/` changes | No |

**Test pipeline** — every sales idea is tested so it can fail: `researcher` (ranked ideas ->
`research/ideas.md`) -> `spec-writer` (spec with the pass rule fixed first, `research/specs/P<n>_*.md`)
-> **owner approves** -> `builder` (tracking behind a default-OFF flag, tests, random-data check) ->
`auditor` (assumes a bug or fluke) -> `reporter` (plain verdict here under "Test results").

| Agent | Use it for | Edits code? |
|---|---|---|
| `spec-writer` | Turns an idea into a test with a fixed pass rule, costs and sample size | No (writes specs) |
| `builder` | Builds an approved spec: attribution codes/links, report scripts, flags default OFF | Yes |
| `auditor` | Checks results for attribution leaks, payday/holiday timing, hidden costs, plumbing | No |
| `reporter` | Plain-language verdict in CLAUDE.md, `research/ideas.md`, `sales/creators.md` | Docs only |

**Sales crew** — drafts only; the owner sends, posts, signs and pays:

| Agent | Use it for | Output |
|---|---|---|
| `influencer-scout` | KZN-first TikTok creators per brand, fit and red flags from public info | `sales/creators.md` |
| `pitch-writer` | Pitches for shoppers in person, salons and boutiques, and creator outreach | `sales/pitches/` |
| `content-planner` | TikTok calendars per brand with hooks, shot lists and a tracking code per post | `sales/content/` |

## Go-to-market (owner's plan)
- Model: a LookFantastic-style store. Start with the in-house brands (Novacaine men and women,
  Countryman, Antisocial, Kookies, Timeless, plus the hair line); add other brands later.
- Channels: online store, face-to-face sales (Yoco card machine), salons and boutiques, TikTok creators.
- Area: KZN (Durban) first, then nationwide.
- Known gaps before channel tests can be measured:
  1. Orders have no source, code or channel field, and the store has no discount codes.
  2. Yoco sales do not reach the `orders` table, so stock does not drop. Hard Rule 2 means the owner
     must decide how to handle this before anything is built.
- Kookies is cannabis-themed: check TikTok's current guidelines before any Kookies creator or post.
- Timeless (clothing) is the newest brand: positioning, products and its `brands` row (logo, colours,
  tagline) are still to be set. "Timeless" is a common word, so search the CIPC trade mark register
  (class 25, clothing) before investing in the name.

## Design & motion skills
| Skill | Where | Use it for |
|---|---|---|
| GSAP skills (official; skills MIT, library under GreenSock's standard licence) | `.claude/skills/gsap-*` (vendored, markdown only) | Any storefront animation — tweens, timelines, eases, reduced motion |
| impeccable (Apache-2.0) | plugin — install yourself (below) | `/impeccable polish \| critique \| audit \| animate` before UI PRs |
| hallmark (MIT) | plugin — install yourself (below) | Anti-"AI slop" review of new pages/sections |

Install the two plugins (owner decision — they ship third-party scripts, so they are not auto-enabled):
```
/plugin marketplace add pbakaus/impeccable
/plugin install impeccable@impeccable
/plugin marketplace add Nutlope/hallmark
/plugin install hallmark@hallmark
```
Hallmark's optional Together AI step needs `TOGETHER_API_KEY` — leave it unset; it is not needed.

**Motion rules (storefront):**
- GSAP is self-hosted at `/assets/vendor/gsap-3.12.5.min.js` (`defer`, optional). Every GSAP effect
  must have a CSS fallback — the shop must work if the script fails to load.
- Respect `prefers-reduced-motion`: no fly/bounce, no stagger, static spinner.
- Add-to-cart: `flyFromEl()` returns `true` when GSAP ran; the bag bump then fires on landing, so callers do
  `if (!flyFromEl(...)) bumpCart();` — never call both.
- Buttons that wait on the network use `setBtnLoading(btn, on, label)` (spinner + `aria-busy`).
- `html, body` use `overflow-x: clip` (not `hidden`) — `hidden` breaks the sticky header. Other sticky
  elements must offset by `var(--header-h)` (60px) so they sit below it.

### Definition of done (every PR)
1. `qa-tester`: `npm test` green, new behaviour has tests.
2. `code-reviewer`: no open bugs/security findings.
3. `checkout-guardian`: PASS (only if the money path was touched).
4. `ux-reviewer`: no must-fix items (only if `apps/` changed).
5. CI green on GitHub (tests + secrets guard) before merging to `main`.
