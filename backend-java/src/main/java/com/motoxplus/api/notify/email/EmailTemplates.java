package com.motoxplus.api.notify.email;

import com.motoxplus.api.auth.otp.OtpService;

/**
 * Branded HTML emails (port of src/lib/email/templates/base.ts). Every value that came from a user is HTML-escaped;
 * the Node templates interpolate names raw.
 */
public final class EmailTemplates {
    private EmailTemplates() {}

    public record Email(String subject, String html) {}

    public static String esc(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> b.append("&amp;");
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '"' -> b.append("&quot;");
                case '\'' -> b.append("&#39;");
                default -> b.append(c);
            }
        }
        return b.toString();
    }

    private static String hi(String name) {
        return "<p class=\"text\">Hi " + (name == null || name.isBlank() ? "there" : esc(name)) + ",</p>";
    }

    private static String button(String url, String label) {
        return "<div style=\"text-align:center;\"><a href=\"" + esc(url) + "\" class=\"btn\">" + esc(label) + "</a></div>";
    }

    public static Email vendorVerifyEmail(String name, String verifyUrl, String otp) {
        String content = """
                <div class="title">Verify your email address</div>
                %s
                <p class="text">Thanks for registering as a vendor on MOTOXPLUS. Enter this code to verify your email address.</p>
                <div class="otp-box">
                  <div class="otp">%s</div>
                  <div class="otp-label">Email verification code, valid for %d minutes</div>
                </div>
                %s
                <hr class="divider" />
                <p class="small">If you did not create a MOTOXPLUS vendor account, ignore this email.</p>
                """.formatted(hi(name), esc(otp), OtpService.EXPIRY_MINUTES, button(verifyUrl, "Enter code"));
        return new Email("Verify your email — MOTOXPLUS", base("Verify your email", content));
    }

    public static Email vendorApplicationSubmitted(String name, String company) {
        String content = """
                <div class="title">Application received</div>
                %s
                <p class="text">We have received the vendor application for <strong style="color:#fff;">%s</strong>.
                Our team reviews your business details and documents, usually within 2 business days.
                We will email you as soon as there is a decision.</p>
                """.formatted(hi(name), esc(company));
        return new Email("Vendor application received — MOTOXPLUS", base("Application received", content));
    }

    public static Email vendorApproved(String name, String company, String dashboardUrl) {
        String content = """
                <div class="title">Your vendor account is active</div>
                %s
                <p class="text"><strong style="color:#fff;">%s</strong> is approved to sell on MOTOXPLUS.
                You can now add products under your approved parts categories.</p>
                %s
                """.formatted(hi(name), esc(company), button(dashboardUrl, "Open vendor dashboard"));
        return new Email("Your vendor account is approved — MOTOXPLUS", base("Vendor account approved", content));
    }

    public static Email vendorChangesRequested(String name, String company, String reason, String applicationUrl) {
        String content = """
                <div class="title">Please update your application</div>
                %s
                <p class="text">We reviewed the vendor application for <strong style="color:#fff;">%s</strong> and need a few changes before we can approve it:</p>
                <div class="warning"><p class="warning-text">%s</p></div>
                %s
                """.formatted(hi(name), esc(company), esc(reason), button(applicationUrl, "Update application"));
        return new Email("Action needed on your vendor application — MOTOXPLUS", base("Changes requested", content));
    }

    public static Email vendorRejected(String name, String company, String reason) {
        String content = """
                <div class="title">Application not approved</div>
                %s
                <p class="text">We could not approve the vendor application for <strong style="color:#fff;">%s</strong>.</p>
                <div class="warning"><p class="warning-text">%s</p></div>
                <p class="small">If you think this is a mistake, write to info@motoxplus.com.</p>
                """.formatted(hi(name), esc(company), esc(reason));
        return new Email("Your vendor application — MOTOXPLUS", base("Application not approved", content));
    }

    public static Email adminNewApplication(String company, String vendorCode, String reviewUrl) {
        String content = """
                <div class="title">New vendor application</div>
                <p class="text"><strong style="color:#fff;">%s</strong> (%s) submitted a vendor application for review.</p>
                %s
                """.formatted(esc(company), esc(vendorCode), button(reviewUrl, "Review application"));
        return new Email("[Review] Vendor application — " + company, base("New vendor application", content));
    }

    /** FYI to the team: an auto-approved vendor finished their business profile and can now list products. */
    public static Email adminVendorProfileCompleted(String company, String vendorCode, String vendorUrl) {
        String content = """
                <div class="title">New vendor is live</div>
                <p class="text"><strong style="color:#fff;">%s</strong> (%s) registered, verified their email and mobile, and
                completed their business profile. The account was approved automatically and can now list products.
                Check the documents and suspend the account if anything is wrong.</p>
                %s
                """.formatted(esc(company), esc(vendorCode), button(vendorUrl, "View vendor"));
        return new Email("[New vendor] " + company, base("New vendor is live", content));
    }

    static String base(String title, String content) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>%s</title>
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
                    .warning-text { font-size: 13px; color: #fca5a5; white-space: pre-line; }
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
                      <div class="body">%s</div>
                      <div class="footer">
                        <div class="footer-text">
                          MOTOXPLUS India Private Limited<br/>
                          Ground Floor, RSR-11, Kh.No.443, Main Nasirpur Road, Palam Village, New Delhi 110045<br/>
                          GST: 07AAUCM5765B1Z4 &nbsp;|&nbsp; info@motoxplus.com &nbsp;|&nbsp; +91 88168 12379<br/><br/>
                          This is an automated email. Please do not reply to this message.
                        </div>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(esc(title), content);
    }
}
