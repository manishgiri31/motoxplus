import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { InvoiceView } from "@/components/invoice/invoice-view";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const dealer = await prisma.dealer.findUnique({ where: { userId: session!.user.id } });

  if (!dealer) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          items: { include: { product: { include: { category: true } } } },
        },
      },
      dealer: { include: { user: true } },
    },
  });

  if (!invoice || invoice.dealerId !== dealer.id) notFound();

  return (
    <div>
      <InvoiceView invoice={JSON.parse(JSON.stringify(invoice))} />
    </div>
  );
}
