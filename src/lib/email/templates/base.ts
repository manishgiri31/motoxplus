export function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e5e5e5; }
    .wrapper { max-width: 600px; margin: 40px auto; padding: 0 16px; }
    .card { background: #111111; border: 1px solid #1f1f1f; border-radius: 2px; overflow: hidden; }
    .header { background: #0f0f0f; border-bottom: 1px solid #1f1f1f; padding: 32px; text-align: center; }
    .logo-text { font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: 2px; }
    .logo-text span { color: #DC2626; }
    .tagline { font-size: 10px; color: #6b7280; letter-spacing: 3px; margin-top: 6px; text-transform: uppercase; }
    .body { padding: 40px 32px; }
    .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
    .text { font-size: 14px; color: #9ca3af; line-height: 1.7; margin-bottom: 16px; }
    .otp-box { background: #1a1a1a; border: 1px solid #DC2626; border-radius: 4px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp { font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #ffffff; font-family: monospace; }
    .otp-label { font-size: 11px; color: #6b7280; letter-spacing: 2px; text-transform: uppercase; margin-top: 8px; }
    .btn { display: inline-block; background: #DC2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 2px; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin: 16px 0; }
    .divider { border: none; border-top: 1px solid #1f1f1f; margin: 24px 0; }
    .small { font-size: 12px; color: #6b7280; line-height: 1.6; }
    .warning { background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 2px; padding: 12px 16px; margin: 16px 0; }
    .warning-text { font-size: 12px; color: #fca5a5; }
    .footer { background: #0a0a0a; border-top: 1px solid #1f1f1f; padding: 24px 32px; text-align: center; }
    .footer-text { font-size: 11px; color: #4b5563; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-text">MOTOX<span>PLUS</span></div>
        <div class="tagline">India Private Limited</div>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <div class="footer-text">
          MOTOXPLUS India Private Limited<br/>
          RZ-43/291, Street No. 6, Geetanjali Park, Sagarpur West, New Delhi 110046<br/>
          GST: 07AAUCM5765B1Z4 &nbsp;|&nbsp; info@motoxplus.in &nbsp;|&nbsp; +91 92171 31801<br/><br/>
          This is an automated email. Please do not reply to this message.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
