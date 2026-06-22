import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();

  String _paymentType = 'FULL_100';
  bool _loading = false;
  late Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final res = await ApiClient().dio.get('/dealer/account');
      if (res.statusCode == 200) {
        final d = res.data as Map<String, dynamic>;
        setState(() {
          _nameCtrl.text = d['ownerName'] as String? ?? '';
          _phoneCtrl.text = d['phone'] as String? ?? '';
          _addressCtrl.text = d['address'] as String? ?? '';
          _cityCtrl.text = d['city'] as String? ?? '';
          _stateCtrl.text = d['state'] as String? ?? '';
          _pincodeCtrl.text = d['pincode'] as String? ?? '';
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _razorpay.clear();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    super.dispose();
  }

  Map<String, dynamic> _buildPayload() => {
        'paymentType': _paymentType,
        'deliveryName': _nameCtrl.text,
        'deliveryPhone': _phoneCtrl.text,
        'deliveryAddress': _addressCtrl.text,
        'deliveryCity': _cityCtrl.text,
        'deliveryState': _stateCtrl.text,
        'deliveryPincode': _pincodeCtrl.text,
      };

  Future<void> _placeCOD() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient().dio.post('/orders', data: {
        ..._buildPayload(),
        'paymentType': 'COD',
      });
      if (!mounted) return;
      final orderId = (res.data['order'] as Map)['id'] as String;
      ref.read(cartProvider.notifier).loadCart();
      context.go('/orders/$orderId');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Failed to place order'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _placeOnline() async {
    setState(() => _loading = true);
    try {
      final orderRes = await ApiClient().dio.post('/orders', data: _buildPayload());
      final orderId = (orderRes.data['order'] as Map)['id'] as String;

      final rzpRes = await ApiClient().dio.post('/payments/create-order', data: {'orderId': orderId});
      final rzpData = rzpRes.data as Map<String, dynamic>;

      _razorpay.open({
        'key': rzpData['keyId'],
        'amount': rzpData['amount'],
        'currency': rzpData['currency'] ?? 'INR',
        'order_id': rzpData['razorpayOrderId'],
        'name': 'MotoXPlus India Pvt. Ltd.',
        'description': 'Order ${rzpData['orderNumber']}',
        'theme': {'color': '#DC2626'},
        'prefill': {
          'name': _nameCtrl.text,
          'contact': _phoneCtrl.text,
        },
        'external': {
          'wallets': ['paytm'],
        },
      });
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Failed to create order'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating),
      );
    }
  }

  void _onPaymentSuccess(PaymentSuccessResponse response) async {
    try {
      await ApiClient().dio.post('/payments/verify', data: {
        'razorpayOrderId': response.orderId,
        'razorpayPaymentId': response.paymentId,
        'razorpaySignature': response.signature,
      });
    } catch (_) {}
    if (!mounted) return;
    ref.read(cartProvider.notifier).loadCart();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          content: Text('Payment successful!'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating),
    );
    context.go('/orders');
  }

  void _onPaymentError(PaymentFailureResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text('Payment failed: ${response.message ?? 'Unknown error'}'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating),
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {}

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_paymentType == 'COD') {
      await _placeCOD();
    } else {
      await _placeOnline();
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: cartAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (_, __) =>
            const Center(child: Text('Error loading cart', style: TextStyle(color: AppColors.textMuted))),
        data: (cart) {
          if (cart.items.isEmpty) {
            return const Center(
                child: Text('Cart is empty', style: TextStyle(color: AppColors.textMuted)));
          }
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Delivery details
                const Text('Delivery Details',
                    style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                _buildInput(_nameCtrl, 'Full Name', Icons.person_outline, required: true),
                const SizedBox(height: 12),
                _buildInput(_phoneCtrl, 'Phone Number', Icons.phone_outlined,
                    required: true, type: TextInputType.phone),
                const SizedBox(height: 12),
                _buildInput(_addressCtrl, 'Street Address', Icons.location_on_outlined,
                    required: true, maxLines: 2),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _buildInput(_cityCtrl, 'City', Icons.location_city_outlined, required: true)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildInput(_stateCtrl, 'State', Icons.map_outlined, required: true)),
                  ],
                ),
                const SizedBox(height: 12),
                _buildInput(_pincodeCtrl, 'Pincode', Icons.pin_drop_outlined,
                    required: true, type: TextInputType.number, maxLen: 6),

                const SizedBox(height: 24),
                const Text('Payment Method',
                    style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                _PaymentOption(
                  id: 'FULL_100',
                  title: 'Full Payment',
                  subtitle: 'Pay 100% now via Razorpay',
                  icon: Icons.credit_card,
                  selected: _paymentType == 'FULL_100',
                  onTap: () => setState(() => _paymentType = 'FULL_100'),
                ),
                const SizedBox(height: 8),
                _PaymentOption(
                  id: 'ADVANCE_20',
                  title: '20% Advance',
                  subtitle: 'Pay 20% now, rest before delivery',
                  icon: Icons.account_balance_wallet_outlined,
                  selected: _paymentType == 'ADVANCE_20',
                  onTap: () => setState(() => _paymentType = 'ADVANCE_20'),
                ),
                const SizedBox(height: 8),
                _PaymentOption(
                  id: 'COD',
                  title: 'Cash on Delivery',
                  subtitle: 'Pay when order is delivered',
                  icon: Icons.local_shipping_outlined,
                  selected: _paymentType == 'COD',
                  onTap: () => setState(() => _paymentType = 'COD'),
                ),

                const SizedBox(height: 24),
                // Order summary
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Order Summary',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      ...cart.items.map((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${item.product.name} × ${item.quantity}',
                                    style: const TextStyle(
                                        color: AppColors.textSecondary, fontSize: 12),
                                  ),
                                ),
                                Text(formatCurrency(item.subtotal),
                                    style: const TextStyle(
                                        color: AppColors.textPrimary, fontSize: 12)),
                              ],
                            ),
                          )),
                      const Divider(color: AppColors.border),
                      _SummaryLine('Subtotal', formatCurrency(cart.subtotal)),
                      _SummaryLine('GST', formatCurrency(cart.gstAmount)),
                      const Divider(color: AppColors.border),
                      _SummaryLine(
                        _paymentType == 'ADVANCE_20' ? 'Pay Now (20%)' : 'Grand Total',
                        formatCurrency(_paymentType == 'ADVANCE_20'
                            ? cart.grandTotal * 0.2
                            : cart.grandTotal),
                        bold: true,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),
                AppButton(
                  label: _paymentType == 'COD'
                      ? 'Confirm COD Order'
                      : 'Pay ${formatCurrency(_paymentType == 'ADVANCE_20' ? cart.grandTotal * 0.2 : cart.grandTotal)}',
                  loading: _loading,
                  onPressed: _submit,
                  icon: Icon(
                    _paymentType == 'COD' ? Icons.local_shipping_outlined : Icons.payment,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInput(
    TextEditingController ctrl,
    String label,
    IconData icon, {
    bool required = false,
    TextInputType? type,
    int maxLines = 1,
    int? maxLen,
  }) {
    return TextFormField(
      controller: ctrl,
      keyboardType: type,
      maxLines: maxLines,
      maxLength: maxLen,
      style: const TextStyle(color: AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: AppColors.textMuted, size: 18),
        counterText: '',
      ),
      validator: required
          ? (v) => (v == null || v.isEmpty) ? '$label is required' : null
          : null,
    );
  }
}

class _PaymentOption extends StatelessWidget {
  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _PaymentOption({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withOpacity(0.05) : AppColors.bgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                    color: selected ? AppColors.primary : AppColors.border, width: 2),
              ),
              child: selected
                  ? Center(
                      child: Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(
                              shape: BoxShape.circle, color: AppColors.primary)))
                  : null,
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary.withOpacity(0.1) : AppColors.bgCardHover,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon,
                  color: selected ? AppColors.primary : AppColors.textMuted, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                  Text(subtitle,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryLine extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _SummaryLine(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  color: bold ? AppColors.textPrimary : AppColors.textMuted,
                  fontSize: bold ? 14 : 12,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
          Text(value,
              style: TextStyle(
                  color: bold ? AppColors.primary : AppColors.textPrimary,
                  fontSize: bold ? 16 : 12,
                  fontWeight: bold ? FontWeight.w900 : FontWeight.w500)),
        ],
      ),
    );
  }
}
