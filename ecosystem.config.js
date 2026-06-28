/**
 * PM2 Ecosystem Configuration — MotoXPlus Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production   # zero-downtime reload
 *   pm2 stop motoxplus
 *   pm2 logs motoxplus
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: "motoxplus",
      script: "node_modules/.bin/next",
      args: "start",

      // Cluster mode for multi-core utilization.
      // "max" uses all CPU cores; set to a specific number to limit.
      instances: "max",
      exec_mode: "cluster",

      // Restart if memory exceeds 1.2 GB (per instance)
      max_memory_restart: "1200M",

      // Graceful shutdown — allow in-flight requests up to 30s to complete
      kill_timeout: 30000,
      wait_ready: true,         // wait for process to send ready signal
      listen_timeout: 15000,   // max time to wait for ready signal

      // Automatic restart policy
      autorestart: true,
      restart_delay: 2000,      // wait 2s between restarts
      max_restarts: 10,         // stop restarting after 10 crashes in window
      min_uptime: "10s",        // must stay up at least 10s to count as stable

      // File watching — off in production
      watch: false,

      // Merge stdout + stderr into a single log stream
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      out_file: "/var/log/pm2/motoxplus-out.log",
      error_file: "/var/log/pm2/motoxplus-error.log",

      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 3000,

        // All sensitive vars should be set in the actual .env file on the server.
        // This section is for non-sensitive production-specific overrides only.

        // Node.js performance tuning
        NODE_OPTIONS: "--max-old-space-size=1024",
      },

      env_staging: {
        NODE_ENV: "production",
        PORT: 3001,
        NODE_OPTIONS: "--max-old-space-size=512",
      },
    },
  ],
};
