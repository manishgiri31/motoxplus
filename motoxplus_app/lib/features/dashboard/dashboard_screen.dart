import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

final _dashStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final res = await ApiClient().dio.get('/orders');
  final orders = (res.data as List<dynamic>?) ?? [];
  double totalSpend = 0;
  int pending = 0;
  int delivered = 0;
  for (final o in orders) {
    totalSpend += (o['grandTotal'] as num?)?.toDouble() ?? 0;
    if (o['status'] == 'PENDING' || o['status'] == 'CONFIRMED' || o['status'] == 'PROCESSING') {
      pending++;
    }
    if (o['status'] == 'DELIVERED') delivered++;
  }
  return {
    'totalOrders': orders.length,
    'totalSpend': totalSpend,
    'pending': pending,
    'delivered': delivered,
  };
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final stats = ref.watch(_dashStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('MOTOXPLUS',
                style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5)),
            Text(
              auth.dealer?.companyName ?? 'Dealer Portal',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.primary,
              child: Text(
                (auth.dealer?.ownerName ?? auth.user?.name ?? 'D').substring(0, 1).toUpperCase(),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.invalidate(_dashStatsProvider),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting
              Text(
                'Hello, ${auth.dealer?.ownerName.split(' ').first ?? 'Dealer'} 👋',
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              const Text(
                'Welcome to your dealer dashboard',
                style: TextStyle(color: AppColors.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 20),

              // Status badge
              if (auth.dealer != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.success.withOpacity(0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                              shape: BoxShape.circle, color: AppColors.success)),
                      const SizedBox(width: 6),
                      Text(
                        '${auth.dealer!.status} DEALER',
                        style: const TextStyle(
                            color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 24),

              // Stats grid
              stats.when(
                loading: () => GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.4,
                  children: List.generate(4, (_) => const ShimmerCard()),
                ),
                error: (_, __) => const SizedBox(),
                data: (data) => GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.4,
                  children: [
                    _StatCard(
                      label: 'Total Orders',
                      value: data['totalOrders'].toString(),
                      icon: Icons.shopping_bag_outlined,
                      color: AppColors.primary,
                    ),
                    _StatCard(
                      label: 'Total Spend',
                      value: formatCurrency(data['totalSpend'] as double),
                      icon: Icons.currency_rupee,
                      color: const Color(0xFF8B5CF6),
                      small: true,
                    ),
                    _StatCard(
                      label: 'Active Orders',
                      value: data['pending'].toString(),
                      icon: Icons.hourglass_empty,
                      color: AppColors.warning,
                    ),
                    _StatCard(
                      label: 'Delivered',
                      value: data['delivered'].toString(),
                      icon: Icons.check_circle_outline,
                      color: AppColors.success,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Text('Quick Actions',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _QuickAction(
                      label: 'Browse Products',
                      icon: Icons.inventory_2_outlined,
                      color: AppColors.primary,
                      onTap: () => context.go('/products'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickAction(
                      label: 'View Orders',
                      icon: Icons.receipt_long_outlined,
                      color: const Color(0xFF8B5CF6),
                      onTap: () => context.go('/orders'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _QuickAction(
                      label: 'Invoices',
                      icon: Icons.description_outlined,
                      color: AppColors.warning,
                      onTap: () => context.go('/invoices'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickAction(
                      label: 'My Profile',
                      icon: Icons.person_outline,
                      color: AppColors.success,
                      onTap: () => context.go('/profile'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool small;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: small ? 14 : 22,
                    fontWeight: FontWeight.w900),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(label,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction(
      {required this.label, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}
