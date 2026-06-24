'use strict';
// ── Totallydifferent API — single serverless entry point ──────
// Route map:
//   GET  /api/products            → Product Engine
//   GET  /api/products/:id        → Product Engine
//   POST /api/cart/validate       → Cart Engine
//   POST /api/checkout/init       → Payment Engine
//   GET  /api/checkout/confirm    → Payment Engine
//   GET  /api/orders/:ref         → Order Engine
//   POST /api/payments/webhook    → Payment Engine (Paystack webhook)
//   GET  /api/admin/products      → Admin (service-role)
//   POST /api/admin/products      → Admin
//   PATCH /api/admin/orders/:ref  → Admin
//   GET  /api/reviews?product=    → Reviews Engine
//   POST /api/reviews             → Reviews Engine

const { sb, recomputeTotal, verifyPaystackTx, decrementStock, uploadProductImage, sendEmail, orderConfirmHtml, PAYSTACK_SECRET, checkAdminCredentials, signAdminSession, isAdminAuthorized, captureError } = require('./shared');
const crypto = require('crypto');

function json(res, status, body) {
  res.status(status).json(body);
}

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = req.url.replace(/^\/api/, '').split('?')[0].replace(/\/$/, '') || '/';
  const q   = Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  // ── PRODUCT ENGINE ─────────────────────────────────────────
  if (url === '/brands' && req.method === 'GET') {
    const { data, error } = await sb().from('brands')
      .select('*').eq('is_active', true).order('sort', { ascending: true });
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { brands: data });
  }

  if (url === '/products' && req.method === 'GET') {
    const filter = sb().from('products')
      .select('*, product_variants(*)')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (q.category) filter.eq('category', q.category);
    if (q.subcategory) filter.eq('subcategory', q.subcategory);
    if (q.brand) filter.eq('brand_id', q.brand);
    const { data, error } = await filter;
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { products: data });
  }

  const productId = url.match(/^\/products\/([^/]+)$/)?.[1];
  if (productId && req.method === 'GET') {
    const { data, error } = await sb().from('products')
      .select('*, product_variants(*)')
      .eq('id', productId).eq('is_active', true).single();
    if (error || !data) return json(res, 404, { error: 'Product not found' });
    return json(res, 200, { product: data });
  }

  // ── CART ENGINE ────────────────────────────────────────────
  if (url === '/cart/validate' && req.method === 'POST') {
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length)
      return json(res, 400, { error: 'items required' });
    try {
      const result = await recomputeTotal(items);
      return json(res, 200, { valid: true, ...result });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // ── PAYMENT ENGINE — init ──────────────────────────────────
  if (url === '/checkout/init' && req.method === 'POST') {
    const { items, buyer_name, buyer_email, buyer_phone, shipping_address } = req.body || {};
    if (!items?.length || !buyer_name || !buyer_email)
      return json(res, 400, { error: 'items, buyer_name, buyer_email required' });
    if (!PAYSTACK_SECRET) return json(res, 503, { error: 'Payments not enabled' });

    let computed;
    try { computed = await recomputeTotal(items); }
    catch (e) { return json(res, 400, { error: e.message }); }

    const order_ref = `TD-${Date.now()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
    const { data: order, error } = await sb().from('orders').insert({
      order_ref, buyer_name, buyer_email, buyer_phone,
      items: computed.lines,
      subtotal: computed.subtotal,
      shipping_fee: computed.shipping,
      total: computed.total,
      shipping_address: shipping_address || null,
      status: 'pending',
    }).select().single();
    if (error) return json(res, 500, { error: error.message });

    // Init Paystack transaction
    const amountKobo = Math.round(computed.total * 100);
    const https = require('https');
    const psRes = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        email: buyer_email,
        amount: amountKobo,
        currency: 'ZAR',
        reference: order_ref,
        metadata: { order_ref, buyer_name },
        callback_url: `${process.env.APP_URL || 'https://totallydifferent.vercel.app'}/checkout/confirm?ref=${order_ref}`,
      });
      const r = https.request({
        hostname: 'api.paystack.co', path: '/transaction/initialize',
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json', 'Content-Length': body.length },
      }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
      r.on('error', reject); r.write(body); r.end();
    });

    if (!psRes?.data?.authorization_url)
      return json(res, 502, { error: 'Paystack init failed' });

    return json(res, 200, {
      order_ref,
      authorization_url: psRes.data.authorization_url,
      total: computed.total,
      currency: 'ZAR',
    });
  }

  // ── PAYMENT ENGINE — confirm ───────────────────────────────
  if (url === '/checkout/confirm' && req.method === 'GET') {
    const ref = q.ref;
    if (!ref) return json(res, 400, { error: 'ref required' });

    const { data: order, error: oErr } = await sb().from('orders')
      .select('*').eq('order_ref', ref).single();
    if (oErr || !order) return json(res, 404, { error: 'Order not found' });
    if (order.status === 'paid')
      return json(res, 200, { success: true, order_ref: order.order_ref, total: order.total });
    if (order.status !== 'pending')
      return json(res, 400, { error: 'Order not payable' });

    if (!PAYSTACK_SECRET) return json(res, 503, { error: 'Payments not enabled' });
    const { ok, pd, reason } = await verifyPaystackTx(ref, order.total);
    if (!ok) { console.error('[confirm]', ref, reason); return json(res, 400, { error: reason }); }

    const { data: confirmed } = await sb().from('orders')
      .update({ status: 'paid', paystack_ref: pd.reference || ref })
      .eq('order_ref', ref).eq('status', 'pending')
      .select().single();

    if (confirmed) {
      await decrementStock(order.items);
      sendEmail({
        to: order.buyer_email,
        subject: `Order Confirmed — ${ref}`,
        html: orderConfirmHtml(order),
      }).catch(() => {});
    }

    return json(res, 200, { success: true, order_ref: ref, total: order.total });
  }

  // ── ORDER ENGINE ───────────────────────────────────────────
  const orderRef = url.match(/^\/orders\/([^/]+)$/)?.[1];
  if (orderRef && req.method === 'GET') {
    const { data, error } = await sb().from('orders')
      .select('*').eq('order_ref', orderRef).single();
    if (error || !data) return json(res, 404, { error: 'Order not found' });
    return json(res, 200, { order: data });
  }

  // ── PAYMENT ENGINE — webhook ───────────────────────────────
  if (url === '/payments/webhook' && req.method === 'POST') {
    const sig  = req.headers['x-paystack-signature'] || '';
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(JSON.stringify(req.body)).digest('hex');
    if (sig !== hash) return json(res, 401, { error: 'Invalid signature' });
    res.status(200).json({ received: true });

    if (req.body?.event === 'charge.success') {
      const ref = req.body.data?.reference;
      if (!ref) return;
      const { data: order } = await sb().from('orders')
        .select('*').eq('order_ref', ref).eq('status', 'pending').single();
      if (!order) return;
      const { ok } = await verifyPaystackTx(ref, order.total);
      if (!ok) return;
      const { data: confirmed } = await sb().from('orders')
        .update({ status: 'paid', paystack_ref: ref })
        .eq('order_ref', ref).eq('status', 'pending').select().single();
      if (confirmed) {
        await decrementStock(order.items);
        sendEmail({
          to: order.buyer_email,
          subject: `Order Confirmed — ${ref}`,
          html: orderConfirmHtml(order),
        }).catch(() => {});
      }
    }
    return;
  }

  // ── ADMIN ENGINE ───────────────────────────────────────────
  // Password login → short-lived signed session token. The service key is
  // also accepted as a bearer for programmatic use (back-compat).
  if (url === '/admin/login' && req.method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return json(res, 503, { error: 'Admin login not configured' });
    const { username, password } = req.body || {};
    if (!checkAdminCredentials(username, password)) return json(res, 401, { error: 'Invalid username or password' });
    return json(res, 200, { token: signAdminSession(), expires_in: 12 * 60 * 60 });
  }

  const adminToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (url.startsWith('/admin') && !isAdminAuthorized(adminToken))
    return json(res, 401, { error: 'Unauthorized' });

  if (url === '/admin/products' && req.method === 'GET') {
    const { data, error } = await sb().from('products').select('*, product_variants(*)').order('created_at', { ascending: false });
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { products: data });
  }

  if (url === '/admin/products' && req.method === 'POST') {
    const { id, name, description, category, subcategory, base_price, images, is_featured, brand_id, specs } = req.body || {};
    if (!id || !name || !category || base_price == null)
      return json(res, 400, { error: 'id, name, category, base_price required' });
    const { data, error } = await sb().from('products')
      .insert({ id, name, description, category, subcategory, base_price, images: images || [], is_featured: is_featured || false, brand_id: brand_id || null, specs: specs || null })
      .select().single();
    if (error) return json(res, 400, { error: error.message });
    return json(res, 201, { product: data });
  }

  // Update an existing product (images, price, flags, copy)
  const adminProductId = url.match(/^\/admin\/products\/([^/]+)$/)?.[1];
  if (adminProductId && req.method === 'PATCH') {
    const allowed = ['name','description','category','subcategory','base_price','images','is_active','is_featured','brand_id','specs'];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if (!Object.keys(patch).length) return json(res, 400, { error: 'No updatable fields provided' });
    const { data, error } = await sb().from('products')
      .update(patch).eq('id', adminProductId).select('*, product_variants(*)').single();
    if (error || !data) return json(res, 404, { error: error?.message || 'Product not found' });
    return json(res, 200, { product: data });
  }

  // Upload an image to the product-images bucket → returns a public URL
  if (url === '/admin/upload' && req.method === 'POST') {
    const { filename, content_base64, content_type } = req.body || {};
    if (!content_base64 || !content_type)
      return json(res, 400, { error: 'content_base64 and content_type required' });
    try {
      const imageUrl = await uploadProductImage({
        filename: filename || 'upload.jpg', contentBase64: content_base64, contentType: content_type,
      });
      return json(res, 201, { url: imageUrl });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // Create a product variant
  if (url === '/admin/variants' && req.method === 'POST') {
    const { product_id, label, size, colour, volume, price_override, stock, sku } = req.body || {};
    if (!product_id || !label || !sku)
      return json(res, 400, { error: 'product_id, label, sku required' });
    const { data, error } = await sb().from('product_variants')
      .insert({ product_id, label, size: size || null, colour: colour || null, volume: volume || null,
                price_override: price_override ?? null, stock: stock ?? 0, sku })
      .select().single();
    if (error) return json(res, 400, { error: error.message });
    return json(res, 201, { variant: data });
  }

  // Update a variant (stock / price)
  const adminVariantId = url.match(/^\/admin\/variants\/([^/]+)$/)?.[1];
  if (adminVariantId && req.method === 'PATCH') {
    const patch = {};
    for (const k of ['label','stock','price_override','sku']) if (k in (req.body || {})) patch[k] = req.body[k];
    if (!Object.keys(patch).length) return json(res, 400, { error: 'No updatable fields provided' });
    const { data, error } = await sb().from('product_variants')
      .update(patch).eq('id', adminVariantId).select().single();
    if (error || !data) return json(res, 404, { error: error?.message || 'Variant not found' });
    return json(res, 200, { variant: data });
  }

  // List orders (newest first)
  if (url === '/admin/orders' && req.method === 'GET') {
    const { data, error } = await sb().from('orders')
      .select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { orders: data });
  }

  const adminOrderRef = url.match(/^\/admin\/orders\/([^/]+)$/)?.[1];
  if (adminOrderRef && req.method === 'PATCH') {
    const { status } = req.body || {};
    const valid = ['pending','paid','packed','shipped','delivered','cancelled'];
    if (!valid.includes(status)) return json(res, 400, { error: 'Invalid status' });
    const { data, error } = await sb().from('orders')
      .update({ status }).eq('order_ref', adminOrderRef).select().single();
    if (error || !data) return json(res, 404, { error: 'Order not found' });
    return json(res, 200, { order: data });
  }

  // ── REVIEWS ENGINE ─────────────────────────────────────────
  // GET /api/reviews?product=<id>  — approved reviews for a product
  if (url === '/reviews' && req.method === 'GET') {
    if (!q.product) return json(res, 400, { error: 'product param required' });
    const { data, error } = await sb().from('reviews')
      .select('id, reviewer_name, rating, comment, photo_url, created_at')
      .eq('product_id', q.product)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { reviews: data });
  }

  // POST /api/reviews  — submit a new review (pending approval)
  if (url === '/reviews' && req.method === 'POST') {
    const { product_id, reviewer_name, rating, comment, photo_url } = req.body || {};
    if (!product_id || !reviewer_name || !rating) {
      return json(res, 400, { error: 'product_id, reviewer_name and rating are required' });
    }
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return json(res, 400, { error: 'rating must be 1–5' });
    }
    const { error } = await sb().from('reviews').insert({
      product_id,
      reviewer_name: String(reviewer_name).slice(0, 80),
      rating: r,
      comment: comment ? String(comment).slice(0, 1200) : null,
      photo_url: photo_url ? String(photo_url).slice(0, 500) : null,
      is_approved: false,
    });
    if (error) return json(res, 400, { error: error.message });
    return json(res, 201, { message: 'Review submitted — it will appear after approval. Thank you!' });
  }

  return json(res, 404, { error: 'Not found' });
};

// Top-level guard: capture any unhandled error and return a clean 500.
module.exports = async (req, res) => {
  try {
    return await handler(req, res);
  } catch (err) {
    captureError(err, { method: req.method, url: req.url });
    if (!res.headersSent) return json(res, 500, { error: 'Internal server error' });
  }
};
