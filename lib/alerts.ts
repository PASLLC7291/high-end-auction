/**
 * Alert Service
 *
 * Sends pipeline alerts via two channels:
 *   1. Email (Resend API) — sent to ALERT_EMAIL env var, or a hardcoded
 *      fallback operator address.
 *   2. Webhook (Discord / Slack / generic HTTP) — sent to ALERT_WEBHOOK_URL
 *      env var when configured.
 *
 * Falls back to console.log when neither channel is configured.
 *
 * Never throws — alerting failures must not break the pipeline.
 *
 * Env vars:
 *   RESEND_API_KEY      — required for email alerts; when missing, emails are
 *                         logged but not sent.
 *   RESEND_FROM         — optional sender address; defaults to
 *                         "Placer Auctions <noreply@mail.fastbid.co>"
 *   ALERT_EMAIL         — recipient for alert emails; falls back to
 *                         FALLBACK_OPERATOR_EMAIL below.
 *   ALERT_WEBHOOK_URL   — optional webhook for Discord / Slack / generic HTTP.
 */

type AlertSeverity = "info" | "warning" | "critical";

const FALLBACK_OPERATOR_EMAIL = "ops@placerauctions.com";

// ---------------------------------------------------------------------------
// Email alert (Resend)
// ---------------------------------------------------------------------------

/** Build a simple HTML email for the alert. */
function buildAlertHtml(
  heading: string,
  message: string,
  severity: AlertSeverity,
  timestamp: string
): string {
  const severityColor =
    severity === "critical"
      ? "#dc2626"
      : severity === "warning"
        ? "#f59e0b"
        : "#3b82f6";

  const severityLabel = severity.toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#18181b;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Placer Auctions &mdash; Pipeline Alert</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <span style="display:inline-block;padding:4px 12px;border-radius:4px;background:${severityColor};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.5px;">${severityLabel}</span>
          <h2 style="margin:16px 0 12px;font-size:18px;color:#18181b;">${heading}</h2>
          <div style="font-size:15px;line-height:1.6;color:#3f3f46;white-space:pre-wrap;">${escapeHtml(message)}</div>
          <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">Timestamp: ${timestamp}</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
            This is an automated alert from the Placer Auctions dropship pipeline.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendAlertEmail(
  message: string,
  severity: AlertSeverity,
  timestamp: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.ALERT_EMAIL?.trim() || FALLBACK_OPERATOR_EMAIL;

  if (!apiKey) {
    console.log(`[alerts] Would email ${severity} alert to ${to}: ${message}`);
    return;
  }

  const fromAddress =
    process.env.RESEND_FROM?.trim() ||
    "Placer Auctions <noreply@mail.fastbid.co>";

  const subject = `[${severity.toUpperCase()}] Pipeline Alert — ${timestamp}`;
  const html = buildAlertHtml("Pipeline Alert", message, severity, timestamp);

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
        `[alerts] Resend API error ${res.status} sending alert to ${to}: ${body}`
      );
      return;
    }

    console.log(`[alerts] Alert email sent to ${to}`);
  } catch (e) {
    console.error(`[alerts] Failed to send alert email to ${to}:`, e);
  }
}

// ---------------------------------------------------------------------------
// Webhook alert (Discord / Slack / generic)
// ---------------------------------------------------------------------------

async function sendAlertWebhook(
  message: string,
  severity: AlertSeverity,
  formatted: string
): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    let body: string;

    if (webhookUrl.includes("discord")) {
      // Discord webhook format
      body = JSON.stringify({ content: formatted });
    } else if (webhookUrl.includes("slack")) {
      // Slack incoming webhook format
      body = JSON.stringify({ text: formatted });
    } else {
      // Generic JSON payload
      body = JSON.stringify({
        severity,
        message,
        timestamp: new Date().toISOString(),
      });
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e) {
    console.error("[alerts] Failed to send webhook alert:", e);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an alert message via email (Resend) and webhook (if configured).
 *
 * Always logs to console as a baseline. Never throws — alerting failures are
 * logged but do not break the pipeline.
 */
export async function sendAlert(
  message: string,
  severity: AlertSeverity = "warning"
): Promise<void> {
  const tag = severity.toUpperCase();
  const formatted = `[${tag}] ${message}`;
  const timestamp = new Date().toISOString();

  // Always log to console regardless of other channels
  if (severity === "critical") {
    console.error(formatted);
  } else if (severity === "warning") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

  // Send to both channels concurrently; failures in one don't affect the other
  await Promise.allSettled([
    sendAlertEmail(message, severity, timestamp),
    sendAlertWebhook(message, severity, formatted),
  ]);
}
