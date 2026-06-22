import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/order.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

final _ordersProvider = FutureProvider<List<Order>>((ref) async {
  final res = await ApiClient().dio.get('/orders');
  return (res.data as List<dynamic>)
      .map((e) => Order.fromJson(e as Map<String, dynamic>))
      .toList();
});

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(_ordersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Orders')),
      body: ordersAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => Center(
          child: EmptyState(
            message: 'Failed to load orders',
            icon: Icons.error_outline,
            onAction: () => ref.invalidate(_ordersProvider),
            actionLabel: 'Retry',
          ),
        ),
        data: (orders) {
          if (orders.isEmpty) {
            return EmptyState(
              message: 'No orders yet.\nStart by browsing our products.',
              icon: Icons.receipt_long_outlined,
              onAction: () => context.go('/products'),
              actionLabel: 'Browse Products',
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(_ordersProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _OrderCard(order: orders[i]),
            ),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Order order;
  const _OrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/orders/${order.id}'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.orderNumber,
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w800),
                      ),
                      Text(
                        formatDate(order.createdAt),
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                StatusBadge.fromStatus(order.status),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _InfoChip(Icons.shopping_bag_outlined,
                    '${order.items.length} item${order.items.length != 1 ? 's' : ''}'),
                const SizedBox(width: 8),
                _InfoChip(Icons.currency_rupee, formatCurrency(order.grandTotal)),
                const SizedBox(width: 8),
                _InfoChip(Icons.payment, order.paymentType.replaceAll('_', ' ')),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text('Payment: ',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                StatusBadge.fromStatus(order.paymentStatus),
                const Spacer(),
                const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 16),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgCardHover,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 10)),
        ],
      ),
    );
  }
}
