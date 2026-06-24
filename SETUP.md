# MotoXPlus India — Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local or cloud)
- Razorpay account (test keys for development)
- Cloudflare R2 bucket (optional for MVP)

---

## 1. Configure Environment

Edit `.env` with your actual values:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/motoxplus?schema=public"

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Razorpay (get from razorpay.com/dashboard)
RAZORPAY_KEY_ID="rzp_test_xxxx"
RAZORPAY_KEY_SECRET="your_secret"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_xxxx"

# Company details
NEXT_PUBLIC_COMPANY_NAME="MotoXPlus India Pvt. Ltd."
NEXT_PUBLIC_COMPANY_GST="22AAAAA0000A1Z5"
NEXT_PUBLIC_COMPANY_ADDRESS="Your Address, City, State - 000000"
NEXT_PUBLIC_COMPANY_PHONE="+91 98765 43210"
NEXT_PUBLIC_COMPANY_EMAIL="info@motoxplus.in"
```

---

## 2. Database Setup

```bash
# Push schema to database
npx prisma db push

# Seed with initial data (super admin, admin, test dealer, categories, sample products)
npx prisma db seed
```

---

## 3. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

---

## 4. Test Accounts (after seeding)

| Role        | Email                     | Password        |
|-------------|---------------------------|-----------------|
| Super Admin | superadmin@motoxplus.in   | SuperAdmin@123  |
| Admin       | admin@motoxplus.in        | Admin@123456    |
| Test Dealer | dealer@testshop.in        | Dealer@123456   |
| Test Vendor | vendor@testparts.in       | Vendor@123456   |

---

## 5. Key Routes

### Public Website
- `/` — Homepage
- `/products` — Product catalog (pricing hidden for guests)
- `/products/[id]` — Product detail
- `/about` — About us
- `/become-dealer` — Dealer registration
- `/contact` — Contact form

### Dealer Portal
- `/login` — Login page
- `/dealer/dashboard` — Dashboard
- `/dealer/products` — Browse products with pricing
- `/dealer/cart` — Shopping cart
- `/dealer/checkout` — Checkout with Razorpay
- `/dealer/orders` — Order history
- `/dealer/invoices` — Invoice downloads

### Admin Panel
- `/admin/dashboard` — Admin dashboard
- `/admin/dealers` — Manage dealer applications
- `/admin/products` — Product management
- `/admin/products/new` — Add product
- `/admin/orders` — Order management

---

## 6. Dealer Approval Flow

1. Dealer registers at `/become-dealer`
2. Admin reviews at `/admin/dealers`
3. Click "Approve" to activate dealer account
4. Dealer receives login access

---

## 7. Production Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all `.env` variables in Vercel Dashboard → Project → Settings → Environment Variables.

Use a cloud PostgreSQL provider like:
- **Neon** (neon.tech) — Serverless PostgreSQL, generous free tier
- **Supabase** (supabase.com) — PostgreSQL with extras
- **Railway** (railway.app) — Simple deploy

---

## 8. Cloudflare R2 Setup (for image uploads)

1. Create R2 bucket named `motoxplus-assets`
2. Enable public access or configure custom domain
3. Create R2 API token with read/write permissions
4. Update `.env` with R2 credentials

---

## 9. Razorpay Integration

1. Sign up at razorpay.com
2. Get test keys from Dashboard → Settings → API Keys
3. Update `.env` with your keys
4. For production: complete KYC and switch to live keys

---

## Notes

- Invoices are generated as PDF in-browser using jsPDF (no server storage needed for MVP)
- Product images can be hosted on Cloudflare R2 or any public URL
- GST calculation is automatic based on per-product GST rate (default 18%)
