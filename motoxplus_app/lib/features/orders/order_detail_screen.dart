import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/models/order.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

final _orderDetailProvider = FutureProvider.family<Order, String>((ref, id) async {
  final res = await ApiClient().dio.get('/orders/$id');
  return Order.fromJson(res.data as Map<String, dynamic>);
});

class OrderDetailScreen extends ConsumerWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(_orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Order Details')),
      body: orderAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (_, _) => const Center(
            child: Text('Failed to load order',
                style: TextStyle(color: AppColors.textMuted))),
        data: (order) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(order.orderNumber,
                            style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 20,
                                fontWeight: FontWeight.w900)),
                        Text(formatDate(order.createdAt),
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 13)),
                      ],
                    ),
                  ),
                  StatusBadge.fromStatus(order.status),
                ],
              ),

              const SizedBox(height: 20),

              // Status row
              Row(
                children: [
                  const Text('Payment: ',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                  StatusBadge.fromStatus(order.paymentStatus),
                ],
              ),

              const SizedBox(height: 20),

              // Items
              const Text('Items',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              ...order.items.map((item) {
                final name =
                    (item.product?['name'] as String?) ?? 'Product #${item.productId.substring(0, 8)}';
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name,
                                style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600)),
                            Text('Qty: ${item.quantity}',
                                style: const TextStyle(
                                    color: AppColors.textMuted, fontSize: 12)),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(formatCurrency(item.unitPrice),
                              style: const TextStyle(
                                  color: AppColors.textSecondary, fontSize: 12)),
                          Text(formatCurrency(item.total),
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ],
                  ),
                );
              }),

              const SizedBox(height: 16),

              // Financial summary
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.bgCard,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    _Line('Subtotal', formatCurrency(order.subtotal)),
                    const SizedBox(height: 6),
                    _Line('GST', formatCurrency(order.gstAmount)),
                    if (order.shippingCost > 0) ...[
                      const SizedBox(height: 6),
                      _Line('Shipping', formatCurrency(order.shippingCost)),
                    ],
                    const Divider(color: AppColors.border, height: 16),
                    _Line('Grand Total', formatCurrency(order.grandTotal), bold: true),
                    const SizedBox(height: 6),
                    _Line('Amount Paid', formatCurrency(order.amountPaid),
                        valueColor: AppColors.success),
                    if (order.amountDue > 0) ...[
                      const SizedBox(height: 6),
                      _Line('Amount Due', formatCurrency(order.amountDue),
                          valueColor: AppColors.warning),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Delivery details
              if (order.deliveryName != null) ...[
                const Text('Delivery Details',
                    style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      _Line('Name', order.deliveryName ?? ''),
                      if (order.deliveryPhone != null) ...[
                        const SizedBox(height: 6),
                        _Line('Phone', order.deliveryPhone!),
                      ],
                      if (order.deliveryCity != null) ...[
                        const SizedBox(height: 6),
                        _Line('City', '${order.deliveryCity}, ${order.deliveryState}'),
                      ],
                      if (order.deliveryPincode != null) ...[
                        const SizedBox(height: 6),
                        _Line('Pincode', order.deliveryPincode!),
                      ],
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;
  const _Line(this.label, this.value, {this.bold = false, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
                color: bold ? AppColors.textSecondary : AppColors.textMuted,
                fontSize: bold ? 14 : 12)),
        Text(value,
            style: TextStyle(
                color: valueColor ?? (bold ? AppColors.primary : AppColors.textPrimary),
                fontSize: bold ? 16 : 12,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w500)),
      ],
    );
  }
}
