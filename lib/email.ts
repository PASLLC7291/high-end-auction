/**
 * Transactional Email via Resend
 *
 * Sends lifecycle emails to auction buyers at key points:
 * - auction_won: Congratulations, payment coming soon
 * - payment_received: Payment confirmed, preparing order
 * - order_shipped: Tracking info
 * - order_delivered: Delivery confirmation
 * - order_refunded: Refund issued with reason and amount
 *
 * Uses the Resend API (https://api.resend.com/emails).
 * Env vars:
 *   RESEND_API_KEY   — required; if missing, emails are logged but not sent
 *   RESEND_FROM      — optional; defaults to "Placer Auctions <noreply@placerauctions.com>"
 *
 * NEVER throws — email failures are logged but do not break the pipeline.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailTemplate =
  | "auction_won"
  | "payment_received"
  | "order_shipped"
  | "order_delivered"
  | "order_refunded";

type EmailData = Record<string, string | number | null>;

// ---------------------------------------------------------------------------
// HTML Templates
// ---------------------------------------------------------------------------

const TEMPLATES: Record<
  EmailTemplate,
  (data: EmailData) => { subject: string; html: string }
> = {
  auction_won: (data) => ({
    subject: `You won: ${data.productName ?? "an auction item"}`,
    html: buildHtml(
      "Congratulations!",
      `<p>You won <strong>${esc(data.productName)}</strong> for <strong>${formatDollars(data.amount)}</strong>.</p>
       <p>Payment will be collected shortly from your card on file.</p>`
    ),
  }),

  payment_received: (data) => ({
    subject: `Payment received for ${data.productName ?? "your order"}`,
    html: buildHtml(
      "Payment Confirmed",
      `<p>We received your payment of <strong>${formatDollars(data.amount)}</strong> for <strong>${esc(data.productName)}</strong>.</p>
       <p>We&rsquo;re preparing your order now. You&rsquo;ll receive a tracking number once it ships.</p>`
    ),
  }),

  order_shipped: (data) => ({
    subject: `Your order has shipped!`,
    html: buildHtml(
      "Your Order Has Shipped",
      `<p>Your order is on its way!</p>
       <p><strong>Tracking Number:</strong> ${esc(data.trackingNumber)}<br/>
       <strong>Carrier:</strong> ${esc(data.trackingCarrier)}</p>
       <p>Allow a few hours for tracking information to become available.</p>`
    ),
  }),

  order_delivered: (data) => ({
    subject: `Your order has been delivered`,
    html: buildHtml(
      "Order Delivered",
      `<p>Your order of <strong>${esc(data.productName)}</strong> has been delivered.</p>
       <p>Thank you for shopping with Placer Auctions!</p>`
    ),
  }),

  order_refunded: (data) => ({
    subject: `Your order has been refunded`,
    html: buildHtml(
      "Order Refunded",
      `<p>We&rsquo;ve issued a full refund for your order of <strong>${esc(data.productName)}</strong>.</p>
       <p><strong>Refund amount:</strong> ${formatDollars(data.amount)}</p>
       <p><strong>Reason:</strong> ${esc(data.reason)}</p>
       <p>The refund has been sent to your original payment method. Depending on your bank, it may take 5&ndash;10 business days to appear on your statement.</p>
       <p>We apologize for the inconvenience. If you have any questions, please reply to this email.</p>`
    ),
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape HTML entities in dynamic values */
function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format a cent amount to $X.XX (or "N/A" if null/undefined) */
function formatDollars(cents: string | number | null | undefined): string {
  if (cents == null) return "N/A";
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (Number.isNaN(n)) return "N/A";
  return `$${(n / 100).toFixed(2)}`;
}

/** Wrap body content in a simple, styled HTML email shell */
function buildHtml(heading: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#18181b;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Placer Auctions</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${heading}</h2>
          <div style="font-size:15px;line-height:1.6;color:#3f3f46;">${body}</div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
            &copy; Placer Auctions &bull; You&rsquo;re receiving this because you participated in an auction.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send Email (public API)
// ---------------------------------------------------------------------------

export async function sendEmail(params: {
  to: string;
  template: EmailTemplate;
  data: EmailData;
}): Promise<void> {
  const { to, template, data } = params;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log(`[email] Would send ${template} to ${to}`);
    return;
  }

  const fromAddress =
    process.env.RESEND_FROM?.trim() ||
    "Placer Auctions <noreply@mail.fastbid.co>";

  const templateFn = TEMPLATES[template];
  if (!templateFn) {
    console.error(`[email] Unknown template: ${template}`);
    return;
  }

  const { subject, html } = templateFn(data);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.error(
        `[email] Resend API error ${res.status} for ${template} to ${to}: ${body}`
      );
      return;
    }

    console.log(`[email] Sent ${template} to ${to}`);
  } catch (error) {
    console.error(`[email] Failed to send ${template} to ${to}:`, error);
  }
}
