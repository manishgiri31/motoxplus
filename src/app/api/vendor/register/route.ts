import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateVendorCode } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  category: z.enum([
    "RAW_MATERIALS", "PACKAGING", "PRINTING", "LOGISTICS",
    "MANUFACTURING_COMPONENTS", "TOOLING", "SERVICES",
  ]),
  state: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5),
  pincode: z.string().regex(/^[0-9]{6}$/),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const [existingUser, existingVendor] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.vendor.findUnique({ where: { email: data.email } }),
    ]);

    if (existingUser || existingVendor) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    if (data.gstNumber) {
      const gstConflict = await prisma.vendor.findUnique({ where: { gstNumber: data.gstNumber } });
      if (gstConflict) {
        return NextResponse.json({ error: "GST number already registered" }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const vendorCode = await generateVendorCode();

    await prisma.user.create({
      data: {
        name: data.ownerName,
        email: data.email,
        password: hashedPassword,
        role: "VENDOR",
        vendor: {
          create: {
            vendorCode,
            companyName: data.companyName,
            ownerName: data.ownerName,
            email: data.email,
            phone: data.phone,
            category: data.category,
            state: data.state,
            city: data.city,
            address: data.address,
            pincode: data.pincode,
            status: "PENDING",
            gstNumber: data.gstNumber || null,
            panNumber: data.panNumber || null,
            website: data.website || null,
            notes: data.notes || null,
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    console.error("Vendor registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
