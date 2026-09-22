import type { ReactNode } from "react";

/**
 * Shared structural shell for the Dealer/Admin/Vendor portals. Each portal's
 * layout.tsx still owns its own server-side session/role check and redirect —
 * this only removes the triplicated flex/sidebar-offset markup. Sidebar
 * components (with their own mobile-drawer state) are passed in, not owned
 * here, since nav items differ per portal.
 */
export function PortalShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {sidebar}
      <main className="flex-1 ml-0 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
