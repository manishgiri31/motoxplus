import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/product.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

final _categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final res = await ApiClient().dio.get('/categories');
  return (res.data as List<dynamic>)
      .map((e) => Category.fromJson(e as Map<String, dynamic>))
      .toList();
});

final _productsProvider =
    FutureProvider.family<List<Product>, _ProductFilter>((ref, filter) async {
  final params = <String, dynamic>{'page': '1', 'pageSize': '50'};
  if (filter.category != null) params['category'] = filter.category;
  if (filter.search != null && filter.search!.isNotEmpty) params['search'] = filter.search;
  final res = await ApiClient().dio.get('/products', queryParameters: params);
  final list = res.data is List ? res.data as List : (res.data['products'] as List? ?? []);
  return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
});

class _ProductFilter {
  final String? category;
  final String? search;
  const _ProductFilter({this.category, this.search});

  @override
  bool operator ==(Object other) =>
      other is _ProductFilter && other.category == category && other.search == search;

  @override
  int get hashCode => Object.hash(category, search);
}

class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  String? _selectedCategory;
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_categoriesProvider);
    final filter = _ProductFilter(category: _selectedCategory, search: _search.isEmpty ? null : _search);
    final products = ref.watch(_productsProvider(filter));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          Consumer(builder: (ctx, ref, _) {
            final cart = ref.watch(cartProvider);
            final count = cart.maybeWhen(data: (c) => c.itemCount, orElse: () => 0);
            return Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.shopping_cart_outlined),
                  onPressed: () => context.push('/cart'),
                ),
                if (count > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                          shape: BoxShape.circle, color: AppColors.primary),
                      child: Center(
                        child: Text(count.toString(),
                            style: const TextStyle(
                                color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),
              ],
            );
          }),
        ],
      ),
      body: Column(
        children: [
          // Search
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search products...',
                prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 18),
                suffixIcon: _search.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppColors.textMuted, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _search = '');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),

          // Category filter
          categories.when(
            loading: () => const SizedBox(height: 48),
            error: (_, __) => const SizedBox(),
            data: (cats) => SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _CategoryChip(
                    label: 'All',
                    selected: _selectedCategory == null,
                    onTap: () => setState(() => _selectedCategory = null),
                  ),
                  ...cats.map((cat) => _CategoryChip(
                        label: cat.name,
                        selected: _selectedCategory == cat.slug,
                        onTap: () => setState(() => _selectedCategory = cat.slug),
                      )),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),

          Expanded(
            child: products.when(
              loading: () => GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.7),
                itemCount: 6,
                itemBuilder: (_, __) => const ShimmerCard(),
              ),
              error: (e, _) => Center(
                child: Text('Failed to load products',
                    style: const TextStyle(color: AppColors.textMuted)),
              ),
              data: (prods) {
                if (prods.isEmpty) {
                  return const EmptyState(
                    message: 'No products found',
                    icon: Icons.inventory_2_outlined,
                  );
                }
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async => ref.invalidate(_productsProvider(filter)),
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.62),
                    itemCount: prods.length,
                    itemBuilder: (_, i) => _ProductCard(product: prods[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.bgCard,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _ProductCard extends ConsumerStatefulWidget {
  final Product product;
  const _ProductCard({required this.product});

  @override
  ConsumerState<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends ConsumerState<_ProductCard> {
  late int _qty;
  bool _adding = false;
  bool _added = false;

  @override
  void initState() {
    super.initState();
    _qty = widget.product.moq;
  }

  Future<void> _addToCart() async {
    setState(() => _adding = true);
    final error = await ref.read(cartProvider.notifier).addItem(widget.product.id, _qty);
    if (!mounted) return;
    setState(() => _adding = false);
    if (error == null) {
      setState(() => _added = true);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _added = false);
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AppColors.error, behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return GestureDetector(
      onTap: () => context.push('/products/${p.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
              child: ProductImageWidget(imageUrl: p.primaryImageUrl, height: 110),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${p.partNumber}${p.oemNumber != null ? ' · ${p.oemNumber}' : ''}',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 9),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      p.name,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(p.category.name,
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(formatCurrency(p.price),
                            style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w900,
                                fontSize: 13)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: p.isInStock
                                ? AppColors.success.withOpacity(0.15)
                                : AppColors.error.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            p.isInStock ? 'In Stock' : 'Out of Stock',
                            style: TextStyle(
                                color: p.isInStock ? AppColors.success : AppColors.error,
                                fontSize: 9,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Qty + Add
                    Row(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              GestureDetector(
                                onTap: () {
                                  if (_qty > p.moq) setState(() => _qty -= p.moq);
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                  child: Icon(Icons.remove, size: 12, color: AppColors.textMuted),
                                ),
                              ),
                              Text('$_qty',
                                  style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700)),
                              GestureDetector(
                                onTap: () => setState(() => _qty += p.moq),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                  child: Icon(Icons.add, size: 12, color: AppColors.textMuted),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: GestureDetector(
                            onTap: p.isInStock && !_adding ? _addToCart : null,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              decoration: BoxDecoration(
                                color: _added
                                    ? AppColors.success
                                    : p.isInStock
                                        ? AppColors.primary
                                        : AppColors.border,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Center(
                                child: _adding
                                    ? const SizedBox(
                                        width: 12,
                                        height: 12,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 1.5, color: Colors.white))
                                    : Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                              _added
                                                  ? Icons.check
                                                  : Icons.shopping_cart_outlined,
                                              size: 11,
                                              color: Colors.white),
                                          const SizedBox(width: 3),
                                          Text(_added ? 'Added' : 'Add',
                                              style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w700)),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
