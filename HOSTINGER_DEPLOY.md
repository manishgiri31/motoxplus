# Hostinger VPS Deployment — motoxplus.com

## One-time server setup (run as root or sudo user)

```bash
# 1. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2 globally
sudo npm install -g pm2

# 3. Install Nginx
sudo apt-get install -y nginx

# 4. (Optional) Install Redis if needed in future
# sudo apt-get install -y redis-server
```

---

## Deploy the app

```bash
# 1. Upload/clone the project to /var/www/motoxplus
cd /var/www
git clone <your-repo-url> motoxplus
# OR: upload via SFTP and extract

cd motoxplus

# 2. Create .env file with production values
cp .env .env.backup   # if you have one
nano .env             # paste in your production .env (see checklist below)

# 3. Install dependencies (skip dev deps for production)
npm ci --omit=dev

# 4. Push DB schema (ONE TIME — run this only on first deploy or after schema changes)
npx prisma db push

# 5. Seed initial data (ONE TIME — only on first deploy)
npx prisma db seed

# 6. Build the app
npm run build

# 7. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # follow the printed command to enable auto-start on reboot
```

---

## Nginx reverse proxy config

Create `/etc/nginx/sites-available/motoxplus`:

```nginx
server {
    listen 80;
    server_name motoxplus.com www.motoxplus.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/motoxplus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL (HTTPS) via Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d motoxplus.com -d www.motoxplus.com
```

Certbot will auto-update the Nginx config with HTTPS and set up auto-renewal.

---

## Re-deploy after code changes

```bash
cd /var/www/motoxplus
git pull
npm ci --omit=dev
npm run build
pm2 restart motoxplus
```

---

## Production .env checklist

Before deploying, verify these values in your `.env`:

| Variable | Required value |
|---|---|
| `DATABASE_URL` | Your Railway/Neon/Supabase PostgreSQL URL |
| `NEXTAUTH_URL` | `https://motoxplus.com` |
| `NEXTAUTH_SECRET` | Any long random string (keep secret) |
| `NEXT_PUBLIC_APP_URL` | `https://motoxplus.com` |
| `RAZORPAY_KEY_ID` | **Live key** from Razorpay dashboard (for real payments) |
| `RAZORPAY_KEY_SECRET` | **Live secret** from Razorpay dashboard |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same as `RAZORPAY_KEY_ID` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret |
| `R2_BUCKET_NAME` | `motoxplus-assets` |
| `R2_PUBLIC_URL` | Your R2 public bucket URL |
| `JWT_SECRET` | Any long random string (keep secret) |
| `RESEND_API_KEY` | Your Resend API key |
| `EMAIL_FROM` | `noreply@motoxplus.in` |
| `MSG91_AUTH_KEY` | Your MSG91 auth key |
| `MSG91_SENDER_ID` | `MOTOXX` |
| `MSG91_OTP_TEMPLATE_ID` | **Real template ID from MSG91 dashboard** |
| `MSG91_FLOW_ID` | **Real flow ID from MSG91 dashboard** |

> **Note:** Switch Razorpay from test keys (`rzp_test_*`) to live keys (`rzp_live_*`) once you've completed KYC on the Razorpay dashboard.

---

## Hostinger hPanel Node.js (alternative to VPS)

If you're using Hostinger's shared hosting with Node.js support (not VPS):

1. Go to hPanel → Advanced → Node.js
2. Set Node.js version to **18.x**
3. Set application root to your upload folder
4. Set startup file to: `node_modules/.bin/next` with args `start`
5. Set environment variables in the hPanel Node.js section (do NOT upload `.env` file)
6. Click **Install dependencies** then **Run npm script** → `build`
7. Click **Start application**

> SSL is automatic on Hostinger shared hosting — enable it in hPanel → SSL.

---

## PM2 useful commands

```bash
pm2 status          # check app status
pm2 logs motoxplus  # view live logs
pm2 restart motoxplus
pm2 stop motoxplus
```
