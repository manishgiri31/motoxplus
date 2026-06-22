import 'product.dart';

class CartItem {
  final String id;
  final String cartId;
  final String productId;
  final int quantity;
  final Product product;

  const CartItem({
    required this.id,
    required this.cartId,
    required this.productId,
    required this.quantity,
    required this.product,
  });

  double get subtotal => product.price * quantity;
  double get gstAmount => subtotal * product.gstRate / 100;
  double get total => subtotal + gstAmount;

  factory CartItem.fromJson(Map<String, dynamic> j) => CartItem(
        id: j['id'] as String,
        cartId: j['cartId'] as String,
        productId: j['productId'] as String,
        quantity: j['quantity'] as int,
        product: Product.fromJson(j['product'] as Map<String, dynamic>),
      );
}

class Cart {
  final String id;
  final List<CartItem> items;

  const Cart({required this.id, required this.items});

  double get subtotal => items.fold(0, (s, i) => s + i.subtotal);
  double get gstAmount => items.fold(0, (s, i) => s + i.gstAmount);
  double get grandTotal => subtotal + gstAmount;
  int get itemCount => items.length;

  factory Cart.fromJson(Map<String, dynamic> j) => Cart(
        id: j['id'] as String? ?? '',
        items: (j['items'] as List<dynamic>?)
                ?.map((e) => CartItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}
