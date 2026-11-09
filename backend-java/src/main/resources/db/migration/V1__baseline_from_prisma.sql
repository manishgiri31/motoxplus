-- BASELINE: the schema as built by Prisma's 17 migrations (prisma/migrations), concatenated in order.
-- On an EXISTING database this file is never executed: Flyway records it as already applied (baseline-version=1)
-- after BaselineGuard confirms Prisma's _prisma_migrations lists every migration below. It runs only on an empty DB.
-- Do not edit. Schema changes from now on are new V2+ files; Prisma migrations are frozen.

-- ===== prisma/migrations/0_init =====
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


-- ===== prisma/migrations/20260723140000_add_product_slug =====
-- Add the column as nullable first so existing rows aren't rejected before backfill runs.
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;

-- Backfill: derive a base slug from the product name (lowercase, non-alphanumeric
-- runs collapsed to a single hyphen, leading/trailing hyphens trimmed — mirrors
-- src/lib/slug.ts#slugify), then disambiguate collisions by appending the row's
-- rank within that base slug (2, 3, ...) so results stay both short and unique.
WITH base AS (
  SELECT
    id,
    NULLIF(trim(both '-' from regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')), '') AS base_slug
  FROM "Product"
),
ranked AS (
  SELECT
    id,
    COALESCE(base_slug, 'product') AS base_slug,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(base_slug, 'product') ORDER BY id) AS rn
  FROM base
)
UPDATE "Product" p
SET slug = CASE WHEN r.rn = 1 THEN r.base_slug ELSE r.base_slug || '-' || r.rn END
FROM ranked r
WHERE p.id = r.id;

-- Enforce the column going forward.
ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- ===== prisma/migrations/20260725120000_add_vehicle_type =====
-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "heroImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_category_key" ON "VehicleType"("category");

-- ===== prisma/migrations/20260728000000_order_cancellation =====
-- CreateEnum
CREATE TYPE "CancelReasonCode" AS ENUM ('CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'FOUND_BETTER_PRICE', 'DELIVERY_TOO_SLOW', 'OTHER');

-- CreateEnum
CREATE TYPE "CancelActor" AS ENUM ('DEALER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NOT_APPLICABLE', 'INITIATED', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stockReserved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrderCancellation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus" NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "amountPaidAtCancellation" DOUBLE PRECISION NOT NULL,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "reasonCode" "CancelReasonCode" NOT NULL,
    "reason" VARCHAR(500),
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledByUserId" TEXT NOT NULL,
    "cancelledByRole" "CancelActor" NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "refundId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundError" TEXT,

    CONSTRAINT "OrderCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "actorId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderCancellation_orderId_key" ON "OrderCancellation"("orderId");

-- CreateIndex
CREATE INDEX "OrderCancellation_refundStatus_idx" ON "OrderCancellation"("refundStatus");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderCancellation" ADD CONSTRAINT "OrderCancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===== prisma/migrations/20260730000000_cancellation_policy_and_waiver =====
-- AlterTable
ALTER TABLE "OrderCancellation" ADD COLUMN     "waived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waivedByUserId" TEXT,
ADD COLUMN     "waivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL,
    "preShipChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "postShipChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- ===== prisma/migrations/20260829000000_dealer_no_approval_default_active =====
-- Dealers no longer require admin approval at sign-up: new dealer accounts are
-- ACTIVE immediately. Admin retains the ability to SUSPEND / re-ACTIVATE.

-- AlterTable
ALTER TABLE "Dealer" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Promote any dealer left waiting in the old approval queue to ACTIVE.
UPDATE "Dealer" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING';

-- ===== prisma/migrations/20260829120000_add_device_token =====
-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_dealerId_idx" ON "DeviceToken"("dealerId");

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== prisma/migrations/20260914000000_product_stock_status =====
-- CreateEnum
CREATE TYPE "ProductStockStatus" AS ENUM ('IN_STOCK', 'FEW_LEFT', 'OUT_OF_STOCK');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stockStatus" "ProductStockStatus" NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE "Product" ALTER COLUMN "stock" DROP NOT NULL;

-- Backfill stockStatus from the existing numeric stock (stock is deprecated but
-- still present so old rows classify correctly instead of all landing on the
-- column default): >10 -> IN_STOCK, 1-10 -> FEW_LEFT, 0 -> OUT_OF_STOCK.
UPDATE "Product" SET "stockStatus" = CASE
  WHEN "stock" > 10 THEN 'IN_STOCK'::"ProductStockStatus"
  WHEN "stock" >= 1 THEN 'FEW_LEFT'::"ProductStockStatus"
  ELSE 'OUT_OF_STOCK'::"ProductStockStatus"
END;

-- DropIndex
DROP INDEX "Product_stock_idx";

-- CreateIndex
CREATE INDEX "Product_stockStatus_idx" ON "Product"("stockStatus");

-- ===== prisma/migrations/20260915000000_gst_benefit_scheme =====
-- CreateEnum
CREATE TYPE "SchemeRedemptionStatus" AS ENUM ('ACTIVE', 'ADJUSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealerDuesReason" AS ENUM ('SCHEME_SHORTFALL', 'COLLECTED_AT_CHECKOUT', 'ADMIN_ADJUSTMENT', 'ADMIN_WAIVER');

-- AlterEnum
-- New value only — no existing OrderStatus row is touched, nothing in this
-- migration reads/writes the new value, so it's safe to add inside the same
-- transaction as everything else here (Postgres 12+: ALTER TYPE ... ADD
-- VALUE is transactional as long as the new value isn't used in that same
-- transaction, which it isn't).
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_CANCELLED';

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "schemeId" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "isSchemeItem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "schemeBenefitValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "schemeAdjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "duesCollected" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "outstandingDues" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "isSchemeItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "schemeDiscountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dealerPriceAtOrder" DOUBLE PRECISION,
ADD COLUMN     "cancelledQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderCancellation" ADD COLUMN     "schemeAdjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "benefitPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "minOrderValue" DOUBLE PRECISION NOT NULL,
    "maxBenefitValue" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeRedemption" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "benefitValue" DOUBLE PRECISION NOT NULL,
    "itemsValue" DOUBLE PRECISION NOT NULL,
    "status" "SchemeRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemCancellation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "schemeAdjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "reasonCode" "CancelReasonCode" NOT NULL,
    "reason" VARCHAR(500),
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledByUserId" TEXT NOT NULL,
    "cancelledByRole" "CancelActor" NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "refundId" TEXT,

    CONSTRAINT "OrderItemCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerDuesEntry" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reason" "DealerDuesReason" NOT NULL,
    "orderId" TEXT,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByRole" "CancelActor" NOT NULL,

    CONSTRAINT "DealerDuesEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeCategory" (
    "schemeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "SchemeCategory_pkey" PRIMARY KEY ("schemeId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");

-- CreateIndex
CREATE INDEX "Scheme_isActive_startsAt_endsAt_idx" ON "Scheme"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeRedemption_orderId_key" ON "SchemeRedemption"("orderId");

-- CreateIndex
CREATE INDEX "SchemeRedemption_schemeId_idx" ON "SchemeRedemption"("schemeId");

-- CreateIndex
CREATE INDEX "OrderItemCancellation_orderId_idx" ON "OrderItemCancellation"("orderId");

-- CreateIndex
CREATE INDEX "OrderItemCancellation_orderItemId_idx" ON "OrderItemCancellation"("orderItemId");

-- CreateIndex
CREATE INDEX "SchemeCategory_categoryId_idx" ON "SchemeCategory"("categoryId");

-- CreateIndex
CREATE INDEX "DealerDuesEntry_dealerId_createdAt_idx" ON "DealerDuesEntry"("dealerId", "createdAt");

-- CreateIndex
CREATE INDEX "DealerDuesEntry_orderId_idx" ON "DealerDuesEntry"("orderId");

-- AddForeignKey
ALTER TABLE "SchemeRedemption" ADD CONSTRAINT "SchemeRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeRedemption" ADD CONSTRAINT "SchemeRedemption_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCancellation" ADD CONSTRAINT "OrderItemCancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCancellation" ADD CONSTRAINT "OrderItemCancellation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCategory" ADD CONSTRAINT "SchemeCategory_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCategory" ADD CONSTRAINT "SchemeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerDuesEntry" ADD CONSTRAINT "DealerDuesEntry_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerDuesEntry" ADD CONSTRAINT "DealerDuesEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== prisma/migrations/20260918000000_add_order_channel =====
-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('B2B', 'B2C');

-- AlterTable
-- Additive, no backfill statement needed: NOT NULL DEFAULT 'B2B' on ADD COLUMN
-- sets every existing row to 'B2B' in this same statement (Postgres 11+,
-- non-volatile constant default — no table rewrite/lock beyond the DDL
-- itself). Every Order placed through this app to date is a B2B dealer
-- order, so 'B2B' is not a placeholder — it is the correct historical value.
ALTER TABLE "Order" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'B2B';

-- AlterTable
-- Same reasoning as Order.channel above.
ALTER TABLE "Invoice" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'B2B';

-- ===== prisma/migrations/20260920000000_add_gst_split =====
-- AlterTable
-- Additive, no backfill needed: NOT NULL DEFAULT 0 sets every existing row's
-- cgst/sgst/igst to 0 in this same statement. Every Order placed to date
-- predates the GST split (lib/tax/gst-split.ts) — 0/0/0 alongside the
-- existing (unsplit) gstAmount is the correct historical value, not a
-- placeholder. placeOfSupply is nullable with no default for the same
-- reason: old orders never recorded one.
ALTER TABLE "Order" ADD COLUMN     "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "placeOfSupply" TEXT;

-- AlterTable
-- Same reasoning as Order's columns above.
ALTER TABLE "Invoice" ADD COLUMN     "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "placeOfSupply" TEXT;

-- ===== prisma/migrations/20260921000000_b2c_customer =====
-- AlterEnum
-- New value only; nothing in this migration reads/writes it, so it's safe in
-- the same transaction (Postgres 12+). Precedent: 20260915000000's
-- PARTIALLY_CANCELLED addition to OrderStatus.
ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER';

-- CreateTable
-- Thin B2C customer profile — name/phone/email live on User, same as Admin.
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Cart
-- Now has two possible owners (B2B dealer / B2C customer). dealerId's unique
-- index survives DROP NOT NULL unchanged; Postgres treats NULL <> NULL in a
-- unique index, so multiple customer-owned rows (dealerId NULL) coexist fine,
-- same for multiple dealer-owned rows (customerId NULL).
ALTER TABLE "Cart" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "Cart" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "Cart_customerId_key" ON "Cart"("customerId");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Every existing row has dealerId set and customerId NULL -> num_nonnulls = 1.
-- No backfill needed; the CHECK is satisfied by every current row as-is.
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- AlterTable: Order
ALTER TABLE "Order" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- AlterTable: Invoice
ALTER TABLE "Invoice" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- AlterTable: PaymentSubmission (B2C Direct UPI submissions)
ALTER TABLE "PaymentSubmission" ALTER COLUMN "dealerId" DROP NOT NULL;
ALTER TABLE "PaymentSubmission" ADD COLUMN "customerId" TEXT;
CREATE INDEX "PaymentSubmission_customerId_idx" ON "PaymentSubmission"("customerId");
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_owner_exactly_one" CHECK (num_nonnulls("dealerId", "customerId") = 1);

-- ===== prisma/migrations/20260921010000_product_price_charm_int =====
-- AlterTable: Product.price becomes a whole-rupee integer.
-- Charm-pricing convention tightened from "any odd whole rupee"
-- (fix-odd-prices.ts / seed-cables.ts) to "last digit is 3, 6, 7, or 9" —
-- snap every existing price to the nearest allowed value (ties broken
-- upward) before narrowing the column type, so no value is truncated.
-- Digit -> delta table mirrors src/lib/pricing/charm-price.ts.
UPDATE "Product" SET price = ROUND(price)::int + CASE ROUND(price)::int % 10
  WHEN 0 THEN -1
  WHEN 1 THEN 2
  WHEN 2 THEN 1
  WHEN 3 THEN 0
  WHEN 4 THEN -1
  WHEN 5 THEN 1
  WHEN 6 THEN 0
  WHEN 7 THEN 0
  WHEN 8 THEN 1
  WHEN 9 THEN 0
END;

ALTER TABLE "Product" ALTER COLUMN "price" TYPE INTEGER USING ROUND(price)::integer;

-- Same convention for ProductVariant.price — a variant is itself a
-- purchasable line item with its own price, so it must satisfy the same
-- invariant as Product.price.
UPDATE "ProductVariant" SET price = ROUND(price)::int + CASE ROUND(price)::int % 10
  WHEN 0 THEN -1
  WHEN 1 THEN 2
  WHEN 2 THEN 1
  WHEN 3 THEN 0
  WHEN 4 THEN -1
  WHEN 5 THEN 1
  WHEN 6 THEN 0
  WHEN 7 THEN 0
  WHEN 8 THEN 1
  WHEN 9 THEN 0
END;

ALTER TABLE "ProductVariant" ALTER COLUMN "price" TYPE INTEGER USING ROUND(price)::integer;

-- ===== prisma/migrations/20260921020000_add_product_source =====
-- AlterTable: tag every Product with where it actually came from.
-- `vendorId IS NULL` was being used as a stand-in for "our own catalog" in the
-- products-page sort, but it's also true of every eAuto-migrated product (they
-- never got a vendorId), so that sort was a no-op for the 6,852 eAuto rows.
--
-- Backfill order matters: VENDOR is decided by vendorId (authoritative, already
-- correct), then EAUTO_IMPORT is carved out of what's left by SKU range, and
-- everything else defaults to MOTOXPLUS via the column default.
--
-- Range is read from the numeric part of the SKU, not compared as a string —
-- 'MX-12372' sorts before 'MX-5521' lexically, which would silently misclassify
-- the whole 10000+ block. Only SKUs matching '^MX-[0-9]+$' are touched; other
-- prefixes (MX-CB..., MQX...) are intentionally left alone and fall through to
-- the MOTOXPLUS default.
CREATE TYPE "ProductSource" AS ENUM ('MOTOXPLUS', 'EAUTO_IMPORT', 'VENDOR');

ALTER TABLE "Product" ADD COLUMN "source" "ProductSource" NOT NULL DEFAULT 'MOTOXPLUS';

UPDATE "Product" SET source = 'VENDOR' WHERE "vendorId" IS NOT NULL;

UPDATE "Product" SET source = 'EAUTO_IMPORT'
WHERE "vendorId" IS NULL
  AND sku ~ '^MX-[0-9]+$'
  AND CAST(substring(sku from 'MX-([0-9]+)') AS INTEGER) BETWEEN 5521 AND 12372;

-- ===== prisma/migrations/20260922000000_add_pickup_request =====
-- CreateEnum
CREATE TYPE "PickupRequestStatus" AS ENUM ('PENDING', 'REQUESTED');

-- CreateTable
-- Additive: a new table, no existing rows or columns are touched.
CREATE TABLE "PickupRequest" (
    "id" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "warehouse" TEXT NOT NULL,
    "pickupDate" TEXT NOT NULL,
    "pickupTime" TEXT NOT NULL,
    "status" "PickupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "packageCount" INTEGER,
    "pickupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One pickup per channel + warehouse + day; also the claim lock.
CREATE UNIQUE INDEX "PickupRequest_channel_warehouse_pickupDate_key" ON "PickupRequest"("channel", "warehouse", "pickupDate");

-- ===== prisma/migrations/20261102000000_order_whatsapp_notification_flags =====
-- AlterTable
-- Additive: three nullable timestamps, no existing column is touched.
ALTER TABLE "Order" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "cancelNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "shippedNotifiedAt" TIMESTAMP(3);

-- Backfill: orders that are already past each stage are marked as handled so
-- turning WhatsApp notifications on doesn't send a late "shipped"/"cancelled"
-- message to customers whose order moved on before this feature existed (the
-- shipped trigger fires on every matching Delhivery scan, not only on the
-- first transition, so an un-backfilled in-transit order would be messaged on
-- its next scan).
UPDATE "Order" SET "confirmationSentAt" = "updatedAt" WHERE "status" <> 'PENDING';
UPDATE "Order" SET "shippedNotifiedAt" = "updatedAt" WHERE "status" IN ('SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED');
UPDATE "Order" SET "cancelNotifiedAt" = "updatedAt" WHERE "status" = 'CANCELLED';

-- ===== prisma/migrations/20261105000000_vendor_part_categories =====
-- Automotive parts catalogue for supplier (vendor) applications.
--
-- Additive only: no existing column, row or constraint is removed.
--   * "Category" becomes a two-level tree (nullable "parentId"). Existing categories stay
--     top-level and keep their names, slugs and products.
--   * "VendorPartCategory" links vendors to the categories they supply (structured ids,
--     not comma-separated text). A top-level category covers all of its subcategories.
--   * "Vendor"."category" (the old procurement segment enum) becomes nullable so existing
--     vendors keep their value and new applications no longer need one.

-- CreateEnum
CREATE TYPE "VehicleSegment" AS ENUM ('MOTORCYCLE', 'SCOOTER', 'THREE_WHEELER', 'PASSENGER_CAR', 'COMMERCIAL_VEHICLE', 'OTHER');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "vehicleSegments" "VehicleSegment"[] DEFAULT ARRAY[]::"VehicleSegment"[],
ALTER COLUMN "category" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VendorPartCategory" (
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPartCategory_pkey" PRIMARY KEY ("vendorId","categoryId")
);

-- CreateIndex
CREATE INDEX "VendorPartCategory_categoryId_idx" ON "VendorPartCategory"("categoryId");

-- CreateIndex
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPartCategory" ADD CONSTRAINT "VendorPartCategory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPartCategory" ADD CONSTRAINT "VendorPartCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the catalogue. Rows are database-managed from here on (Admin -> Categories).
--
-- An existing category is REUSED rather than duplicated when its slug (or a known alias
-- slug) or its name matches, so e.g. the live "Engine Parts", "Horns" and "Mudguard"
-- categories keep their products and storefront URLs. A reused category only gains a
-- parent (and its position in the group); its name, slug, description and status are
-- left alone. A reused category that already has subcategories is never nested.
DO $seed$
DECLARE
  r RECORD;
  existing_id TEXT;
  group_id TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    (1, 0, 'screws-nuts-fasteners', 'Screws, Nuts & Fasteners', NULL, ARRAY[]::text[]),
    (1, 1, 'screws', 'Screws', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 2, 'nuts', 'Nuts', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 3, 'bolts', 'Bolts', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 4, 'washers', 'Washers', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 5, 'clips', 'Clips', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 6, 'clamps', 'Clamps', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 7, 'studs', 'Studs', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 8, 'rivets', 'Rivets', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (1, 9, 'mounting-hardware', 'Mounting Hardware', 'screws-nuts-fasteners', ARRAY[]::text[]),
    (2, 0, 'engine-parts', 'Engine Parts', NULL, ARRAY[]::text[]),
    (2, 1, 'piston-piston-rings', 'Piston & Piston Rings', 'engine-parts', ARRAY[]::text[]),
    (2, 2, 'cylinder-block', 'Cylinder Block', 'engine-parts', ARRAY[]::text[]),
    (2, 3, 'cylinder-head', 'Cylinder Head', 'engine-parts', ARRAY[]::text[]),
    (2, 4, 'valves', 'Valves', 'engine-parts', ARRAY[]::text[]),
    (2, 5, 'camshaft', 'Camshaft', 'engine-parts', ARRAY[]::text[]),
    (2, 6, 'crankshaft', 'Crankshaft', 'engine-parts', ARRAY[]::text[]),
    (2, 7, 'gaskets', 'Gaskets', 'engine-parts', ARRAY[]::text[]),
    (2, 8, 'engine-bearings', 'Engine Bearings', 'engine-parts', ARRAY[]::text[]),
    (2, 9, 'timing-components', 'Timing Components', 'engine-parts', ARRAY[]::text[]),
    (3, 0, 'electrical-parts', 'Electrical Parts', NULL, ARRAY[]::text[]),
    (3, 1, 'wiring-harness', 'Wiring Harness', 'electrical-parts', ARRAY[]::text[]),
    (3, 2, 'ignition-coil', 'Ignition Coil', 'electrical-parts', ARRAY[]::text[]),
    (3, 3, 'cdi-units', 'CDI Units', 'electrical-parts', ARRAY[]::text[]),
    (3, 4, 'sensors', 'Sensors', 'electrical-parts', ARRAY[]::text[]),
    (3, 5, 'relays', 'Relays', 'electrical-parts', ARRAY[]::text[]),
    (3, 6, 'switches', 'Switches', 'electrical-parts', ARRAY[]::text[]),
    (3, 7, 'horns', 'Horns', 'electrical-parts', ARRAY[]::text[]),
    (3, 8, 'batteries', 'Batteries', 'electrical-parts', ARRAY[]::text[]),
    (3, 9, 'regulators', 'Regulators', 'electrical-parts', ARRAY[]::text[]),
    (3, 10, 'starter-motors', 'Starter Motors', 'electrical-parts', ARRAY[]::text[]),
    (4, 0, 'body-parts', 'Body Parts', NULL, ARRAY[]::text[]),
    (4, 1, 'mudguards', 'Mudguards', 'body-parts', ARRAY['mudguard']::text[]),
    (4, 2, 'side-panels', 'Side Panels', 'body-parts', ARRAY[]::text[]),
    (4, 3, 'fuel-tanks', 'Fuel Tanks', 'body-parts', ARRAY[]::text[]),
    (4, 4, 'headlight-visors', 'Headlight Visors', 'body-parts', ARRAY['head-light-visor']::text[]),
    (4, 5, 'side-covers', 'Side Covers', 'body-parts', ARRAY[]::text[]),
    (4, 6, 'front-panels', 'Front Panels', 'body-parts', ARRAY[]::text[]),
    (4, 7, 'rear-panels', 'Rear Panels', 'body-parts', ARRAY[]::text[]),
    (4, 8, 'number-plate-holders', 'Number Plate Holders', 'body-parts', ARRAY[]::text[]),
    (4, 9, 'body-fittings', 'Body Fittings', 'body-parts', ARRAY[]::text[]),
    (5, 0, 'brake-system', 'Brake System', NULL, ARRAY[]::text[]),
    (5, 1, 'brake-shoes', 'Brake Shoes', 'brake-system', ARRAY[]::text[]),
    (5, 2, 'brake-pads', 'Brake Pads', 'brake-system', ARRAY[]::text[]),
    (5, 3, 'brake-discs', 'Brake Discs', 'brake-system', ARRAY[]::text[]),
    (5, 4, 'master-cylinders', 'Master Cylinders', 'brake-system', ARRAY[]::text[]),
    (5, 5, 'brake-cables', 'Brake Cables', 'brake-system', ARRAY[]::text[]),
    (5, 6, 'brake-levers', 'Brake Levers', 'brake-system', ARRAY[]::text[]),
    (5, 7, 'brake-drums', 'Brake Drums', 'brake-system', ARRAY[]::text[]),
    (6, 0, 'suspension-steering', 'Suspension & Steering', NULL, ARRAY[]::text[]),
    (6, 1, 'front-forks', 'Front Forks', 'suspension-steering', ARRAY[]::text[]),
    (6, 2, 'rear-shock-absorbers', 'Rear Shock Absorbers', 'suspension-steering', ARRAY[]::text[]),
    (6, 3, 'suspension-springs', 'Suspension Springs', 'suspension-steering', ARRAY[]::text[]),
    (6, 4, 'steering-bearings', 'Steering Bearings', 'suspension-steering', ARRAY[]::text[]),
    (6, 5, 'handlebar-components', 'Handlebar Components', 'suspension-steering', ARRAY[]::text[]),
    (6, 6, 'suspension-bushes', 'Suspension Bushes', 'suspension-steering', ARRAY[]::text[]),
    (7, 0, 'cables-controls', 'Cables & Controls', NULL, ARRAY[]::text[]),
    (7, 1, 'accelerator-cables', 'Accelerator Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 2, 'clutch-cables', 'Clutch Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 3, 'speedometer-cables', 'Speedometer Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 4, 'front-brake-cables', 'Front Brake Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 5, 'decompression-cables', 'Decompression Cables', 'cables-controls', ARRAY[]::text[]),
    (7, 6, 'control-levers', 'Control Levers', 'cables-controls', ARRAY[]::text[]),
    (8, 0, 'bearings-transmission', 'Bearings & Transmission', NULL, ARRAY[]::text[]),
    (8, 1, 'ball-bearings', 'Ball Bearings', 'bearings-transmission', ARRAY[]::text[]),
    (8, 2, 'roller-bearings', 'Roller Bearings', 'bearings-transmission', ARRAY[]::text[]),
    (8, 3, 'clutch-assemblies', 'Clutch Assemblies', 'bearings-transmission', ARRAY[]::text[]),
    (8, 4, 'clutch-plates', 'Clutch Plates', 'bearings-transmission', ARRAY[]::text[]),
    (8, 5, 'chains', 'Chains', 'bearings-transmission', ARRAY[]::text[]),
    (8, 6, 'sprockets', 'Sprockets', 'bearings-transmission', ARRAY[]::text[]),
    (8, 7, 'gear-components', 'Gear Components', 'bearings-transmission', ARRAY[]::text[]),
    (9, 0, 'lighting-indicators', 'Lighting & Indicators', NULL, ARRAY[]::text[]),
    (9, 1, 'headlights', 'Headlights', 'lighting-indicators', ARRAY[]::text[]),
    (9, 2, 'tail-lights', 'Tail Lights', 'lighting-indicators', ARRAY[]::text[]),
    (9, 3, 'indicators', 'Indicators', 'lighting-indicators', ARRAY[]::text[]),
    (9, 4, 'led-lights', 'LED Lights', 'lighting-indicators', ARRAY[]::text[]),
    (9, 5, 'bulbs', 'Bulbs', 'lighting-indicators', ARRAY[]::text[]),
    (9, 6, 'reflectors', 'Reflectors', 'lighting-indicators', ARRAY[]::text[]),
    (10, 0, 'filters-fuel-system', 'Filters & Fuel System', NULL, ARRAY[]::text[]),
    (10, 1, 'air-filters', 'Air Filters', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 2, 'oil-filters', 'Oil Filters', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 3, 'fuel-filters', 'Fuel Filters', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 4, 'fuel-pumps', 'Fuel Pumps', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 5, 'carburetors', 'Carburetors', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 6, 'fuel-injectors', 'Fuel Injectors', 'filters-fuel-system', ARRAY[]::text[]),
    (10, 7, 'fuel-pipes', 'Fuel Pipes', 'filters-fuel-system', ARRAY[]::text[]),
    (11, 0, 'wheels-tyres', 'Wheels & Tyres', NULL, ARRAY[]::text[]),
    (11, 1, 'alloy-wheels', 'Alloy Wheels', 'wheels-tyres', ARRAY[]::text[]),
    (11, 2, 'wheel-hubs', 'Wheel Hubs', 'wheels-tyres', ARRAY[]::text[]),
    (11, 3, 'rims', 'Rims', 'wheels-tyres', ARRAY[]::text[]),
    (11, 4, 'tyres', 'Tyres', 'wheels-tyres', ARRAY[]::text[]),
    (11, 5, 'tubes', 'Tubes', 'wheels-tyres', ARRAY[]::text[]),
    (11, 6, 'wheel-accessories', 'Wheel Accessories', 'wheels-tyres', ARRAY[]::text[]),
    (12, 0, 'car-spare-parts', 'Car Spare Parts', NULL, ARRAY[]::text[]),
    (12, 1, 'car-engine-parts', 'Car Engine Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 2, 'car-electrical-parts', 'Car Electrical Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 3, 'car-body-parts', 'Car Body Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 4, 'car-brake-parts', 'Car Brake Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 5, 'car-suspension-parts', 'Car Suspension Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 6, 'car-steering-parts', 'Car Steering Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 7, 'car-transmission-parts', 'Car Transmission Parts', 'car-spare-parts', ARRAY[]::text[]),
    (12, 8, 'car-cooling-system', 'Car Cooling System', 'car-spare-parts', ARRAY[]::text[]),
    (12, 9, 'car-lighting', 'Car Lighting', 'car-spare-parts', ARRAY[]::text[]),
    (12, 10, 'car-filters', 'Car Filters', 'car-spare-parts', ARRAY[]::text[]),
    (12, 11, 'car-interior-accessories', 'Car Interior Accessories', 'car-spare-parts', ARRAY[]::text[]),
    (12, 12, 'car-exterior-accessories', 'Car Exterior Accessories', 'car-spare-parts', ARRAY[]::text[]),
    (13, 0, 'other-automotive-parts', 'Other Automotive Parts', NULL, ARRAY[]::text[]),
    (13, 1, 'accessories', 'Accessories', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 2, 'rubber-components', 'Rubber Components', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 3, 'plastic-components', 'Plastic Components', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 4, 'metal-components', 'Metal Components', 'other-automotive-parts', ARRAY[]::text[]),
    (13, 5, 'other-spare-parts', 'Other Spare Parts', 'other-automotive-parts', ARRAY[]::text[])
    ) AS t(group_pos, child_pos, slug, name, parent_slug, aliases)
    ORDER BY group_pos, child_pos
  LOOP
    SELECT c.id INTO existing_id
    FROM "Category" c
    WHERE c.slug = r.slug OR c.slug = ANY (r.aliases) OR lower(c.name) = lower(r.name)
    ORDER BY (c.slug = r.slug) DESC, c."createdAt" ASC
    LIMIT 1;

    IF r.parent_slug IS NULL THEN
      IF existing_id IS NULL THEN
        INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES ('cat_' || md5('part-category:' || r.slug), r.name, r.slug, r.group_pos, true, now(), now())
        RETURNING id INTO group_id;
      ELSE
        UPDATE "Category" SET "sortOrder" = r.group_pos, "updatedAt" = now()
        WHERE id = existing_id AND "parentId" IS NULL;
        group_id := existing_id;
      END IF;
    ELSE
      IF existing_id IS NULL THEN
        INSERT INTO "Category" (id, name, slug, "sortOrder", "isActive", "parentId", "createdAt", "updatedAt")
        VALUES ('cat_' || md5('part-category:' || r.slug), r.name, r.slug, r.child_pos, true, group_id, now(), now());
      ELSE
        UPDATE "Category" c SET "parentId" = group_id, "sortOrder" = r.child_pos, "updatedAt" = now()
        WHERE c.id = existing_id
          AND c.id <> group_id
          AND c."parentId" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "Category" k WHERE k."parentId" = c.id);
      END IF;
    END IF;
  END LOOP;
END
$seed$;
