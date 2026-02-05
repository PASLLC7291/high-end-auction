import { test, expect } from "@playwright/test";
import { createTestDbClient } from "./db-client";
import { rm } from "fs/promises";
import path from "path";

test("marketing forms: newsletter, contact, consultation, valuation", async ({ page }) => {
  page.on("pageerror", (error) => {
    console.error("PAGEERROR:", error);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("BROWSER CONSOLE ERROR:", msg.text());
    }
  });

  const db = createTestDbClient();

  const uniqueSuffix = Date.now();

  // Newsletter signup (footer)
  const newsletterEmail = `newsletter_${uniqueSuffix}@example.com`;
  await page.goto("/");
  await page.locator("#newsletter-email").fill(newsletterEmail);
  await page.getByRole("button", { name: /subscribe/i }).click();
  await expect(page.getByText("Subscribed!", { exact: true })).toBeVisible();

  const newsletterRes = await db.execute({
    sql: "SELECT COUNT(1) AS count FROM lead_submissions WHERE type = ? AND email = ?",
    args: ["newsletter", newsletterEmail.toLowerCase()],
  });
  expect(Number(newsletterRes.rows[0]?.count ?? 0)).toBeGreaterThan(0);

  // Contact form
  const contactEmail = `contact_${uniqueSuffix}@example.com`;
  await page.goto("/contact");
  await page.locator("#contact-firstName").fill("Test");
  await page.locator("#contact-lastName").fill("User");
  await page.locator("#contact-email").fill(contactEmail);
  await page.locator("#contact-phone").fill("555-111-2222");
  await page.locator("#contact-inquiryType").selectOption("general");
  await page.locator("#contact-message").fill("Hello from Playwright.");
  await page.getByRole("button", { name: /send message/i }).click();
  await expect(page.getByText("Message sent", { exact: true })).toBeVisible();

  const contactRes = await db.execute({
    sql: "SELECT COUNT(1) AS count FROM lead_submissions WHERE type = ? AND email = ?",
    args: ["contact", contactEmail.toLowerCase()],
  });
  expect(Number(contactRes.rows[0]?.count ?? 0)).toBeGreaterThan(0);

  // Consultation form
  const consultationEmail = `consultation_${uniqueSuffix}@example.com`;
  await page.goto("/services#consultation-form");
  await page.locator("#consultation-firstName").fill("Test");
  await page.locator("#consultation-lastName").fill("User");
  await page.locator("#consultation-email").fill(consultationEmail);
  await page.locator("#consultation-serviceInterest").selectOption("valuation");
  await page.locator("#consultation-message").fill("Interested in a valuation.");
  await page.getByRole("button", { name: /submit request/i }).click();
  await expect(page.getByText("Request submitted", { exact: true })).toBeVisible();

  const consultationRes = await db.execute({
    sql: "SELECT COUNT(1) AS count FROM lead_submissions WHERE type = ? AND email = ?",
    args: ["consultation", consultationEmail.toLowerCase()],
  });
  expect(Number(consultationRes.rows[0]?.count ?? 0)).toBeGreaterThan(0);

  // Valuation form (with upload)
  const valuationEmail = `valuation_${uniqueSuffix}@example.com`;
  await page.goto("/consign#valuation-form");
  await page.locator("#valuation-firstName").fill("Test");
  await page.locator("#valuation-lastName").fill("User");
  await page.locator("#valuation-email").fill(valuationEmail);
  await page.locator("#valuation-phone").fill("555-222-3333");
  await page.locator("#valuation-category").selectOption("fine-art");
  await page
    .locator("#valuation-description")
    .fill("Test valuation submission from Playwright.");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /select files/i }).click();
  const chooser = await chooserPromise;
  const png1x1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/cck0P0AAAAASUVORK5CYII=";
  await chooser.setFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(png1x1, "base64"),
  });
  await expect(page.getByText("test.png", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /submit for valuation/i }).click();
  await expect(page.getByText("Request submitted", { exact: true })).toBeVisible();

  const valuationSubmission = await db.execute({
    sql: "SELECT id FROM lead_submissions WHERE type = ? AND email = ? ORDER BY created_at DESC LIMIT 1",
    args: ["valuation", valuationEmail.toLowerCase()],
  });
  const submissionId = valuationSubmission.rows[0]?.id as string | undefined;
  expect(submissionId).toBeTruthy();

  const uploads = await db.execute({
    sql: "SELECT path FROM lead_uploads WHERE submission_id = ?",
    args: [submissionId!],
  });
  expect(uploads.rows.length).toBe(1);

  // Best-effort cleanup of uploaded files to keep the repo tidy in repeated runs.
  let hasFilesystemUploads = false;
  for (const row of uploads.rows) {
    const relativePath = row.path as string | null | undefined;
    if (!relativePath) continue;
    if (relativePath.startsWith("db:")) continue;
    hasFilesystemUploads = true;
    await rm(path.join(process.cwd(), relativePath), { force: true }).catch(() => {});
  }
  if (hasFilesystemUploads) {
    await rm(
      path.join(process.cwd(), "db", "uploads", "valuation-requests", submissionId!),
      { recursive: true, force: true }
    ).catch(() => {});
  }

  db.close();
});
