import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/models/order.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

final _invoicesProvider = FutureProvider<List<Invoice>>((ref) async {
  final res = await ApiClient().dio.get('/orders');
  final orders = res.data as List<dynamic>;
  final invoices = <Invoice>[];
  for (final o in orders) {
    if (o['invoice'] != null) {
      invoices.add(Invoice.fromJson(o['invoice'] as Map<String, dynamic>));
    }
  }
  return invoices;
});

class InvoicesScreen extends ConsumerWidget {
  const InvoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoicesAsync = ref.watch(_invoicesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: invoicesAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (_, _) => const Center(
            child: Text('Failed to load invoices',
                style: TextStyle(color: AppColors.textMuted))),
        data: (invoices) {
          if (invoices.isEmpty) {
            return const EmptyState(
              message: 'No invoices yet.\nInvoices are generated after order delivery.',
              icon: Icons.description_outlined,
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(_invoicesProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: invoices.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _InvoiceCard(invoice: invoices[i]),
            ),
          );
        },
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  final Invoice invoice;
  const _InvoiceCard({required this.invoice});

  Future<void> _openPdf() async {
    if (invoice.pdfUrl == null) return;
    final uri = Uri.parse(invoice.pdfUrl!);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.receipt_long_outlined,
                color: AppColors.primary, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.invoiceNumber,
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(formatDate(invoice.issuedAt),
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Text(formatCurrency(invoice.grandTotal),
                    style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 14,
                        fontWeight: FontWeight.w900)),
              ],
            ),
          ),
          if (invoice.pdfUrl != null)
            IconButton(
              icon: const Icon(Icons.download_outlined, color: AppColors.primary),
              onPressed: _openPdf,
              tooltip: 'Download PDF',
            ),
        ],
      ),
    );
  }
}
