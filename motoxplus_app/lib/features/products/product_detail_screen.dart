import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/product.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

final _productDetailProvider = FutureProvider.family<Product, String>((ref, id) async {
  final res = await ApiClient().dio.get('/products/$id');
  return Product.fromJson(res.data as Map<String, dynamic>);
});

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int _qty = 1;
  bool _adding = false;
  bool _added = false;

  Future<void> _addToCart(Product p) async {
    setState(() => _adding = true);
    final error = await ref.read(cartProvider.notifier).addItem(p.id, _qty);
    if (!mounted) return;
    setState(() => _adding = false);
    if (error == null) {
      setState(() => _added = true);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _added = false);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Added to cart'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AppColors.error, behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(_productDetailProvider(widget.productId));

    return productAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: const Center(
            child: Text('Failed to load product', style: TextStyle(color: AppColors.textMuted))),
      ),
      data: (product) {
        if (_qty < product.moq) _qty = product.moq;
        return Scaffold(
          appBar: AppBar(
            title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            actions: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined),
                onPressed: () => context.push('/cart'),
              ),
            ],
          ),
          body: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image
                ProductImageWidget(imageUrl: product.primaryImageUrl, height: 250),

                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // SKU
                      Text(
                        '${product.partNumber}${product.oemNumber != null ? ' · OEM: ${product.oemNumber}' : ''}',
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 11, fontFamily: 'monospace'),
                      ),
                      const SizedBox(height: 6),

                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              product.name,
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900),
                            ),
                          ),
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: product.isInStock
                                  ? AppColors.success.withValues(alpha: 0.15)
                                  : AppColors.error.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              product.isInStock ? 'In Stock' : 'Out of Stock',
                              style: TextStyle(
                                  color: product.isInStock ? AppColors.success : AppColors.error,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 4),
                      Text(product.category.name,
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),

                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.bgCardHover,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  formatCurrency(product.price),
                                  style: const TextStyle(
                                      color: AppColors.primary,
                                      fontSize: 26,
                                      fontWeight: FontWeight.w900),
                                ),
                                Text(
                                  '+${product.gstRate.toStringAsFixed(0)}% GST · MOQ: ${product.moq}',
                                  style: const TextStyle(
                                      color: AppColors.textMuted, fontSize: 12),
                                ),
                              ],
                            ),
                            const Spacer(),
                            Text(
                              '(incl. GST: ${formatCurrency(product.price * (1 + product.gstRate / 100))})',
                              style: const TextStyle(
                                  color: AppColors.textSecondary, fontSize: 12),
                            ),
                          ],
                        ),
                      ),

                      if (product.description != null && product.description!.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        const Text('Description',
                            style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text(product.description!,
                            style: const TextStyle(
                                color: AppColors.textSecondary, fontSize: 13, height: 1.5)),
                      ],

                      const SizedBox(height: 20),
                      const Text('Product Details',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      _DetailRow('Brand', product.brand),
                      _DetailRow('Warranty', product.warranty),
                      if (product.hsnCode != null && product.hsnCode!.isNotEmpty)
                        _DetailRow('HSN Code', product.hsnCode!),
                      _DetailRow('SKU', product.sku),

                      if (product.compatibility.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        const Text('Compatible Vehicles',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: product.compatibility
                              .map((c) => Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.bgCardHover,
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Text(c,
                                        style: const TextStyle(
                                            color: AppColors.textSecondary, fontSize: 11)),
                                  ))
                              .toList(),
                        ),
                      ],

                      const SizedBox(height: 80),
                    ],
                  ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: product.isInStock
              ? Container(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard,
                    border: const Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, size: 18),
                              color: AppColors.textMuted,
                              onPressed: () {
                                if (_qty > product.moq) setState(() => _qty -= product.moq);
                              },
                            ),
                            Text('$_qty',
                                style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700)),
                            IconButton(
                              icon: const Icon(Icons.add, size: 18),
                              color: AppColors.textMuted,
                              onPressed: () => setState(() => _qty += product.moq),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: AppButton(
                          label: _added ? 'Added to Cart' : 'Add to Cart',
                          loading: _adding,
                          color: _added ? AppColors.success : AppColors.primary,
                          icon: Icon(_added ? Icons.check : Icons.shopping_cart_outlined,
                              size: 16, color: Colors.white),
                          onPressed: () => _addToCart(product),
                        ),
                      ),
                    ],
                  ),
                )
              : null,
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
