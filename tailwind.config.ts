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
        brand: {
          red: ch("--c-red-600"),
          "red-dark": ch("--c-red-700"),
          "red-light": ch("--c-red-400"),
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
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
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
      },
    },
  },
  plugins: [],
};
export default config;
