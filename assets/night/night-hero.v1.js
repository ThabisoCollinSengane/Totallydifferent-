/* Night hero: the crew (him + her), speech bubble, lean-to-pointer and the lookbook slideshow.
 * Optional: the hero is plain HTML/CSS, so the store works if this file fails to load.
 * /assets is cached as immutable: ship changes as night-hero.v2.js. */
(function () {
  'use strict';
  var stage = document.getElementById('nh-stage');
  if (!stage) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ── The crew ────────────────────────────────────────────────
  var him = document.getElementById('nh-him'), her = document.getElementById('nh-her');
  var herImg = document.getElementById('nh-her-img'), bubble = document.getElementById('nh-bubble');
  var POSES = [
    { src: '/assets/crew/her.webp', alt: 'Model in the white Antisocial eye-sleeve longsleeve and mauve Novacaine Women leggings, with long wavy hair' },
    { src: '/assets/crew/her-2.webp', alt: 'Model laughing, hand in her hair, in the Antisocial eye-sleeve longsleeve and Novacaine Women leggings' }
  ];
  new Image().src = POSES[1].src; // preload so the pose change is instant
  var pose = 0, himIx = -1, herIx = -1;
  var HIM = ['Antisocial on the chest. Eyes down the sleeve.', 'Cuff says BRB, overthinking.', 'Novacaine cargos. Free delivery over R750.'];
  var HER = ['Same longsleeve, her way.', 'Novacaine leggings with the beetle crest.', 'The hair? Our hair line. Bundles and wigs.'];

  function say(text) {
    bubble.textContent = text;
    if (reduced) return;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    setTimeout(function () { bubble.classList.remove('pop'); }, 220);
  }
  function hop(btn) {
    if (reduced) return;
    btn.classList.remove('hop'); void btn.offsetWidth; btn.classList.add('hop');
  }
  [him, her].forEach(function (b) { b.addEventListener('animationend', function (e) { if (e.animationName === 'nh-hop') b.classList.remove('hop'); }); });
  function swapPose() {
    pose = (pose + 1) % POSES.length;
    herImg.src = POSES[pose].src; herImg.alt = POSES[pose].alt;
  }
  function changePose() {
    if (reduced) { swapPose(); return; }
    her.classList.add('mid');
    setTimeout(function () { swapPose(); her.classList.remove('mid'); }, 170);
  }
  him.addEventListener('click', function () { hop(him); himIx = (himIx + 1) % HIM.length; say(HIM[himIx]); });
  her.addEventListener('click', function () { changePose(); herIx = (herIx + 1) % HER.length; say(HER[herIx]); });
  document.getElementById('nh-pose').addEventListener('click', function () { changePose(); say(pose ? 'New pose.' : 'And back.'); });

  // They lean toward your cursor or finger.
  if (!reduced) {
    var raf = 0, nx = 0;
    var lean = function () {
      raf = 0;
      him.style.setProperty('--tx', (nx * -8).toFixed(1) + 'px'); him.style.setProperty('--ry', (nx * 7).toFixed(1) + 'deg');
      her.style.setProperty('--tx', (nx * -14).toFixed(1) + 'px'); her.style.setProperty('--ry', (nx * 9).toFixed(1) + 'deg');
    };
    var point = function (x) {
      var r = stage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      nx = Math.max(-1, Math.min(1, ((x - r.left) / r.width) * 2 - 1));
      if (!raf) raf = requestAnimationFrame(lean);
    };
    window.addEventListener('pointermove', function (e) { point(e.clientX); }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (e.touches[0]) point(e.touches[0].clientX); }, { passive: true });
  }

  // ── Lookbook slideshow ──────────────────────────────────────
  // go: a brand id opens that brand in the shop; 'hair' opens the hair category.
  var LOOKS = [
    { brand: 'Novacaine Men', line: 'Crest tees and hoodies with baggy denim.', img: '/assets/brands/novacaine-men-hero.webp', go: 'novacaine-men' },
    { brand: 'Novacaine Women', line: 'Fitted sets, hoodies and leggings.', img: '/assets/brands/novacaine-women-hero.webp', go: 'novacaine-women' },
    { brand: 'Antisocial', line: 'Graphic tees and longsleeves. Talk later. Maybe.', img: '/assets/brands/antisocial-hero.webp', go: 'antisocial' },
    { brand: 'Novacaine', line: 'Utility jacket with the embroidered crest.', img: '/assets/brands/novacaine-utility-jacket.webp', go: 'novacaine-men' },
    { brand: 'Kookies', line: 'Good Kookies. High vibes.', img: '/assets/brands/kookies-hero.webp', go: 'kookies' },
    { brand: 'Hair', line: 'Brazilian, Peruvian and Vietnamese bundles.', img: '/assets/hair/brazilian-body-wave.webp', go: 'hair' }
  ];
  function shop(go) {
    try {
      if (go === 'hair' && typeof window.filterProducts === 'function') window.filterProducts('hair');
      else if (typeof window.openBrand === 'function') window.openBrand(go);
    } catch (e) { /* the shop still scrolls into view */ }
    var s = document.getElementById('shop');
    if (s) s.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  var frame = document.getElementById('nh-frame'), dotsEl = document.getElementById('nh-dots');
  var slides = [], dots = [], cur = 0, paused = false, inView = false, resumeT;
  LOOKS.forEach(function (l, i) {
    var s = el('div', 'nh-slide');
    s.setAttribute('role', 'group'); s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', (i + 1) + ' of ' + LOOKS.length + ': ' + l.brand);
    var bg = new Image(); bg.className = 'bg'; bg.alt = ''; bg.setAttribute('aria-hidden', 'true'); bg.decoding = 'async'; bg.loading = 'lazy'; bg.src = l.img;
    var fg = new Image(); fg.className = 'fg'; fg.alt = l.brand + ' clothes on models'; fg.decoding = 'async'; fg.loading = 'lazy'; fg.src = l.img;
    var cap = el('div', 'nh-cap'), tx = el('div', 'nh-cap-text');
    tx.appendChild(el('span', 'nh-cap-brand', l.brand)); tx.appendChild(el('span', 'nh-cap-line', l.line)); cap.appendChild(tx);
    var btn = el('button', 'nh-cap-shop', 'Shop ' + l.brand); btn.type = 'button';
    btn.addEventListener('click', function () { shop(l.go); });
    cap.appendChild(btn);
    s.appendChild(bg); s.appendChild(fg); s.appendChild(cap);
    frame.insertBefore(s, frame.firstChild); slides.push(s);
    var d = el('button'); d.type = 'button'; d.setAttribute('aria-label', 'Show look ' + (i + 1) + ', ' + l.brand);
    d.addEventListener('click', function () { go(i); hold(); });
    dotsEl.appendChild(d); dots.push(d);
  });
  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      var on = k === cur;
      s.classList.toggle('on', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.querySelector('.nh-cap-shop').tabIndex = on ? 0 : -1;
    });
    dots.forEach(function (d, k) { d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
  }
  function hold() { paused = true; clearTimeout(resumeT); resumeT = setTimeout(function () { paused = false; }, 9000); }
  document.getElementById('nh-prev').addEventListener('click', function () { go(cur - 1); hold(); });
  document.getElementById('nh-next').addEventListener('click', function () { go(cur + 1); hold(); });
  frame.addEventListener('mouseenter', function () { paused = true; });
  frame.addEventListener('mouseleave', function () { paused = false; });
  frame.addEventListener('focusin', function () { paused = true; });
  frame.addEventListener('focusout', function () { paused = false; });
  var sx = null;
  frame.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  frame.addEventListener('touchend', function (e) {
    if (sx == null) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); hold(); }
  }, { passive: true });
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }).observe(frame);
  else inView = true;
  go(0);
  if (!reduced) setInterval(function () { if (!paused && inView && !document.hidden) go(cur + 1); }, 5000);
})();
