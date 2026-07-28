"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle2, AlertTriangle, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

/**
 * Replaces `alert()` / inline error `<p>` tags (~30 sites) with a real toast
 * system. Imperative API (`toast(...)`) backed by a tiny module-level store —
 * no new dependency beyond the already-installed-but-unused @radix-ui/react-toast.
 */
export interface ToastOptions {
  title: string;
  description?: string;
  tone?: Tone;
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: string;
}

let listeners: Array<(items: ToastItem[]) => void> = [];
let items: ToastItem[] = [];

function emit() {
  listeners.forEach((l) => l(items));
}

export function toast(options: ToastOptions) {
  const id = Math.random().toString(36).slice(2);
  items = [...items, { id, duration: 5000, tone: "neutral", ...options }];
  emit();
  return id;
}

toast.success = (title: string, description?: string) => toast({ title, description, tone: "ok" });
toast.error = (title: string, description?: string) => toast({ title, description, tone: "danger" });
toast.warning = (title: string, description?: string) => toast({ title, description, tone: "warn" });
toast.info = (title: string, description?: string) => toast({ title, description, tone: "info" });

function dismiss(id: string) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToast() {
  const [state, setState] = React.useState<ToastItem[]>(items);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  }, []);
  return { toasts: state, dismiss };
}

const TONE_ICON: Record<Tone, LucideIcon> = {
  neutral: Info,
  info: Info,
  progress: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
};

/** Mount once, in src/components/providers.tsx. */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map(({ id, title, description, tone = "neutral", duration }) => {
        const Icon = TONE_ICON[tone];
        return (
          <ToastPrimitive.Root
            key={id}
            duration={duration}
            onOpenChange={(open) => !open && dismiss(id)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 shadow-[var(--elev-4)]",
              "bg-[var(--bg-card)] border-[var(--border-color)]",
              "data-[state=open]:animate-slide-in-left data-[swipe=end]:animate-fade-in"
            )}
          >
            <span data-tone={tone} className="mt-0.5 flex-shrink-0 text-[var(--tone-fg)]">
              <Icon size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </ToastPrimitive.Title>
              {description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="flex-shrink-0 rounded-sm p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        className={cn(
          "fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4",
          "outline-none"
        )}
      />
    </ToastPrimitive.Provider>
  );
}
