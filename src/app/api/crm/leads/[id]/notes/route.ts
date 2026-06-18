import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { requireSectionAccess } from "@/lib/staff-access";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !requireSectionAccess(session.user.role, session.user.department, "crm")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, isPrivate } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 });
  }

  const note = await prisma.leadNote.create({
    data: {
      leadId: params.id,
      authorId: session.user.id,
      authorName: session.user.name || session.user.email || "Admin",
      content,
      isPrivate: isPrivate ?? false,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
