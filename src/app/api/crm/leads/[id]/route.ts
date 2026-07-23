import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { requireSectionAccess } from "@/lib/staff-access";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !requireSectionAccess(session.user.role, session.user.department, "crm")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !requireSectionAccess(session.user.role, session.user.department, "crm")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    status, priority, estimatedValue, nextFollowUp,
    lostReason, assignedToId, assignedToName,
    companyName, ownerName, email, phone, city, state, source,
  } = body;

  const data: any = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;
  if (estimatedValue !== undefined) data.estimatedValue = estimatedValue ? parseFloat(estimatedValue) : null;
  if (nextFollowUp !== undefined) data.nextFollowUp = nextFollowUp ? new Date(nextFollowUp) : null;
  if (lostReason !== undefined) data.lostReason = lostReason;
  if (assignedToId !== undefined) { data.assignedToId = assignedToId; data.assignedToName = assignedToName || null; }
  if (companyName) data.companyName = companyName;
  if (ownerName) data.ownerName = ownerName;
  if (email !== undefined) data.email = email;
  if (phone) data.phone = phone;
  if (city) data.city = city;
  if (state) data.state = state;
  if (source) data.source = source;

  const lead = await prisma.lead.update({ where: { id: params.id }, data });

  return NextResponse.json(lead);
}
