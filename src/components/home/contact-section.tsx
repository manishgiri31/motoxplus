"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message");
      }

      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setStatus("error");
    }
  };

  return (
    <section className="py-16 md:py-20 px-4 md:px-8 bg-[var(--paper)]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact info */}
          <div className="space-y-4">
            {[
              { icon: MapPin, title: "Our Office", detail: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "India" },
              { icon: Phone, title: "Call Us", detail: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 88168 12379" },
              { icon: Mail, title: "Email Us", detail: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@motoxplus.com" },
            ].map((item) => (
              <Card key={item.title} pad="md" className="flex items-start gap-4">
                <div className="w-9 h-9 border border-[var(--line)] flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} className="text-[var(--red)]" />
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-widest mb-1 font-semibold">{item.title}</div>
                  <div className="text-[var(--ink)] text-sm font-medium">{item.detail}</div>
                </div>
              </Card>
            ))}

            {/* Business hours */}
            <Card pad="md">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-[var(--red)]" />
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-widest font-semibold">Business Hours</div>
              </div>
              {[
                { day: "Mon – Sat", time: "9:00 AM – 6:00 PM" },
                { day: "Sunday", time: "Closed" },
              ].map((h, i) => (
                <div key={h.day} className={`flex justify-between py-2.5 ${i === 0 ? "border-b border-[var(--line)]" : ""}`}>
                  <span className="text-[var(--muted)] text-sm">{h.day}</span>
                  <span className={`text-sm font-semibold ${h.time === "Closed" ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}>
                    {h.time}
                  </span>
                </div>
              ))}
            </Card>
          </div>

          {/* Form */}
          <Card pad="lg" className="lg:col-span-2">
            {status === "success" ? (
              <div className="flex flex-col items-center justify-center h-full min-h-64 text-center py-12">
                <div className="w-14 h-14 border border-[var(--sig-ok-bd)] bg-[var(--sig-ok-bg)] flex items-center justify-center mb-5">
                  <CheckCircle2 size={26} className="text-[var(--sig-ok-fg)]" />
                </div>
                <h3 className="text-[var(--ink)] font-bold text-xl mb-2">Message Sent!</h3>
                <p className="text-[var(--muted)]">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full themed-input border rounded-sm px-4 py-3 text-sm"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full themed-input border rounded-sm px-4 py-3 text-sm"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full themed-input border rounded-sm px-4 py-3 text-sm"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full themed-select border rounded-sm px-4 py-3 text-sm"
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
                  <label className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-semibold block mb-2">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full themed-input border rounded-sm px-4 py-3 text-sm resize-none"
                    placeholder="Tell us about your requirements..."
                  />
                </div>
                {status === "error" && error && (
                  <p className="text-[var(--sig-danger-fg)] text-sm text-center">{error}</p>
                )}
                <Button type="submit" variant="brand" block size="lg" loading={status === "loading"}>
                  {status === "loading" ? "Sending..." : "Send Message"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
