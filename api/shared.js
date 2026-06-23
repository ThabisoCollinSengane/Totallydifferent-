'use strict';
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

// Upload a base64 image to the public product-images bucket, return its public URL
async function uploadProductImage({ filename, contentBase64, contentType }) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(contentType)) throw new Error('Unsupported image type');
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Image exceeds 5MB limit');
  const ext  = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb().storage.from('product-images')
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error('Upload failed: ' + error.message);
  const { data } = sb().storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

// ── Admin auth — password login → short-lived signed session token ───────────
// The service key never reaches the browser. Sessions are HMAC-signed with a
// server-only secret (ADMIN_SESSION_SECRET, falling back to the service key).
function adminSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || '';
}

function timingEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function checkAdminCredentials(username, password) {
  const u = process.env.ADMIN_USERNAME || 'admin';
  const p = process.env.ADMIN_PASSWORD || '';
  if (!p || !username || !password) return false;
  // evaluate both to keep timing roughly constant
  const okUser = timingEqual(username, u);
  const okPass = timingEqual(password, p);
  return okUser && okPass;
}

function signAdminSession(ttlMs = 12 * 60 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', adminSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminSession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', adminSecret()).update(payload).digest('base64url');
  if (!timingEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch { return false; }
}

// Authorized = valid session token OR the raw service key (programmatic/back-compat)
function isAdminAuthorized(token) {
  if (!token) return false;
  if (process.env.SUPABASE_SERVICE_KEY && timingEqual(token, process.env.SUPABASE_SERVICE_KEY)) return true;
  return verifyAdminSession(token);
}

// Decrement stock atomically after confirmed payment
async function decrementStock(lines) {
  for (const line of lines) {
    await sb().rpc('decrement_stock', { variant_id: line.variant_id, qty: line.quantity });
  }
}

// Communication Engine — Resend email, fire-and-forget
// Never awaited in the order flow — email errors must never block a confirmed order.
async function sendEmail({ to, subject, html }) {
  const key  = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Totallydifferent <hello@totallydifferent.co.za>';
  if (!key) return;
  const https = require('https');
  const body  = JSON.stringify({ from, to: [to], subject, html });
  await new Promise(resolve => {
    const r = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
                 'Content-Length': Buffer.byteLength(body) },
    }, res => { res.resume(); res.on('end', resolve); });
    r.on('error', resolve); // swallow — never block
    r.write(body); r.end();
  });
}

function orderConfirmHtml({ order_ref, buyer_name, total }) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:auto;padding:24px">
<h2 style="font-size:22px;font-weight:700;margin-bottom:4px">Order Confirmed</h2>
<p style="color:#555;margin-top:0">Reference: <strong>${order_ref}</strong></p>
<p>Hi ${buyer_name}, your order has been confirmed and payment received.</p>
<p style="font-size:20px;font-weight:700">Total: R${Number(total).toFixed(2)}</p>
<p>We'll notify you when your order is packed and on its way.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#aaa;font-size:12px">Totallydifferent — Premium Clothing &amp; Hair &bull; South Africa</p>
</body></html>`;
}

module.exports = { sb, calcShipping, recomputeTotal, verifyPaystackTx, decrementStock, uploadProductImage, sendEmail, orderConfirmHtml, PAYSTACK_SECRET, checkAdminCredentials, signAdminSession, isAdminAuthorized };
