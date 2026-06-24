# Totallydifferent — Colour Scheme Handover (for Copilot)

A focused guide so GitHub Copilot (or any developer) can help iterate on the
**colour scheming**. It records the **original intent**, the **current values**,
**exactly where they live**, and **how to change them safely**.

- Live site: https://totallydifferent.vercel.app
- Main file: `apps/store/index.html` (single-file storefront — CSS in `<style>`, JS inline)
- Brand colours are **data-driven** from the Supabase `brands` table, not the file.

---

## 1. The colour direction the owner asked for — "smoked matte"

The store theme should be a **smoked matte** palette: muted, desaturated,
sophisticated tones with a soft "burning smoke" haze drifting over them — never
bright/neon, never glossy. The look evolved through three rounds of feedback:

1. **Original request** — a different matte background **per shop tab**:
   - **All** → *light matte orange*
   - **Clothing** → *matte ocean blue*
   - **Hair** → *matte red*
   - Plus a **distinct colour per brand**, and the hero band as a **light matte black** (not pure black).
2. **"Make it light smoked matte / more visible"** — the pale tints were hard to
   see, so they were deepened into smoked tones.
3. **"Darker, especially All; add burning-smoke effect; balance them so they're
   cohesive, not mismatched"** — the tabs became a **dark, cohesive smoked
   family** (all dark with light text) plus an animated smoke haze.

> **North star for tuning:** keep them *smoked matte* — muted, balanced as a
> family, All the darkest. If asked to go lighter again, scale all three
> together so they stay cohesive (don't make one bright while the others are dark).

### Reference: the original "smoked matte" values (kept here on purpose)
These are the earlier light-smoked-matte tones, useful if the owner ever wants to
dial back toward lighter smoked colours:

| Tab | Original light matte | Light **smoked** matte | Current dark smoked |
|---|---|---|---|
| All (now **matte maroon**) | `#f0dcc2` | `#ddbd97` | **`#2a141a`** (deep) / `#4a2630` (hero band) |
| Clothing (ocean blue) | `#cddfe4` | `#a6c2ca` | **`#121f1e`** |
| Hair (red/ember) | `#eccdc6` | `#d3aaa0` | **`#1e120f`** |

---

## 2. Current colours & where they live

### a) Per-tab themes — token-driven + auto-derived (`apps/store/index.html`)
Each tab now sets only a **base background token**; the accent and text are
**derived automatically** by `autoPalette()` (design-system rule: accent = same
hue, higher saturation + brightness; text = light on dark bg / dark on light bg):

```js
// showAll()    → applyAutoTheme('--primary-bg', false)   // All  (darkest)
// showBrands() → applyAutoTheme('--clothing-bg', false)  // Clothing
// showHair()   → applyAutoTheme('--hair-bg', false)      // Hair
```
The base tokens live in `:root`:
```css
--primary-bg: #1c1712;   /* All  — dark smoked ember */
--clothing-bg: #121f1e;  /* Clothing — dark smoked ocean */
--hair-bg: #1e120f;      /* Hair — dark smoked ember-red */
```
To recolour a tab, **change only its base token** — the accent/text follow.
(`applyTheme(bg, accent, text, glow)` still exists for fully-manual control, e.g.
brand pages, and drives `--theme-bg / --theme-accent / --theme-text`.)

### b) Hero band — `:root` var + `.hero` (~lines 24 & 67)
```css
--maroon: #4a2630;                 /* matte maroon — light shaded (hero band) */
--maroon-deep: #2a141a;            /* matte maroon — dark shaded (All tab base) */
--matte-black: var(--maroon);      /* hero band is now a light-shaded matte maroon, not black */
.hero { background: var(--matte-black); color: var(--white); }
```
The **main theme is matte maroon**: the hero band uses the lighter shade
(`--maroon`) and the "All" tab + its smoke haze derive from the darker shade
(`--primary-bg: #2a141a`). `--black: #0a0a0a` is still used for
header/buttons/footer/active filter only.

### c) The "burning smoke" effect — `.products-section.themed::before` (~lines 366–383)
Animated, blurred radial-gradient haze tinted by `--theme-accent`, drifting via
`@keyframes smokeDrift` (22s). It's behind content (`z-index:0`; content is
`z-index:1`), respects `prefers-reduced-motion`, and the section uses
`clip-path: inset(0)` (NOT `overflow:hidden`, which would break the sticky brand bar).
- **Stronger/weaker smoke:** change the `opacity: 0.9` and the gradient
  `color-mix(... NN% ...)` percentages.
- **Faster/slower:** change the `22s` duration.

### d) Per-brand colours — Supabase `brands` table (NOT in the file)
Each brand row has `theme_bg`, `theme_accent`, `theme_text`. The storefront reads
them from `GET /api/brands` and applies them when a brand is opened, and for the
brand cards. Current distinct, cohesive matte set:

| Brand | theme_bg | theme_accent | theme_text | Feel |
|---|---|---|---|---|
| novacaine-men | `#26323d` | `#7fa8c9` | `#eaf0f5` | slate blue |
| novacaine-women | `#3b2731` | `#d3a3b3` | `#f3e8ec` | wine / mauve |
| countryman | `#373b24` | `#bfa467` | `#f0ead9` | olive |
| antisocial | `#e9e5ee` | `#6d5d83` | `#211c2a` | light lilac |
| kookies | `#142a18` | `#5ec46f` | `#dcecd6` | cannabis green |

To change a brand colour, update its row (no code deploy needed — it's live via the API):
```sql
update brands set theme_bg='#…', theme_accent='#…', theme_text='#…' where id='kookies';
```

### e) Global brand palette — `:root` (~lines 23–30)
`--black #0a0a0a` · `--matte-black #2a2a2a` · `--white #fafafa` ·
`--gold #c8a96e` · `--gold-light #e8c98a` · `--grey #888`.

### f) Design-system tokens — `:root`
Per the design-system handover, non-colour tokens are defined as variables:
- **Spacing:** `--space-xs 8px` · `--space-sm 16px` · `--space-md 24px` · `--space-lg 32px`
- **Typography:** `--weight-title 700` · `--weight-body 400` · `--fs-title 1.25rem` · `--fs-body 0.95rem` · `--fs-meta 0.78rem`
- **Motion:** `--trans 180ms ease-out` · `--anim-card 220ms` (cards fade-in + slide-up via `@keyframes cardIn`, within the 150–250ms ease-out rule)

**UI kit:** product/brand cards follow Image → Title → Value → CTA; buttons are
Primary (accent fill, `.add-btn`/`.hero-cta`) or Secondary (outlined, `.filter-btn`).

---

## 3. How the theme system works (so changes stay safe)

- `applyTheme(bg, accent, text, glow)` sets `--theme-bg/accent/text` on the
  `#shop` section and adds the `.themed` class.
- `.products-section.themed` paints `background: var(--theme-bg)` and
  `color: var(--theme-text)`; product **cards** auto-tint via
  `color-mix(in srgb, var(--theme-bg) 86%, #fff)`, so a dark `theme_bg` gives dark
  cards + light text, and a light `theme_bg` gives light cards + dark text.
- **Always set all three** of bg/accent/text together so contrast stays correct
  (light text on dark bg, or dark text on light bg). Accent must be readable on bg.

---

## 4. Good prompts to give Copilot

- "In `apps/store/index.html`, the three `applyTheme(...)` calls in `showAll`,
  `showBrands`, `showHair` set the tab themes. Keep them **smoked matte** and
  cohesive (All darkest). Propose a lighter-but-still-smoked variant of all three
  together, preserving text/accent contrast."
- "Tune the `smokeDrift` smoke effect on `.products-section.themed::before` —
  make it more subtle (lower opacity) without touching the base colours."
- "Suggest 5 distinct but harmonious matte brand palettes (bg/accent/text) for the
  `brands` table that read as one family."

## 5. Guardrails
- Don't change `--black` to fix the hero — only `--matte-black` drives the hero.
- Don't add `overflow:hidden` to `.products-section.themed` — it breaks the sticky
  floating brand bar; the smoke layer uses `clip-path` for this reason.
- Keep the smoke layer behind content (`z-index`) and behind `prefers-reduced-motion`.
- Brand colours live in the database — change them with SQL, not in the HTML.
