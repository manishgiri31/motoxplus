-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GUEST', 'DEALER', 'ADMIN', 'SUPER_ADMIN', 'VENDOR', 'STAFF', 'SALES', 'SUPPORT', 'PRODUCTION', 'DISPATCH', 'ACCOUNTS', 'MARKETING');

-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('EMAIL_VERIFICATION', 'MOBILE_VERIFICATION', 'LOGIN', 'FORGOT_PASSWORD');

-- CreateEnum
CREATE TYPE "StaffDepartment" AS ENUM ('SALES', 'MARKETING', 'PRODUCTION', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE_20', 'FULL_100', 'COD');

-- CreateEnum
CREATE TYPE "DealerDocumentType" AS ENUM ('GST_CERTIFICATE', 'PAN_CARD', 'BUSINESS_REGISTRATION', 'SHOP_IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('RAW_MATERIALS', 'PACKAGING', 'PRINTING', 'LOGISTICS', 'MANUFACTURING_COMPONENTS', 'TOOLING', 'SERVICES');

-- CreateEnum
CREATE TYPE "VendorDocumentType" AS ENUM ('GST_CERTIFICATE', 'PAN_CARD', 'BUSINESS_REGISTRATION', 'BANK_STATEMENT', 'CANCELLED_CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'NEGOTIATION', 'CONVERTED', 'LOST', 'DORMANT');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'REFERRAL', 'TRADE_SHOW', 'COLD_CALL', 'SOCIAL_MEDIA', 'WHATSAPP', 'WALK_IN', 'OTHER', 'ADVERTISEMENT');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'MANIFESTED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UpiSubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DirectPaymentMethod" AS ENUM ('UPI', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('MOTORCYCLE', 'SCOOTER', 'ELECTRIC', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "EmissionStandard" AS ENUM ('BS3', 'BS4', 'BS6', 'BS6_PHASE2');

-- CreateEnum
CREATE TYPE "CompatibilityConfidence" AS ENUM ('VERIFIED', 'LIKELY', 'UNVERIFIED', 'INCOMPATIBLE');

-- CreateEnum
CREATE TYPE "CompatibilitySource" AS ENUM ('MANUAL', 'OEM_CATALOG', 'IMPORTED', 'LEGACY_STRING', 'AI_INFERRED');

-- CreateEnum
CREATE TYPE "VehicleModelFormat" AS ENUM ('GLB', 'GLTF', 'USDZ');

-- CreateEnum
CREATE TYPE "VehicleDetectionInput" AS ENUM ('IMAGE', 'OCR_TEXT', 'VIN', 'PLATE', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'DEALER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "department" "StaffDepartment",
    "mobileNumber" TEXT,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "mobileVerifiedAt" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "accountLockedUntil" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginIP" TEXT,
    "lastDevice" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "method" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "companyAddress" TEXT,
    "shopAddress" TEXT,
    "pincode" TEXT,
    "gstVerified" BOOLEAN NOT NULL DEFAULT false,
    "gstVerifiedAt" TIMESTAMP(3),
    "status" "DealerStatus" NOT NULL DEFAULT 'PENDING',
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,
    "mrp" DOUBLE PRECISION,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "images" TEXT[],
    "compatibility" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'MOTOXPLUS',
    "countryOfOrigin" TEXT NOT NULL DEFAULT 'India',
    "hsnCode" TEXT NOT NULL DEFAULT '',
    "oemNumber" TEXT,
    "packageHeight" DOUBLE PRECISION,
    "packageLength" DOUBLE PRECISION,
    "packageWeight" DOUBLE PRECISION,
    "packageWidth" DOUBLE PRECISION,
    "warranty" TEXT NOT NULL DEFAULT 'No Warranty',
    "vendorId" TEXT,
    "vendorCostPrice" DOUBLE PRECISION,
    "markupPercent" DOUBLE PRECISION,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "partNumber" TEXT,
    "color" TEXT,
    "vehicleModel" TEXT,
    "finish" TEXT,
    "size" TEXT,
    "extra" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "mrp" DOUBLE PRECISION,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "moq" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantImage" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT NOT NULL DEFAULT '',
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "mediumUrl" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "thumbnailUrl" TEXT,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerDocument" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "documentType" "DealerDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "shippingAddress" TEXT,
    "deliveryName" TEXT,
    "deliveryPhone" TEXT,
    "deliveryCity" TEXT,
    "deliveryState" TEXT,
    "deliveryPincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "variantLabel" TEXT,
    "variantSku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentType" "PaymentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "vendorCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "gstVerified" BOOLEAN NOT NULL DEFAULT false,
    "gstVerifiedAt" TIMESTAMP(3),
    "category" "VendorCategory" NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "creditDays" INTEGER NOT NULL DEFAULT 30,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDocument" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentType" "VendorDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "key" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRating" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "ratedById" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL,
    "deliveryScore" DOUBLE PRECISION NOT NULL,
    "priceScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseOrderId" TEXT,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "estimatedUnitPrice" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "vendorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "termsAndConditions" TEXT,
    "vendorNotes" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceivedNote" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedByName" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "qualityStatus" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceivedNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceivedItem" (
    "id" TEXT NOT NULL,
    "goodsReceivedNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL,
    "acceptedQuantity" INTEGER NOT NULL,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,

    CONSTRAINT "GoodsReceivedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "convertedAt" TIMESTAMP(3),
    "dealerId" TEXT,
    "lostReason" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "nextFollowUp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "alternatePhone" TEXT,
    "designation" TEXT,
    "pincode" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" TEXT,
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "waybill" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingUrl" TEXT,
    "expectedDelivery" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "pickupDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentTrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "activity" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "states" TEXT[],
    "minWeight" DOUBLE PRECISION NOT NULL,
    "maxWeight" DOUBLE PRECISION NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "perKgRate" DOUBLE PRECISION NOT NULL,
    "baseWeight" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gstin" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "paymentMethod" "DirectPaymentMethod" NOT NULL,
    "utrNumber" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerEmail" TEXT NOT NULL,
    "payerPhone" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "screenshotKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "UpiSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "ipAddress" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleManufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "wmi" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleManufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "engineCc" DOUBLE PRECISION,
    "launchYear" INTEGER,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "heroImage" TEXT,
    "power" TEXT,
    "torque" TEXT,
    "mileage" TEXT,
    "weight" TEXT,
    "fuelTank" TEXT,
    "modelUrl" TEXT,
    "searchAliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ocrKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "badgeText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleColor" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "oemColorId" TEXT,

    CONSTRAINT "VehicleColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGallery" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VehicleGallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePartSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePartSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGeneration" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codeName" TEXT,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleVariant" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "generationId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "emissionStandard" "EmissionStandard",
    "brakeType" TEXT,
    "startType" TEXT,
    "transmission" TEXT,
    "fuelType" TEXT,
    "engineCc" DOUBLE PRECISION,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "chassisPrefix" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OemColor" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorCode" TEXT,
    "paintCode" TEXT,
    "hex" TEXT NOT NULL,
    "finish" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OemColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "generationId" TEXT,
    "variantId" TEXT,
    "sectionId" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "emissionStandard" "EmissionStandard",
    "position" TEXT,
    "confidence" "CompatibilityConfidence" NOT NULL DEFAULT 'VERIFIED',
    "confidenceScore" DOUBLE PRECISION,
    "source" "CompatibilitySource" NOT NULL DEFAULT 'MANUAL',
    "fitmentNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel3D" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "variantId" TEXT,
    "colorId" TEXT,
    "format" "VehicleModelFormat" NOT NULL DEFAULT 'GLB',
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleModel3D_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSpin" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "variantId" TEXT,
    "colorId" TEXT,
    "frameUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleSpin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDiagram" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "generationId" TEXT,
    "sectionId" TEXT,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDiagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDiagramHotspot" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "calloutNumber" INTEGER,
    "sectionId" TEXT,
    "productId" TEXT,
    "compatibilityId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDiagramHotspot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleVinPattern" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "vehicleId" TEXT,
    "variantId" TEXT,
    "wmi" TEXT NOT NULL,
    "vdsPattern" TEXT,
    "yearCode" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleVinPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDetectionLog" (
    "id" TEXT NOT NULL,
    "inputType" "VehicleDetectionInput" NOT NULL,
    "rawInput" TEXT,
    "imageUrl" TEXT,
    "detectedVehicleId" TEXT,
    "detectedVariantId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "alternatives" JSONB,
    "method" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDetectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "productId" TEXT,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAccessory" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleProductRecommendation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleProductRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleFAQ" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleFAQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDownload" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'pdf',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDownload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobileNumber_key" ON "User"("mobileNumber");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_userId_type_used_idx" ON "OtpCode"("userId", "type", "used");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshToken_key" ON "UserSession"("refreshToken");

-- CreateIndex
CREATE INDEX "UserSession_userId_isActive_idx" ON "UserSession"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_userId_key" ON "Dealer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_gstNumber_key" ON "Dealer"("gstNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_partNumber_key" ON "Product"("partNumber");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_isActive_createdAt_idx" ON "Product"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex
CREATE INDEX "Product_stock_idx" ON "Product"("stock");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DealerDocument_dealerId_documentType_key" ON "DealerDocument"("dealerId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_dealerId_key" ON "Cart"("dealerId");

-- CreateIndex
CREATE INDEX "Cart_updatedAt_idx" ON "Cart"("updatedAt");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_dealerId_status_idx" ON "Order"("dealerId", "status");

-- CreateIndex
CREATE INDEX "Order_dealerId_createdAt_idx" ON "Order"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_key" ON "Vendor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_email_key" ON "Vendor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_gstNumber_key" ON "Vendor"("gstNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VendorRating_vendorId_period_key" ON "VendorRating"("vendorId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_requestNumber_key" ON "PurchaseRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_purchaseRequestId_key" ON "PurchaseOrder"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceivedNote_grnNumber_key" ON "GoodsReceivedNote"("grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_dealerId_key" ON "Lead"("dealerId");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_status_idx" ON "Lead"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Lead_nextFollowUp_idx" ON "Lead"("nextFollowUp");

-- CreateIndex
CREATE INDEX "Lead_priority_status_idx" ON "Lead"("priority", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_waybill_key" ON "Shipment"("waybill");

-- CreateIndex
CREATE INDEX "PaymentSubmission_status_createdAt_idx" ON "PaymentSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_dealerId_idx" ON "PaymentSubmission"("dealerId");

-- CreateIndex
CREATE INDEX "PaymentSubmission_orderId_idx" ON "PaymentSubmission"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSubmission_utrNumber_key" ON "PaymentSubmission"("utrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleManufacturer_name_key" ON "VehicleManufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleManufacturer_slug_key" ON "VehicleManufacturer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");

-- CreateIndex
CREATE INDEX "Vehicle_category_isActive_idx" ON "Vehicle"("category", "isActive");

-- CreateIndex
CREATE INDEX "Vehicle_manufacturerId_idx" ON "Vehicle"("manufacturerId");

-- CreateIndex
CREATE INDEX "VehicleColor_vehicleId_idx" ON "VehicleColor"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleColor_oemColorId_idx" ON "VehicleColor"("oemColorId");

-- CreateIndex
CREATE INDEX "VehicleGallery_vehicleId_idx" ON "VehicleGallery"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePartSection_name_key" ON "VehiclePartSection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePartSection_slug_key" ON "VehiclePartSection"("slug");

-- CreateIndex
CREATE INDEX "VehiclePartSection_isActive_sortOrder_idx" ON "VehiclePartSection"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "VehicleGeneration_vehicleId_isActive_idx" ON "VehicleGeneration"("vehicleId", "isActive");

-- CreateIndex
CREATE INDEX "VehicleVariant_generationId_idx" ON "VehicleVariant"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleVariant_vehicleId_slug_key" ON "VehicleVariant"("vehicleId", "slug");

-- CreateIndex
CREATE INDEX "OemColor_manufacturerId_isActive_idx" ON "OemColor"("manufacturerId", "isActive");

-- CreateIndex
CREATE INDEX "ProductCompatibility_productId_idx" ON "ProductCompatibility"("productId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_vehicleId_idx" ON "ProductCompatibility"("vehicleId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_variantId_idx" ON "ProductCompatibility"("variantId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_sectionId_idx" ON "ProductCompatibility"("sectionId");

-- CreateIndex
CREATE INDEX "VehicleModel3D_vehicleId_idx" ON "VehicleModel3D"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleSpin_vehicleId_idx" ON "VehicleSpin"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleDiagram_vehicleId_idx" ON "VehicleDiagram"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleDiagramHotspot_diagramId_idx" ON "VehicleDiagramHotspot"("diagramId");

-- CreateIndex
CREATE INDEX "VehicleVinPattern_wmi_idx" ON "VehicleVinPattern"("wmi");

-- CreateIndex
CREATE INDEX "VehicleDetectionLog_detectedVehicleId_idx" ON "VehicleDetectionLog"("detectedVehicleId");

-- CreateIndex
CREATE INDEX "VehicleDetectionLog_createdAt_idx" ON "VehicleDetectionLog"("createdAt");

-- CreateIndex
CREATE INDEX "Review_vehicleId_isApproved_idx" ON "Review"("vehicleId", "isApproved");

-- CreateIndex
CREATE INDEX "Review_productId_isApproved_idx" ON "Review"("productId", "isApproved");

-- CreateIndex
CREATE INDEX "VehicleAccessory_vehicleId_sortOrder_idx" ON "VehicleAccessory"("vehicleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleAccessory_vehicleId_productId_key" ON "VehicleAccessory"("vehicleId", "productId");

-- CreateIndex
CREATE INDEX "VehicleProductRecommendation_vehicleId_priority_idx" ON "VehicleProductRecommendation"("vehicleId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleProductRecommendation_vehicleId_productId_key" ON "VehicleProductRecommendation"("vehicleId", "productId");

-- CreateIndex
CREATE INDEX "VehicleFAQ_vehicleId_isActive_sortOrder_idx" ON "VehicleFAQ"("vehicleId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "VehicleDownload_vehicleId_isActive_sortOrder_idx" ON "VehicleDownload"("vehicleId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantImage" ADD CONSTRAINT "VariantImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerDocument" ADD CONSTRAINT "DealerDocument_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDocument" ADD CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRating" ADD CONSTRAINT "VendorRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedNote" ADD CONSTRAINT "GoodsReceivedNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceivedItem" ADD CONSTRAINT "GoodsReceivedItem_goodsReceivedNoteId_fkey" FOREIGN KEY ("goodsReceivedNoteId") REFERENCES "GoodsReceivedNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentTrackingEvent" ADD CONSTRAINT "ShipmentTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "VehicleManufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleColor" ADD CONSTRAINT "VehicleColor_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleColor" ADD CONSTRAINT "VehicleColor_oemColorId_fkey" FOREIGN KEY ("oemColorId") REFERENCES "OemColor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleGallery" ADD CONSTRAINT "VehicleGallery_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleGeneration" ADD CONSTRAINT "VehicleGeneration_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVariant" ADD CONSTRAINT "VehicleVariant_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVariant" ADD CONSTRAINT "VehicleVariant_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OemColor" ADD CONSTRAINT "OemColor_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "VehicleManufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VehiclePartSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleModel3D" ADD CONSTRAINT "VehicleModel3D_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleModel3D" ADD CONSTRAINT "VehicleModel3D_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleModel3D" ADD CONSTRAINT "VehicleModel3D_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "VehicleColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpin" ADD CONSTRAINT "VehicleSpin_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpin" ADD CONSTRAINT "VehicleSpin_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpin" ADD CONSTRAINT "VehicleSpin_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "VehicleColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagram" ADD CONSTRAINT "VehicleDiagram_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagram" ADD CONSTRAINT "VehicleDiagram_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagram" ADD CONSTRAINT "VehicleDiagram_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VehiclePartSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagramHotspot" ADD CONSTRAINT "VehicleDiagramHotspot_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "VehicleDiagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagramHotspot" ADD CONSTRAINT "VehicleDiagramHotspot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VehiclePartSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagramHotspot" ADD CONSTRAINT "VehicleDiagramHotspot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDiagramHotspot" ADD CONSTRAINT "VehicleDiagramHotspot_compatibilityId_fkey" FOREIGN KEY ("compatibilityId") REFERENCES "ProductCompatibility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVinPattern" ADD CONSTRAINT "VehicleVinPattern_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "VehicleManufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVinPattern" ADD CONSTRAINT "VehicleVinPattern_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleVinPattern" ADD CONSTRAINT "VehicleVinPattern_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDetectionLog" ADD CONSTRAINT "VehicleDetectionLog_detectedVehicleId_fkey" FOREIGN KEY ("detectedVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDetectionLog" ADD CONSTRAINT "VehicleDetectionLog_detectedVariantId_fkey" FOREIGN KEY ("detectedVariantId") REFERENCES "VehicleVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAccessory" ADD CONSTRAINT "VehicleAccessory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAccessory" ADD CONSTRAINT "VehicleAccessory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProductRecommendation" ADD CONSTRAINT "VehicleProductRecommendation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProductRecommendation" ADD CONSTRAINT "VehicleProductRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFAQ" ADD CONSTRAINT "VehicleFAQ_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDownload" ADD CONSTRAINT "VehicleDownload_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

