import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/cart.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cart'),
        actions: [
          if (cartAsync.maybeWhen(
              data: (c) => c.items.isNotEmpty, orElse: () => false))
            TextButton(
              onPressed: () => context.push('/checkout'),
              child: const Text('CHECKOUT',
                  style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12)),
            ),
        ],
      ),
      body: cartAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Failed to load cart',
                  style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.read(cartProvider.notifier).loadCart(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (cart) {
          if (cart.items.isEmpty) {
            return EmptyState(
              message: 'Your cart is empty',
              icon: Icons.shopping_cart_outlined,
              onAction: () => context.go('/products'),
              actionLabel: 'Browse Products',
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: cart.items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _CartItemTile(item: cart.items[i]),
                ),
              ),
              _CartSummary(cart: cart),
            ],
          );
        },
      ),
    );
  }
}

class _CartItemTile extends ConsumerStatefulWidget {
  final CartItem item;
  const _CartItemTile({required this.item});

  @override
  ConsumerState<_CartItemTile> createState() => _CartItemTileState();
}

class _CartItemTileState extends ConsumerState<_CartItemTile> {
  bool _removing = false;
  bool _updating = false;

  Future<void> _updateQty(int qty) async {
    setState(() => _updating = true);
    await ref.read(cartProvider.notifier).addItem(widget.item.productId, qty);
    if (mounted) setState(() => _updating = false);
  }

  Future<void> _remove() async {
    setState(() => _removing = true);
    await ref.read(cartProvider.notifier).removeItem(widget.item.id);
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final p = item.product;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              width: 70,
              height: 70,
              child: ProductImageWidget(imageUrl: p.primaryImageUrl, height: 70),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(p.partNumber,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(formatCurrency(p.price),
                        style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 14,
                            fontWeight: FontWeight.w900)),
                    const Spacer(),
                    // Qty controls
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: _updating
                                ? null
                                : () {
                                    final newQty = item.quantity - p.moq;
                                    if (newQty >= p.moq) _updateQty(newQty);
                                  },
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Icon(Icons.remove, size: 14, color: AppColors.textMuted),
                            ),
                          ),
                          _updating
                              ? const SizedBox(
                                  width: 20,
                                  height: 14,
                                  child: Center(
                                    child: SizedBox(
                                        width: 12,
                                        height: 12,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 1.5, color: AppColors.primary)),
                                  ))
                              : Text('${item.quantity}',
                                  style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700)),
                          GestureDetector(
                            onTap: _updating ? null : () => _updateQty(item.quantity + p.moq),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Icon(Icons.add, size: 14, color: AppColors.textMuted),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: _removing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.error))
                : const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
            onPressed: _removing ? null : _remove,
          ),
        ],
      ),
    );
  }
}

class _CartSummary extends StatelessWidget {
  final Cart cart;
  const _CartSummary({required this.cart});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.bgCard,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          _SummaryRow('Subtotal (excl. GST)', formatCurrency(cart.subtotal)),
          const SizedBox(height: 6),
          _SummaryRow('GST Amount', formatCurrency(cart.gstAmount)),
          const Divider(color: AppColors.border, height: 20),
          _SummaryRow('Grand Total', formatCurrency(cart.grandTotal), bold: true),
          const SizedBox(height: 16),
          AppButton(
            label: 'Proceed to Checkout',
            icon: const Icon(Icons.arrow_forward, size: 16, color: Colors.white),
            onPressed: () => context.push('/checkout'),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _SummaryRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
                color: bold ? AppColors.textPrimary : AppColors.textMuted,
                fontSize: bold ? 14 : 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
        Text(value,
            style: TextStyle(
                color: bold ? AppColors.primary : AppColors.textPrimary,
                fontSize: bold ? 16 : 13,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w600)),
      ],
    );
  }
}
