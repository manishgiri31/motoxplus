import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Users, Package, ClipboardList, TrendingUp, ArrowRight, Clock, Ban, Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatGrid, StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Money, PartNo } from "@/components/ui/numeral";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    totalDealers,
    pendingDealers,
    totalOrders,
    pendingOrders,
    totalProducts,
    revenueData,
    recentOrders,
    recentDealers,
    cancellationsThisMonth,
    chargesThisMonth,
  ] = await Promise.all([
    prisma.dealer.count({ where: { status: "ACTIVE" } }),
    prisma.dealer.count({ where: { status: "PENDING" } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { dealer: { include: { user: true } } },
    }),
    prisma.dealer.findMany({
      where: { status: "PENDING" },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.orderCancellation.count({ where: { cancelledAt: { gte: startOfMonth } } }),
    prisma.orderCancellation.aggregate({ _sum: { feeAmount: true }, where: { cancelledAt: { gte: startOfMonth } } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="OVERVIEW"
        title="Admin Dashboard"
        description={`Welcome back, ${session?.user?.name}.`}
      />

      <StatGrid className="mb-8">
        <StatCard
          icon={Users}
          label="Active Dealers"
          value={totalDealers}
          sub={`${pendingDealers} pending`}
          href="/admin/dealers"
          tone="info"
        />
        <StatCard
          icon={ClipboardList}
          label="Total Orders"
          value={totalOrders}
          sub={`${pendingOrders} pending`}
          href="/admin/orders"
          tone="warn"
        />
        <StatCard icon={Package} label="Products" value={totalProducts} sub="active listings" href="/admin/products" tone="progress" />
        <StatCard icon={TrendingUp} label="Total Revenue" value={<Money amount={revenueData._sum.amount || 0} />} sub="paid orders" href="/admin/orders" tone="ok" />
      </StatGrid>

      <StatGrid cols={2} className="mb-8">
        <StatCard
          icon={Ban}
          label="Cancellations"
          value={cancellationsThisMonth}
          sub="this month"
          href="/admin/orders?status=CANCELLED"
          tone="danger"
        />
        <StatCard
          icon={Receipt}
          label="Charges Collected"
          value={<Money amount={chargesThisMonth._sum.feeAmount || 0} />}
          sub="this month"
          href="/admin/refunds"
          tone="danger"
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders */}
        <Card className="lg:col-span-2" pad="lg">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/admin/orders">
                View All <ArrowRight size={12} />
              </Link>
            </Button>
          </CardHeader>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between p-3.5 rounded-sm border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card-hover)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div data-tone="danger" className="w-8 h-8 rounded-sm bg-[var(--tone-bg)] flex items-center justify-center flex-shrink-0">
                    <ClipboardList size={13} className="text-[var(--tone-fg)]" />
                  </div>
                  <div>
                    <PartNo className="text-[var(--text-primary)] text-xs font-bold">{order.orderNumber}</PartNo>
                    <div className="text-[var(--text-muted)] text-[10px] mt-0.5">{order.dealer.companyName}</div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="text-[var(--text-primary)] font-bold text-sm">
                    <Money amount={order.grandTotal} />
                  </span>
                  <StatusBadge domain="order" value={order.status} />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Pending Dealers */}
        <Card pad="lg">
          <CardHeader>
            <CardTitle>Pending Dealers</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/admin/dealers?status=PENDING">
                View All <ArrowRight size={12} />
              </Link>
            </Button>
          </CardHeader>
          {recentDealers.length === 0 ? (
            <EmptyState title="No pending applications" />
          ) : (
            <div className="space-y-2">
              {recentDealers.map((dealer) => (
                <Link
                  key={dealer.id}
                  href={`/admin/dealers/${dealer.id}`}
                  className="flex items-center gap-3 p-3 rounded-sm border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card-hover)] transition-colors group"
                >
                  <div data-tone="warn" className="w-8 h-8 rounded-sm bg-[var(--tone-bg)] flex items-center justify-center flex-shrink-0">
                    <Clock size={13} className="text-[var(--tone-fg)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)] text-xs font-bold truncate">{dealer.companyName}</div>
                    <div className="text-[var(--text-muted)] text-[10px]">{dealer.city}, {dealer.state}</div>
                    <div className="text-[var(--text-muted)] text-[10px] opacity-60">{formatDate(dealer.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {pendingDealers > 0 && (
            <Button asChild variant="outline" size="sm" block className="mt-4">
              <Link href="/admin/dealers?status=PENDING">Review {pendingDealers} Applications</Link>
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
