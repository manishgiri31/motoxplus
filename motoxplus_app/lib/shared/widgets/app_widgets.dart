import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';

final _currencyFmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);

String formatCurrency(double amount) => _currencyFmt.format(amount);
String formatDate(DateTime dt) => DateFormat('dd MMM yyyy').format(dt);

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  const AppCard({super.key, required this.child, this.padding, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: context.cBgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: context.cBorder),
        ),
        child: child,
      ),
    );
  }
}

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Color? color;
  final Widget? icon;

  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.color,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color ?? AppColors.primary,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[icon!, const SizedBox(width: 8)],
                  Text(label.toUpperCase(),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13, letterSpacing: 0.8)),
                ],
              ),
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color bgColor;

  const StatusBadge({super.key, required this.label, required this.color, required this.bgColor});

  factory StatusBadge.fromStatus(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'APPROVED':
      case 'DELIVERED':
      case 'PAID':
      case 'IN_STOCK':
        return StatusBadge(
            label: status,
            color: AppColors.success,
            bgColor: AppColors.success.withValues(alpha: 0.15));
      case 'PENDING':
      case 'PROCESSING':
        return StatusBadge(
            label: status,
            color: AppColors.warning,
            bgColor: AppColors.warning.withValues(alpha: 0.15));
      case 'CANCELLED':
      case 'REJECTED':
      case 'FAILED':
      case 'OUT_OF_STOCK':
        return StatusBadge(
            label: status, color: AppColors.error, bgColor: AppColors.error.withValues(alpha: 0.15));
      default:
        return StatusBadge(
            label: status,
            color: AppColors.textSecondary,
            bgColor: AppColors.textSecondary.withValues(alpha: 0.1));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(4)),
      child: Text(
        label.replaceAll('_', ' '),
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class ProductImageWidget extends StatelessWidget {
  final String? imageUrl;
  final double? height;

  const ProductImageWidget({super.key, this.imageUrl, this.height});

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      height: height ?? 140,
      color: context.cBgCard,
      child: Center(
        child: Icon(Icons.image_outlined, color: context.cBorder, size: 40),
      ),
    );
    if (imageUrl == null || imageUrl!.isEmpty) return placeholder;
    return CachedNetworkImage(
      imageUrl: imageUrl!,
      height: height ?? 140,
      width: double.infinity,
      fit: BoxFit.cover,
      placeholder: (_, _) => Shimmer.fromColors(
        baseColor: context.cBgCard,
        highlightColor: context.isDark ? AppColors.bgCardHover : const Color(0xFFEEEEEE),
        child: Container(height: height ?? 140, color: context.cBgCard),
      ),
      errorWidget: (_, _, _) => placeholder,
    );
  }
}

class ShimmerCard extends StatelessWidget {
  const ShimmerCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: context.cBgCard,
      highlightColor: context.isDark ? AppColors.bgCardHover : const Color(0xFFEEEEEE),
      child: Container(
        height: 220,
        decoration: BoxDecoration(
          color: context.cBgCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: context.cBorder),
        ),
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;

  const SectionHeader({super.key, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  color: context.cTextPrimary, fontSize: 22, fontWeight: FontWeight.w900)),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(subtitle!,
                  style: TextStyle(color: context.cTextMuted, fontSize: 13)),
            ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final String message;
  final IconData icon;
  final VoidCallback? onAction;
  final String? actionLabel;

  const EmptyState({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.onAction,
    this.actionLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 48, color: context.cTextMuted),
            const SizedBox(height: 16),
            Text(message,
                textAlign: TextAlign.center,
                style: TextStyle(color: context.cTextMuted, fontSize: 14)),
            if (onAction != null && actionLabel != null) ...[
              const SizedBox(height: 20),
              SizedBox(
                width: 160,
                child: AppButton(label: actionLabel!, onPressed: onAction),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
