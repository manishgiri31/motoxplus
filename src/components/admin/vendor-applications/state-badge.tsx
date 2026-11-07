import type { ApplicationState } from "@/lib/vendor/onboarding";
import { STATE_LABELS } from "@/lib/vendor/review";

const TONE: Record<ApplicationState, string> = {
  UNDER_REVIEW: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  DOCUMENTS_PENDING: "border-[var(--border-color)] text-[var(--text-secondary)]",
  DRAFT: "border-[var(--border-color)] text-[var(--text-secondary)]",
  PENDING_VERIFICATION: "border-[var(--border-color)] text-[var(--text-muted)]",
  ACTIVE: "border-green-600/40 bg-green-600/10 text-green-700",
  SUSPENDED: "border-orange-500/40 bg-orange-500/10 text-orange-700",
  REJECTED: "border-red-600/40 bg-red-600/10 text-red-700",
  BLOCKED: "border-red-800/50 bg-red-800/10 text-red-800",
};

export function StateBadge({ state }: { state: ApplicationState }) {
  return <span className={`inline-block whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold ${TONE[state]}`}>{STATE_LABELS[state]}</span>;
}
