'use strict';
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL     = process.env.SUPABASE_URL;
const SUPA_ANON    = process.env.SUPABASE_ANON_KEY;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Service-role client — server only, never in the browser
const sb = () => createClient(SUPA_URL, SUPA_SERVICE, {
  auth: { persistSession: false },
});

// Shipping: free over R750, else flat R80
function calcShipping(subtotal) {
  return subtotal >= 750 ? 0 : 80;
}

// Recompute total from DB prices — never trust client amounts
async function recomputeTotal(items) {
  // items: [{ variant_id, quantity }]
  const variantIds = items.map(i => i.variant_id);
  const { data: variants, error } = await sb()
    .from('product_variants')
    .select('id, price_override, product_id, stock, products(base_price, currency)')
    .in('id', variantIds);
  if (error) throw new Error('Failed to load variants: ' + error.message);

  const lines = items.map(item => {
    const v = variants.find(r => r.id === item.variant_id);
    if (!v) throw new Error(`Variant ${item.variant_id} not found`);
    if (v.stock < item.quantity) throw new Error(`Insufficient stock for variant ${item.variant_id}`);
    const unit = v.price_override ?? v.products.base_price;
    return { variant_id: v.id, quantity: item.quantity, unit_price: unit, line_total: unit * item.quantity };
  });

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const shipping = calcShipping(subtotal);
  return { lines, subtotal, shipping, total: subtotal + shipping, currency: 'ZAR' };
}

// Paystack verify with 3x retry (lifted from Pulsify)
async function verifyPaystackTx(ref, expectedZAR) {
  const https = require('https');
  const paystackGet = (path) => new Promise((resolve, reject) => {
    const r = https.request(
      { hostname: 'api.paystack.co', path, method: 'GET',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); }
    );
    r.on('error', reject); r.end();
  });

  let pd = null;
  for (let i = 1; i <= 3; i++) {
    try {
      const vr = await paystackGet(`/transaction/verify/${encodeURIComponent(ref)}`);
      pd = vr?.data || null;
      if (pd) break;
    } catch (e) {
      if (i < 3) await new Promise(r => setTimeout(r, i * 1000));
    }
  }
  if (!pd || pd.status !== 'success') return { ok: false, reason: 'Payment not verified by Paystack' };
  if (pd.currency !== 'ZAR')           return { ok: false, reason: `Wrong currency: ${pd.currency}` };
  if ((pd.amount || 0) < Math.round(expectedZAR * 100))
    return { ok: false, reason: `Amount mismatch: got ${pd.amount}, expected ${Math.round(expectedZAR * 100)}` };
  return { ok: true, pd };
}

// Decrement stock atomically after confirmed payment
async function decrementStock(lines) {
  for (const line of lines) {
    await sb().rpc('decrement_stock', { variant_id: line.variant_id, qty: line.quantity });
  }
}

module.exports = { sb, recomputeTotal, verifyPaystackTx, decrementStock, PAYSTACK_SECRET };
