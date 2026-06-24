import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function commonPrefix(names: string[]): string {
  if (!names.length) return "";
  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    while (!names[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix.trimEnd();
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

interface ProductRow {
  id: string;
  name: string;
  partNumber: string;
  price: number;
  mrp: number | null;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
}

interface Group {
  prefix: string;
  products: ProductRow[];
}

function autoGroupProducts(products: ProductRow[], minWords: number): Group[] {
  // Sort alphabetically so similar names are adjacent
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const groups: Group[] = [];

  for (const p of sorted) {
    let bestMatch = -1;
    let bestLen = minWords - 1;

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const cp = commonPrefix([g.prefix, p.name]);
      const wc = wordCount(cp);
      if (wc > bestLen) {
        bestLen = wc;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0) {
      const g = groups[bestMatch];
      g.products.push(p);
      g.prefix = commonPrefix([g.prefix, p.name]).trimEnd();
    } else {
      groups.push({ prefix: p.name, products: [p] });
    }
  }

  return groups.filter((g) => g.products.length >= 2);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const minWords = Math.max(2, parseInt(searchParams.get("minWords") ?? "3"));

  if (!search) {
    return NextResponse.json({ error: "search param required" }, { status: 400 });
  }

  // Fetch all products matching the search (up to 500)
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      partNumber: true,
      price: true,
      mrp: true,
      stock: true,
      isActive: true,
      productImages: {
        where: { isPrimary: true },
        take: 1,
        select: { imageUrl: true },
      },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    partNumber: p.partNumber,
    price: p.price,
    mrp: p.mrp,
    stock: p.stock,
    isActive: p.isActive,
    imageUrl: (p as any).productImages?.[0]?.imageUrl ?? null,
  }));

  // Only group active products (exclude already-deactivated ones)
  const active = rows.filter((p) => p.isActive);
  const groups = autoGroupProducts(active, minWords);

  return NextResponse.json({
    totalFound: products.length,
    activeCount: active.length,
    groups: groups.map((g) => ({
      prefix: g.prefix,
      count: g.products.length,
      products: g.products.map((p) => ({
        id: p.id,
        name: p.name,
        partNumber: p.partNumber,
        price: p.price,
        stock: p.stock,
      })),
      // First product is suggested parent
      suggestedParentId: g.products[0].id,
    })),
  });
}
