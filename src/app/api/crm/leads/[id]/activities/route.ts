import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const VALID_TYPES = ["CALL", "EMAIL", "VISIT", "DEMO", "PROPOSAL", "FOLLOW_UP", "MEETING", "OTHER"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, description, outcome, nextAction, updateStatus, newStatus, nextFollowUp } = await req.json();

  if (!type || !VALID_TYPES.includes(type) || !description) {
    return NextResponse.json({ error: "Type and description are required" }, { status: 400 });
  }

  const [activity] = await prisma.$transaction([
    prisma.leadActivity.create({
      data: {
        leadId: params.id,
        performedBy: session.user.id,
        performedByName: session.user.name || session.user.email || "Admin",
        type,
        description,
        outcome: outcome || null,
        nextAction: nextAction || null,
      },
    }),
    ...(updateStatus && newStatus
      ? [
          prisma.lead.update({
            where: { id: params.id },
            data: {
              status: newStatus,
              ...(nextFollowUp && { nextFollowUp: new Date(nextFollowUp) }),
            },
          }),
        ]
      : nextFollowUp
      ? [
          prisma.lead.update({
            where: { id: params.id },
            data: { nextFollowUp: new Date(nextFollowUp) },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(activity, { status: 201 });
}
