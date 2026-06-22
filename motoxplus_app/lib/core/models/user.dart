class User {
  final String id;
  final String? name;
  final String email;
  final String role;
  final bool isActive;
  final String? mobileNumber;
  final bool mobileVerified;

  const User({
    required this.id,
    this.name,
    required this.email,
    required this.role,
    required this.isActive,
    this.mobileNumber,
    required this.mobileVerified,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: j['name'] as String?,
        email: j['email'] as String,
        role: j['role'] as String,
        isActive: j['isActive'] as bool? ?? true,
        mobileNumber: j['mobileNumber'] as String?,
        mobileVerified: j['mobileVerified'] as bool? ?? false,
      );
}

class Dealer {
  final String id;
  final String companyName;
  final String ownerName;
  final String phone;
  final String state;
  final String city;
  final String address;
  final String pincode;
  final String gstNumber;
  final String status;
  final double creditLimit;

  const Dealer({
    required this.id,
    required this.companyName,
    required this.ownerName,
    required this.phone,
    required this.state,
    required this.city,
    required this.address,
    required this.pincode,
    required this.gstNumber,
    required this.status,
    required this.creditLimit,
  });

  factory Dealer.fromJson(Map<String, dynamic> j) => Dealer(
        id: j['id'] as String,
        companyName: j['companyName'] as String,
        ownerName: j['ownerName'] as String,
        phone: j['phone'] as String,
        state: j['state'] as String,
        city: j['city'] as String,
        address: j['address'] as String,
        pincode: j['pincode'] as String,
        gstNumber: j['gstNumber'] as String,
        status: j['status'] as String,
        creditLimit: (j['creditLimit'] as num?)?.toDouble() ?? 0,
      );
}
