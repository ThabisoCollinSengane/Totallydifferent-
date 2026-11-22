'use strict';
// TotaAI assistant tests — Supabase and Groq are mocked; no real network.
const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ── Mock Supabase: per-table results, and every select() is recorded ──
let tables = {};
const selects = [];
function chain(table) {
  const result = () => {
    const r = tables[table];
    return Promise.resolve(typeof r === 'function' ? r() : (r || { data: null, error: null }));
  };
  const q = {
    select: (cols) => { selects.push({ table, cols }); return q; },
    eq: () => q, in: () => q, order: () => q, limit: () => q,
    single: () => result(),
    then: (a, b) => result().then(a, b),
  };
  return q;
}
const mockSb = { from: (t) => chain(t), rpc: () => Promise.resolve({ error: null }) };

const _orig = Module._load.bind(Module);
Module._load = function (req, parent, isMain) {
  if (req === '@supabase/supabase-js') return { createClient: () => mockSb };
  return _orig(req, parent, isMain);
};
for (const f of ['../api/shared.js', '../api/_assistant.js', '../api/index.js']) delete require.cache[require.resolve(f)];
const A = require('../api/_assistant.js');
const handler = require('../api/index.js');

// ── Mock Groq (global fetch) ──
const realFetch = global.fetch;
let groqReplies = [];
let groqCalls = [];
global.fetch = async (url, opts = {}) => {
  if (String(url).endsWith('/models')) {
    return { ok: true, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile', active: true }, { id: 'whisper-large-v3', active: true }] }) };
  }
  groqCalls.push(JSON.parse(opts.body));
  const next = groqReplies.length ? groqReplies.shift() : 'Sure!';
  if (next instanceof Error) throw next;
  if (typeof next === 'number') return { ok: false, status: next, json: async () => ({}) };
  return { ok: true, json: async () => ({ choices: [{ message: { content: next } }] }) };
};
after(() => { Module._load = _orig; global.fetch = realFetch; });

const CATALOG = {
  brands: { data: [{ id: 'novacaine', name: 'Novacaine' }], error: null },
  products: { data: [
    { id: 'hoodie', name: 'Beetle Crest Hoodie', category: 'clothing', subcategory: 'hoodies', brand_id: 'novacaine', base_price: 650, compare_at_price: 799,
      product_variants: [{ label: 'M', size: 'M', price_override: null, stock: 3 }, { label: 'XL', size: 'XL', price_override: 690, stock: 0 }] },
    { id: 'wig', name: 'Body Wave Wig 20"', category: 'hair', subcategory: 'wigs', brand_id: null, base_price: 1450, compare_at_price: null,
      product_variants: [{ label: '20 inch', price_override: null, stock: 0 }] },
  ], error: null },
};

function req(body, ip = '10.0.0.1') {
  return { method: 'POST', url: '/api/assistant', body, headers: { 'x-forwarded-for': ip } };
}
function res() {
  const r = { _status: null, _body: null, status(s) { r._status = s; return r; }, json(b) { r._body = b; return r; }, end() { return r; }, setHeader() { return r; } };
  return r;
}
const ask = (text, ip) => req({ messages: [{ role: 'user', content: text }] }, ip);

beforeEach(() => {
  A._resetForTests();
  tables = { ...CATALOG };
  selects.length = 0; groqReplies = []; groqCalls = [];
  process.env.GROQ_API_KEY = 'test-groq-key';
});

describe('sanitizeMessages', () => {
  test('rejects missing, empty, malformed and assistant-last histories', () => {
    assert.equal(A.sanitizeMessages(undefined), null);
    assert.equal(A.sanitizeMessages([]), null);
    assert.equal(A.sanitizeMessages([{ role: 'system', content: 'hi' }]), null);
    assert.equal(A.sanitizeMessages([{ role: 'user', content: '   ' }]), null);
    assert.equal(A.sanitizeMessages([{ role: 'user', content: 5 }]), null);
    assert.equal(A.sanitizeMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]), null);
  });
  test('keeps the last 12 turns and caps each at 600 chars', () => {
    const long = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(900) }));
    const out = A.sanitizeMessages(long);
    assert.equal(out.length, 12);
    assert.ok(out.every(m => m.content.length === 600));
    assert.equal(out[out.length - 1].role, 'user');
  });
});

describe('unknownPrices', () => {
  const allowed = new Set([650, 1450, 750, 80]);
  test('allows catalogue, delivery and threshold prices in any format', () => {
    assert.deepEqual(A.unknownPrices('The hoodie is R650, the wig R1 450 or R1,450.00. Free over R750, else R80.', allowed), []);
  });
  test('order refs and volumes are not read as prices', () => {
    assert.deepEqual(A.unknownPrices('Your order TD-1732000000000-AR7 has shipped.', allowed), []);
    assert.deepEqual(A.unknownPrices('Hair oil R650 250ml', allowed), []);
  });
  test('flags invented prices', () => {
    assert.deepEqual(A.unknownPrices('Only R499 today!', allowed), [499]);
  });
});

describe('POST /api/assistant', () => {
  test('400 on a bad body', async () => {
    const r = res();
    await handler(req({ messages: 'hi' }), r);
    assert.equal(r._status, 400);
  });

  test('503 with fallback when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    const r = res();
    await handler(ask('hi'), r);
    assert.equal(r._status, 503);
    assert.equal(r._body.fallback, true);
  });

  test('200 with the reply; system prompt carries live catalogue and store facts', async () => {
    groqReplies = ['The Beetle Crest Hoodie is R650 and comes in M.'];
    const r = res();
    await handler(ask('Any hoodies?'), r);
    assert.equal(r._status, 200);
    assert.equal(r._body.reply, 'The Beetle Crest Hoodie is R650 and comes in M.');
    const sys = groqCalls[0].messages[0];
    assert.equal(sys.role, 'system');
    assert.match(sys.content, /Beetle Crest Hoodie \| Novacaine \/ hoodies \| R650 \(on sale, was R799\) \| in stock: M/);
    assert.match(sys.content, /Body Wave Wig 20" \| Hair \/ wigs \| R1450 \| sold out/);
    assert.match(sys.content, /Free delivery on orders of R750 or more; otherwise a flat R80/);
    assert.doesNotMatch(sys.content, /R690/, 'out-of-stock variant price is not offered');
    assert.equal(groqCalls[0].model, 'llama-3.3-70b-versatile');
  });

  test('an invented price is retried once, then replaced with a safe reply', async () => {
    groqReplies = ['It is R499!', 'Still R499!'];
    const r = res();
    await handler(ask('How much is the hoodie?'), r);
    assert.equal(r._status, 200);
    assert.equal(r._body.reply, A.SAFE_PRICE_REPLY);
    assert.equal(groqCalls.length, 2);
  });

  test('the retry is used when it fixes the price', async () => {
    groqReplies = ['It is R499!', 'It is R650.'];
    const r = res();
    await handler(ask('How much is the hoodie?'), r);
    assert.equal(r._body.reply, 'It is R650.');
  });

  test('order lookup never selects buyer details', async () => {
    tables.orders = { data: { order_ref: 'TD-1732280000000-AB1', status: 'shipped', created_at: '2026-11-20T10:00:00Z', items: [{ quantity: 2 }], total: 1380 }, error: null };
    groqReplies = ['Your order TD-1732280000000-AB1 has shipped. Total R1380.'];
    const r = res();
    await handler(ask('where is td-1732280000000-ab1?'), r);
    assert.equal(r._status, 200);
    const orderSelect = selects.find(s => s.table === 'orders');
    assert.ok(orderSelect, 'orders table queried');
    assert.doesNotMatch(orderSelect.cols, /buyer|email|phone|address|name|\*/);
    const sys = groqCalls[0].messages[0].content;
    assert.match(sys, /TD-1732280000000-AB1: shipped, on its way; placed 2026-11-20; 2 item\(s\); total R1380/);
    assert.equal(r._body.reply, 'Your order TD-1732280000000-AB1 has shipped. Total R1380.', 'order total is an allowed price');
  });

  test('unknown order ref tells the model it was not found', async () => {
    tables.orders = { data: null, error: { message: 'no rows' } };
    const r = res();
    await handler(ask('status of TD-1732280000000-ZZZ'), r);
    assert.match(groqCalls[0].messages[0].content, /TD-1732280000000-ZZZ was not found/);
  });

  test('a database error still answers from the store facts', async () => {
    tables.products = { data: null, error: { message: 'paused' } };
    const r = res();
    await handler(ask('delivery?'), r);
    assert.equal(r._status, 200);
    assert.match(groqCalls[0].messages[0].content, /catalogue unavailable/);
  });

  test('502 with fallback when every Groq model fails', async () => {
    groqReplies = [500, 500, 500, 500];
    const r = res();
    await handler(ask('hi'), r);
    assert.equal(r._status, 502);
    assert.equal(r._body.fallback, true);
  });

  test('falls through to the next model when one errors', async () => {
    A._resetForTests();
    global.fetch = (orig => async (url, opts) => String(url).endsWith('/models') ? { ok: false, json: async () => ({}) } : orig(url, opts))(global.fetch);
    groqReplies = [404, 'Hello from the backup model'];
    const r = res();
    await handler(ask('hi'), r);
    assert.equal(r._body.reply, 'Hello from the backup model');
    assert.notEqual(groqCalls[0].model, groqCalls[1].model);
  });

  test('rate limit: 21st request in 10 minutes from one IP gets 429', async () => {
    for (let i = 0; i < 20; i++) {
      const r = res();
      await handler(ask('hi', '9.9.9.9'), r);
      assert.equal(r._status, 200);
    }
    const r = res();
    await handler(ask('hi', '9.9.9.9'), r);
    assert.equal(r._status, 429);
    const other = res();
    await handler(ask('hi', '8.8.8.8'), other);
    assert.equal(other._status, 200, 'other visitors are not affected');
  });
});
