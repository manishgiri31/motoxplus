import localFont from "next/font/local";

// Self-hosted (latin subset, SIL OFL) like every other font here, so `next build` never reaches
// fonts.gstatic.com. Imported only by the seller-acquisition route, so other pages don't preload it.
export const spaceGrotesk = localFont({
  src: "../../app/fonts/SpaceGroteskVF.woff2",
  weight: "300 700",
  variable: "--font-grotesk",
  display: "swap",
});
