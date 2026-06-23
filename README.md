# Totallydifferent

Premium clothing & hair e-commerce. Built backend-first on Vercel + Supabase + Paystack.

## Stack
- **Hosting:** Vercel (serverless API + static front end)
- **Database:** Supabase (Postgres + Auth + Storage) — project `ekmgnrnlhksqywdmftcs`
- **Payments:** Paystack (ZAR, verify-before-confirm with 3× retry)
- **Email:** Resend

## API Contract

| Method | Path | Engine | Description |
|--------|------|--------|-------------|
| GET | /api/products | Product | List active products (filter: ?category=clothing\|hair) |
| GET | /api/products/:id | Product | Single product with variants |
| POST | /api/cart/validate | Cart | Recompute totals server-side, check stock |
| POST | /api/checkout/init | Payment | Create pending order + Paystack auth URL |
| GET | /api/checkout/confirm | Payment | Verify payment, confirm order, decrement stock |
| GET | /api/orders/:ref | Order | Get order by ref |
| POST | /api/payments/webhook | Payment | Paystack webhook (HMAC verified) |
| GET | /api/admin/products | Admin | List all products |
| POST | /api/admin/products | Admin | Create product |
| PATCH | /api/admin/orders/:ref | Admin | Update order status |

## Env Vars (Vercel → Settings → Environment Variables)
See `.env.example` for the full list.

## Build Order (spec §10)
1. ✅ Schema + seed data
2. ✅ API contract defined
3. ✅ Backend logic (all 5 engines)
4. ⬜ Tests + validation
5. ⬜ UI system (apps/store/index.html)
6. ⬜ Animations
7. ⬜ Final polish
