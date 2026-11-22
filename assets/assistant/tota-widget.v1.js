/* TotaAI — the store's meerkat helper.
 * A draggable 2D meerkat on every page; tap it to chat. Talks to POST /api/assistant
 * and falls back to built-in answers when the AI is off or unreachable.
 * Self-contained: injects its own CSS, needs no other script. Versioned filename
 * because /assets is cached as immutable — ship changes as tota-widget.v2.js. */
(function () {
  'use strict';
  if (window.__tota) return;
  window.__tota = true;

  var BASE = '/assets/assistant/';
  var FRAMES = ['idle', 'blink', 'wave', 'talk', 'think', 'happy'];
  var EMAIL = 'hello@totallydifferent.co.za';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function get(kind, k) { try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(kind, k, v) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (e) { /* private mode */ } }

  // ── Styles ─────────────────────────────────────────────────
  var css = [
    '.tota-pet{position:fixed;z-index:180;width:74px;height:91px;padding:0;border:0;background:none;cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45));}',
    '.tota-pet:focus-visible{outline:2px solid #ff3fd8;outline-offset:4px;border-radius:12px;}',
    '.tota-pet.dragging{cursor:grabbing;}',
    '.tota-pet img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-drag:none;}',
    '.tota-pet .tota-body{display:block;width:100%;height:100%;transform-origin:50% 100%;}',
    '.tota-pet:not(.still) .tota-body{animation:tota-bob 2.8s ease-in-out infinite;}',
    '.tota-pet.hop .tota-body{animation:tota-hop .5s cubic-bezier(.3,1.6,.5,1);}',
    '.tota-pet[hidden],.tota-panel[hidden],.tota-bubble[hidden],.tota-chips[hidden]{display:none;}',
    '@keyframes tota-bob{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-4px) scaleY(1.015)}}',
    '@keyframes tota-hop{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-16px) scale(1.04,.97)}100%{transform:translateY(0) scale(1)}}',
    '.tota-bubble{position:fixed;z-index:181;max-width:190px;padding:9px 12px;border-radius:14px;background:#1a0f24;color:#fdf2ff;border:1px solid #ff3fd8;box-shadow:0 0 18px rgba(255,63,216,.35);font:600 13px/1.35 system-ui,-apple-system,sans-serif;pointer-events:none;}',
    '.tota-panel{position:fixed;z-index:190;right:12px;bottom:12px;width:min(370px,calc(100vw - 24px));height:min(540px,calc(100dvh - 84px));display:flex;flex-direction:column;background:#140b1c;color:#fdf2ff;border:1px solid rgba(255,63,216,.55);border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px rgba(255,63,216,.18);font:14px/1.45 system-ui,-apple-system,sans-serif;overflow:hidden;}',
    '.tota-panel:not(.still){animation:tota-in .26s cubic-bezier(.16,1,.3,1);}',
    '@keyframes tota-in{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}',
    '.tota-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,#24102f,#140b1c);border-bottom:1px solid rgba(255,63,216,.3);}',
    '.tota-head .tota-av{width:42px;height:52px;flex:none;object-fit:contain;}',
    '.tota-head .tota-logo{height:30px;width:auto;}',
    '.tota-head .tota-sub{font-size:11.5px;color:#c9b3d6;margin-top:1px;}',
    '.tota-x{margin-left:auto;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fdf2ff;font-size:22px;line-height:1;cursor:pointer;}',
    '.tota-x:hover,.tota-x:focus-visible{border-color:#ff3fd8;outline:none;}',
    '.tota-log{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain;}',
    '.tota-msg{max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;}',
    '.tota-msg.bot{align-self:flex-start;background:#2a1736;border-bottom-left-radius:4px;}',
    '.tota-msg.me{align-self:flex-end;background:#ff3fd8;color:#1a0018;font-weight:500;border-bottom-right-radius:4px;}',
    '.tota-msg.wait{color:#c9b3d6;font-style:italic;}',
    '.tota-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px;}',
    '.tota-chip{min-height:36px;padding:6px 12px;border-radius:999px;border:1px solid rgba(57,255,212,.55);background:transparent;color:#bffff0;font:500 12.5px system-ui,-apple-system,sans-serif;cursor:pointer;}',
    '.tota-chip:hover,.tota-chip:focus-visible{background:rgba(57,255,212,.12);outline:none;}',
    '.tota-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);}',
    '.tota-form input{flex:1;min-width:0;height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:#1f1229;color:#fdf2ff;font-size:16px;}',
    '.tota-form input:focus{outline:none;border-color:#ff3fd8;}',
    '.tota-form button{height:44px;padding:0 16px;border-radius:999px;border:0;background:#ff3fd8;color:#1a0018;font-weight:700;cursor:pointer;}',
    '.tota-form button[disabled]{opacity:.5;cursor:default;}',
    '.tota-note{padding:0 12px 8px;font-size:11px;color:#9f8aab;}',
    '@media (max-width:480px){.tota-panel{right:0;left:0;bottom:0;width:100%;height:min(78dvh,600px);border-radius:18px 18px 0 0;}}',
    '@media (prefers-reduced-motion:reduce){.tota-pet .tota-body,.tota-panel{animation:none!important;}}',
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Preload frames so state swaps never flash.
  FRAMES.forEach(function (f) { var i = new Image(); i.src = BASE + 'tota-' + f + '.webp'; });

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  // ── The meerkat ────────────────────────────────────────────
  var pet = el('button', { type: 'button', class: 'tota-pet' + (reduced ? ' still' : ''), 'aria-label': 'Chat with TotaAI, the shop helper', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
  var body = el('span', { class: 'tota-body' });
  var petImg = el('img', { src: BASE + 'tota-idle.webp', alt: '', width: '268', height: '328', draggable: 'false' });
  body.appendChild(petImg); pet.appendChild(body);

  var bubble = el('div', { class: 'tota-bubble', role: 'status', hidden: '' });

  // ── The chat panel ─────────────────────────────────────────
  var panel = el('div', { class: 'tota-panel' + (reduced ? ' still' : ''), role: 'dialog', 'aria-modal': 'false', 'aria-label': 'TotaAI chat', hidden: '' });
  var head = el('div', { class: 'tota-head' });
  var avatar = el('img', { class: 'tota-av', src: BASE + 'tota-idle.webp', alt: '' });
  var titleBox = el('div');
  titleBox.appendChild(el('img', { class: 'tota-logo', src: BASE + 'tota-logo.webp', alt: 'TotaAI' }));
  titleBox.appendChild(el('div', { class: 'tota-sub' }, 'Shop helper · sizes, delivery, orders'));
  var closeBtn = el('button', { type: 'button', class: 'tota-x', 'aria-label': 'Close chat' }, '×');
  head.appendChild(avatar); head.appendChild(titleBox); head.appendChild(closeBtn);
  var log = el('div', { class: 'tota-log', role: 'log', 'aria-live': 'polite' });
  var chips = el('div', { class: 'tota-chips' });
  ['What’s new?', 'How much is delivery?', 'Track my order', 'Help with sizing'].forEach(function (c) {
    var b = el('button', { type: 'button', class: 'tota-chip' }, c);
    b.addEventListener('click', function () { send(c); });
    chips.appendChild(b);
  });
  var form = el('form', { class: 'tota-form' });
  var input = el('input', { type: 'text', maxlength: '600', placeholder: 'Ask TotaAI…', 'aria-label': 'Message TotaAI', autocomplete: 'off', enterkeyhint: 'send' });
  var sendBtn = el('button', { type: 'submit' }, 'Send');
  form.appendChild(input); form.appendChild(sendBtn);
  var note = el('div', { class: 'tota-note' }, 'TotaAI can make mistakes. Never share card details in chat.');
  panel.appendChild(head); panel.appendChild(log); panel.appendChild(chips); panel.appendChild(form); panel.appendChild(note);

  // ── Frames / mood ──────────────────────────────────────────
  var mood = 'idle', moodTimer = null;
  function show(frame) { var src = BASE + 'tota-' + frame + '.webp'; petImg.src = src; avatar.src = src; }
  function setMood(m, ms) {
    clearTimeout(moodTimer);
    mood = m; show(m);
    if (ms) moodTimer = setTimeout(function () { setMood('idle'); }, ms);
  }
  function hop() {
    if (reduced) return;
    pet.classList.remove('hop'); void pet.offsetWidth; pet.classList.add('hop');
    setTimeout(function () { pet.classList.remove('hop'); }, 520);
  }
  (function blinkLoop() {
    setTimeout(function () {
      if (mood === 'idle' && !document.hidden) { show('blink'); setTimeout(function () { if (mood === 'idle') show('idle'); }, 150); }
      blinkLoop();
    }, 3000 + Math.random() * 3000);
  })();
  if (!reduced) {
    (function waveLoop() {
      setTimeout(function () {
        if (mood === 'idle' && !open && !document.hidden) setMood('wave', 1400);
        waveLoop();
      }, 22000 + Math.random() * 16000);
    })();
  }

  // ── Position + drag ────────────────────────────────────────
  var W = 74, H = 91, M = 8;
  var pos = null;
  try { pos = JSON.parse(get('localStorage', 'tota.pos') || 'null'); } catch (e) { pos = null; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function place(fx, fy) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var x = clamp(fx * vw, M, vw - W - M), y = clamp(fy * vh, M + 60, vh - H - M);
    pet.style.left = x + 'px'; pet.style.top = y + 'px';
    return { x: x, y: y };
  }
  function defaultPos() { return { fx: 1, fy: 1 }; } // bottom-right; place() clamps it in
  var cur = pos && typeof pos.fx === 'number' ? pos : defaultPos();
  window.addEventListener('resize', function () { place(cur.fx, cur.fy); placeBubble(); });

  var drag = null;
  pet.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var r = pet.getBoundingClientRect();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false };
    try { pet.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  pet.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true; pet.classList.add('dragging'); bubble.hidden = true;
    cur = { fx: (e.clientX - drag.ox) / window.innerWidth, fy: (e.clientY - drag.oy) / window.innerHeight };
    place(cur.fx, cur.fy);
    if (mood !== 'happy') setMood('happy');
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var moved = drag.moved; drag = null;
    pet.classList.remove('dragging');
    if (moved) {
      var r = pet.getBoundingClientRect();
      cur = { fx: r.left / window.innerWidth, fy: r.top / window.innerHeight };
      set('localStorage', 'tota.pos', JSON.stringify(cur));
      setMood('idle'); hop();
      pet.__skipClick = true;
    }
  }
  pet.addEventListener('pointerup', endDrag);
  pet.addEventListener('pointercancel', endDrag);
  pet.addEventListener('click', function () {
    if (pet.__skipClick) { pet.__skipClick = false; return; }
    openPanel();
  });
  // Arrow keys move it too, so keyboard users can get it out of the way.
  pet.addEventListener('keydown', function (e) {
    var step = 0.04, k = e.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    e.preventDefault();
    var p = place(cur.fx, cur.fy);
    cur = { fx: p.x / window.innerWidth + (k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0),
            fy: p.y / window.innerHeight + (k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0) };
    var q = place(cur.fx, cur.fy);
    cur = { fx: q.x / window.innerWidth, fy: q.y / window.innerHeight };
    set('localStorage', 'tota.pos', JSON.stringify(cur));
  });

  function placeBubble() {
    if (bubble.hidden) return;
    var r = pet.getBoundingClientRect(), bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    var left = r.left + r.width / 2 - bw / 2;
    bubble.style.left = clamp(left, 8, window.innerWidth - bw - 8) + 'px';
    var top = r.top - bh - 8;
    bubble.style.top = (top < 68 ? r.bottom + 8 : top) + 'px';
  }
  function say(text, ms) {
    if (open || pet.hidden) return;
    bubble.textContent = text; bubble.hidden = false; placeBubble();
    setTimeout(function () { bubble.hidden = true; }, ms || 5000);
  }

  // Hide while the cart, a modal or a product page has the screen (they set body.no-scroll).
  function syncVisibility() {
    var covered = document.body.classList.contains('no-scroll');
    pet.hidden = covered || open;
    if (pet.hidden) bubble.hidden = true;
  }

  // ── Chat ───────────────────────────────────────────────────
  var open = false, busy = false, lastFocus = null;
  var history = [];
  try { history = JSON.parse(get('sessionStorage', 'tota.chat') || '[]'); } catch (e) { history = []; }
  if (!Array.isArray(history)) history = [];

  function bubbleMsg(role, text, extra) {
    var m = el('div', { class: 'tota-msg ' + (role === 'user' ? 'me' : 'bot') + (extra ? ' ' + extra : '') }, text);
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return m;
  }
  function renderHistory() {
    log.textContent = '';
    bubbleMsg('assistant', 'Heita! I’m TotaAI 👋 Ask me about our drops, sizes, delivery or your order (send your TD- reference).');
    history.forEach(function (m) { bubbleMsg(m.role, m.content); });
    chips.hidden = history.length > 0;
  }
  function saveHistory() { set('sessionStorage', 'tota.chat', JSON.stringify(history.slice(-20))); }

  function openPanel() {
    if (open) return;
    open = true; lastFocus = document.activeElement;
    renderHistory();
    panel.hidden = false; pet.setAttribute('aria-expanded', 'true'); syncVisibility();
    setMood('wave', 1200);
    setTimeout(function () { input.focus(); }, 30);
  }
  function closePanel() {
    if (!open) return;
    open = false; panel.hidden = true; pet.setAttribute('aria-expanded', 'false'); syncVisibility();
    setMood('idle');
    if (lastFocus && lastFocus.focus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus(); else pet.focus();
  }
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) closePanel(); });

  // Built-in answers for when the AI is switched off or unreachable. Same facts as the FAQ.
  function offlineAnswer(q) {
    var t = q.toLowerCase();
    if (/td-\d|track|where.*order|order status/.test(t)) return 'You can check your order from the link in your confirmation email, or email ' + EMAIL + ' with your TD- reference and we’ll update you.';
    if (/deliver|ship|courier|how long|arrive/.test(t)) return 'We deliver nationwide in about 2–5 business days. Delivery is free on orders of R750 or more, otherwise a flat R80.';
    if (/pay|card|eft|paystack/.test(t)) return 'Checkout is secured by Paystack in rand (card, instant EFT and more). Your card details go to Paystack, never to us.';
    if (/size|fit|small|large|oversized/.test(t)) return 'Our clothing fits true to size with a relaxed cut; tees and hoodies run slightly oversized. Not sure? Email ' + EMAIL + ' with your measurements.';
    if (/return|refund|exchange|faulty|wrong item/.test(t)) return 'For returns, exchanges or a faulty item, email ' + EMAIL + ' with your order reference and the team will sort you out.';
    if (/new|drop|latest|recommend|hair|wig|hoodie|tee|shirt/.test(t)) return 'Scroll the shop for the latest drops, or use the Clothing and Hair tabs at the top. Tap any product for sizes and stock.';
    return 'My AI brain is napping right now 😴 For anything else, email ' + EMAIL + ' and the team will help.';
  }

  function send(text) {
    text = String(text || '').trim().slice(0, 600);
    if (!text || busy) return;
    chips.hidden = true;
    history.push({ role: 'user', content: text }); saveHistory();
    bubbleMsg('user', text);
    input.value = '';
    busy = true; sendBtn.disabled = true;
    var waiting = bubbleMsg('assistant', 'TotaAI is thinking…', 'wait');
    setMood('think');
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12) }),
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (x) {
      if (x.ok && x.d && typeof x.d.reply === 'string' && x.d.reply.trim()) return x.d.reply.trim();
      if (x.d && x.d.error && !x.d.fallback) return x.d.error;
      return offlineAnswer(text);
    }).catch(function () {
      return offlineAnswer(text);
    }).then(function (reply) {
      clearTimeout(timer);
      waiting.remove();
      history.push({ role: 'assistant', content: reply }); saveHistory();
      bubbleMsg('assistant', reply);
      busy = false; sendBtn.disabled = false;
      setMood('talk');
      moodTimer = setTimeout(function () { setMood('happy', 1200); }, Math.min(3200, 900 + reply.length * 18));
      if (open) input.focus();
    });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });

  // ── Mount ──────────────────────────────────────────────────
  function mount() {
    document.body.appendChild(pet);
    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    place(cur.fx, cur.fy);
    syncVisibility();
    new MutationObserver(syncVisibility).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (!get('sessionStorage', 'tota.greeted')) {
      setTimeout(function () {
        set('sessionStorage', 'tota.greeted', '1');
        if (!open) { setMood('wave', 1600); hop(); say('Heita! Need help finding your fit? Tap me 👋', 5200); }
      }, 3500);
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
