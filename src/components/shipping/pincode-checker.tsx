"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface PincodeCheckerProps {
  value: string;
  onChange: (pincode: string) => void;
  onResult?: (result: ServiceabilityResult | null) => void;
}

interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDeliveryDays: number | null;
  availableServices: string[];
  city: string | null;
  state: string | null;
  error?: string;
}

export function PincodeChecker({ value, onChange, onResult }: PincodeCheckerProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length !== 6 || !/^\d{6}$/.test(value)) {
      setResult(null);
      onResult?.(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/shipping/serviceability?pincode=${value}`);
        const data: ServiceabilityResult = await res.json();
        setResult(data);
        onResult?.(data);
      } catch {
        const err = { serviceable: false, estimatedDeliveryDays: null, availableServices: [], city: null, state: null, error: "Check failed" };
        setResult(err);
        onResult?.(err);
      } finally {
        setChecking(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block">
        Delivery Pincode <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <MapPin
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit pincode"
          className="w-full themed-input rounded-sm pl-9 pr-4 py-3 text-sm outline-none transition-colors"
        />
        {checking && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
          />
        )}
      </div>

      {result && !checking && (
        <div
          className={`flex items-start gap-2 rounded-sm px-3 py-2 text-xs ${
            result.serviceable
              ? "bg-green-900/10 border border-green-800/30"
              : "bg-red-900/10 border border-red-800/30"
          }`}
        >
          {result.serviceable ? (
            <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            {result.serviceable ? (
              <>
                <span className="text-green-400 font-semibold">Deliverable</span>
                {result.city && (
                  <span className="text-[var(--text-muted)] ml-1">
                    — {result.city}, {result.state}
                  </span>
                )}
                {result.estimatedDeliveryDays && (
                  <div className="text-[var(--text-muted)] mt-0.5">
                    Estimated delivery: <span className="font-medium text-[var(--text-secondary)]">{result.estimatedDeliveryDays} business days</span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-red-400">
                {result.error || "Delivery not available to this pincode"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
