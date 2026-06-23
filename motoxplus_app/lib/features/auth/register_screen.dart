import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _pageCtrl = PageController();
  int _page = 0;
  bool _loading = false;
  bool _obscure = true;

  // Page 1 — account
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  // Page 2 — dealer info
  final _companyCtrl = TextEditingController();
  final _ownerCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _gstCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      _nameCtrl, _emailCtrl, _passCtrl, _companyCtrl, _ownerCtrl,
      _phoneCtrl, _gstCtrl, _addressCtrl, _cityCtrl, _stateCtrl, _pincodeCtrl,
    ]) { c.dispose(); }
    _pageCtrl.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_formKey.currentState!.validate()) {
      _pageCtrl.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _page = 1);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ApiClient().dio.post('/auth/register', data: {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim().toLowerCase(),
        'password': _passCtrl.text,
        'companyName': _companyCtrl.text.trim(),
        'ownerName': _ownerCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'gstNumber': _gstCtrl.text.trim().toUpperCase(),
        'address': _addressCtrl.text.trim(),
        'city': _cityCtrl.text.trim(),
        'state': _stateCtrl.text.trim(),
        'pincode': _pincodeCtrl.text.trim(),
      });
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          title: const Text('Application Submitted'),
          content: const Text(
            'Your dealer application has been submitted. We\'ll review it and notify you by email once approved.',
          ),
          actions: [
            TextButton(
              onPressed: () { Navigator.pop(context); context.go('/login'); },
              child: const Text('Back to Login'),
            ),
          ],
        ),
      );
    } on DioException catch (e) {
      final msg = e.response?.data?['error'] as String? ?? 'Registration failed. Please try again.';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.error, behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => _page == 0 ? context.pop() : _pageCtrl.previousPage(
            duration: const Duration(milliseconds: 300), curve: Curves.easeInOut,
          ).then((_) => setState(() => _page = 0)),
        ),
        title: Text(_page == 0 ? 'Create Account' : 'Dealer Details'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress indicator
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: Row(
                children: List.generate(2, (i) => Expanded(
                  child: Container(
                    height: 4,
                    margin: EdgeInsets.only(right: i == 0 ? 4 : 0, left: i == 1 ? 4 : 0),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color: i <= _page ? AppColors.primary : Theme.of(context).dividerColor,
                    ),
                  ),
                )),
              ),
            ),
            Expanded(
              child: Form(
                key: _formKey,
                child: PageView(
                  controller: _pageCtrl,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _buildPage1(),
                    _buildPage2(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPage1() => SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Your Account', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('Basic login details', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
            const SizedBox(height: 28),
            _field(_nameCtrl, 'Full Name', Icons.person_outline, validator: _required),
            const SizedBox(height: 14),
            _field(_emailCtrl, 'Email Address', Icons.email_outlined,
                keyboard: TextInputType.emailAddress,
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (!v.contains('@')) return 'Invalid email';
                  return null;
                }),
            const SizedBox(height: 14),
            TextFormField(
              controller: _passCtrl,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline, size: 18),
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (v.length < 8) return 'At least 8 characters';
                return null;
              },
            ),
            const SizedBox(height: 28),
            AppButton(label: 'Next', onPressed: _nextPage,
                icon: const Icon(Icons.arrow_forward, size: 16, color: Colors.white)),
            const SizedBox(height: 16),
            Center(
              child: GestureDetector(
                onTap: () => context.go('/login'),
                child: RichText(
                  text: TextSpan(
                    text: 'Already have an account? ',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                    children: [
                      TextSpan(text: 'Sign in', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _buildPage2() => SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Dealer Information', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('Your application will be reviewed by our team', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
            const SizedBox(height: 28),
            _field(_companyCtrl, 'Company Name', Icons.business_outlined, validator: _required),
            const SizedBox(height: 14),
            _field(_ownerCtrl, 'Owner Name', Icons.person_outline, validator: _required),
            const SizedBox(height: 14),
            _field(_phoneCtrl, 'Phone Number', Icons.phone_outlined,
                keyboard: TextInputType.phone, validator: _required),
            const SizedBox(height: 14),
            _field(_gstCtrl, 'GST Number', Icons.receipt_outlined,
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (v.length != 15) return 'GST must be 15 characters';
                  return null;
                }),
            const SizedBox(height: 14),
            _field(_addressCtrl, 'Address', Icons.location_on_outlined, validator: _required),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _field(_cityCtrl, 'City', Icons.location_city_outlined, validator: _required)),
                const SizedBox(width: 12),
                Expanded(child: _field(_stateCtrl, 'State', Icons.map_outlined, validator: _required)),
              ],
            ),
            const SizedBox(height: 14),
            _field(_pincodeCtrl, 'Pincode', Icons.pin_drop_outlined,
                keyboard: TextInputType.number, validator: _required),
            const SizedBox(height: 28),
            AppButton(
              label: 'Submit Application',
              onPressed: _submit,
              loading: _loading,
              icon: const Icon(Icons.send, size: 16, color: Colors.white),
            ),
          ],
        ),
      );

  Widget _field(
    TextEditingController ctrl,
    String label,
    IconData icon, {
    TextInputType keyboard = TextInputType.text,
    String? Function(String?)? validator,
  }) =>
      TextFormField(
        controller: ctrl,
        keyboardType: keyboard,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 18),
        ),
        validator: validator,
      );

  String? _required(String? v) => (v == null || v.isEmpty) ? 'Required' : null;
}
