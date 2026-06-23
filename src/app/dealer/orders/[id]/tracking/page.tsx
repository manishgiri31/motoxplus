"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { TrackingTimeline } from "@/components/shipping/tracking-timeline";

interface TrackingData {
  orderId: string;
  orderNumber: string;
  waybill: string;
  status: string;
  currentLocation: string;
  lastUpdate: string;
  estimatedDelivery: string | null;
  trackingUrl: string | null;
  events: Array<{
    status: string;
    location: string;
    activity: string;
    timestamp: string;
  }>;
  error?: string;
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/orders/${id}/tracking`);
      if (res.status === 404) {
        setError("Shipment has not been created yet. Please check back after your order is confirmed.");
        return;
      }
      if (!res.ok) {
        setError("Failed to load tracking information.");
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Unable to load tracking. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push(`/dealer/orders/${id}`)}
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back to Order
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Shipment Tracking
          </h1>
          {data?.orderNumber && (
            <p className="text-[var(--text-muted)] mt-1 text-sm">Order #{data.orderNumber}</p>
          )}
        </div>
        <button
          onClick={() => fetchTracking(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-pulse text-[var(--text-muted)] text-sm">Loading tracking...</div>
        </div>
      )}

      {error && !loading && (
        <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
          <p className="text-[var(--text-muted)] text-sm">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {data.lastUpdate && (
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Last updated: {new Date(data.lastUpdate).toLocaleString("en-IN")}
            </p>
          )}
          <TrackingTimeline
            waybill={data.waybill}
            status={data.status}
            currentLocation={data.currentLocation}
            estimatedDelivery={data.estimatedDelivery}
            trackingUrl={data.trackingUrl}
            events={data.events}
          />
        </>
      )}
    </div>
  );
}
