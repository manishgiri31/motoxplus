"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { MotionConfig } from "framer-motion";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        forcedTheme="light"
        storageKey="motoxplus-theme"
      >
        {/* reducedMotion="user" makes every framer-motion animation in the app
            (reveal.tsx, the public route-change fade, …) respect
            prefers-reduced-motion automatically — framer reads that at the JS
            level, so the CSS-only rule in globals.css doesn't reach it. */}
        <MotionConfig reducedMotion="user">
          <NextTopLoader
            color="#0071e3"
            initialPosition={0.08}
            crawlSpeed={120}
            height={2}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={160}
            shadow="0 0 8px #0071e3,0 0 4px #2997ff"
            zIndex={99999}
          />
          {children}
          <Toaster />
        </MotionConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
