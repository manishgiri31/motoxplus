# MotoXPlus — VPS Hardening

Companion to [`scripts/vps/harden.sh`](scripts/vps/harden.sh). This was written and reviewed **without SSH access to the actual Hostinger VPS** — nothing in this document has been executed against production. Read the script before running it.

---

## 0. Do this first, separately from the script: rotate leaked credentials

`git log --all --oneline -- .env` shows `.env` was committed to this repo across several early commits (`d2bdf8b` "Initial MotoXPlus MVP" through `096671d` "Remove .env from tracking") before being untracked. **Removing a file from tracking does not remove it from history** — every value that was ever in `.env` is still readable from any full clone of this repository via `git show <commit>:.env`.

The variable names present across those historical commits (values not reproduced here — you don't need the old value to rotate, only to know it needs rotating):

| Variable | Rotate because |
|---|---|
| `DATABASE_URL` | Contains the DB password (one commit is literally titled "connect neon db" — a real connection string) |
| `JWT_SECRET` | Signs every custom access/refresh token |
| `NEXTAUTH_SECRET` | Signs every NextAuth session |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment API credentials |
| `RESEND_API_KEY` | Email-sending credential |
| `DELHIVERY_API_TOKEN` / `DELHIVERY_WEBHOOK_SECRET` | Shipping API + webhook auth |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS credential (historical — confirm current provider in `.env` is still Twilio or has since moved to MSG91/Fast2SMS, and rotate whichever is live) |

Note: the auth-hardening ask referenced "WhatsApp OTP via Meta Cloud API" — that's not what's implemented. `src/lib/sms/` sends OTPs via a configurable SMS gateway (Twilio, MSG91, or Fast2SMS — `SMS_PROVIDER` env var), not WhatsApp/Meta. Rotate whichever of these is actually configured in the live `.env`, not a Meta token that doesn't exist in this codebase.

**Rotating `JWT_SECRET`/`NEXTAUTH_SECRET` forces every active session and refresh token to become invalid immediately** — everyone gets logged out. Plan the deploy for a low-traffic window and tell dealers/staff to expect a re-login.

```bash
# Generate fresh values (run locally, not on the VPS, so they never touch a shell history you'd need to scrub):
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # NEXTAUTH_SECRET
```
Update `DATABASE_URL`'s password via `ALTER ROLE motoxplus WITH PASSWORD '...';` in psql, update Razorpay/Resend/Delhivery keys from their respective dashboards, then update `.env` on the VPS and `pm2 reload motoxplus --update-env`.

If this repository is or was ever public, or if anyone outside the current team has ever cloned it, treat this as a confirmed leak, not a theoretical one — rotate on that basis rather than trying to first prove exploitation.

---

## 1. Postgres exposure (script step 1)

The script locks `listen_addresses` to `localhost` and reports (doesn't auto-edit) any `pg_hba.conf` line allowing `0.0.0.0/0` or `::/0`. If found, edit `pg_hba.conf` by hand to scope it to `127.0.0.1/32` for the `motoxplus` role/database, then `systemctl restart postgresql`.

## 2. Firewall (script step 2)

`ufw`: default-deny incoming, allow 80/443, rate-limited SSH, explicit deny on 5432 and 6379. The script prints `ss -tlnp` at the end — confirm nothing besides nginx (80/443) and sshd (22) is bound to a non-loopback address.

**Known gap, not yet automated:** `ufw allow 80/tcp` / `443/tcp` accepts inbound from anywhere, not just Cloudflare. Combined with nginx trusting `CF-Connecting-IP` (see `cloudflare-ips.conf`), that means:
- nginx's own `limit_req` zones (keyed on `$binary_remote_addr`, which `real_ip_header` only overwrites for peers in `cloudflare-ips.conf`) are **not** foolable this way — a direct connection that isn't actually from Cloudflare gets its own real IP, not a spoofed one.
- The app layer is: `src/lib/auth/middleware.ts`'s `getClientIP()` (and the near-duplicate in `src/lib/auth.ts`) trusts the *first* entry of `X-Forwarded-For`, and nginx's `$proxy_add_x_forwarded_for` only *appends* — it never strips a client-supplied XFF from an untrusted peer. A request straight to the origin's IP (bypassing Cloudflare, which is easy to find — DNS history, Shodan, `.env`/deploy logs, etc.) can set its own `X-Forwarded-For` and forge the identity the app's per-IP rate limit keys on. This does NOT bypass the per-*identifier* budget or the DB-backed account lockout (both keyed on email/mobile, not IP), but it does defeat the per-IP layer and skips Cloudflare's own WAF/bot checks entirely.

**Proposed fix** (not yet scripted into `harden.sh` — this changes live reachability and deserves a deliberate rollout, not a silent default): restrict `80`/`443` to Cloudflare's ranges only, reusing the same list `cloudflare-ips.conf` already tracks:
```bash
# after allowing 80/443 more broadly above, tighten to Cloudflare only:
ufw delete allow 80/tcp
ufw delete allow 443/tcp
while read -r range; do
  [[ "$range" =~ ^# ]] && continue
  ufw allow from "$range" to any port 80,443 proto tcp comment "Cloudflare only"
done < <(curl -s https://www.cloudflare.com/ips-v4; curl -s https://www.cloudflare.com/ips-v6)
```
Do this only after confirming nothing else needs direct origin access (uptime monitors, webhook senders that don't proxy through Cloudflare, etc. would need their own allow rules first) — and keep the ufw rules refreshed on the same schedule as `cloudflare-ips.conf` (`scripts/vps/refresh-cloudflare-ips.sh`), or a range rotation silently locks out real Cloudflare traffic instead of just attackers.

## 3. SSH (script step 3)

Key-only auth, no root login, fail2ban on sshd (5 attempts / 10 min → 1 hour ban). **Before running**: confirm your own key is in `~/.ssh/authorized_keys` for the account you'll reconnect as — this script does not verify that, and getting locked out of a VPS with `PasswordAuthentication no` and no other access path means going through the hosting provider's console/rescue mode.

## 4. TLS / nginx (script step 4)

`nginx.conf` in this repo already assumes nginx terminates TLS and proxies to `127.0.0.1:3000` — confirmed by the file itself (header comment: "Ubuntu 24.04 + Let's Encrypt + Cloudflare"). If nginx isn't installed, **the script stops and refuses to continue** rather than leaving Node directly exposed — install nginx and deploy `nginx.conf` first (see its own header for the `certbot --nginx` command). The script adds `server_tokens off` if missing and verifies `certbot.timer` is enabled for auto-renewal.

## 5. Unattended upgrades (script step 5)

Standard `unattended-upgrades` package, enabled for security patches.

## 6. Backups (script step 6)

`scripts/db/backup.sh --upload-r2` already exists in this repo and is referenced in `OPERATIONS.md`'s cron table (nightly 02:00) — the script only *verifies* it's actually in `crontab -l` rather than just documented, and prints the line to add if it's missing. Before relying on it:
- Confirm retention: the script should keep ~14 days locally and prune older ones (read `scripts/db/backup.sh` to confirm — not modified here since it wasn't part of the reviewed diff).
- Confirm the R2 upload actually happens and lands in a bucket separate from the app's asset bucket (or at least a distinct prefix), so a compromised app can't also delete backups it can reach.
- **Test a restore now, not during an incident**:
  ```bash
  # On a scratch DB, never the production one:
  createdb motoxplus_restore_test
  gunzip -c /var/backups/motoxplus/<latest>.sql.gz | psql motoxplus_restore_test
  psql motoxplus_restore_test -c "SELECT count(*) FROM \"Order\";"   # sanity check
  dropdb motoxplus_restore_test
  ```

## 7. Secrets (script step 7)

`.env` → `600`, owned by the app user (not root). PM2 should run as that same non-root user — `pm2 kill` as root then restart as the app user if it's currently running as root. See §0 above for the git-history rotation, which this step can't do for you (needs a human call on timing).

## 8. Cloudflare — recommended, not executed

Not run by the script, and not something to flip on without planning the DNS cutover:

1. Add the domain to Cloudflare (free tier), set nameservers at the registrar.
2. Enable the orange-cloud proxy on the `motoxplus.com`/`www` A records — this puts Cloudflare in front of nginx (WAF, DDoS absorption, hides the origin IP).
3. **Once Cloudflare proxies traffic, nginx's client-IP handling needs to change** — the rate-limiter code (`src/lib/auth/middleware.ts#getClientIP`) currently trusts the first `X-Forwarded-For` entry because nginx is the only hop today. With Cloudflare in front, nginx needs `set_real_ip_from <Cloudflare ranges>;` + `real_ip_header CF-Connecting-IP;` (Cloudflare's IP list: https://www.cloudflare.com/ips/) so nginx's own `$remote_addr`/forwarded header reflects the real client, not Cloudflare's edge IP. Skipping this after enabling the proxy would make every request appear to come from Cloudflare's IPs, silently breaking every per-IP rate limit into one shared bucket.
4. Set Cloudflare SSL/TLS mode to "Full (strict)" (not "Flexible") — Flexible would mean Cloudflare↔origin traffic is unencrypted HTTP even though nginx is already terminating real TLS.

Flag for confirmation before doing this — it's a live DNS change with a propagation window, not a same-session flip.

---

## 5-minute verification checklist (after running the script)

Run these from **outside** the VPS (your laptop, not an SSH session into the box):

```bash
# 1. Port scan — only 80 and 443 should be open externally, 22 should be filtered/limited not wide open
nmap -Pn -p 22,80,443,3000,5432,6379 <VPS_IP>
# Expect: 80,443 open; 22 open-but-limited (or open, fail2ban handles abuse); 3000,5432,6379 filtered/closed

# 2. TLS
curl -I https://motoxplus.com          # expect HTTP/2 200, HSTS header present
curl -I http://motoxplus.com           # expect 301 to https

# 3. sshd config, from inside a session you already trust (don't close your existing session until this passes):
ssh -o PasswordAuthentication=yes youruser@<VPS_IP>   # expect this to be REFUSED (password auth disabled)
sudo sshd -T | grep -E "passwordauthentication|permitrootlogin"   # expect "no" / "no"
```

4. **Restore drill**: run the restore commands in §6 above against a scratch database and confirm row counts look sane. A backup that's never been restored is a hope, not a backup.

5. `sudo ufw status verbose` — confirm default deny incoming, and 5432/6379 show explicit `DENY`.
