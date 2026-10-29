import type { Config } from "tailwindcss";

/**
 * Wraps a CSS custom property in the `rgb(var(--x) / <alpha-value>)` channel
 * form Tailwind needs to keep opacity modifiers (bg-red-900/20, text-red-500/80,
 * …) working. The vars themselves are bare "R G B" triplets defined in
 * src/app/globals.css — using hex directly in a var (`--c-red-600: #DC2626`)
 * would silently break every one of the ~726 opacity-modifier call sites in
 * this codebase, so don't "simplify" this back to hex.
 */
const ch = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const colorRamp = (family: string) => ({
  50: ch(`--c-${family}-50`),
  100: ch(`--c-${family}-100`),
  200: ch(`--c-${family}-200`),
  300: ch(`--c-${family}-300`),
  400: ch(`--c-${family}-400`),
  500: ch(`--c-${family}-500`),
  600: ch(`--c-${family}-600`),
  700: ch(`--c-${family}-700`),
  800: ch(`--c-${family}-800`),
  900: ch(`--c-${family}-900`),
  950: ch(`--c-${family}-950`),
});

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // src/lib/status.ts and friends compose class names from data — without this
    // glob, any Tailwind class string authored there works in dev and is purged
    // from the production build (the class never appears literally under the
    // three globs above), which is a silent, hard-to-diagnose failure mode.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", md: "2rem", lg: "4rem" },
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        // MotoXplus v2 — brand redesign foundation tokens (paper/ink/muted/line/red).
        // Plain hex custom properties, not RGB triplets — no <alpha-value> opacity
        // modifier support (bg-paper/50 etc. won't work), unlike the ramps below.
        paper: "var(--paper)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        // Replaces the old brand.red/red-dark/red-light keys (zero call sites in src/).
        brand: {
          DEFAULT: "var(--red)",
          hover: "var(--red-hover)",
          soft: "var(--red-soft)",
        },
        // Re-pointed at the carbon ramp so the ordering (900 = darkest) is
        // preserved; low usage today, kept for back-compat rather than deleted.
        dark: {
          900: ch("--carbon-1000"),
          800: ch("--carbon-950"),
          700: ch("--carbon-900"),
          600: ch("--carbon-800"),
          500: ch("--carbon-700"),
          400: ch("--carbon-600"),
          300: ch("--carbon-500"),
          200: ch("--carbon-400"),
          100: ch("--carbon-300"),
        },
        // Only families actually used in src/ get remapped (verified by grep);
        // teal/lime/pink/rose/sky/violet/fuchsia/stone/neutral/slate have zero
        // call sites and are left at Tailwind's stock palette.
        // Store design system (apple-store-design-system.md §20). Nested under
        // `store` because bare `ink`/`line`/`accent` already mean something else
        // to the ~900 existing call sites (dealer/vendor/admin). Hex values are
        // the spec's, verbatim.
        store: {
          bg: { DEFAULT: "#ffffff", alt: "#f5f5f7", inverse: "#000000", inverse2: "#161617" },
          ink: { DEFAULT: "#1d1d1f", 2: "#6e6e73", 3: "#86868b", inverse: "#f5f5f7" },
          line: { DEFAULT: "#d2d2d7", soft: "#e8e8ed" },
          "gray-700": "#424245",
          accent: { DEFAULT: "#0071e3", hover: "#0077ed", active: "#006edb" },
          link: { DEFAULT: "#0066cc", dark: "#2997ff" },
          success: "#008009",
          warning: "#f56300",
          danger: "#e30000",
        },
        red: colorRamp("red"),
        gray: colorRamp("gray"),
        zinc: colorRamp("zinc"),
        green: colorRamp("green"),
        emerald: colorRamp("emerald"),
        amber: colorRamp("amber"),
        yellow: colorRamp("yellow"),
        orange: colorRamp("orange"),
        blue: colorRamp("blue"),
        cyan: colorRamp("cyan"),
        purple: colorRamp("purple"),
        indigo: colorRamp("indigo"),
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        // v2 — Schibsted Grotesk (headings) / Inter (body) / IBM Plex Mono (codes).
        // `mono` is repointed from Geist Mono to IBM Plex Mono: font-mono already has
        // 100 call sites across 46 files (SKUs/order IDs/HSN codes in dealer, vendor,
        // admin, products), so this is an immediate, sitewide font change on every one
        // of them, not something scoped to new/redesigned pages.
        display: ["var(--font-display)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        // Store design system: Inter (self-hosted as --font-body), system stack behind it.
        store: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // hero-pattern deleted: it was a hardcoded dark gradient (#0a0a0a -> #1a0000),
        // hostile to the light-first industrial register and unrelated to any theme token.
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-in-left": "slideInLeft 0.5s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      /**
       * Tight = engineered. All values resolve through --r-0..--r-4 in
       * globals.css, so the whole scale can be rolled back with a single CSS
       * edit (bump the --r-* values) without touching any of the 913
       * `rounded-*` call sites across the app. Relative ordering
       * (sm ≤ md ≤ lg ≤ xl ≤ 2xl) is preserved, so nothing looks broken,
       * just tighter.
       */
      borderRadius: {
        none: "0px",
        DEFAULT: "var(--r-1)",
        sm: "var(--r-1)",
        md: "var(--r-2)",
        lg: "var(--r-2)",
        xl: "var(--r-3)",
        "2xl": "var(--r-4)",
        "3xl": "var(--r-4)",
        full: "9999px",
        // v2 radius scale — additive, distinct keys so existing rounded-sm/md/lg/xl
        // call sites (tied to --r-0..--r-4, the deliberately tight/"engineered" scale)
        // don't move.
        input: "var(--radius-input)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
        pill: "var(--radius-pill)",
        // Store design system: card 18px, pill 999px (spec §6.1). `card`/`pill`
        // above are taken by the v2 scale (14px), so these are `store-*`.
        "store-card": "18px",
        "store-pill": "999px",
      },
      borderWidth: {
        hairline: "1px",
        3: "3px",
      },
      letterSpacing: {
        tech: "0.14em",
        eyebrow: "0.18em",
        data: "-0.01em",
      },
      fontSize: {
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "600" }],
        micro: ["0.625rem", { lineHeight: "1.1", letterSpacing: "0.1em" }],
        // Store type scale (spec §20). Numeric keys don't collide with anything.
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
      boxShadow: {
        s1: "2px 4px 12px rgba(0,0,0,.08)",
        s2: "2px 4px 16px rgba(0,0,0,.16)",
        s3: "2px 8px 24px 2px rgba(0,0,0,.08)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(.4,0,.6,1)",
        "apple-out": "cubic-bezier(.165,.84,.44,1)",
      },
      transitionDuration: { fast: "160ms", base: "240ms", slow: "320ms" },
      // Spec breakpoints (§20): 480 / 734 / 834 / 1068 / 1441. Prefixed `bp-`
      // because overriding sm/md/lg/xl would re-flow every existing page
      // (md 768→734, lg 1024→1068). Use `bp-md:` etc. in store components.
      screens: {
        "bp-sm": "480px",
        "bp-md": "734px",
        "bp-tab": "834px",
        "bp-lg": "1068px",
        "bp-xl": "1441px",
      },
      maxWidth: { page: "1260px", narrow: "980px" },
    },
  },
  plugins: [],
};
export default config;
