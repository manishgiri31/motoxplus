import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/cart.dart';

class CartNotifier extends StateNotifier<AsyncValue<Cart>> {
  final ApiClient _api;

  CartNotifier(this._api) : super(const AsyncValue.loading());

  Future<void> loadCart() async {
    state = const AsyncValue.loading();
    try {
      final res = await _api.dio.get('/cart');
      state = AsyncValue.data(Cart.fromJson(res.data as Map<String, dynamic>));
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<String?> addItem(String productId, int quantity) async {
    try {
      await _api.dio.post('/cart', data: {'productId': productId, 'quantity': quantity});
      await loadCart();
      return null;
    } catch (e) {
      return _extractError(e);
    }
  }

  Future<String?> removeItem(String itemId) async {
    try {
      await _api.dio.delete('/cart', data: {'itemId': itemId});
      await loadCart();
      return null;
    } catch (e) {
      return _extractError(e);
    }
  }

  String _extractError(dynamic e) => 'Failed to update cart';
}

final cartProvider = StateNotifierProvider<CartNotifier, AsyncValue<Cart>>((ref) {
  return CartNotifier(ApiClient());
});
