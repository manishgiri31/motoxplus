# MOTOXPLUS India — B2B Dealer Portal

Full-stack B2B dealer management platform for MOTOXPLUS India Private Limited — premium two-wheeler spare parts manufacturer.

## Overview

| Portal | Roles | Purpose |
|--------|-------|---------|
| Public | Anyone | Product catalog, company info, dealer/vendor applications |
| Dealer | `DEALER` | Browse products, place orders, make payments, track shipments |
| Admin | `ADMIN`, `SUPER_ADMIN`, `STAFF` | Manage all dealer/vendor/product/order data |
| Vendor | `VENDOR` | View purchase orders, submit products for approval |

## Tech Stack

**Frontend:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Radix UI  
**Backend:** Next.js API Routes · Prisma ORM · PostgreSQL 16  
**Auth:** NextAuth.js (JWT sessions) · bcrypt · OTP (MSG91)  
**Payments:** Razorpay · UPI manual verification  
**Storage:** Cloudflare R2 (images, documents, invoices)  
**Email:** Resend  
**Shipping:** Delhivery API  
**Deployment:** Ubuntu 24.04 · PM2 · Nginx · Let's Encrypt

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm 10+

### Setup

```bash
git clone https://github.com/YOUR_ORG/motoxplus.git
cd motoxplus

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your local values

# Set up database
createdb motoxplus
npx prisma migrate dev

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

Open http://localhost:3000

### Default seed accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@motoxplus.in | SuperAdmin@123 |
| Admin | admin@motoxplus.in | Admin@123456 |
| Dealer | dealer@testshop.in | Dealer@123456 |
| Vendor | vendor@testparts.in | Vendor@123456 |
    
**Change these passwords immediately after first login on any non-local environment.**

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript check

npm run db:migrate   # Create new migration
npm run db:push      # Push schema (dev only)
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

## Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Server setup, deployment, zero-downtime releases |
| [ENVIRONMENT.md](ENVIRONMENT.md) | All environment variables explained |
| [BACKUP.md](BACKUP.md) | Database backup & restore procedures |
| [SECURITY.md](SECURITY.md) | Security architecture & incident response |
| [OPERATIONS.md](OPERATIONS.md) | Daily ops, monitoring, troubleshooting |
| [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) | Full DR procedures |

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Full health check (DB + uptime) |
| `GET /api/health/ready` | Readiness probe |
| `GET /api/health/live` | Liveness probe |

## Project Structure

```
src/
├── app/
│   ├── (public)/        # Public pages (catalog, about, contact)
│   ├── admin/           # Admin portal
│   ├── dealer/          # Dealer portal
│   ├── vendor/          # Vendor portal
│   └── api/             # All API routes
├── components/
│   ├── admin/           # Admin-specific components
│   ├── auth/            # Authentication forms
│   ├── dealer/          # Dealer portal components
│   ├── vendor/          # Vendor components
│   └── ui/              # Shared UI primitives
└── lib/
    ├── auth.ts          # NextAuth configuration
    ├── prisma.ts        # Prisma singleton
    ├── logger.ts        # Structured logging
    ├── api.ts           # API response helpers
    ├── env.ts           # Environment validation
    ├── email/           # Email templates (Resend)
    ├── sms/             # SMS providers (MSG91, Twilio)
    ├── storage/         # Cloudflare R2 operations
    └── delhivery/       # Shipping integration
```

## License

Proprietary — MOTOXPLUS India Private Limited. All rights reserved.
