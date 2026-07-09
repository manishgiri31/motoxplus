import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final dealer = auth.dealer;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Avatar
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary,
                border: Border.all(color: context.cBorder, width: 2),
              ),
              child: Center(
                child: Text(
                  (dealer?.ownerName ?? user?.name ?? 'D').substring(0, 1).toUpperCase(),
                  style: const TextStyle(
                      color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              dealer?.ownerName ?? user?.name ?? 'Dealer',
              style: TextStyle(
                  color: context.cTextPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              user?.email ?? '',
              style: TextStyle(color: context.cTextMuted, fontSize: 13),
            ),
            if (dealer != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                ),
                child: Text(
                  '${dealer.status} DEALER',
                  style: const TextStyle(
                      color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],

            const SizedBox(height: 24),

            if (dealer != null) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: Text('Business Information',
                    style: TextStyle(
                        color: context.cTextPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 10),
              _InfoCard(children: [
                _InfoRow(Icons.business, 'Company', dealer.companyName),
                _InfoRow(Icons.receipt, 'GST Number', dealer.gstNumber),
                _InfoRow(Icons.phone, 'Phone', dealer.phone),
                _InfoRow(Icons.location_on_outlined, 'City', '${dealer.city}, ${dealer.state}'),
                _InfoRow(Icons.pin_drop_outlined, 'Pincode', dealer.pincode),
              ]),
              const SizedBox(height: 16),
              _InfoCard(children: [
                _InfoRow(Icons.account_balance_wallet_outlined, 'Credit Limit',
                    formatCurrency(dealer.creditLimit)),
              ]),
            ],

            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Account',
                  style: TextStyle(
                      color: context.cTextPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 10),
            _ActionTile(
              icon: Icons.lock_outline,
              label: 'Change Password',
              onTap: () {},
            ),
            const SizedBox(height: 8),
            _ActionTile(
              icon: Icons.help_outline,
              label: 'Support',
              onTap: () {},
            ),
            const SizedBox(height: 8),
            _ActionTile(
              icon: Icons.logout,
              label: 'Sign Out',
              color: AppColors.error,
              onTap: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              },
            ),
            const SizedBox(height: 32),
            Text(
              'MOTOXPLUS India Pvt. Ltd.\nDealer Mobile App v1.0.0',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.cTextMuted, fontSize: 11),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: context.cBgCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: context.cBorder),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: context.cTextMuted),
          const SizedBox(width: 12),
          SizedBox(
            width: 100,
            child: Text(label,
                style: TextStyle(color: context.cTextMuted, fontSize: 12)),
          ),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    color: context.cTextPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: context.cBgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: context.cBorder),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color ?? context.cTextSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      color: color ?? context.cTextPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600)),
            ),
            Icon(Icons.chevron_right, size: 18, color: context.cTextMuted),
          ],
        ),
      ),
    );
  }
}
