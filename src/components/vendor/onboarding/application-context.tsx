"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/client";
import { getApplication, type VendorApplication } from "@/lib/vendor/onboarding";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; app: VendorApplication }
  | { kind: "error"; message: string; unavailable: boolean };

interface Ctx {
  status: Status;
  /** Replace the application with what the server returned after a save. */
  set: (app: VendorApplication) => void;
  reload: () => void;
}

const ApplicationCtx = React.createContext<Ctx | null>(null);

/**
 * One fetch of the vendor's application shared by the onboarding frame and every step page. When the server says
 * the account is ACTIVE but the session still carries the old status, the session is refreshed (the middleware
 * reads it) and the vendor is sent to the dashboard.
 */
export function ApplicationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = React.useState(0);
  const { data: session, update } = useSession();
  const router = useRouter();
  const refreshed = React.useRef(false);

  React.useEffect(() => {
    let live = true;
    getApplication().then(
      (app) => live && setStatus({ kind: "ready", app }),
      (e: unknown) => {
        if (!live) return;
        const unavailable = e instanceof ApiError ? [404, 501, 502, 503, 504].includes(e.status) : true;
        setStatus({
          kind: "error",
          unavailable,
          message: unavailable
            ? "Vendor registration isn't available right now. Your details are safe; please try again shortly."
            : e instanceof Error
              ? e.message
              : "Something went wrong.",
        });
      }
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const app = status.kind === "ready" ? status.app : null;
  React.useEffect(() => {
    if (!app || refreshed.current) return;
    const sessionStatus = session?.user?.vendorStatus;
    const serverApproved = app.state === "ACTIVE";
    const pendingMismatch = serverApproved && app.profileComplete === (session?.user?.vendorProfilePending === true);
    if (serverApproved !== (sessionStatus === "APPROVED") || pendingMismatch) {
      refreshed.current = true;
      update().then(() => {
        if (serverApproved && app.profileComplete) router.replace("/vendor/dashboard");
        else router.refresh();
      });
    }
  }, [app, session?.user?.vendorStatus, update, router]);

  const value = React.useMemo<Ctx>(
    () => ({
      status,
      set: (next) => setStatus({ kind: "ready", app: next }),
      reload: () => setAttempt((n) => n + 1),
    }),
    [status]
  );

  return <ApplicationCtx.Provider value={value}>{children}</ApplicationCtx.Provider>;
}

export function useApplication(): Ctx {
  const ctx = React.useContext(ApplicationCtx);
  if (!ctx) throw new Error("useApplication must be used inside ApplicationProvider");
  return ctx;
}

/** Field errors from an API failure, plus a summary for anything not tied to a field. */
export function errorsFrom(e: unknown): { fields: Record<string, string>; message: string } {
  if (e instanceof ApiError) {
    const fields = e.fieldErrors ?? {};
    if ([404, 501, 502, 503, 504].includes(e.status)) {
      return { fields: {}, message: "We couldn't save this right now. Nothing was lost; please try again shortly." };
    }
    return { fields, message: Object.keys(fields).length ? "Please fix the highlighted fields." : e.message };
  }
  return { fields: {}, message: "We couldn't reach the server. Check your connection and try again." };
}
