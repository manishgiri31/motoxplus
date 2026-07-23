import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const faqs = await prisma.vehicleFAQ.findMany({
    where: { vehicleId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(faqs);
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.question?.trim() || !body.answer?.trim()) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  const faq = await prisma.vehicleFAQ.create({
    data: {
      vehicleId: params.id,
      question: body.question.trim(),
      answer: body.answer.trim(),
      sortOrder: body.sortOrder ? parseInt(body.sortOrder) : 0,
      isActive: body.isActive === "false" ? false : true,
    },
  });
  return NextResponse.json(faq, { status: 201 });
}
