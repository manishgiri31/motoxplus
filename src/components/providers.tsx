"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="motoxplus-theme"
      >
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
      </ThemeProvider>
    </SessionProvider>
  );
}
