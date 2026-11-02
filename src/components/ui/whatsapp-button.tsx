"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const PHONE = (process.env.NEXT_PUBLIC_COMPANY_WHATSAPP || "918816812379").replace(/\D/g, "");
const MESSAGE = encodeURIComponent("Hello! I'm interested in MOTOXPLUS products. Please share details.");

export function WhatsAppButton() {
  const [hovered, setHovered] = useState(false);
  // Product pages pin a buy bar to the bottom of phone screens; sit above it.
  const aboveBuyBar = /^\/products\/[^/]+/.test(usePathname() ?? "");

  return (
    <div className={`fixed right-4 z-50 flex flex-col items-end gap-3 bp-md:bottom-6 bp-md:right-6 ${
        aboveBuyBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
      }`}>
      {/* Tooltip */}
      <div
        className={`transition-all duration-200 ${
          hovered ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm px-4 py-2 shadow-xl whitespace-nowrap">
          <p className="text-[var(--text-primary)] text-xs font-semibold">Chat with us on WhatsApp</p>
          <p className="text-[var(--text-muted)] text-12">Typically replies within minutes</p>
        </div>
      </div>

      {/* Button */}
      <a
        href={`https://wa.me/${PHONE}?text=${MESSAGE}`}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Chat on WhatsApp"
        className="group relative w-12 h-12 bp-md:w-14 bp-md:h-14 rounded-full flex items-center justify-center shadow-xl transition-transform duration-200 hover:scale-110 active:scale-95"
        style={{ backgroundColor: "#25D366" }}
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 hidden rounded-full bg-[#25D366] animate-ping opacity-20 bp-md:block" />
        <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 bp-md:w-7 bp-md:h-7 relative z-10">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.116 1.528 5.843L.057 23.428a.5.5 0 00.611.628l5.703-1.494A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.52-5.17-1.426l-.367-.218-3.807.998 1.014-3.706-.24-.382A9.95 9.95 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      </a>
    </div>
  );
}
