'use strict';
// Integration tests — exercise full request → handler → engine → shipping/pricing
// flows through the real route handler, with Supabase and outbound HTTP mocked.
// Complements api.test.js (per-route) by asserting cross-cutting behaviour:
// server-side price recompute, the R750 free-shipping threshold, price_override
// precedence, multi-line maths, and the confirm short-circuit.
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ── Mock Supabase (queue-based, same approach as api.test.js) ────────
const _queue = [];
let   _default = { data: null, error: null };
const nextResult = () => (_queue.length ? _queue.shift() : _default);

function makeChain() {
  const q = {
    select: () => q, eq: () => q, neq: () => q, in: () => q, order: () => q,
    insert: () => q, update: () => q,
    single:  () => Promise.resolve(nextResult()),
    then:    (r, e) => Promise.resolve(nextResult()).then(r, e),
    catch:   (e)    => Promise.resolve(nextResult()).catch(e),
    finally: (f)    => Promise.resolve(nextResult()).finally(f),
  };
  return q;
}
const mockSb = { from: () => makeChain(), rpc: () => Promise.resolve({ error: null }) };

const _orig = Module._load.bind(Module);
Module._load = function (req, parent, isMain) {
  if (req === '@supabase/supabase-js') return { createClient: () => mockSb };
  if (req === 'https') return { request: () => ({ write: () => {}, end: () => {} }) };
  return _orig(req, parent, isMain);
};

delete require.cache[require.resolve('../api/shared.js')];
delete require.cache[require.resolve('../api/index.js')];
const handler = require('../api/index.js');
after(() => { Module._load = _orig; });

// ── Helpers ──────────────────────────────────────────────────────────
function req(method, path, { body = {}, headers = {} } = {}) {
  return { method, url: `/api${path}`, body, headers };
}
function res() {
  const r = {
    _status: null, _body: null,
    status(s) { r._status = s; return r; },
    json(b)   { r._body  = b; return r; },
    end()     { return r; },
    setHeader() { return r; },
  };
  return r;
}
const variant = (over) => ({ id: 'v', price_override: null, stock: 99, products: { base_price: 100, currency: 'ZAR' }, ...over });
async function validate(items, variants) {
  _default = { data: variants, error: null };
  const r = res();
  await handler(req('POST', '/cart/validate', { body: { items } }), r);
  return r;
}

// ── Free-shipping threshold (cart engine × calcShipping) ─────────────
describe('cart → shipping integration', () => {
  test('subtotal below R750 adds R80 shipping', async () => {
    const r = await validate(
      [{ variant_id: 'a', quantity: 1 }],
      [variant({ id: 'a', products: { base_price: 700 } })]);
    assert.equal(r._status, 200);
    assert.equal(r._body.subtotal, 700);
    assert.equal(r._body.shipping, 80);
    assert.equal(r._body.total, 780);
  });

  test('subtotal exactly R750 ships free (boundary)', async () => {
    const r = await validate(
      [{ variant_id: 'a', quantity: 1 }],
      [variant({ id: 'a', products: { base_price: 750 } })]);
    assert.equal(r._body.subtotal, 750);
    assert.equal(r._body.shipping, 0);
    assert.equal(r._body.total, 750);
  });

  test('subtotal above R750 ships free', async () => {
    const r = await validate(
      [{ variant_id: 'a', quantity: 2 }],
      [variant({ id: 'a', products: { base_price: 500 } })]);
    assert.equal(r._body.subtotal, 1000);
    assert.equal(r._body.shipping, 0);
    assert.equal(r._body.total, 1000);
  });
});

// ── Server-side pricing is authoritative ─────────────────────────────
describe('pricing integration', () => {
  test('price_override takes precedence over base_price', async () => {
    const r = await validate(
      [{ variant_id: 'a', quantity: 1 }],
      [variant({ id: 'a', price_override: 299, products: { base_price: 999 } })]);
    assert.equal(r._body.subtotal, 299); // override wins, not base
  });

  test('client-supplied price is ignored; DB price is used', async () => {
    _default = { data: [variant({ id: 'a', products: { base_price: 400 } })], error: null };
    const r = res();
    await handler(req('POST', '/cart/validate', {
      body: { items: [{ variant_id: 'a', quantity: 1, unit_price: 1 }] }, // bogus client price
    }), r);
    assert.equal(r._body.subtotal, 400);
  });

  test('multi-line cart sums quantities × unit prices', async () => {
    const r = await validate(
      [{ variant_id: 'a', quantity: 2 }, { variant_id: 'b', quantity: 3 }],
      [variant({ id: 'a', products: { base_price: 100 } }),
       variant({ id: 'b', price_override: 50 })]);
    // 2×100 + 3×50 = 350 → under 750 → +80
    assert.equal(r._body.subtotal, 350);
    assert.equal(r._body.total, 430);
  });
});

// ── Stock guard blocks the flow ──────────────────────────────────────
describe('stock guard integration', () => {
  test('insufficient stock rejects the cart with 400', async () => {
    const r = await validate(
      [{ variant_id: 'a', quantity: 5 }],
      [variant({ id: 'a', stock: 2 })]);
    assert.equal(r._status, 400);
    assert.match(r._body.error, /stock/i);
  });
});

// ── Confirm short-circuits for an already-paid order ─────────────────
describe('checkout confirm integration', () => {
  test('already-paid order returns success without re-charging', async () => {
    _default = { data: { order_ref: 'TD-9-XYZ', status: 'paid', total: 780 }, error: null };
    const r = res();
    await handler(req('GET', '/checkout/confirm?ref=TD-9-XYZ'), r);
    assert.equal(r._status, 200);
    assert.equal(r._body.success, true);
  });
});
