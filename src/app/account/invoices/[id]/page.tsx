import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { InvoiceView } from "@/components/invoice/invoice-view";

export default async function AccountInvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const customer = await prisma.customer.findUnique({ where: { userId: session!.user.id } });

  if (!customer) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          items: { include: { product: { include: { category: true } } } },
        },
      },
      customer: { include: { user: true } },
    },
  });

  if (!invoice || invoice.customerId !== customer.id) notFound();

  // B2C invoice — no GSTIN, no dealer company. Recipient comes straight off
  // the order's own delivery fields (there's no "customer profile address",
  // only wherever this particular order shipped to).
  const billTo = {
    name: invoice.order.deliveryName ?? invoice.customer!.user.name ?? "Customer",
    subName: null,
    address: invoice.order.shippingAddress ?? "",
    city: invoice.order.deliveryCity ?? "",
    state: invoice.order.deliveryState ?? "",
    pincode: invoice.order.deliveryPincode ?? "",
    gstNumber: null,
    phone: invoice.order.deliveryPhone ?? "",
  };

  return (
    <div>
      <InvoiceView invoice={JSON.parse(JSON.stringify({ ...invoice, billTo }))} />
    </div>
  );
}
