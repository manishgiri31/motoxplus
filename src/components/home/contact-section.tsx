"use client";

import { useState } from "react";
import { MapPin, Phone, Mail } from "lucide-react";

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    // Simple client-side simulation; replace with actual API
    setTimeout(() => setStatus("success"), 1000);
  };

  return (
    <section className="py-24 px-4 md:px-8 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs font-semibold uppercase tracking-widest">
              Get In Touch
            </span>
            <div className="w-8 h-px bg-red-600" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] tracking-tight">
            Let&apos;s Talk Business.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact info */}
          <div className="space-y-4">
            {[
              {
                icon: MapPin,
                title: "Our Office",
                detail: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "India",
              },
              {
                icon: Phone,
                title: "Call Us",
                detail: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 98765 43210",
              },
              {
                icon: Mail,
                title: "Email Us",
                detail: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@motoxplus.in",
              },
            ].map((item) => (
              <div key={item.title} className="glass border border-[var(--border-color)] rounded-sm p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-red-900/20 border border-red-900/40 rounded-sm flex items-center justify-center flex-shrink-0">
                  <item.icon size={18} className="text-red-500" />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">{item.title}</div>
                  <div className="text-[var(--text-primary)] text-sm font-medium">{item.detail}</div>
                </div>
              </div>
            ))}

            {/* Business hours */}
            <div className="glass border border-[var(--border-color)] rounded-sm p-6">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-4">Business Hours</div>
              {[
                { day: "Mon – Sat", time: "9:00 AM – 6:00 PM" },
                { day: "Sunday", time: "Closed" },
              ].map((h) => (
                <div key={h.day} className="flex justify-between py-2 border-b border-[var(--border-color)] last:border-0">
                  <span className="text-[var(--text-muted)] text-sm">{h.day}</span>
                  <span className="text-[var(--text-primary)] text-sm font-medium">{h.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 glass border border-[var(--border-color)] rounded-sm p-8">
            {status === "success" ? (
              <div className="flex flex-col items-center justify-center h-full min-h-64 text-center">
                <div className="text-5xl mb-4">✓</div>
                <h3 className="text-[var(--text-primary)] font-bold text-xl mb-2">Message Sent!</h3>
                <p className="text-[var(--text-muted)]">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors"
                    >
                      <option value="">Select subject</option>
                      <option value="dealer">Dealer Enquiry</option>
                      <option value="product">Product Enquiry</option>
                      <option value="partnership">Manufacturing Partnership</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full themed-input border focus:border-red-600/60 rounded-sm px-4 py-3 text-sm outline-none transition-colors resize-none"
                    placeholder="Tell us about your requirements..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-colors uppercase tracking-wider text-sm"
                >
                  {status === "loading" ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
