import {
  LayoutDashboard,
  PackagePlus,
  ReceiptText,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Copy for the seller-acquisition page. Rules for anything added here: no commission rate, no payout
 * timeline, no approval timeline, no buyer/seller counts - none of those are published facts.
 */

export const BENEFITS: { Icon: LucideIcon; title: string; body: string }[] = [
  { Icon: Users, title: "Reach more buyers", body: "Connect with automotive dealers, retailers, workshops and customers." },
  { Icon: LayoutDashboard, title: "Your own seller dashboard", body: "Manage products, orders, pricing and inventory in one place." },
  { Icon: PackagePlus, title: "Easy product listing", body: "Upload products, images, SKUs and vehicle compatibility." },
  { Icon: Truck, title: "MotoXPlus-arranged shipping", body: "We coordinate shipping and tracking for your marketplace orders." },
  { Icon: ReceiptText, title: "Sales & payment tracking", body: "Monitor orders, commissions, settlements and sales performance." },
  { Icon: TrendingUp, title: "Business growth", body: "Expand your reach without building your own ecommerce infrastructure." },
];

export const VENDOR_TYPES = [
  { name: "Manufacturers", body: "Sell your own manufactured spare parts." },
  { name: "Wholesalers", body: "Expand your wholesale distribution." },
  { name: "Distributors", body: "Reach more dealers and retailers." },
  { name: "Stockists & suppliers", body: "Sell your available automotive spare-parts inventory." },
] as const;

export const VEHICLE_BRAND_LIST = ["Hero", "Honda", "Bajaj", "TVS", "Royal Enfield"] as const;

// Display index only; the selectable catalogue is admin-managed (GET /api/part-categories).
export const PART_CATEGORY_LIST = [
  "Screws, nuts & fasteners",
  "Engine parts",
  "Electrical parts",
  "Body parts",
  "Brake systems",
  "Suspension & steering",
  "Cables & controls",
  "Bearings & transmission",
  "Lighting & indicators",
  "Filters & fuel systems",
  "Wheels & tyres",
  "Car spare parts",
] as const;

export const STEPS = [
  { title: "Register", body: "Create your account and verify your email and mobile. You are approved straight away." },
  { title: "Complete your profile", body: "Add business details and bank account; KYC documents are optional. Then your dashboard opens." },
  { title: "List products", body: "Upload your spare-parts catalogue, pricing, stock and compatibility." },
  { title: "Go live", body: "Your listings appear on the MotoXPlus storefront for dealers and customers." },
  { title: "Receive orders", body: "Dealers and customers can purchase your approved products." },
  { title: "Shipping & settlement", body: "Prepare your packages for MotoXPlus-arranged pickup and track eligible vendor settlements." },
] as const;

export const TRANSPARENCY_POINTS = [
  "Applicable marketplace commission is communicated to you before you start selling.",
  "Vendor settlements are based on completed and eligible orders.",
  "MotoXPlus coordinates shipping for your marketplace orders.",
  "Applicable shipping charges and other deductions are shown as separate lines, not buried in a total.",
  "You can monitor every settlement from your vendor dashboard.",
] as const;

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Who can register as a vendor?",
    a: "Manufacturers, wholesalers, distributors, stockists and spare-parts suppliers who sell two-wheeler automotive parts and have a bank account in the business's name. Your account is approved as soon as you verify your email and mobile; you complete your business profile (business details and bank account; documents are optional) before your dashboard opens. MotoXPlus can suspend accounts that break the vendor agreement.",
  },
  {
    q: "Can manufacturers and wholesalers both join?",
    a: "Yes. You choose your business type when you register - manufacturer, wholesaler, distributor, stockist, retailer or other - and the same requirements apply to everyone.",
  },
  {
    q: "Can I sell Hero, Honda, Bajaj and TVS spare parts?",
    a: "Yes, you can list parts for the vehicle brands you supply, including Hero, Honda, Bajaj, TVS and Royal Enfield. Each listing, including its vehicle compatibility, is reviewed before it goes live, and you are responsible for describing your parts accurately.",
  },
  {
    q: "Do I need to upload documents?",
    a: "No, documents are optional. You can add your PAN card, GST certificate, business registration proof, a cancelled cheque or an address proof whenever you like from your vendor account; they help us verify your business faster. MotoXPlus may ask for more information later.",
  },
  {
    q: "Is GST mandatory for every vendor?",
    a: "Enter your GSTIN if you have one. Whether GST registration is required for your sales depends on your circumstances and applicable law, so please check with your tax advisor. If anything further is needed for your application, we will contact you.",
  },
  {
    q: "Who handles product delivery?",
    a: "MotoXPlus arranges shipping. You prepare the package, enter its weight and dimensions, and mark the order ready for pickup. MotoXPlus books the courier and tracking is shared with you and the buyer.",
  },
  {
    q: "How does marketplace commission work?",
    a: "The applicable commission is communicated to you before you start selling and appears as its own line in your settlement statements. We do not publish rates on this page.",
  },
  {
    q: "How do I receive payments?",
    a: "Settlements are paid to your verified bank account for completed, eligible orders, after the applicable commission, shipping charges and other deductions. You can follow each settlement and its status from your dashboard. Terms are set out in the seller agreement.",
  },
  {
    q: "Can I manage my stock online?",
    a: "Yes. Once your account is approved you manage stock quantities for each of your listings from your dashboard, and low-stock products are flagged.",
  },
  {
    q: "Can I sell to both dealers and retail customers?",
    a: "Yes. Your approved listings are offered to both B2B buyers (dealers, retailers, workshops) and B2C customers. You set the retail price and the dealer price separately, and MotoXPlus shows each buyer the right one.",
  },
];
