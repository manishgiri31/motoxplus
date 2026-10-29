
# Apple Store: Detailed Design System Reference

**Source:** Project Wallace report and design-tokens analysis of `apple.com/store`.
**Purpose:** study and rebuild the *look and feel* with your own branding, images and copy.

**Legend**
- **[DATA]**: taken directly from the extracted CSS statistics (counts shown where available)
- **[INFERRED]**: derived from usage patterns or common practice; verify in DevTools before relying on it

**Legal note:** Do not reuse Apple's logos, product photos, icons, SF Pro font files, or copy. Layout, spacing and color ideas are fine to learn from.

---

## Table of contents
1. Stylesheet overview
2. Design principles
3. Color system
4. Typography
5. Spacing and layout
6. Shape, borders and elevation
7. Motion and animation
8. Responsive behavior
9. Accessibility
10. Components (with CSS)
11. Page anatomy of the Store
12. Z-index and stacking
13. Icons and imagery
14. Do and don't
15. Full CSS starter
16. Build checklist
17. Known gaps

---

## 1. Stylesheet overview [DATA]

| Metric | Value |
|---|---|
| Lines of code | 37,074 |
| File size | 1.81 MB |
| Rules | 11,096 |
| Selectors | 12,750 (8,803 unique) |
| Declarations | 22,504 (4,463 unique) |
| `!important` | 760 (3.38%) |
| Custom properties | 306 |
| `@media` queries | 1,305 (50 unique) |
| `@keyframes` | 112 (49 unique) |
| `@supports` | 8 |
| Embedded SVGs | 43 (15.5 kB) |
| Unique colors | 210 of 1,477 uses |
| Unique font sizes | 39 |
| Unique line heights | 82 |

**What this tells you**
- The huge size comes from **localization**: about 5,014 selectors use `:lang()`, and there are a dozen font stacks for Japanese, Korean, Chinese, Thai and Arabic. You do not need this for a single-language site.
- Class naming is component-based (`sk-*` for shared kit, `r-*` for responsive, `globalnav-*`, `dotnav-*`, `tabnav-*`, `ribbon-*`).
- Components are driven by `data-*` attributes (`data-core-scroller`, `data-core-gallery`, `data-core-tabs`, `data-core-accordion`, `data-core-overlay`).
- Custom elements exist: `as-tabnav`, `as-disclosure`, `as-accordion`.
- Mostly **desktop-first** (`max-width` queries: 1,203 vs `min-width`: 56).
- Display values are mostly `block` (156), `flex` (179), `none` (116), `inline-block` (87), `grid` (16).

---

## 2. Design principles [INFERRED from the tokens]

1. **Neutral canvas, one accent.** White and light gray dominate. Blue is the only recurring accent color.
2. **Type does the heavy lifting.** Big, tightly-leaded headlines with calm gray secondary text.
3. **Flat surfaces.** Cards use a background tint and a large radius, not heavy shadows. Only 20 box-shadow declarations exist in the whole file.
4. **Generous whitespace.** Sections breathe; content is centered.
5. **Subtle, fast motion.** Most transitions are 0.24-0.32s with a soft ease.
6. **Accessibility is built in.** Reduced-motion, contrast, hover-capable-only and focus-visible rules are all present.
7. **Pixel-based sizing.** `px` is 4,661 of 7,377 unit uses; `%` 1,146; `em` 821; `rem` 296.

---

## 3. Color system

### 3.1 Core neutrals [DATA]

| Token (suggested) | Hex | Uses | Role |
|---|---|---|---|
| `--c-black` | `#000` | 67 (+`#000000` 4) | Pure black, dark hero sections |
| `--c-ink` | `#1d1d1f` | 97 | **Primary text** |
| `--c-ink-dark-surface` | `#161617` | 1 (+12 `#18181a`) | Dark section backgrounds |
| `--c-ink-2` | `#272729` | 12 | Dark card / dark UI |
| `--c-ink-3` | `#333336` | 24 | Dark borders and UI |
| `--c-gray-700` | `#424245` | 18 | Secondary text on light, UI on dark |
| `--c-gray-600` | `#6e6e73` | 42 | **Secondary text** |
| `--c-gray-500` | `#86868b` | 28 | **Muted / tertiary text** |
| `--c-gray-400` | `#d2d2d7` | 47 | **Borders, dividers** |
| `--c-gray-300` | `#e8e8ed` | 36 | Light borders, fills |
| `--c-gray-200` | `#f5f5f7` | 67 | **Section and card background** |
| `--c-gray-100` | `#fbfbfd` / `#fafafa` | | Very subtle off-white |
| `--c-white` | `#fff` | 153 | **Page background** |

### 3.2 Transparent blacks and whites [DATA]
These are used for overlays, shadows, scrims and dividers.

| Value | Typical use [INFERRED] |
|---|---|
| `rgba(0,0,0,.8)` | strong text/overlay |
| `rgba(0,0,0,.56)` / `.48` | secondary text on light |
| `rgba(0,0,0,.4)` | scrim, disabled |
| `rgba(0,0,0,.16)` / `.08` / `.04` | borders, hover fills, shadows |
| `rgba(29,29,31,.8)` / `.07` / `.04` | tinted text-colored overlays |
| `rgba(255,255,255,.8)` | translucent nav on light |
| `rgba(255,255,255,.92)` | frosted surfaces |
| `rgba(255,255,255,.08)` / `.4` / `.48` | borders and text on dark |
| `rgba(245,245,247,.8)` / `.14` | light translucent surfaces |
| `rgba(232,232,237,.4)` | subtle fills |

### 3.3 Accent: blue [DATA]

| Token | Hex | Role |
|---|---|---|
| `--c-blue` | `#0071e3` | **Primary button** (`--sk-button-background`) |
| `--c-blue-hover` | `#0077ed` | Button hover |
| `--c-link` | `#06c` (= `#0066cc`) | **Text links on light** |
| `--c-link-dark` | `#2997ff` | **Links on dark backgrounds** |
| `--c-blue-ios` | `#007aff` / `#027aff` | iOS-style blue |
| `--c-blue-deep` | `#006edb`, `#0070dd`, `#0076df` | hover/active variants |
| `--c-blue-tint` | `#d8edff`, `#c9e5ff`, `#add8ff` | light blue fills |
| `rgba(0,125,250,.6)` | | focus ring [INFERRED] |

### 3.4 Status and highlight colors [DATA]

| Family | Values |
|---|---|
| Green | `#008009`, `#2d9b00`, `#03a10e`, `#09b54e`, `#00d959`, `#e6ffee` (tint) |
| Orange | `#f56300` (+ `.1` and `.2` alpha versions), `#e07000`, `#d04901`, `#ff9500` |
| Red | `#e30000`, `#d0112b`, `#cf0f3c`, `#ff3333`, `#fff2f4` (tint) |
| Magenta/Purple | `#d80084`, `#df0082`, `#903fcf`, `#9e52d8`, `#ac39ff` |
| Yellow | `#ffe045`, `#fefcce` |
| Pink | `#ff0053`, `#ec348c` |
| Violet | `#6319c1`, `#472fd3`, `#efe6fe` |

Use these only for badges, promotional ribbons, and decorative gradients, never for general UI.

### 3.5 Semantic mapping (recommended)

```css
:root {
  /* surfaces */
  --bg:            #ffffff;
  --bg-alt:        #f5f5f7;
  --bg-inverse:    #000000;
  --bg-inverse-2:  #161617;
  --bg-card-dark:  #1d1d1f;

  /* text */
  --text:          #1d1d1f;
  --text-2:        #6e6e73;
  --text-3:        #86868b;
  --text-inverse:  #f5f5f7;
  --text-inverse-2:#a1a1a6;   /* [INFERRED] muted text on dark */

  /* lines */
  --border:        #d2d2d7;
  --border-soft:   #e8e8ed;
  --border-dark:   rgba(255,255,255,.16);

  /* brand/interactive */
  --accent:        #0071e3;
  --accent-hover:  #0077ed;
  --accent-active: #006edb;
  --link:          #0066cc;
  --link-on-dark:  #2997ff;
  --focus:         #0071e3;

  /* status */
  --success:       #008009;
  --warning:       #f56300;
  --danger:        #e30000;
}
```

### 3.6 Gradients [DATA]
33 uses, 24 unique. Most are one of three kinds:

1. **Edge fade masks** for scrollers and tab bars: `linear-gradient(to right, #fff0, #fff)` and `linear-gradient(to right, #f5f5f700, #f5f5f7)`.
2. **Rainbow promo text/accents:**
   - `linear-gradient(108deg, #0090f7 0, #ba62fc 34%, #f2416b 68%, #f55600 100%)`
   - `linear-gradient(108deg, #0079d0 0, #9e52d8 32%, #da365c 84%, #d04901 100%)`
   - `linear-gradient(to right, #f8ab5e 0, #f36961 20%, #a176c8 40%, #759beb 60%, #65beb3 80%, #70db96 100%)`
   - `linear-gradient(to right, #f06844 0, #ee4c54 25%, #d45e95 50%, #9c6ca6 75%, #6583c1 100%)`
3. **Two-stop accents:** `linear-gradient(to right, #d80084, #ff8f66)`, `linear-gradient(to right, #056bbd, #09b54e)`, `linear-gradient(to right, #6319c1, #c600c2 50%, #df0082)`.

### 3.7 Color formats in source [DATA]
`#rrggbb` 754, `#rgb` 277, `#rrggbbaa` 172, `#rgba` 91, `rgba()` 80, `transparent` 41, `rgb()` 41, `currentColor` 11, `hsla()` 10.

### 3.8 Which colors go on which property [DATA, from the usage chart]
- `color` (text): mostly black, `#1d1d1f`, white, grays (`#6e6e73`, `#86868b`), blue links, and a few accent colors.
- `background-color`: white, `#f5f5f7`, black, dark grays, with some blue and light tints.
- `--sk-button-background`: blue `#0071e3` (main), dark grays, and white for inverse buttons.
- `--sk-badge-background`: warm tints (orange/peach/brown family).
- `border-bottom`: light grays.

---

## 4. Typography

### 4.1 Font families [DATA]
Apple uses two optical sizes of SF Pro, switched by size:
- **SF Pro Display**: headlines (large sizes)
- **SF Pro Text**: body and small text
- **SF Pro Icons**: icon glyph font

Base stacks (English):
```css
/* Display */ "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
/* Text    */ "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
```
Localized variants add `SF Pro JP/KR/SC/TC/HK/TH/AR`, PingFang, Hiragino, Meiryo, Apple Gothic, Malgun Gothic. Skip these unless you ship those languages.

No `@font-face` appears in this stylesheet (the fonts load from another file).

**Your replacement (free):**
```css
--font-display: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-text:    -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
```
Inter from Google Fonts (weights 400, 500, 600, 700) is the closest free match. On Apple devices, `-apple-system` renders real SF Pro automatically.

### 4.2 Font-size scale [DATA, with usage counts]

| px | Uses | Role [INFERRED] |
|---|---|---|
| 10 | 5 | micro labels |
| 11 | 1 | legal micro |
| 12 | 54 | captions, footnotes, legal |
| 14 | 79 | nav links, small body, labels |
| 16 | 1 | |
| 17 | **82** | **body copy** |
| 18 | 2 | |
| 19 | 29 | lead paragraph |
| 21 | 68 | sub-headline, card title |
| 22 | 3 | |
| 24 | 65 | section sub-head |
| 28 | 48 | card headline |
| 30 / 34 / 37 / 38 | 1 each | one-offs |
| 32 | 43 | section headline |
| 40 | 24 | large headline |
| 44 | 1 | |
| 48 | 18 | hero sub-headline |
| 51 | 1 | |
| 56 | 1 | hero |
| 64 | 5 | hero |
| 80 | 3 | extra-large hero |
| 89 / 96 | 2 each | display / marketing |

Relative units also appear: `1em` (6), `.9em` (4), `.8em`, `.75em`, `.65em`, `.6em`, `.55em`, `.45em`, `106.25%`, `1rem`.

**Recommended consolidated scale:**
```css
--fs-12: 12px;  --fs-14: 14px;  --fs-17: 17px;  --fs-19: 19px;
--fs-21: 21px;  --fs-24: 24px;  --fs-28: 28px;  --fs-32: 32px;
--fs-40: 40px;  --fs-48: 48px;  --fs-56: 56px;  --fs-64: 64px;  --fs-80: 80px;
```

### 4.3 Line heights [DATA]
82 unique values. The most-used:

| Ratio | Uses | Typical size [INFERRED] |
|---|---|---|
| `1.25` | 133 | mid headlines |
| `1.21875` | 111 | 32px headlines (39/32) |
| `1.375` | 108 | small body |
| `1.3571828571` | 113 | |
| `1.3529611765` | 130 | 17px body (23/17) |
| `1.4285914286` | 69 | 14px (20/14) |
| `1.4166666667` | 79 | 12px (17/12) |
| `1.3334` family | ~190 | 12/16 and similar |
| `1.1666666667` | 47 | large headlines |
| `1.125` | 38 | 40-48px headlines |
| `1.0625` / `1.075` / `1.0714` | | very large display |
| `1` | 20 | icons, single-line UI |

**Recommended roles:**

| Role | Size | Line height | Weight | Letter-spacing |
|---|---|---|---|---|
| Display / hero | 56-80px | 1.05-1.07 | 600 | -0.015em |
| H1 | 48-56px | 1.08 | 600 | -0.01em |
| H2 | 40px | 1.1 | 600 | -0.01em |
| H3 | 28-32px | 1.125-1.22 | 600 | -0.005em |
| Sub-head | 21-24px | 1.17-1.25 | 600 | 0 |
| Lead | 19-21px | 1.35 | 400 | 0.01em |
| Body | 17px | 1.47 | 400 | -0.022em |
| Small | 14px | 1.43 | 400 | -0.016em |
| Caption | 12px | 1.33 | 400 | -0.01em |

(Weights and letter-spacing: **[INFERRED]**. The report shows `font-weight` 643 times and `letter-spacing` 1,602 times, so both are used heavily, but the actual values weren't in the pasted sections.)

### 4.4 Fluid headline helper
```css
.display { font-size: clamp(40px, 7vw, 80px); line-height: 1.05; font-weight: 600; letter-spacing: -.015em; }
h1       { font-size: clamp(36px, 5.5vw, 56px); line-height: 1.08; font-weight: 600; letter-spacing: -.01em; }
h2       { font-size: clamp(28px, 4vw, 40px);   line-height: 1.1;  font-weight: 600; }
h3       { font-size: clamp(21px, 2.6vw, 28px); line-height: 1.17; font-weight: 600; }
```

---

## 5. Spacing and layout

The tokens page reports properties but not a spacing scale. Properties most used: `margin-top` 464, `padding-top` 406, `padding-bottom` 381, `margin-inline-start` 396, `padding` 352, `height` 353, `width` 664.

Logical properties (`margin-inline-*`, `padding-inline-*`) are used for RTL support.

### 5.1 Spacing scale [INFERRED, base 4px]
```css
--sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
--sp-5: 20px;  --sp-6: 24px;  --sp-8: 32px;  --sp-10: 40px;
--sp-12: 48px; --sp-16: 64px; --sp-20: 80px; --sp-24: 96px; --sp-30: 120px;
```

### 5.2 Container [INFERRED]
```css
.container { width: min(100% - 48px, 1260px); margin-inline: auto; }
.container--narrow { width: min(100% - 48px, 980px); margin-inline: auto; }
@media (max-width: 734px) { .container, .container--narrow { width: calc(100% - 32px); } }
```

### 5.3 Section rhythm [INFERRED]
- Section vertical padding: 80-120px desktop, 48-64px mobile
- Gap between cards: 12-20px
- Card inner padding: 24-40px
- Headline-to-subline gap: 8-12px; subline-to-button: 24-32px

### 5.4 Grid
Grid is used sparingly (16 `display: grid`, 27 uses of `fr`). Most layouts are **flex** and **block** with percentage widths (`%`: 1,146 uses).

```css
.grid { display: grid; gap: 20px; }
.grid--2 { grid-template-columns: repeat(2, 1fr); }
.grid--3 { grid-template-columns: repeat(3, 1fr); }
.grid--4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 833px) { .grid--2, .grid--3, .grid--4 { grid-template-columns: 1fr; } }
```

### 5.5 Units summary [DATA]
`px` 4,661 | `%` 1,146 | `em` 821 | `rem` 296 | `s` 251 | `ms` 59 | `deg` 58 | `vw` 46 | `fr` 27 | `vh` 8 | `dvh` 2 | `turn` 2

---

## 6. Shape, borders and elevation

### 6.1 Border radius [DATA]

| Value | Uses | Where [INFERRED] |
|---|---|---|
| `18px` | **24** | **cards, tiles, media containers** |
| `999px` | 12 | pill buttons |
| `99px` | 2 | pills |
| `50%` | 9 | circular arrows/dots |
| `0` | 9 | full-bleed bands |
| `5px`, `6px` | 1 each | inputs, small chips |
| `1.3em` | 1 | |
| `0 0 18px 18px` / `18px 18px 0 0` | 2 / 1 | split cards (image top, text bottom) |
| `var(--sk-button-border-radius)` | 4 | button token |
| `var(--sk-badge-border-radius)` | 4 | badge token |
| `var(--ribbon-border-radius)` | 1 | ribbon |
| `var(--sk-paddlenav-diameter)` | 1 | circular arrow nav |

```css
--radius-sm: 6px;  --radius-md: 12px;  --radius-card: 18px;  --radius-lg: 28px;  --radius-pill: 999px;
```

### 6.2 Box shadows [DATA] (20 total, 10 unique)

| Value | Uses |
|---|---|
| `2px 4px 16px rgba(0,0,0,.16)` | 1 |
| `2px 4px 12px rgba(0,0,0,.08)` | 2 |
| `2px 4px 16px #0003` | 3 |
| `2px 4px 16px #00000029` | 4 |
| `2px 8px 24px 2px #00000014` | 1 |
| `2px 4px 12px #00000014` | 4 |
| `8px 8px 16px 0 #00000014` | 2 |
| `inset 0 0 3px #1d1d1f` | 1 |
| `inset 0 0 3px #f5f5f7` | 1 |
| `inset 0 0 0 2px var(--tabnav-focus-color)` | 1 (focus ring) |

```css
--shadow-1: 2px 4px 12px rgba(0,0,0,.08);
--shadow-2: 2px 4px 16px rgba(0,0,0,.16);
--shadow-3: 2px 8px 24px 2px rgba(0,0,0,.08);
--shadow-focus: inset 0 0 0 2px var(--focus);
```
No text-shadows are used anywhere.

### 6.3 Borders [DATA/INFERRED]
Hairline dividers (`1px solid #d2d2d7` or `#e8e8ed`) via `border-bottom`, and `border-top` on footer rows.

---

## 7. Motion and animation

### 7.1 Durations [DATA]

| Duration | Uses | Role [INFERRED] |
|---|---|---|
| `0.1s`-`0.16s` | 19 / 10 / 9 | micro hover |
| `0.2s` | 4 | |
| `0.24s` | **40** | standard UI transition |
| `0.25s` | 26 | |
| `0.3s` | 24 | |
| `0.32s` | **33** | standard (flyouts, nav) |
| `0.4s`, `0.5s` | 10 / 22 | reveals |
| `0.8s`, `1s` | 6 / 13 | slow reveals |
| `1.8s`, `2s` | 60 / 60 | looping decorative animations |
| `80ms`, `60ms`, `40ms`, `20ms` | | stagger offsets |

Stagger formula used for nav flyouts:
```css
transition-delay: min(0.16s + calc(var(--item-total) - var(--item-number)) * 20ms, 0.24s);
```

### 7.2 Easing [DATA]

| Function | Uses |
|---|---|
| `ease-in-out` | **209** |
| `cubic-bezier(.4, 0, .6, 1)` | **88** |
| `linear` | 47 |
| `ease-out` | 23 |
| `ease` | 19 |
| `ease-in` | 14 |
| `cubic-bezier(.25, .1, .3, 1)` | 13 |
| `cubic-bezier(0, 0, .5, 1)` / `(0, 0, .2, 1)` | 4 each |
| `cubic-bezier(.165, .84, .44, 1)` | 2 (decelerate/expo-out) |
| `cubic-bezier(.15, 0, .2, 1)` | 2 |
| `steps(1)`, `step-start`, `step-end` | sprite/state changes |

```css
--ease:        cubic-bezier(.4, 0, .6, 1);
--ease-out:    cubic-bezier(.165, .84, .44, 1);
--ease-soft:   cubic-bezier(.25, .1, .3, 1);
--t-fast: .16s;  --t-base: .24s;  --t-slow: .32s;  --t-reveal: .5s;
```

### 7.3 Named keyframes [DATA]
- **Global nav:** `globalnav-fade-in`, `globalnav-scrim-height-change`, `globalnav-flyout-slide-forward-next/previous`, `globalnav-flyout-slide-back-next/previous`, `globalnav-chevron-slide-in-hover`, `globalnav-chevron-hover-off`, `globalnav-search-fade`, `-fade-and-slide`, `-fade-and-slide-to-close`, `-slide-top-to-bottom`, `-slide-bottom-to-top`, `-input-intro`, `-input-outro`
- **Dot navigation:** `dotnav-shift-start-1/2/3`, `dotnav-shift-end-1/2/3`, `dotnav-become-visible`, `-become-invisible`, `-timed-animation`, `-timed-dot-expand`, `-timed-dot-shrink`
- **Ribbon:** `ribbon-drop`, `ribbon-animate-background`, `-text-color`, `-link-color`
- **Loaders:** `loading-fade`, `waitindicator-animation`, `progress-indicator-animating`, `segment-out`
- **Promo illustrations** (Mac for students): `peaceAnimation`, `burstAndCapAnimation`, `gradCapAnimation`, `eyesAnimation`, `pointingFingerAnimation`, `yellowBurstAnimation`, `pinkBurstAnimation`, `yellowMegaphoneAnimation`, `movementAnimation`, `scaleAnimation`, `dd-mac-for-students-fade-in`, `animate-opacity`

### 7.4 Reusable patterns
```css
.fade-in { opacity: 0; transform: translateY(12px);
           transition: opacity .5s var(--ease-out), transform .5s var(--ease-out); }
.fade-in.is-visible { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```
Reveal on scroll with `IntersectionObserver` (a few lines of JS), or GSAP / Framer Motion for richer effects.

---

## 8. Responsive behavior

### 8.1 Breakpoints [DATA]

| Query | Notes |
|---|---|
| `max-width: 480px` / `393px` / `375px` | small phones |
| `max-width: 640px` | |
| `max-width: 734px` | **phone** |
| `max-width: 833px` / `min-width: 834px` | **tablet split**, most-used pair (92 / 17 uses) |
| `max-width: 1023px` / `min-width: 1024px` | tablet/desktop |
| `max-width: 1044px`, `1068px` | **main desktop** |
| `min-width: 1440px` / `1441px` | **large desktop** (18 uses at 1441) |
| `(max-width: 1023px) and (max-device-width: 736px)` | 902 uses: real phones, mostly localization fixes |

### 8.2 Recommended tokens
```css
/* mobile-first translation of Apple's desktop-first breakpoints */
--bp-sm: 480px;
--bp-md: 734px;
--bp-lg: 1068px;
--bp-xl: 1441px;
```

### 8.3 Behavior by size [INFERRED]
- **≤ 734px:** single column, nav collapses to a hamburger, headlines 28-40px, horizontal card scrollers
- **735-1067px:** 2-column grids, headlines 40-48px
- **≥ 1068px:** 3-4 column grids, full nav with flyouts, headlines 48-80px
- **≥ 1441px:** content stays centered at max-width; backgrounds go full-bleed

### 8.4 Other media features in use [DATA]
`prefers-reduced-motion` (22), `prefers-contrast: more` (1), `hover: hover` (2), `pointer: fine` (1), `inverted-colors` (16), `orientation` (13), `print` (1).

---

## 9. Accessibility

- **Focus:** `:focus-visible` (42 uses), `:focus` (43), `:focus-within` (16). A `data-focus-method` attribute (26 uses) tracks keyboard vs mouse focus so the ring shows only for keyboard users.
- **Reduced motion:** 22 queries. Animations are disabled or simplified.
- **Contrast:** `prefers-contrast: more` is handled.
- **Hover only on hover devices:** `@media (hover: hover) and (pointer: fine)`.
- **ARIA state selectors:** `[aria-hidden="true"]`, `[role="button"]`, plus `data-core-*-expanded` for accordions.
- **Inverted colors:** supported.

```css
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
@media (prefers-contrast: more) { :root { --text-2: #424245; --border: #86868b; } }
@media (hover: hover) and (pointer: fine) { .btn:hover { background: var(--accent-hover); } }
```

Minimum tap target 44x44px [INFERRED]. Keep body text contrast above 4.5:1 (`#1d1d1f` on white is about 16:1; `#6e6e73` on white is about 5:1).

---

## 10. Components

### 10.1 Global navigation [DATA: classes/animations; INFERRED: sizes]
- Height about 44px desktop, about 48px mobile
- Sticky, translucent, blurred background
- Links 12px (desktop) in `rgba(0,0,0,.8)`, hover to black
- Flyout panels with staggered fade/slide, a full-width scrim behind
- Search expands with its own intro/outro animation
- `@supports (backdrop-filter: initial)` is checked, so provide a solid fallback

```css
.nav { position: sticky; top: 0; z-index: 9998; height: 44px;
       background: rgba(255,255,255,.8);
       backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); }
@supports not (backdrop-filter: blur(1px)) { .nav { background: rgba(255,255,255,.95); } }
.nav__inner { max-width: 1024px; height: 100%; margin: 0 auto; padding: 0 22px;
              display: flex; align-items: center; justify-content: space-between; }
.nav__link { font-size: 12px; line-height: 1; color: rgba(0,0,0,.8); padding: 0 8px; transition: color .24s var(--ease); }
.nav__link:hover { color: #000; }
```

### 10.2 Buttons
Tokens in the source: `--sk-button-background`, `-hover`, `-active`, `--sk-button-color`, `--sk-button-border-radius`, `--sk-button-display`.

```css
.btn { display: inline-block; font: 400 17px/1.17 var(--font-text); letter-spacing: -.022em;
       padding: 12px 22px; border-radius: 999px; border: 0; cursor: pointer;
       background: var(--accent); color: #fff;
       transition: background-color .24s var(--ease), transform .16s var(--ease); }
.btn:hover  { background: var(--accent-hover); }
.btn:active { background: var(--accent-active); transform: scale(.98); }
.btn--secondary { background: transparent; color: var(--link); box-shadow: inset 0 0 0 1px var(--link); }
.btn--secondary:hover { background: var(--link); color: #fff; }
.btn--dark { background: #1d1d1f; } .btn--dark:hover { background: #333336; }
.btn--sm { font-size: 14px; padding: 8px 16px; }
.btn[disabled] { opacity: .32; pointer-events: none; }   /* 31 :disabled selectors in source */
```

### 10.3 Text link with chevron
```css
.link { color: var(--link); font-size: 17px; }
.link::after { content: " \203A"; }          /* › */
.link:hover { text-decoration: underline; }
.on-dark .link { color: var(--link-on-dark); }
```

### 10.4 Hero tile
```html
<section class="hero">
  <h1>Product name</h1>
  <p class="hero__sub">One-line benefit statement.</p>
  <div class="hero__cta"><a class="btn" href="#">Buy</a> <a class="link" href="#">Learn more</a></div>
  <img src="your-product.png" alt="">
</section>
```
```css
.hero { text-align: center; padding: 80px 0 0; background: var(--bg); overflow: hidden; }
.hero--dark { background: #000; color: #f5f5f7; }
.hero h1 { font-size: clamp(40px, 7vw, 80px); line-height: 1.05; font-weight: 600; letter-spacing: -.015em; }
.hero__sub { font-size: clamp(19px, 2.4vw, 28px); line-height: 1.17; margin-top: 8px; color: var(--text); }
.hero__cta { margin-top: 24px; display: flex; gap: 24px; justify-content: center; align-items: center; }
.hero img { width: min(100%, 1000px); margin: 48px auto 0; }
```

### 10.5 Product card
```css
.card { background: var(--bg-alt); border-radius: 18px; padding: 40px 32px; text-align: center;
        display: flex; flex-direction: column; align-items: center; }
.card--dark { background: #161617; color: #f5f5f7; }
.card__eyebrow { font-size: 12px; font-weight: 600; color: #bf4800; }   /* [INFERRED] orange eyebrow for "New" */
.card__title { font-size: 28px; line-height: 1.14; font-weight: 600; margin-top: 4px; }
.card__text  { font-size: 17px; line-height: 1.47; color: var(--text-2); margin-top: 8px; }
.card__price { font-size: 14px; margin-top: 12px; }
.card img { width: 100%; margin-top: 24px; }
```

### 10.6 Horizontal scroller / gallery
Source attributes: `data-core-scroller`, `-platter`, `-transition`, `-customsnap`, `data-core-gallery`, `-item`, `-fade`. Edge fades via gradients; scrollbar hidden with `@supports (scrollbar-width: none)` and `::-webkit-scrollbar`.

```css
.scroller { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory;
            scrollbar-width: none; padding-inline: 24px; }
.scroller::-webkit-scrollbar { display: none; }
.scroller > * { flex: 0 0 min(80%, 340px); scroll-snap-align: start; }
.scroller-wrap { position: relative; }
.scroller-wrap::after { content: ""; position: absolute; inset: 0 0 0 auto; width: 48px;
        background: linear-gradient(to right, #f5f5f700, #f5f5f7); pointer-events: none; }
.arrow { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,.08); color: rgba(0,0,0,.56);
         display: grid; place-items: center; transition: background .24s var(--ease); }
.arrow:hover { background: rgba(0,0,0,.16); }
```

### 10.7 Dot navigation
```css
.dots { display: flex; gap: 10px; justify-content: center; padding: 12px; border-radius: 99px; background: rgba(0,0,0,.08); }
.dots i { width: 8px; height: 8px; border-radius: 50%; background: rgba(0,0,0,.4); transition: all .24s var(--ease); }
.dots i.is-active { background: rgba(0,0,0,.8); width: 24px; border-radius: 99px; }
```

### 10.8 Tabs (tabnav)
Source: `as-tabnav` custom element with `--tabnav-mask-color-left/right` (registered with `@property`), sliding indicator, `--tabnav-focus-color`.

```css
.tabs { display: flex; gap: 8px; justify-content: center; }
.tab { padding: 8px 16px; border-radius: 999px; font-size: 14px; color: var(--text-2); transition: all .24s var(--ease); }
.tab[aria-selected="true"] { background: #1d1d1f; color: #fff; }
.tab:hover:not([aria-selected="true"]) { background: rgba(0,0,0,.04); }
```

### 10.9 Accordion
Source: `as-accordion`, `data-core-accordion-item-expanded`, `data-core-height-transition-*`.

```css
.acc-item { border-bottom: 1px solid var(--border); }
.acc-btn { width: 100%; text-align: left; padding: 20px 0; font-size: 21px; font-weight: 600;
           display: flex; justify-content: space-between; }
.acc-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .32s var(--ease); }
.acc-panel > div { overflow: hidden; }
.acc-item.is-open .acc-panel { grid-template-rows: 1fr; }
```

### 10.10 Badge and ribbon
Tokens: `--sk-badge-background`, `--sk-badge-text-color`, `--sk-badge-border-radius`, `--sk-badge-display`; ribbon: `--ribbon-background-color`, `--ribbon-border-radius`.
```css
.badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 6px;
         background: #fae9e1; color: #b64400; }
.ribbon { background: #f5f5f7; padding: 12px 22px; font-size: 14px; border-radius: 0 0 18px 18px; }
```

### 10.11 Overlay / modal
Source: `data-core-overlay`, `-open`, `-fullscreen`, `-cover`, `-content`, `-open-ios-fixed`.
```css
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 9999;
           opacity: 0; pointer-events: none; transition: opacity .32s var(--ease); }
.overlay.is-open { opacity: 1; pointer-events: auto; }
.modal { position: absolute; inset: 5vh 5vw; background: #fff; border-radius: 18px; overflow: auto; }
```

### 10.12 Form inputs
Source styles `::placeholder`, `:checked`, `:disabled`, number spinners, `:-moz-focus-inner`.
```css
input, select, textarea { font: 400 17px/1.3 var(--font-text); padding: 12px 14px; border: 1px solid #d2d2d7;
                          border-radius: 12px; background: #fff; color: var(--text); width: 100%; }
input::placeholder { color: #86868b; }
input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(0,125,250,.6); outline: 0; }
```

### 10.13 Footer [INFERRED]
```css
.footer { background: #f5f5f7; color: #6e6e73; font-size: 12px; line-height: 1.33; padding: 20px 0 40px; }
.footer a { color: #424245; } .footer a:hover { text-decoration: underline; }
.footer__legal { border-top: 1px solid #d2d2d7; margin-top: 20px; padding-top: 16px; }
.footer__cols { display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px; }
@media (max-width: 833px) { .footer__cols { grid-template-columns: 1fr 1fr; } }
```

---

## 11. Page anatomy of the Store [INFERRED from components]

1. **Global nav** (sticky, translucent)
2. **Local ribbon / promo strip** (optional, animated)
3. **Page heading** ("Store" with a large semi-bold title, gray subtitle)
4. **Product category row** (icon + label scroller)
5. **Feature tiles:** 1-2 big hero cards (dark and light alternating, 18px radius)
6. **Card scroller** ("The latest": horizontal snap cards with arrows)
7. **Help / services module** (tabs or accordion)
8. **Accessory / promo blocks** (gradient headline text)
9. **Footer** (gray, small text, legal links)

Alternate **light (`#f5f5f7`) and dark (`#000`/`#161617`)** blocks to give vertical rhythm.

---

## 12. Z-index and stacking [DATA]
115 uses, 42 unique. Patterns: `1` (38), `2` (18), `10` (6), `3` (5), `-1` (7), `0` (4), then big values `1000`, `9998`, `9999` (2), `99999`. A calc-based stack (`calc(var(--size) * 10 + N)` for N=1..30) orders many items in the animated promo.

```css
--z-base: 1;  --z-raised: 2;  --z-dropdown: 10;  --z-sticky: 1000;
--z-nav: 9998;  --z-overlay: 9999;  --z-top: 99999;
```

---

## 13. Icons and imagery
- 43 **inline SVGs** are embedded as data URIs (15.5 kB total), so icons are small vector assets.
- "SF Pro Icons" is a font used for glyph icons (chevrons, arrows).
- **Your options:** Lucide, Heroicons, Phosphor, or Feather (free, MIT).
- **Imagery:** large product shots on a clean or dark background with soft light. Use your own photos, `webp` or `avif`, and `loading="lazy"`.

---

## 14. Do and don't

**Do**
- Use `#f5f5f7` cards on white, and alternate with black sections
- Keep one accent (blue) for actions
- Use 18px radius for cards, a pill for buttons
- Use big semi-bold headlines with tight line-height
- Honor reduced motion and keyboard focus
- Keep copy short, with one action per tile

**Don't**
- Don't use heavy shadows, borders on cards, or many accent colors
- Don't use bold (700+) for body text
- Don't animate everything, because motion should be subtle
- Don't copy Apple's logo, images, icons, copy, or SF Pro files

---

## 15. Full CSS starter

```css
/* ---------- tokens ---------- */
:root {
  --bg:#fff; --bg-alt:#f5f5f7; --bg-inverse:#000; --bg-inverse-2:#161617;
  --text:#1d1d1f; --text-2:#6e6e73; --text-3:#86868b; --text-inverse:#f5f5f7;
  --border:#d2d2d7; --border-soft:#e8e8ed;
  --accent:#0071e3; --accent-hover:#0077ed; --accent-active:#006edb;
  --link:#0066cc; --link-on-dark:#2997ff; --focus:#0071e3;
  --success:#008009; --warning:#f56300; --danger:#e30000;

  --font: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;

  --radius-sm:6px; --radius-md:12px; --radius-card:18px; --radius-pill:999px;

  --shadow-1:2px 4px 12px rgba(0,0,0,.08);
  --shadow-2:2px 4px 16px rgba(0,0,0,.16);

  --ease:cubic-bezier(.4,0,.6,1);
  --ease-out:cubic-bezier(.165,.84,.44,1);
  --t-fast:.16s; --t-base:.24s; --t-slow:.32s;

  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px;
  --sp-8:32px; --sp-10:40px; --sp-12:48px; --sp-16:64px; --sp-20:80px; --sp-30:120px;
}

/* ---------- base ---------- */
*,*::before,*::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body { margin:0; font:400 17px/1.47 var(--font); letter-spacing:-.022em; color:var(--text);
       background:var(--bg); -webkit-font-smoothing:antialiased; }
img { max-width:100%; display:block; }
a { color:var(--link); text-decoration:none; }
a:hover { text-decoration:underline; }
h1,h2,h3 { margin:0; font-weight:600; }
.display { font-size:clamp(40px,7vw,80px); line-height:1.05; letter-spacing:-.015em; }
h1 { font-size:clamp(36px,5.5vw,56px); line-height:1.08; letter-spacing:-.01em; }
h2 { font-size:clamp(28px,4vw,40px); line-height:1.1; }
h3 { font-size:clamp(21px,2.6vw,28px); line-height:1.17; }
.small { font-size:14px; line-height:1.43; }
.caption { font-size:12px; line-height:1.33; color:var(--text-2); }

/* ---------- layout ---------- */
.container { width:min(100% - 48px, 1260px); margin-inline:auto; }
.section { padding-block: clamp(48px, 8vw, 120px); }
.section--alt  { background:var(--bg-alt); }
.section--dark { background:var(--bg-inverse); color:var(--text-inverse); }
.section--dark a { color:var(--link-on-dark); }
.grid { display:grid; gap:20px; }
.grid--2 { grid-template-columns:repeat(2,1fr); }
.grid--3 { grid-template-columns:repeat(3,1fr); }
@media (max-width:833px){ .grid--2,.grid--3{ grid-template-columns:1fr; } }

/* ---------- components (see section 10 for the rest) ---------- */
.btn { display:inline-block; padding:12px 22px; border-radius:var(--radius-pill); background:var(--accent);
       color:#fff; border:0; cursor:pointer; transition:background-color var(--t-base) var(--ease); }
.btn:hover { background:var(--accent-hover); text-decoration:none; }
.card { background:var(--bg-alt); border-radius:var(--radius-card); padding:40px 32px; text-align:center; }
.card--dark { background:var(--bg-inverse-2); color:var(--text-inverse); }

/* ---------- a11y ---------- */
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{ animation:none!important; transition:none!important; scroll-behavior:auto!important; }
}
```

---

## 16. Build checklist

- [ ] Add tokens (`:root`) and base typography
- [ ] Load Inter (or use the system stack)
- [ ] Build sticky translucent nav with a mobile menu
- [ ] Build hero with big headline, subline, button + link
- [ ] Build light and dark tile cards (18px radius)
- [ ] Build snap scroller with arrow buttons and edge fade
- [ ] Add product grid with price and "Buy" pill
- [ ] Add tabs/accordion for FAQs or help
- [ ] Add footer
- [ ] Add scroll-reveal animation (respect reduced motion)
- [ ] Test at 375, 734, 834, 1068, 1441 px
- [ ] Check keyboard focus, contrast, tap size
- [ ] Replace every asset (logo, photos, copy) with your own

---

## 17. Known gaps (not in the extracted data)

- Actual **font weights** and **letter-spacing** values (inferred above)
- A true **spacing scale** and section padding values
- The pixel layout of the Store page sections (take a full-page screenshot and measure it)
- Content-width values per breakpoint
- Dark-mode color tokens (the Store page itself appears light with dark tiles)
- JavaScript behavior (carousel, flyout logic): this file covers CSS only

To close the gaps, open DevTools on the live page, inspect the nav, hero, and a card, and read the Computed tab for `font-weight`, `letter-spacing`, `padding` and `max-width`. Send those or a screenshot and I can update this file with exact values.

---
---

# PART 2: FINAL BUILD SPEC (stack, architecture, code, launch)

This part turns the design reference into a buildable plan. Everything here is for building **your own** store with your own brand and assets.

## Additional table of contents
18. Recommended stack and why
19. Project setup and folder structure
20. Tailwind configuration (design tokens)
21. Global styles and fonts
22. Core components (code)
23. Pages and routes
24. Data model (products, cart, orders)
25. State management (cart)
26. Checkout and payments
27. Product data source (CMS options)
28. UX details that make it feel premium
29. Performance budget
30. SEO and metadata
31. Accessibility checklist (final)
32. Security and privacy
33. Legal and compliance pages
34. Analytics and monitoring
35. Testing plan
36. Deployment
37. Environment variables
38. Roadmap (phases)
39. Asset replacement list
40. Final launch checklist

---

## 18. Recommended stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server rendering, automatic code splitting, image optimization, great SEO |
| Styling | **Tailwind CSS** | Design tokens live in one config; consistent spacing/colors |
| Animation | **Framer Motion** | Scroll reveals, hover/tap effects, page transitions; supports reduced motion |
| Cart state | **Zustand** (persisted to localStorage) | Tiny, simple, fast |
| Payments | **Stripe Checkout** | Hosted, secure, handles cards, wallets, tax options |
| Products | **Shopify Storefront API** *or* **Sanity/Contentful** *or* a **JSON file** for a first version | Pick by how much inventory management you need |
| Images | **next/image** (AVIF/WebP) | Lazy loading, responsive sizes |
| Icons | **lucide-react** | Free, consistent, tree-shakable |
| Forms | **react-hook-form + zod** | Validation with small bundle |
| Hosting | **Vercel** (or Netlify / Cloudflare) | Zero-config for Next.js |
| Analytics | **Vercel Analytics / Plausible / GA4** | Pick one |
| Testing | **Playwright** (e2e), **Vitest** (unit) | Covers cart and checkout flows |

**If you want zero backend work:** use Shopify (hosted checkout, inventory, taxes, orders) and build only the frontend with the Storefront API.
**If you want full control:** Next.js + Stripe + a CMS + a small database (Postgres via Supabase or Neon) for orders.

---

## 19. Project setup and folder structure

```bash
npx create-next-app@latest my-store --typescript --tailwind --app --eslint
cd my-store
npm i framer-motion zustand lucide-react zod react-hook-form stripe @stripe/stripe-js
npm i -D vitest @playwright/test prettier
```

```
my-store/
├─ app/
│  ├─ layout.tsx              # root layout, fonts, nav, footer
│  ├─ page.tsx                # store home
│  ├─ globals.css             # tokens + base styles
│  ├─ (shop)/
│  │  ├─ [category]/page.tsx  # category listing
│  │  └─ product/[slug]/page.tsx
│  ├─ cart/page.tsx
│  ├─ checkout/success/page.tsx
│  ├─ checkout/cancel/page.tsx
│  ├─ search/page.tsx
│  ├─ support/page.tsx
│  ├─ (legal)/privacy/page.tsx
│  ├─ (legal)/terms/page.tsx
│  ├─ (legal)/returns/page.tsx
│  ├─ api/checkout/route.ts   # creates Stripe session
│  ├─ api/webhooks/stripe/route.ts
│  ├─ not-found.tsx
│  ├─ error.tsx
│  ├─ loading.tsx
│  ├─ sitemap.ts
│  └─ robots.ts
├─ components/
│  ├─ layout/ (Nav.tsx, MobileMenu.tsx, Footer.tsx, Ribbon.tsx)
│  ├─ ui/ (Button.tsx, Badge.tsx, Input.tsx, Skeleton.tsx, Tabs.tsx, Accordion.tsx, Modal.tsx)
│  ├─ home/ (Hero.tsx, FeatureTile.tsx, CardScroller.tsx, CategoryRow.tsx)
│  ├─ product/ (ProductCard.tsx, Gallery.tsx, OptionPicker.tsx, PriceBlock.tsx)
│  └─ cart/ (CartDrawer.tsx, CartLine.tsx)
├─ lib/ (products.ts, stripe.ts, format.ts, seo.ts)
├─ store/ cart.ts
├─ types/ index.ts
├─ public/ (your images, favicon, og-image)
├─ tests/ (e2e + unit)
├─ .env.local
└─ tailwind.config.ts
```

---

## 20. Tailwind configuration (design tokens)

For Tailwind v3 (`tailwind.config.ts`). If you use Tailwind v4, put the same values in an `@theme { ... }` block inside `globals.css` instead.

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#ffffff", alt: "#f5f5f7", inverse: "#000000", inverse2: "#161617" },
        ink: { DEFAULT: "#1d1d1f", 2: "#6e6e73", 3: "#86868b", inverse: "#f5f5f7" },
        line: { DEFAULT: "#d2d2d7", soft: "#e8e8ed" },
        accent: { DEFAULT: "#0071e3", hover: "#0077ed", active: "#006edb" },
        link: { DEFAULT: "#0066cc", dark: "#2997ff" },
        success: "#008009", warning: "#f56300", danger: "#e30000",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      fontSize: {
        "12": ["12px", { lineHeight: "1.33" }],
        "14": ["14px", { lineHeight: "1.43" }],
        "17": ["17px", { lineHeight: "1.47" }],
        "19": ["19px", { lineHeight: "1.35" }],
        "21": ["21px", { lineHeight: "1.19" }],
        "24": ["24px", { lineHeight: "1.17" }],
        "28": ["28px", { lineHeight: "1.14" }],
        "32": ["32px", { lineHeight: "1.125" }],
        "40": ["40px", { lineHeight: "1.1" }],
        "48": ["48px", { lineHeight: "1.08" }],
        "56": ["56px", { lineHeight: "1.07" }],
        "64": ["64px", { lineHeight: "1.06" }],
        "80": ["80px", { lineHeight: "1.05" }],
      },
      borderRadius: { card: "18px", pill: "999px" },
      boxShadow: {
        s1: "2px 4px 12px rgba(0,0,0,.08)",
        s2: "2px 4px 16px rgba(0,0,0,.16)",
        s3: "2px 8px 24px 2px rgba(0,0,0,.08)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(.4,0,.6,1)",
        out: "cubic-bezier(.165,.84,.44,1)",
      },
      transitionDuration: { fast: "160ms", base: "240ms", slow: "320ms" },
      screens: { sm: "480px", md: "734px", tab: "834px", lg: "1068px", xl: "1441px" },
      maxWidth: { page: "1260px", narrow: "980px" },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 21. Global styles and fonts

`app/layout.tsx`
```tsx
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", weight: ["400","500","600","700"] });

export const metadata = {
  title: { default: "Your Store", template: "%s | Your Store" },
  description: "Short, clear store description.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-ink font-sans antialiased tracking-[-0.022em]">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[99999] focus:bg-white focus:p-3 focus:rounded-lg">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

`app/globals.css`
```css
@tailwind base; @tailwind components; @tailwind utilities;

@layer base {
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  :focus-visible { outline: 2px solid #0071e3; outline-offset: 2px; border-radius: 4px; }
  ::selection { background: #c9e5ff; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

---

## 22. Core components (code)

### 22.1 Button
```tsx
// components/ui/Button.tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = { variant?: "primary" | "secondary" | "dark"; size?: "sm" | "md"; href?: string } &
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ variant = "primary", size = "md", href, className, ...rest }: Props) {
  const base = "inline-flex items-center justify-center rounded-pill font-normal transition duration-base ease-apple active:scale-[.98] disabled:opacity-30 disabled:pointer-events-none";
  const sizes = { sm: "text-14 px-4 py-2", md: "text-17 px-[22px] py-3" };
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover active:bg-accent-active",
    secondary: "text-link ring-1 ring-link hover:bg-link hover:text-white",
    dark: "bg-ink text-white hover:bg-[#333336]",
  };
  const cls = cn(base, sizes[size], variants[variant], className);
  return href ? <Link href={href} className={cls}>{rest.children}</Link> : <button className={cls} {...rest} />;
}
```
`lib/cn.ts`: `export const cn = (...a: (string|false|undefined)[]) => a.filter(Boolean).join(" ");`

### 22.2 Sticky translucent nav
```tsx
// components/layout/Nav.tsx
"use client";
import Link from "next/link";
import { ShoppingBag, Search, Menu } from "lucide-react";
import { useCart } from "@/store/cart";

const links = [
  { href: "/phones", label: "Phones" }, { href: "/laptops", label: "Laptops" },
  { href: "/audio", label: "Audio" }, { href: "/accessories", label: "Accessories" },
  { href: "/support", label: "Support" },
];

export default function Nav() {
  const count = useCart((s) => s.count());
  return (
    <header className="sticky top-0 z-[9998] h-11 bg-white/80 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-white/95">
      <nav aria-label="Main" className="mx-auto flex h-full max-w-[1024px] items-center justify-between px-[22px]">
        <Link href="/" className="text-17 font-semibold">YourBrand</Link>
        <ul className="hidden md:flex gap-1">
          {links.map((l) => (
            <li key={l.href}><Link href={l.href} className="px-2 text-12 text-black/80 transition-colors duration-base hover:text-black">{l.label}</Link></li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <Link href="/search" aria-label="Search"><Search size={16} /></Link>
          <Link href="/cart" aria-label={`Bag, ${count} items`} className="relative">
            <ShoppingBag size={16} />
            {count > 0 && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">{count}</span>}
          </Link>
          <button className="md:hidden" aria-label="Menu"><Menu size={18} /></button>
        </div>
      </nav>
    </header>
  );
}
```

### 22.3 Scroll-reveal wrapper (Framer Motion)
```tsx
// components/ui/Reveal.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

export default function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

### 22.4 Hero
```tsx
// components/home/Hero.tsx
import Image from "next/image";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";

export default function Hero({ title, sub, img, dark = false, href }: { title: string; sub: string; img: string; dark?: boolean; href: string }) {
  return (
    <section className={`overflow-hidden text-center pt-20 ${dark ? "bg-black text-ink-inverse" : "bg-bg-alt"}`}>
      <Reveal>
        <h1 className="text-[clamp(40px,7vw,80px)] leading-[1.05] font-semibold tracking-[-0.015em]">{title}</h1>
        <p className="mt-2 text-[clamp(19px,2.4vw,28px)] leading-[1.17]">{sub}</p>
        <div className="mt-6 flex items-center justify-center gap-6">
          <Button href={href}>Buy</Button>
          <a href={href} className={`text-17 hover:underline ${dark ? "text-link-dark" : "text-link"}`}>Learn more &rsaquo;</a>
        </div>
      </Reveal>
      <Image src={img} alt="" width={1400} height={900} priority className="mx-auto mt-12 w-[min(100%,1000px)] h-auto" />
    </section>
  );
}
```

### 22.5 Product card
```tsx
// components/product/ProductCard.tsx
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types";

export default function ProductCard({ p, dark }: { p: Product; dark?: boolean }) {
  return (
    <Link href={`/product/${p.slug}`} className={`group flex flex-col items-center rounded-card px-8 py-10 text-center transition-transform duration-slow ease-out hover:scale-[1.015] ${dark ? "bg-bg-inverse2 text-ink-inverse" : "bg-bg-alt"}`}>
      {p.badge && <span className="text-12 font-semibold text-[#bf4800]">{p.badge}</span>}
      <h3 className="mt-1 text-28 font-semibold">{p.name}</h3>
      <p className={`mt-2 text-17 ${dark ? "text-white/70" : "text-ink-2"}`}>{p.tagline}</p>
      <p className="mt-3 text-14">From {formatPrice(p.price)}</p>
      <Image src={p.images[0]} alt={p.name} width={600} height={600} className="mt-6 h-auto w-full" sizes="(max-width:834px) 80vw, 33vw" />
    </Link>
  );
}
```

### 22.6 Snap scroller with arrows
```tsx
// components/home/CardScroller.tsx
"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CardScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} tabIndex={0} role="region" aria-label="Product carousel"
           className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <div className="mt-4 flex justify-end gap-2 px-6">
        <button onClick={() => scroll(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full bg-black/10 transition-colors hover:bg-black/20"><ChevronLeft size={18} /></button>
        <button onClick={() => scroll(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full bg-black/10 transition-colors hover:bg-black/20"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
```
Wrap each child in `<div className="snap-start shrink-0 basis-[min(80%,340px)]">`.

### 22.7 Skeleton loader
```tsx
export const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-card bg-black/5 ${className}`} />;
```

### 22.8 Footer
Gray `bg-bg-alt`, 12px text, 5-column grid on desktop (2 columns on mobile), legal row with a top border `border-line`. Include links to Privacy, Terms, Returns, Contact, Shipping, and your company name and address.

---

## 23. Pages and routes

| Route | Purpose | Key UX |
|---|---|---|
| `/` | Store home | Hero tiles, category row, "The latest" scroller, services, footer |
| `/[category]` | Category listing | Filters (price, availability), sort, grid, pagination or "Load more" |
| `/product/[slug]` | Product detail | Gallery, option pickers (color/storage), sticky price + Add to Bag, specs, related items |
| `/cart` | Bag | Line items, quantity steppers, subtotal, shipping note, "Check out" |
| `/search` | Search | Instant results, empty state, suggestions |
| `/checkout/success` | Order confirmed | Order summary, next steps |
| `/checkout/cancel` | Cancelled | Return to bag |
| `/support` | Help | Accordion FAQ, contact form |
| `/privacy`, `/terms`, `/returns` | Legal | Plain-language text |
| `404`, `error` | Fallbacks | Friendly message and links back |

---

## 24. Data model

```ts
// types/index.ts
export type Money = number; // store in the smallest currency unit (paise/cents)

export interface Option { id: string; label: string; priceDelta?: Money; swatch?: string }
export interface Variant { id: string; sku: string; options: Record<string, string>; price: Money; stock: number; image?: string }

export interface Product {
  id: string; slug: string; name: string; tagline: string; description: string;
  category: string; price: Money; currency: "INR" | "USD" | "EUR" | "GBP";
  badge?: "New" | "Sale" | "Limited";
  images: string[];
  options?: { name: string; values: Option[] }[];
  variants?: Variant[];
  specs?: { label: string; value: string }[];
  featured?: boolean; inStock: boolean;
}

export interface CartLine { productId: string; variantId?: string; qty: number }
export interface Order { id: string; email: string; lines: CartLine[]; total: Money; status: "pending"|"paid"|"shipped"|"delivered"|"refunded"; createdAt: string }
```

Store prices as integers (never floats). Format with `Intl.NumberFormat`:
```ts
export const formatPrice = (n: number, c = "INR") =>
  new Intl.NumberFormat(c === "INR" ? "en-IN" : "en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100);
```

---

## 25. State management (cart)

```ts
// store/cart.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/types";

interface CartState {
  lines: CartLine[];
  add: (l: CartLine) => void;
  setQty: (productId: string, variantId: string | undefined, qty: number) => void;
  remove: (productId: string, variantId?: string) => void;
  clear: () => void;
  count: () => number;
}

export const useCart = create<CartState>()(persist((set, get) => ({
  lines: [],
  add: (l) => set((s) => {
    const i = s.lines.findIndex((x) => x.productId === l.productId && x.variantId === l.variantId);
    if (i > -1) { const copy = [...s.lines]; copy[i] = { ...copy[i], qty: copy[i].qty + l.qty }; return { lines: copy }; }
    return { lines: [...s.lines, l] };
  }),
  setQty: (pid, vid, qty) => set((s) => ({ lines: s.lines.map((x) => x.productId === pid && x.variantId === vid ? { ...x, qty: Math.max(1, qty) } : x) })),
  remove: (pid, vid) => set((s) => ({ lines: s.lines.filter((x) => !(x.productId === pid && x.variantId === vid)) })),
  clear: () => set({ lines: [] }),
  count: () => get().lines.reduce((n, l) => n + l.qty, 0),
}), { name: "cart-v1" }));
```
**Important:** the cart only stores IDs and quantities. **Always re-price on the server** at checkout; never trust prices sent from the browser.

---

## 26. Checkout and payments

### Flow
1. Browser sends `[{productId, variantId, qty}]` to `/api/checkout`.
2. Server looks up real prices and stock, creates a Stripe Checkout Session, returns the URL.
3. Browser redirects to Stripe's hosted page.
4. Stripe sends a **webhook** on payment success; the server marks the order paid, reduces stock, and sends the confirmation email.
5. Customer lands on `/checkout/success`.

```ts
// app/api/checkout/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { lines } = await req.json();
  const products = await getProductsByIds(lines.map((l: any) => l.productId));

  const line_items = lines.map((l: any) => {
    const p = products.find((x) => x.id === l.productId);
    if (!p || !p.inStock) throw new Error("Unavailable item");
    return {
      quantity: Math.min(Math.max(1, l.qty), 10),
      price_data: { currency: p.currency.toLowerCase(), unit_amount: p.price, product_data: { name: p.name, images: [new URL(p.images[0], process.env.NEXT_PUBLIC_SITE_URL).toString()] } },
    };
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    shipping_address_collection: { allowed_countries: ["IN", "US", "GB"] },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`,
  });
  return NextResponse.json({ url: session.url });
}
```

**Webhook:** verify the signature with `STRIPE_WEBHOOK_SECRET` using the raw body (`await req.text()` + `stripe.webhooks.constructEvent`). Handle `checkout.session.completed`.

**For India:** check that your Stripe account supports your business type; alternatives are **Razorpay**, **Cashfree**, or **PayU** (UPI, cards, netbanking, wallets). The architecture is the same: server-side price check, hosted payment page, webhook confirmation. Payment provider availability and fees change, so verify current terms before choosing.

---

## 27. Product data source (pick one)

| Option | Best for | Effort |
|---|---|---|
| **Local `products.ts` / JSON** | Prototype, under about 30 products | Lowest |
| **Shopify Storefront API** | Real inventory, taxes, orders, no backend | Medium; fastest path to a real store |
| **Sanity / Contentful / Strapi** | Rich content and editorial pages | Medium |
| **Postgres (Supabase/Neon) + admin panel** | Full control | Highest |

Start with local JSON and keep all reads behind one file (`lib/products.ts`) so you can swap the source later without touching components.

---

## 28. UX details that make it feel premium

**Navigation and discovery**
- Sticky nav that never covers anchors (`scroll-padding-top: 44px`)
- Breadcrumbs on category and product pages
- Search with instant results and an empty state ("No results. Try fewer words.")
- Clear "Bag" count badge that updates with a small animation

**Product page**
- Image gallery with swipe on mobile and zoom on desktop
- Option pickers (color swatches, storage pills) with clear selected state
- Price updates instantly when a variant changes
- Sticky mobile "Add to Bag" bar
- Stock message ("In stock", "Only 3 left"), delivery estimate, return policy snippet
- "Added to bag" confirmation (small drawer or toast, not a page jump)

**Cart and checkout**
- Mini cart drawer, quantity steppers, undo on remove
- Free-shipping progress hint
- Guest checkout by default; never force sign-up
- Show total cost (tax and shipping) before payment

**Feedback states (all required)**
- Loading: skeletons, never blank screens
- Empty: empty bag, no results, no orders
- Error: friendly message and a retry
- Success: clear confirmation
- Offline/slow: handle failed fetches gracefully

**Micro-interactions**
- Button press scale `.98`, card hover scale `1.015`
- Reveal on scroll, once only (do not re-animate)
- Respect reduced motion everywhere

**Content**
- Short headlines, one benefit line, one primary action per tile
- Consistent price format; "From" prices for variants
- Real alt text on product images

---

## 29. Performance budget

| Metric | Target |
|---|---|
| LCP (largest contentful paint) | ≤ 2.5 s on mobile 4G |
| CLS (layout shift) | ≤ 0.1 |
| INP (interaction delay) | ≤ 200 ms |
| JS shipped on home | ≤ 170 KB gzipped (aim lower) |
| Hero image | ≤ 200 KB (AVIF/WebP), `priority` |
| Other images | lazy, correct `sizes`, ≤ 100 KB each |
| Fonts | one family, `display: swap`, 3-4 weights max |

Tips: use server components by default and add `"use client"` only where needed (nav, cart, scroller); give images explicit width/height; avoid heavy animation libraries on every page; run Lighthouse and the Vercel Speed Insights regularly.

---

## 30. SEO and metadata

- Unique `<title>` and meta description per page (`generateMetadata`)
- Open Graph and Twitter images
- Canonical URLs
- `app/sitemap.ts` and `app/robots.ts`
- **Product structured data (JSON-LD):**
```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@context": "https://schema.org", "@type": "Product", name: p.name, image: p.images, description: p.description,
  sku: p.id, offers: { "@type": "Offer", priceCurrency: p.currency, price: (p.price / 100).toFixed(2),
  availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
}) }} />
```
- Clean, readable URLs (`/product/wireless-earbuds`), semantic HTML (`h1` once per page)

---

## 31. Accessibility checklist (final)

- [ ] Skip-to-content link
- [ ] Logical heading order; one `h1` per page
- [ ] All images have meaningful `alt` (decorative = `alt=""`)
- [ ] Every interactive element reachable and operable by keyboard
- [ ] Visible `:focus-visible` ring
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI
- [ ] Tap targets ≥ 44x44 px
- [ ] Carousels: arrow buttons labeled, keyboard scrollable, no auto-advance without a pause control
- [ ] Modals/drawers trap focus and close on Escape
- [ ] Form fields have visible labels and clear error messages (`aria-live`)
- [ ] `prefers-reduced-motion` honored
- [ ] Test with VoiceOver/NVDA and axe DevTools

---

## 32. Security and privacy

- HTTPS only; HSTS enabled by your host
- **Never** put secret keys in client code (`NEXT_PUBLIC_` is public)
- Recalculate prices on the server; validate every input with `zod`
- Verify Stripe webhook signatures
- Rate-limit API routes (login, checkout, contact form)
- Security headers in `next.config.js`: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- Do not store card data; let the payment provider handle it
- Keep dependencies updated (`npm audit`, Dependabot)
- Cookie consent if you use analytics or ads trackers (see legal)

---

## 33. Legal and compliance pages

You need these before taking real payments (have a qualified person review them for your country):
- Privacy Policy
- Terms of Service / Terms of Sale
- Return and Refund Policy
- Shipping Policy
- Contact details and business registration info
- Cookie notice if applicable
- Tax/GST details if applicable

Rules and requirements vary by country (India's consumer and e-commerce rules, GDPR for EU visitors, etc.), so verify them for where you sell.

---

## 34. Analytics and monitoring

- Pageviews and conversion funnel: view product → add to bag → begin checkout → purchase
- Error tracking: **Sentry**
- Uptime check: **UptimeRobot** or **Better Stack**
- Web vitals: Vercel Speed Insights
- Log failed payments and webhook errors

---

## 35. Testing plan

| Type | Tool | What to cover |
|---|---|---|
| Unit | Vitest | price formatting, cart reducer logic |
| E2E | Playwright | add to bag, change quantity, checkout redirect, 404 |
| Visual | Playwright screenshots | home, product, cart at 375/834/1441 px |
| Accessibility | axe + Lighthouse | every key page |
| Cross-browser | Chrome, Safari, Firefox, Android Chrome, iOS Safari | layout and blur effects |
| Payments | Stripe test cards | success, decline, cancel, webhook |

---

## 36. Deployment

1. Push to GitHub.
2. Import the repo on **Vercel** (or Netlify / Cloudflare Pages).
3. Add environment variables.
4. Add your custom domain and enable HTTPS.
5. Set the Stripe webhook endpoint to `https://yourdomain.com/api/webhooks/stripe`.
6. Use preview deployments for each pull request; promote to production when checks pass.
7. Switch Stripe from test mode to live mode only at launch.

---

## 37. Environment variables

```bash
# .env.local
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=...
DATABASE_URL=postgres://...
RESEND_API_KEY=...            # order confirmation emails
SENTRY_DSN=...
```
Add `.env.local` to `.gitignore`. Never commit secrets.

---

## 38. Roadmap (phases)

**Phase 1: Foundation (about 2-3 days)**
Project setup, tokens, fonts, nav, footer, home page with hero and product cards using local JSON.

**Phase 2: Shopping (about 3-5 days)**
Category pages, product detail page with options, cart drawer and page, Zustand persistence.

**Phase 3: Payments (about 2-4 days)**
Stripe/Razorpay checkout, webhook, success/cancel pages, order emails.

**Phase 4: Polish (about 2-3 days)**
Scroll animations, skeletons, empty/error states, search, SEO metadata, JSON-LD.

**Phase 5: Quality (about 2-3 days)**
Accessibility pass, performance tuning, cross-browser and device testing, legal pages.

**Phase 6: Launch**
Deploy, connect domain, live payments, monitor.

**Later:** accounts and order history, wishlist, reviews, discount codes, multi-currency, trade-in/financing-style modules, A/B tests.

(Time estimates are rough and depend on your experience and the number of products.)

---

## 39. Asset replacement list

Replace every one of these with your own before launch:
- [ ] Logo and favicon
- [ ] All product photos and hero images
- [ ] All icons (use Lucide or your own)
- [ ] Fonts (Inter, not SF Pro)
- [ ] All headlines, product names and descriptions
- [ ] Gradient colors and brand accent (change `#0071e3` to your own brand color if you want a distinct identity)
- [ ] Open Graph image
- [ ] Legal text and company details

Keeping the *structure and feel* is fine. Keeping Apple's *assets, names, or anything implying you are Apple* is not.

---

## 40. Final launch checklist

**Design**
- [ ] Tokens match this document
- [ ] Looks right at 375, 734, 834, 1068, 1441 px
- [ ] Dark and light sections alternate cleanly

**Functionality**
- [ ] Add, change quantity, remove, persist cart across reload
- [ ] Checkout completes with a test card; webhook marks the order paid
- [ ] Out-of-stock and error states work
- [ ] Search works; 404 page works

**Quality**
- [ ] Lighthouse: Performance, Accessibility, SEO, Best Practices all 90+
- [ ] Keyboard-only walkthrough passes
- [ ] No console errors

**Business**
- [ ] Legal pages published
- [ ] Contact and support route works
- [ ] Order confirmation email tested
- [ ] Analytics and error tracking live
- [ ] Stripe/Razorpay in live mode, with a real small test purchase

---

## Appendix: quick commands

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # run production build
npx playwright test  # e2e tests
npx vitest           # unit tests
npx lighthouse https://yourdomain.com --view
```
