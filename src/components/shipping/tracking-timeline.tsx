"use client";

import { Package, Truck, MapPin, CheckCircle, XCircle, Clock, RotateCcw, AlertCircle } from "lucide-react";

interface TrackingEvent {
  status: string;
  location: string;
  activity: string;
  timestamp: string;
}

interface TrackingTimelineProps {
  waybill: string;
  status: string;
  currentLocation: string;
  estimatedDelivery: string | null;
  trackingUrl: string | null;
  events: TrackingEvent[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING:           { label: "Order Placed",        icon: <Package size={16} />,      color: "text-[var(--text-muted)]" },
  MANIFESTED:        { label: "Shipment Created",    icon: <Package size={16} />,      color: "text-blue-400" },
  PICKED_UP:         { label: "Picked Up",           icon: <Truck size={16} />,        color: "text-blue-400" },
  IN_TRANSIT:        { label: "In Transit",          icon: <Truck size={16} />,        color: "text-yellow-400" },
  OUT_FOR_DELIVERY:  { label: "Out for Delivery",    icon: <MapPin size={16} />,       color: "text-orange-400" },
  DELIVERED:         { label: "Delivered",           icon: <CheckCircle size={16} />,  color: "text-green-400" },
  FAILED_DELIVERY:   { label: "Delivery Failed",     icon: <XCircle size={16} />,      color: "text-red-400" },
  RETURNED:          { label: "Returned",            icon: <RotateCcw size={16} />,    color: "text-red-400" },
  CANCELLED:         { label: "Cancelled",           icon: <XCircle size={16} />,      color: "text-red-400" },
};

const STEPS = ["MANIFESTED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TrackingTimeline({
  waybill,
  status,
  currentLocation,
  estimatedDelivery,
  trackingUrl,
  events,
}: TrackingTimelineProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const isTerminal = ["DELIVERED", "RETURNED", "CANCELLED"].includes(status);
  const currentStepIndex = STEPS.indexOf(status);

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="glass border border-[var(--border-color)] rounded-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`flex items-center gap-2 font-bold text-lg ${config.color}`}>
              {config.icon}
              {config.label}
            </div>
            {currentLocation && (
              <p className="text-[var(--text-muted)] text-sm mt-1 flex items-center gap-1">
                <MapPin size={12} />
                {currentLocation}
              </p>
            )}
            {estimatedDelivery && !isTerminal && (
              <p className="text-[var(--text-secondary)] text-sm mt-1 flex items-center gap-1">
                <Clock size={12} />
                Expected: {formatDateTime(estimatedDelivery)}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Waybill</div>
            <div className="text-[var(--text-primary)] font-mono font-bold text-sm">{waybill}</div>
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-500 hover:text-red-400 text-xs mt-1 block transition-colors"
              >
                Track on Delhivery →
              </a>
            )}
          </div>
        </div>

        {/* Progress steps */}
        {!["FAILED_DELIVERY", "RETURNED", "CANCELLED"].includes(status) && (
          <div className="mt-5 flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const done = currentStepIndex >= idx;
              const cfg = STATUS_CONFIG[step];
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex flex-col items-center gap-1 ${done ? cfg.color : "text-[var(--text-muted)]"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                      done ? "border-current bg-current/10" : "border-[var(--border-color)] bg-transparent"
                    }`}>
                      {cfg.icon}
                    </div>
                    <span className="text-[10px] text-center leading-tight max-w-[60px] hidden sm:block">{cfg.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 transition-colors ${
                      currentStepIndex > idx ? "bg-red-600" : "bg-[var(--border-color)]"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="glass border border-[var(--border-color)] rounded-sm p-5">
          <h3 className="text-[var(--text-primary)] font-bold mb-4 text-sm uppercase tracking-wider">
            Tracking History
          </h3>
          <div className="space-y-0">
            {events.map((event, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${idx === 0 ? "bg-red-600" : "bg-[var(--border-color)]"}`} />
                  {idx < events.length - 1 && <div className="w-px flex-1 bg-[var(--border-color)] my-1" />}
                </div>
                <div className="pb-4">
                  <div className="text-[var(--text-primary)] text-sm font-medium">{event.activity || event.status}</div>
                  {event.location && (
                    <div className="text-[var(--text-muted)] text-xs flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      {event.location}
                    </div>
                  )}
                  <div className="text-[var(--text-muted)] text-xs mt-0.5">
                    {formatDateTime(event.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="glass border border-[var(--border-color)] rounded-sm p-8 text-center">
          <AlertCircle size={24} className="text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-[var(--text-muted)] text-sm">
            Tracking events will appear once the shipment is picked up.
          </p>
        </div>
      )}
    </div>
  );
}
