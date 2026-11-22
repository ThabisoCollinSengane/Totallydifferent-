/* TotaAI — the store's meerkat helper.
 * A draggable 2D meerkat on every page; tap it to chat. Talks to POST /api/assistant
 * and falls back to built-in answers when the AI is off or unreachable.
 * Self-contained: injects its own CSS, needs no other script. Versioned filename
 * because /assets is cached as immutable — ship changes as tota-widget.v4.js. */
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
  // Store palette (COLOUR_SCHEME.md: smoked matte, gold accent), with fallbacks for pages
  // that don't define the variables (the light confirm page).
  var css = [
    '.tota-pet{position:fixed;z-index:180;width:64px;height:78px;padding:0;border:0;background:none;cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 5px 10px rgba(0,0,0,.4));}',
    '.tota-pet:focus-visible{outline:2px solid #d4b87e;outline-offset:4px;border-radius:12px;}',
    '.tota-pet.dragging{cursor:grabbing;}',
    '.tota-pet img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-drag:none;}',
    '.tota-pet .tota-body{display:block;width:100%;height:100%;transform-origin:50% 100%;}',
    '.tota-pet:not(.still) .tota-body{animation:tota-bob 2.8s ease-in-out infinite;}',
    '.tota-pet.hop .tota-body{animation:tota-hop .5s cubic-bezier(.3,1.6,.5,1);}',
    '.tota-pet[hidden],.tota-panel[hidden],.tota-bubble[hidden],.tota-chips[hidden]{display:none;}',
    'body.tota-on{padding-bottom:calc(92px + env(safe-area-inset-bottom));}',
    '@keyframes tota-bob{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-4px) scaleY(1.015)}}',
    '@keyframes tota-hop{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-16px) scale(1.04,.97)}100%{transform:translateY(0) scale(1)}}',
    '.tota-bubble{position:fixed;z-index:181;max-width:190px;padding:9px 12px;border-radius:12px;background:#2b1d24;color:#f6ebe3;border:1px solid rgba(212,184,126,.6);box-shadow:0 8px 22px rgba(0,0,0,.4);font:500 13px/1.35 system-ui,-apple-system,sans-serif;pointer-events:none;}',
    '.tota-panel{position:fixed;z-index:190;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:min(370px,calc(100vw - 24px));height:min(540px,calc(100dvh - 84px));display:flex;flex-direction:column;background:#2b1d24;color:#f6ebe3;border:1px solid rgba(212,184,126,.35);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.55);font:14px/1.45 system-ui,-apple-system,sans-serif;overflow:hidden;}',
    '.tota-panel:not(.still){animation:tota-in .26s cubic-bezier(.16,1,.3,1);}',
    '@keyframes tota-in{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}',
    '.tota-head{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;background:#3b2731;border-bottom:1px solid rgba(212,184,126,.25);}',
    '.tota-head .tota-av{width:40px;height:49px;flex:none;object-fit:contain;}',
    '.tota-head .tota-logo{height:28px;width:auto;display:block;}',
    '.tota-head .tota-sub{font-size:11.5px;color:#cdbcb4;margin-top:1px;}',
    '.tota-hide{margin-left:auto;min-height:44px;padding:0 10px;border:0;background:transparent;color:#cdbcb4;font:500 12px system-ui,-apple-system,sans-serif;text-decoration:underline;white-space:nowrap;cursor:pointer;}',
    '.tota-x{width:44px;height:44px;flex:none;border-radius:50%;border:1px solid rgba(246,235,227,.2);background:transparent;color:#f6ebe3;font-size:22px;line-height:1;cursor:pointer;}',
    '.tota-x:hover{border-color:#d4b87e;}',
    '.tota-panel :focus-visible{outline:2px solid #d4b87e;outline-offset:2px;}',
    '.tota-log{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain;}',
    '.tota-msg{max-width:85%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;}',
    '.tota-msg.bot{align-self:flex-start;background:#3b2731;border-bottom-left-radius:4px;}',
    '.tota-msg.me{align-self:flex-end;background:#d4b87e;color:#231419;font-weight:500;border-bottom-right-radius:4px;}',
    '.tota-msg.wait{color:#cdbcb4;font-style:italic;}',
    '.tota-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px;}',
    '.tota-chip{min-height:44px;padding:6px 14px;border-radius:999px;border:1px solid rgba(212,184,126,.55);background:transparent;color:#f6ebe3;font:500 13px system-ui,-apple-system,sans-serif;cursor:pointer;}',
    '.tota-chip:hover{background:rgba(212,184,126,.12);}',
    '.tota-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(246,235,227,.08);}',
    '.tota-form input{flex:1;min-width:0;height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(246,235,227,.2);background:#3b2731;color:#f6ebe3;font-size:16px;}',
    '.tota-form input::placeholder{color:#b3a29b;}',
    '.tota-form input:focus{border-color:#d4b87e;}',
    '.tota-form button{height:44px;padding:0 18px;border-radius:999px;border:0;background:#d4b87e;color:#231419;font-weight:700;cursor:pointer;}',
    '.tota-form button[disabled]{opacity:.5;cursor:default;}',
    '.tota-note{padding:0 12px 8px;font-size:11px;color:#b3a29b;}',
    '@media (max-width:480px){.tota-panel{right:0;left:0;bottom:0;width:100%;height:min(78dvh,600px);border-radius:14px 14px 0 0;padding-bottom:env(safe-area-inset-bottom);}}',
    '@media (prefers-reduced-motion:reduce){.tota-pet .tota-body,.tota-panel{animation:none!important;}}',
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Idle + blink up front; the rest load the first time the chat opens (or on first wave).
  var loaded = {};
  function preload(list) { list.forEach(function (f) { if (!loaded[f]) { loaded[f] = 1; var i = new Image(); i.src = BASE + 'tota-' + f + '.webp'; } }); }
  preload(['idle', 'blink']);

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

  var bubble = el('div', { class: 'tota-bubble', 'aria-hidden': 'true', hidden: '' });

  // ── The chat panel ─────────────────────────────────────────
  var panel = el('div', { class: 'tota-panel' + (reduced ? ' still' : ''), role: 'dialog', 'aria-modal': 'false', 'aria-label': 'TotaAI chat', hidden: '' });
  var head = el('div', { class: 'tota-head' });
  var avatar = el('img', { class: 'tota-av', src: BASE + 'tota-idle.webp', alt: '' });
  var titleBox = el('div');
  var logoImg = el('img', { class: 'tota-logo', alt: 'TotaAI', width: '240', height: '87' });
  titleBox.appendChild(logoImg);
  titleBox.appendChild(el('div', { class: 'tota-sub' }, 'Shop helper · sizes, delivery, orders'));
  var closeBtn = el('button', { type: 'button', class: 'tota-x', 'aria-label': 'Close chat' }, '×');
  var hideBtn = el('button', { type: 'button', class: 'tota-hide', 'aria-label': 'Hide TotaAI for this visit' }, 'Hide');
  head.appendChild(avatar); head.appendChild(titleBox); head.appendChild(hideBtn); head.appendChild(closeBtn);
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
  if (!reduced) (function blinkLoop() {
    setTimeout(function () {
      if (mood === 'idle' && !document.hidden) { show('blink'); setTimeout(function () { if (mood === 'idle') show('idle'); }, 150); }
      blinkLoop();
    }, 3000 + Math.random() * 3000);
  })();
  if (!reduced) {
    (function waveLoop() {
      setTimeout(function () {
        if (mood === 'idle' && !open && !document.hidden) { preload(['wave']); setMood('wave', 1400); }
        waveLoop();
      }, 22000 + Math.random() * 16000);
    })();
  }

  // ── Position + drag ────────────────────────────────────────
  var W = 64, H = 78, M = 8;
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
  // True when the box would cover a visible button, link or field on the page.
  function coversControl(b) {
    var els = document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e === pet || panel.contains(e)) continue;
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) return true;
    }
    return false;
  }
  function say(text, ms) {
    if (open || pet.hidden) return;
    bubble.textContent = text; bubble.hidden = false; placeBubble();
    // Never cover something the shopper might tap: try beside the meerkat, else stay quiet.
    if (coversControl(bubble.getBoundingClientRect())) {
      var r = pet.getBoundingClientRect(), bw = bubble.offsetWidth, bh = bubble.offsetHeight;
      var left = r.left - bw - 8 >= 8 ? r.left - bw - 8 : r.right + 8;
      bubble.style.left = left + 'px';
      bubble.style.top = clamp(r.top + r.height / 2 - bh / 2, 68, window.innerHeight - bh - 8) + 'px';
      if (left + bw > window.innerWidth - 8 || coversControl(bubble.getBoundingClientRect())) { bubble.hidden = true; return; }
    }
    setTimeout(function () { bubble.hidden = true; }, ms || 5000);
  }

  // Hide while the cart, a modal or a product page has the screen (they set body.no-scroll).
  function syncVisibility() {
    if (get('sessionStorage', 'tota.hidden')) { pet.hidden = true; bubble.hidden = true; return; }
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
    preload(FRAMES);
    if (!logoImg.getAttribute('src')) logoImg.src = BASE + 'tota-logo.webp';
    var small = window.innerWidth <= 480;
    panel.setAttribute('aria-modal', small ? 'true' : 'false');
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
  hideBtn.addEventListener('click', function () {
    set('sessionStorage', 'tota.hidden', '1');
    closePanel();
    pet.hidden = true; bubble.hidden = true; document.body.classList.remove('tota-on');
    lastFocus = null;
  });
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { closePanel(); return; }
    // On phones the panel covers the page: keep Tab inside it.
    if (e.key === 'Tab' && panel.getAttribute('aria-modal') === 'true') {
      var f = panel.querySelectorAll('button:not([disabled]),input');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

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
    setTimeout(function () { preload(['wave', 'happy']); }, 2500);
    new MutationObserver(syncVisibility).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (!get('sessionStorage', 'tota.hidden')) document.body.classList.add('tota-on');
    // No greeting on the order-confirmation page: the buyer has just paid.
    if (!get('sessionStorage', 'tota.greeted') && !/confirm/.test(location.pathname)) {
      setTimeout(function () {
        set('sessionStorage', 'tota.greeted', '1');
        if (!open) { setMood('wave', 1600); hop(); say('Heita! Need help finding your fit? Tap me 👋', 5200); }
      }, 3500);
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
