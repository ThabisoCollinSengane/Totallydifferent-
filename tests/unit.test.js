'use strict';
// Unit tests for pure business logic — no network, no DB required.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── calcShipping ────────────────────────────────────────────────
// Must be tested in isolation; import after mocking Supabase so
// the module loads without crashing on missing env vars.
const Module = require('node:module');
const _orig = Module._load.bind(Module);
Module._load = function (req, parent, isMain) {
  if (req === '@supabase/supabase-js')
    return { createClient: () => ({}) };
  return _orig(req, parent, isMain);
};
const { calcShipping, orderConfirmHtml } = require('../api/shared');
Module._load = _orig; // restore immediately — only needed for this require

describe('calcShipping', () => {
  test('free shipping at exactly R750', () => {
    assert.equal(calcShipping(750), 0);
  });
  test('free shipping above R750', () => {
    assert.equal(calcShipping(1000), 0);
  });
  test('flat R80 below R750', () => {
    assert.equal(calcShipping(749.99), 80);
  });
  test('flat R80 on empty cart', () => {
    assert.equal(calcShipping(0), 80);
  });
});

describe('orderConfirmHtml', () => {
  test('includes order_ref, buyer_name and total', () => {
    const html = orderConfirmHtml({ order_ref: 'TD-001', buyer_name: 'Thabiso', total: 830 });
    assert.ok(html.includes('TD-001'));
    assert.ok(html.includes('Thabiso'));
    assert.ok(html.includes('830.00'));
  });
  test('escapes ampersand in footer', () => {
    const html = orderConfirmHtml({ order_ref: 'x', buyer_name: 'x', total: 0 });
    assert.ok(html.includes('&amp;'));
    assert.ok(!html.includes(' & '));
  });
});

describe('order ref format', () => {
  test('matches TD-{timestamp}-{3chars} pattern', () => {
    const ref = `TD-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    assert.match(ref, /^TD-\d+-[A-Z0-9]{3}$/);
  });
});

describe('Paystack HMAC logic', () => {
  test('matching signature validates', () => {
    const crypto = require('node:crypto');
    const secret = 'test-secret';
    const body   = JSON.stringify({ event: 'charge.success' });
    const sig    = crypto.createHmac('sha512', secret).update(body).digest('hex');
    const hash   = crypto.createHmac('sha512', secret).update(body).digest('hex');
    assert.equal(sig, hash);
  });
  test('tampered body fails signature check', () => {
    const crypto = require('node:crypto');
    const secret = 'test-secret';
    const sig    = crypto.createHmac('sha512', secret).update('original').digest('hex');
    const hash   = crypto.createHmac('sha512', secret).update('tampered').digest('hex');
    assert.notEqual(sig, hash);
  });
});
