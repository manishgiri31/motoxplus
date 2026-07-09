import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email/templates/base";
import { checkIPRateLimit } from "@/lib/auth/rate-limit";
import { getClientIP } from "@/lib/auth/middleware";

const SUBJECT_LABELS: Record<string, string> = {
  dealer: "Dealer Enquiry",
  product: "Product Enquiry",
  partnership: "Manufacturing Partnership",
  other: "Other",
};

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (!checkIPRateLimit(ip, 5, 60)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json();
  const { name, email, phone, subject, message } = body;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email and message are required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

  const subjectLabel = SUBJECT_LABELS[subject] || "General Enquiry";
  const to = process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_COMPANY_EMAIL || process.env.EMAIL_FROM!;

  const html = `
    <div class="title">New Website Enquiry</div>
    <p class="text"><strong>Subject:</strong> ${escapeHtml(subjectLabel)}</p>
    <p class="text"><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p class="text"><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${phone ? `<p class="text"><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
    <hr class="divider" />
    <p class="text" style="white-space: pre-wrap;">${escapeHtml(message)}</p>
  `;

  try {
    await sendEmail({
      to,
      subject: `Website Enquiry — ${subjectLabel}`,
      html: baseTemplate(`Website Enquiry — ${subjectLabel}`, html),
    });
  } catch (err) {
    console.error("[Contact] Failed to send enquiry email:", err);
    return NextResponse.json({ error: "Failed to send message. Please try again later." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
