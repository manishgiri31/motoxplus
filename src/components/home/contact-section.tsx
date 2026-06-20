"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle2 } from "lucide-react";

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
          <p className="text-[var(--text-muted)] mt-4 max-w-lg mx-auto">
            Have questions? We'd love to hear from you. Send us a message and we'll respond within 24 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <div key={item.title} className="glass border border-[var(--border-color)] rounded-2xl p-5 flex items-start gap-4 transition-colors hover:border-red-900/30">
                <div className="w-10 h-10 bg-red-900/20 border border-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon size={17} className="text-red-500" />
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1 font-semibold">{item.title}</div>
                  <div className="text-[var(--text-primary)] text-sm font-medium">{item.detail}</div>
                </div>
              </div>
            ))}

            {/* Business hours */}
            <div className="glass border border-[var(--border-color)] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-red-500" />
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">Business Hours</div>
              </div>
              {[
                { day: "Mon – Sat", time: "9:00 AM – 6:00 PM" },
                { day: "Sunday", time: "Closed" },
              ].map((h, i) => (
                <div key={h.day} className={`flex justify-between py-2.5 ${i === 0 ? "border-b border-[var(--border-color)]" : ""}`}>
                  <span className="text-[var(--text-muted)] text-sm">{h.day}</span>
                  <span className={`text-sm font-semibold ${h.time === "Closed" ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 glass border border-[var(--border-color)] rounded-2xl p-8">
            {status === "success" ? (
              <div className="flex flex-col items-center justify-center h-full min-h-64 text-center py-12">
                <div className="w-16 h-16 bg-green-900/20 border border-green-900/40 rounded-2xl flex items-center justify-center mb-5">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h3 className="text-[var(--text-primary)] font-bold text-xl mb-2">Message Sent!</h3>
                <p className="text-[var(--text-muted)]">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full themed-input border rounded-xl px-4 py-3 text-sm"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full themed-input border rounded-xl px-4 py-3 text-sm"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full themed-input border rounded-xl px-4 py-3 text-sm"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full themed-input border rounded-xl px-4 py-3 text-sm"
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
                  <label className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full themed-input border rounded-xl px-4 py-3 text-sm resize-none"
                    placeholder="Tell us about your requirements..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-wider text-sm red-glow-sm"
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
