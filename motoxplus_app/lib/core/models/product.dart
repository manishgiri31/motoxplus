class ProductImage {
  final String id;
  final String imageUrl;
  final bool isPrimary;
  final int sortOrder;

  const ProductImage({
    required this.id,
    required this.imageUrl,
    required this.isPrimary,
    required this.sortOrder,
  });

  factory ProductImage.fromJson(Map<String, dynamic> j) => ProductImage(
        id: j['id'] as String,
        imageUrl: j['imageUrl'] as String,
        isPrimary: j['isPrimary'] as bool? ?? false,
        sortOrder: j['sortOrder'] as int? ?? 0,
      );
}

class Category {
  final String id;
  final String name;
  final String slug;

  const Category({required this.id, required this.name, required this.slug});

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
      );
}

class Product {
  final String id;
  final String name;
  final String sku;
  final String partNumber;
  final String? oemNumber;
  final double price;
  final double gstRate;
  final int moq;
  final List<String> images;
  final List<ProductImage> productImages;
  final int stock;
  final String? vendorId;
  final Category category;
  final String? description;
  final String brand;
  final String warranty;
  final List<String> compatibility;
  final String? hsnCode;

  const Product({
    required this.id,
    required this.name,
    required this.sku,
    required this.partNumber,
    this.oemNumber,
    required this.price,
    required this.gstRate,
    required this.moq,
    required this.images,
    required this.productImages,
    required this.stock,
    this.vendorId,
    required this.category,
    this.description,
    required this.brand,
    required this.warranty,
    required this.compatibility,
    this.hsnCode,
  });

  bool get isInStock => vendorId != null || stock > 0;

  String? get primaryImageUrl {
    if (productImages.isNotEmpty) {
      final primary = productImages.where((i) => i.isPrimary).firstOrNull;
      return (primary ?? productImages.first).imageUrl;
    }
    if (images.isNotEmpty) return images.first;
    return null;
  }

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as String,
        name: j['name'] as String,
        sku: j['sku'] as String,
        partNumber: j['partNumber'] as String,
        oemNumber: j['oemNumber'] as String?,
        price: (j['price'] as num).toDouble(),
        gstRate: (j['gstRate'] as num?)?.toDouble() ?? 18,
        moq: j['moq'] as int? ?? 1,
        images: (j['images'] as List<dynamic>?)?.cast<String>() ?? [],
        productImages: (j['productImages'] as List<dynamic>?)
                ?.map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        stock: j['stock'] as int? ?? 0,
        vendorId: j['vendorId'] as String?,
        category: Category.fromJson(j['category'] as Map<String, dynamic>),
        description: j['description'] as String?,
        brand: j['brand'] as String? ?? 'MOTOXPLUS',
        warranty: j['warranty'] as String? ?? 'No Warranty',
        compatibility: (j['compatibility'] as List<dynamic>?)?.cast<String>() ?? [],
        hsnCode: j['hsnCode'] as String?,
      );
}
