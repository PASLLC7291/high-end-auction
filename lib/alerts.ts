/**
 * Alert Service
 *
 * Sends pipeline alerts to a configured webhook (Discord, Slack, or generic
 * HTTP endpoint). Falls back to console.log when no webhook is configured.
 *
 * Never throws — alerting failures must not break the pipeline.
 */

type AlertSeverity = "info" | "warning" | "critical";

/**
 * Send an alert message. If the `ALERT_WEBHOOK_URL` env var is set, POSTs a
 * JSON payload to the webhook. Auto-detects Discord vs Slack format based on
 * the URL. Always logs to console as a fallback.
 */
export async function sendAlert(
  message: string,
  severity: AlertSeverity = "warning"
): Promise<void> {
  const tag = severity.toUpperCase();
  const formatted = `[${tag}] ${message}`;

  // Always log to console regardless of webhook
  if (severity === "critical") {
    console.error(formatted);
  } else if (severity === "warning") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

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
    // Alerting failures must not propagate
    console.error("[alerts] Failed to send webhook alert:", e);
  }
}
