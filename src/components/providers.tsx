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
        storageKey="motoxplus-theme"
      >
        {/* reducedMotion="user" makes every framer-motion animation in the app
            (reveal.tsx, the public route-change fade, …) respect
            prefers-reduced-motion automatically — framer reads that at the JS
            level, so the CSS-only rule in globals.css doesn't reach it. */}
        <MotionConfig reducedMotion="user">
          <NextTopLoader
            color="#dc2626"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #dc2626,0 0 5px #ef4444"
            zIndex={99999}
          />
          {children}
          <Toaster />
        </MotionConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
