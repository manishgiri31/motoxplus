# Running the Java API in production

The Java API runs beside the Next.js app on the same VPS: `127.0.0.1:8080`, behind the same Nginx, same `.env`, same
PostgreSQL and Redis. Nginx decides which paths go to Java; everything else stays on Node.

Live on Java after these steps: **`GET /api/categories`** and **`GET /api/products/search`** (plus `/api/search`, added
separately). Login and everything else stays on Node: Java's login can't mint the NextAuth cookie the pages and
middleware still read, so moving it now would log every dealer and admin out.

## One-time setup (about 10 minutes, as root)

1. **Java 21 runtime** (must match `<java.version>` in `backend-java/pom.xml`; the deploy checks this)
   ```bash
   apt install -y openjdk-21-jre-headless
   java -version          # must say 21 (or newer)
   ```
2. **Service user** (no shell, no home)
   ```bash
   useradd --system --no-create-home --shell /usr/sbin/nologin motoxplus-api
   ```
3. **Check `.env` is readable by systemd.** Lines must be `KEY=value` or `KEY="value"`; remove any `export ` prefix.
   Make sure it does **not** contain `DB_MIGRATE=true` or `MARKETPLACE_ENABLED=true` unless you mean it (the service
   forces both off anyway).
4. **First build** (later deploys do this automatically)
   ```bash
   cd /var/www/motoxplus/backend-java
   sh ./mvnw -q -B -DskipTests package
   cp target/motoxplus-api-*.jar motoxplus-api.jar
   sudo -u motoxplus-api test -r motoxplus-api.jar && echo "service user can read the jar"
   ```
5. **Install and start the service**
   ```bash
   cp /var/www/motoxplus/backend-java/deploy/motoxplus-api.service /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now motoxplus-api
   ```
6. **Check it** (startup takes ~15 s)
   ```bash
   curl -s http://127.0.0.1:8080/api/health/ready     # {"ready":true,"redis":"up"}
   curl -s http://127.0.0.1:8080/api/categories | head -c 300
   journalctl -u motoxplus-api -n 50 --no-pager
   ss -ltnp | grep 8080                               # must show 127.0.0.1:8080, NOT 0.0.0.0
   ```
7. **Send the routes to Java**: install the updated `nginx.conf` (it has the `java_api` switch and the two Java
   locations), then `nginx -t && systemctl reload nginx`.
8. **Check through Nginx**
   ```bash
   curl -s https://motoxplus.com/api/categories | head -c 200
   curl -s "https://motoxplus.com/api/products/search?q=brake" | head -c 300
   curl -si https://motoxplus.com/api/categories | grep -i '^x-served-by'   # "java" while on Java
   ```

From then on, every push to `main` builds the jar on the server and restarts the service, **only if** the unit is
enabled and the Java tests passed in the `java_test` CI job. A Java failure never blocks or undoes the Node deploy.

## Rollback

* **Send the routes back to Node instantly:** in `nginx.conf`, change the one line
  `default http://127.0.0.1:8080;` under `map $host $java_api` to `default http://127.0.0.1:3000;`, then
  `nginx -t && systemctl reload nginx`. No restart, no deploy.
* **Java down or crashing:** nothing to do for users; Nginx falls back to Node automatically for these GET routes
  (`error_page 502 503 504 = @node_fallback`).
* **A bad Java release:** the deploy step keeps the previous jar as `motoxplus-api.jar.prev` and restores it by itself
  when the new one fails its health check. To do it by hand:
  `mv motoxplus-api.jar.prev motoxplus-api.jar && systemctl restart motoxplus-api`.
* **Stop Java completely:** `systemctl disable --now motoxplus-api`. Nginx falls back to Node, and deploys skip Java
  while the unit is disabled (they only build/restart an *enabled* unit). `systemctl enable --now` turns it back on.

## Day-to-day

* Logs: `journalctl -u motoxplus-api -f`
* Status: `systemctl status motoxplus-api`
* Health: `curl -s http://127.0.0.1:8080/api/health/ready` (`"redis":"down"` means rate limits fell back to memory)
* Memory: the JVM is capped at 512 MB heap (`-Xmx512m` in the unit). Raise it there if the logs show
  `OutOfMemoryError`; the service restarts itself on OOM.
