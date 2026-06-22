class OrderItem {
  final String id;
  final String productId;
  final int quantity;
  final double unitPrice;
  final double gstRate;
  final double gstAmount;
  final double total;
  final Map<String, dynamic>? product;

  const OrderItem({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    required this.gstRate,
    required this.gstAmount,
    required this.total,
    this.product,
  });

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'] as String,
        productId: j['productId'] as String,
        quantity: j['quantity'] as int,
        unitPrice: (j['unitPrice'] as num).toDouble(),
        gstRate: (j['gstRate'] as num).toDouble(),
        gstAmount: (j['gstAmount'] as num).toDouble(),
        total: (j['total'] as num).toDouble(),
        product: j['product'] as Map<String, dynamic>?,
      );
}

class Order {
  final String id;
  final String orderNumber;
  final double subtotal;
  final double gstAmount;
  final double shippingCost;
  final double grandTotal;
  final String paymentType;
  final double amountPaid;
  final double amountDue;
  final String status;
  final String paymentStatus;
  final String? notes;
  final String? shippingAddress;
  final String? deliveryName;
  final String? deliveryPhone;
  final String? deliveryCity;
  final String? deliveryState;
  final String? deliveryPincode;
  final DateTime createdAt;
  final List<OrderItem> items;

  const Order({
    required this.id,
    required this.orderNumber,
    required this.subtotal,
    required this.gstAmount,
    required this.shippingCost,
    required this.grandTotal,
    required this.paymentType,
    required this.amountPaid,
    required this.amountDue,
    required this.status,
    required this.paymentStatus,
    this.notes,
    this.shippingAddress,
    this.deliveryName,
    this.deliveryPhone,
    this.deliveryCity,
    this.deliveryState,
    this.deliveryPincode,
    required this.createdAt,
    required this.items,
  });

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as String,
        orderNumber: j['orderNumber'] as String,
        subtotal: (j['subtotal'] as num).toDouble(),
        gstAmount: (j['gstAmount'] as num).toDouble(),
        shippingCost: (j['shippingCost'] as num?)?.toDouble() ?? 0,
        grandTotal: (j['grandTotal'] as num).toDouble(),
        paymentType: j['paymentType'] as String,
        amountPaid: (j['amountPaid'] as num?)?.toDouble() ?? 0,
        amountDue: (j['amountDue'] as num).toDouble(),
        status: j['status'] as String,
        paymentStatus: j['paymentStatus'] as String,
        notes: j['notes'] as String?,
        shippingAddress: j['shippingAddress'] as String?,
        deliveryName: j['deliveryName'] as String?,
        deliveryPhone: j['deliveryPhone'] as String?,
        deliveryCity: j['deliveryCity'] as String?,
        deliveryState: j['deliveryState'] as String?,
        deliveryPincode: j['deliveryPincode'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
        items: (j['items'] as List<dynamic>?)
                ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class Invoice {
  final String id;
  final String invoiceNumber;
  final String orderId;
  final double subtotal;
  final double gstAmount;
  final double grandTotal;
  final String? pdfUrl;
  final DateTime issuedAt;

  const Invoice({
    required this.id,
    required this.invoiceNumber,
    required this.orderId,
    required this.subtotal,
    required this.gstAmount,
    required this.grandTotal,
    this.pdfUrl,
    required this.issuedAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> j) => Invoice(
        id: j['id'] as String,
        invoiceNumber: j['invoiceNumber'] as String,
        orderId: j['orderId'] as String,
        subtotal: (j['subtotal'] as num).toDouble(),
        gstAmount: (j['gstAmount'] as num).toDouble(),
        grandTotal: (j['grandTotal'] as num).toDouble(),
        pdfUrl: j['pdfUrl'] as String?,
        issuedAt: DateTime.parse(j['issuedAt'] as String),
      );
}
