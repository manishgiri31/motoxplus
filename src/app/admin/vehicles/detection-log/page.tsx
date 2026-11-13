import Link from "next/link";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parsePageParam } from "@/lib/query-limits";
import { formatDate } from "@/lib/utils";
import { DetectionCorrection } from "@/components/admin/detection-correction";

const PAGE_SIZE = 25;

const INPUT_LABEL: Record<string, string> = {
  IMAGE: "Photo",
  OCR_TEXT: "Text (OCR)",
  VIN: "VIN",
  PLATE: "Number plate",
  MANUAL: "Manual",
};

function confidenceTone(score: number | null) {
  if (score === null) return "text-[var(--text-muted)]";
  if (score >= 0.8) return "text-green-500";
  if (score >= 0.5) return "text-yellow-500";
  return "text-red-500";
}

// Bike-ID inbox: every photo/VIN/plate/OCR identification attempt, newest
// first. Low-confidence rows are the ones to review; "Correct" re-points the
// attempt at the right vehicle via PATCH /api/admin/vehicles/detection-log/[id].
export default async function DetectionLogPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const page = parsePageParam(searchParams.page);

  const [logs, total, vehicles] = await Promise.all([
    prisma.vehicleDetectionLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        detectedVehicle: { select: { id: true, name: true } },
        detectedVariant: { select: { name: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vehicleDetectionLog.count(),
    prisma.vehicle.findMany({
      where: { isActive: true },
      select: { id: true, name: true, manufacturer: { select: { name: true } } },
      orderBy: [{ manufacturer: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const vehicleOptions = vehicles.map((v) => ({ id: v.id, label: `${v.manufacturer.name} ${v.name}` }));

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Link href="/admin/vehicles" className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={14} /> Vehicles
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Detection Log</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          {total} identification attempt{total !== 1 ? "s" : ""}. Review low-confidence matches and correct the vehicle where it&apos;s wrong.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="glass rounded-xl border border-[var(--border-color)] py-16 text-center">
          <ScanSearch size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="font-semibold text-[var(--text-primary)]">No detection attempts yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">They appear here when customers identify a bike by photo, VIN or number plate.</p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-xl border border-[var(--border-color)]">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Input</th>
                <th className="px-4 py-3">Matched vehicle</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {logs.map((log) => (
                <tr key={log.id} className="align-top text-sm">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--text-primary)]">{INPUT_LABEL[log.inputType] ?? log.inputType}</div>
                    {log.rawInput && <div className="mt-0.5 max-w-[220px] truncate font-mono text-xs text-[var(--text-muted)]" title={log.rawInput}>{log.rawInput}</div>}
                    {log.imageUrl && (
                      <a href={log.imageUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs text-[var(--accent-text)] hover:underline">
                        View photo
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {log.detectedVehicle?.name ?? <span className="text-[var(--text-muted)]">No match</span>}
                    {log.detectedVariant && <div className="text-xs text-[var(--text-muted)]">{log.detectedVariant.name}</div>}
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold ${confidenceTone(log.confidenceScore)}`}>
                    {log.confidenceScore === null ? "—" : `${Math.round(log.confidenceScore * 100)}%`}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{log.method ?? "—"}</td>
                  <td className="px-4 py-3">
                    <DetectionCorrection logId={log.id} currentVehicleId={log.detectedVehicleId} options={vehicleOptions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-[var(--text-muted)]">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/vehicles/detection-log?page=${page - 1}`} className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/vehicles/detection-log?page=${page + 1}`} className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]">
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
