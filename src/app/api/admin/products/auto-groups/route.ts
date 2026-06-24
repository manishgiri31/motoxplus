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
}

interface Group {
  prefix: string;
  products: ProductRow[];
}

function autoGroupProducts(products: ProductRow[], minWords: number): Group[] {
  const MIN_PREFIX_CHARS = 8; // prefix must be at least 8 chars to avoid "H" type nonsense

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const groups: Group[] = [];

  for (const p of sorted) {
    let bestMatch = -1;
    let bestLen = minWords - 1;

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const cp = commonPrefix([g.prefix, p.name]);
      const wc = wordCount(cp);
      // Must meet both word count AND minimum character length
      if (wc > bestLen && cp.length >= MIN_PREFIX_CHARS) {
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

  // Fetch all active products matching the search, EXCLUDING those that already
  // have variants (they are already consolidated master products)
  const products = await (prisma.product as any).findMany({
    where: {
      isActive: true,
      variants: { none: {} }, // skip already-consolidated products
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
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const rows: ProductRow[] = products.map((p: any) => ({
    id: p.id,
    name: p.name,
    partNumber: p.partNumber,
    price: p.price,
    mrp: p.mrp,
    stock: p.stock,
  }));

  const groups = autoGroupProducts(rows, minWords);

  return NextResponse.json({
    totalFound: products.length,
    activeCount: products.length,
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
      suggestedParentId: g.products[0].id,
    })),
  });
}
