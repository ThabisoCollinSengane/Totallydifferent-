'use strict';
// Route handler tests — Supabase and Paystack are mocked; no real network.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ── Mock Supabase ────────────────────────────────────────────────
// Queue-based: tests push expected results; each DB call pops one.
const _queue = [];
let   _default = { data: null, error: null };

function nextResult() {
  return _queue.length ? _queue.shift() : _default;
}

function makeChain() {
  const q = {
    select:  () => q,  eq:     () => q,  neq:    () => q,
    in:      () => q,  order:  () => q,  insert: () => q,
    update:  () => q,
    single:  () => Promise.resolve(nextResult()),
    then:    (r, e) => Promise.resolve(nextResult()).then(r, e),
    catch:   (e)    => Promise.resolve(nextResult()).catch(e),
    finally: (f)    => Promise.resolve(nextResult()).finally(f),
  };
  return q;
}

const mockSb = {
  from: () => makeChain(),
  rpc:  () => Promise.resolve({ error: null }),
};

// Intercept @supabase/supabase-js and https (block real Paystack/Resend calls)
const _orig = Module._load.bind(Module);
Module._load = function (req, parent, isMain) {
  if (req === '@supabase/supabase-js')
    return { createClient: () => mockSb };
  if (req === 'https')
    return { request: () => { const r = { write: () => {}, end: () => {} }; return r; } };
  return _orig(req, parent, isMain);
};

// Load handler with mocked deps
delete require.cache[require.resolve('../api/shared.js')];
delete require.cache[require.resolve('../api/index.js')];
const handler = require('../api/index.js');

after(() => { Module._load = _orig; });

// ── Helpers ──────────────────────────────────────────────────────
const SVCKEY = 'test-service-key';
process.env.SUPABASE_SERVICE_KEY = SVCKEY;

function req(method, path, { body = {}, headers = {} } = {}) {
  return { method, url: `/api${path}`, body, headers };
}

function res() {
  const r = {
    _status: null, _body: null,
    status(s)    { r._status = s; return r; },
    json(b)      { r._body  = b; return r; },
    end()        { return r; },
    setHeader()  { return r; },
  };
  return r;
}

function push(data, error = null) { _queue.push({ data, error }); }

// ── CORS ─────────────────────────────────────────────────────────
describe('CORS preflight', () => {
  test('OPTIONS → 204', async () => {
    const response = res();
    await handler(req('OPTIONS', '/products'), response);
    assert.equal(response._status, 204);
  });
});

// ── Product Engine ───────────────────────────────────────────────
describe('GET /products', () => {
  test('returns 200 with products array', async () => {
    _default = { data: [{ id: 'p1', name: 'Test Hoodie' }], error: null };
    const response = res();
    await handler(req('GET', '/products'), response);
    assert.equal(response._status, 200);
    assert.ok(Array.isArray(response._body.products));
  });

  test('returns 400 on DB error', async () => {
    _default = { data: null, error: { message: 'DB down' } };
    const response = res();
    await handler(req('GET', '/products'), response);
    assert.equal(response._status, 400);
  });
});

describe('GET /products/:id', () => {
  test('returns 200 with product when found', async () => {
    _default = { data: { id: 'p1', name: 'Test Hoodie' }, error: null };
    const response = res();
    await handler(req('GET', '/products/p1'), response);
    assert.equal(response._status, 200);
    assert.ok(response._body.product);
  });

  test('returns 404 when product not found', async () => {
    _default = { data: null, error: { message: 'Not found' } };
    const response = res();
    await handler(req('GET', '/products/missing'), response);
    assert.equal(response._status, 404);
  });
});

// ── Cart Engine ──────────────────────────────────────────────────
describe('POST /cart/validate', () => {
  test('returns 400 when items missing', async () => {
    const response = res();
    await handler(req('POST', '/cart/validate', { body: {} }), response);
    assert.equal(response._status, 400);
    assert.ok(response._body.error);
  });

  test('returns 400 when items is empty array', async () => {
    const response = res();
    await handler(req('POST', '/cart/validate', { body: { items: [] } }), response);
    assert.equal(response._status, 400);
  });

  test('returns 200 with computed totals on valid items', async () => {
    // recomputeTotal calls sb().from('product_variants').select(...).in(...)
    // That chain resolves via _default
    _default = {
      data: [{
        id: 'v1', price_override: null, stock: 10,
        products: { base_price: 500, currency: 'ZAR' },
      }],
      error: null,
    };
    const response = res();
    await handler(req('POST', '/cart/validate', {
      body: { items: [{ variant_id: 'v1', quantity: 1 }] },
    }), response);
    assert.equal(response._status, 200);
    assert.equal(response._body.valid, true);
    assert.equal(response._body.subtotal, 500);
    assert.equal(response._body.shipping, 80); // under R750
    assert.equal(response._body.total, 580);
  });

  test('returns 400 when stock insufficient', async () => {
    _default = {
      data: [{ id: 'v1', price_override: null, stock: 0, products: { base_price: 200 } }],
      error: null,
    };
    const response = res();
    await handler(req('POST', '/cart/validate', {
      body: { items: [{ variant_id: 'v1', quantity: 5 }] },
    }), response);
    assert.equal(response._status, 400);
    assert.match(response._body.error, /stock/i);
  });
});

// ── Payment Engine — init ────────────────────────────────────────
describe('POST /checkout/init', () => {
  test('returns 400 when required fields missing', async () => {
    const response = res();
    await handler(req('POST', '/checkout/init', { body: { items: [] } }), response);
    assert.equal(response._status, 400);
  });

  test('returns 503 when PAYSTACK_SECRET not set', async () => {
    const saved = process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    const response = res();
    await handler(req('POST', '/checkout/init', {
      body: { items: [{ variant_id: 'v1', quantity: 1 }], buyer_name: 'A', buyer_email: 'a@b.com' },
    }), response);
    assert.equal(response._status, 503);
    process.env.PAYSTACK_SECRET_KEY = saved;
  });
});

// ── Payment Engine — confirm ─────────────────────────────────────
describe('GET /checkout/confirm', () => {
  test('returns 400 when ref missing', async () => {
    const response = res();
    await handler(req('GET', '/checkout/confirm'), response);
    assert.equal(response._status, 400);
  });

  test('returns 404 when order not found', async () => {
    _default = { data: null, error: { message: 'Not found' } };
    const response = res();
    await handler(req('GET', '/checkout/confirm?ref=TD-123-ABC'), response);
    assert.equal(response._status, 404);
  });

  test('returns 200 immediately for already-paid order', async () => {
    _default = { data: { order_ref: 'TD-1-A', status: 'paid', total: 580 }, error: null };
    const response = res();
    await handler(req('GET', '/checkout/confirm?ref=TD-1-A'), response);
    assert.equal(response._status, 200);
    assert.equal(response._body.success, true);
  });

  test('returns 400 for non-payable order status', async () => {
    _default = { data: { order_ref: 'TD-2-B', status: 'cancelled', total: 580 }, error: null };
    const response = res();
    await handler(req('GET', '/checkout/confirm?ref=TD-2-B'), response);
    assert.equal(response._status, 400);
  });
});

// ── Order Engine ─────────────────────────────────────────────────
describe('GET /orders/:ref', () => {
  test('returns 200 with order when found', async () => {
    _default = { data: { order_ref: 'TD-1-ABC', status: 'paid' }, error: null };
    const response = res();
    await handler(req('GET', '/orders/TD-1-ABC'), response);
    assert.equal(response._status, 200);
    assert.ok(response._body.order);
  });

  test('returns 404 when order not found', async () => {
    _default = { data: null, error: { message: 'Not found' } };
    const response = res();
    await handler(req('GET', '/orders/TD-MISSING'), response);
    assert.equal(response._status, 404);
  });
});

// ── Webhook ───────────────────────────────────────────────────────
describe('POST /payments/webhook', () => {
  test('returns 401 when signature invalid', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'real-secret';
    const response = res();
    await handler(req('POST', '/payments/webhook', {
      body: { event: 'charge.success' },
      headers: { 'x-paystack-signature': 'bad-sig' },
    }), response);
    assert.equal(response._status, 401);
  });

  test('returns 200 when signature valid', async () => {
    const crypto = require('node:crypto');
    const secret = 'real-secret';
    process.env.PAYSTACK_SECRET_KEY = secret;
    const body = { event: 'ping' };
    const sig  = crypto.createHmac('sha512', secret).update(JSON.stringify(body)).digest('hex');
    const response = res();
    await handler(req('POST', '/payments/webhook', {
      body, headers: { 'x-paystack-signature': sig },
    }), response);
    assert.equal(response._status, 200);
  });
});

// ── Admin Engine ─────────────────────────────────────────────────
describe('Admin auth guard', () => {
  test('GET /admin/products → 401 without token', async () => {
    const response = res();
    await handler(req('GET', '/admin/products'), response);
    assert.equal(response._status, 401);
  });

  test('GET /admin/products → 401 with wrong token', async () => {
    const response = res();
    await handler(req('GET', '/admin/products', {
      headers: { authorization: 'Bearer wrong-key' },
    }), response);
    assert.equal(response._status, 401);
  });

  test('GET /admin/products → 200 with correct token', async () => {
    _default = { data: [], error: null };
    const response = res();
    await handler(req('GET', '/admin/products', {
      headers: { authorization: `Bearer ${SVCKEY}` },
    }), response);
    assert.equal(response._status, 200);
  });

  test('POST /admin/products → 400 when required fields missing', async () => {
    const response = res();
    await handler(req('POST', '/admin/products', {
      body: { name: 'No ID or price' },
      headers: { authorization: `Bearer ${SVCKEY}` },
    }), response);
    assert.equal(response._status, 400);
  });

  test('PATCH /admin/orders/:ref → 400 with invalid status', async () => {
    const response = res();
    await handler(req('PATCH', '/admin/orders/TD-1-ABC', {
      body: { status: 'refunded' },
      headers: { authorization: `Bearer ${SVCKEY}` },
    }), response);
    assert.equal(response._status, 400);
  });

  test('PATCH /admin/orders/:ref → 200 with valid status', async () => {
    _default = { data: { order_ref: 'TD-1-ABC', status: 'shipped' }, error: null };
    const response = res();
    await handler(req('PATCH', '/admin/orders/TD-1-ABC', {
      body: { status: 'shipped' },
      headers: { authorization: `Bearer ${SVCKEY}` },
    }), response);
    assert.equal(response._status, 200);
  });
});

// ── 404 catch-all ────────────────────────────────────────────────
describe('404 catch-all', () => {
  test('unknown route → 404', async () => {
    const response = res();
    await handler(req('GET', '/unknown-route'), response);
    assert.equal(response._status, 404);
  });
});
