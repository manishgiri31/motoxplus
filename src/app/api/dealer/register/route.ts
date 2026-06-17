import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const registerSchema = z.object({
  companyName: z.string().min(2),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/),
  ownerName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(8),
  state: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5),
  pincode: z.string().regex(/^[0-9]{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    // Check existing email
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    // Check existing GST
    const existingGST = await prisma.dealer.findUnique({ where: { gstNumber: data.gstNumber } });
    if (existingGST) {
      return NextResponse.json({ error: "GST number already registered" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    await prisma.user.create({
      data: {
        name: data.ownerName,
        email: data.email,
        password: hashedPassword,
        role: "DEALER",
        dealer: {
          create: {
            companyName: data.companyName,
            gstNumber: data.gstNumber,
            ownerName: data.ownerName,
            phone: data.phone,
            state: data.state,
            city: data.city,
            address: data.address,
            pincode: data.pincode,
            status: "PENDING",
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }
    console.error("Dealer registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
