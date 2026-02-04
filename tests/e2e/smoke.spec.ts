import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";

test("smoke: auth, session token, watchlist, settings", async ({ page, request }) => {
  page.on("pageerror", (error) => {
    // Useful when Next.js renders the global error boundary without surfacing the root cause in the test output
    console.error("PAGEERROR:", error);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("BROWSER CONSOLE ERROR:", msg.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() === 400) {
      console.error("HTTP 400:", response.url());
    }
  });

  const password = "Password123!";
  const email = `e2e_${Date.now()}@example.com`;
  const name = "E2E User";

  const signupRes = await request.post("/api/auth/signup", {
    data: { name, email, password },
  });
  expect(signupRes.status(), await signupRes.text()).toBe(201);

  const signupJson = (await signupRes.json()) as { user?: { id: string } };
  const userId = signupJson.user?.id;
  expect(userId).toBeTruthy();

  // Seed a "payment method" so bidder token generation is enabled in auth callbacks.
  const db = createClient({ url: "file:./db/local.db" });
  await db.execute({
    sql: `INSERT INTO payment_profiles (user_id, stripe_customer_id, default_payment_method_id)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            stripe_customer_id = excluded.stripe_customer_id,
            default_payment_method_id = excluded.default_payment_method_id,
            updated_at = datetime('now')`,
    args: [userId!, `cus_e2e_${userId}`, `pm_e2e_${userId}`],
  });

  // Login
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/");

  // Bidder token should now be present in the session
  const token = await page.evaluate(async () => {
    const res = await fetch("/api/protected/token", { method: "POST" });
    const json = await res.json();
    return json.token as string | null;
  });
  expect(token).toBeTruthy();
  expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

  // Payment status should recognize the seeded method
  const paymentStatus = await page.evaluate(async () => {
    const res = await fetch("/api/payments/status");
    return (await res.json()) as { hasPaymentMethod?: boolean };
  });
  expect(paymentStatus?.hasPaymentMethod).toBe(true);

  // Settings save + reload
  await page.goto("/account/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Phone Number").fill("+1 (555) 000-0000");
  await page.getByLabel("Location").fill("Sacramento, CA");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile updated", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Phone Number")).toHaveValue("+1 (555) 000-0000");
  await expect(page.getByLabel("Location")).toHaveValue("Sacramento, CA");

  // Toggle a preference and save
  await page.getByLabel("Marketing Emails").click();
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect(page.getByText("Preferences updated", { exact: true })).toBeVisible();

  // Watchlist toggle (skip if no auctions/lots available)
  await page.goto("/auctions");
  const auctionLinks = await page
    .locator('a[href^="/auction/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")).filter(Boolean) as string[]);

  const auctionHref = auctionLinks.find((href) => /^\/auction\/[A-Za-z0-9-]+$/.test(href));
  if (auctionHref) {
    await page.goto(auctionHref);

    const lotHref = await page
      .locator('a[href*="/lot/"]')
      .first()
      .getAttribute("href");

    if (lotHref) {
      await page.goto(lotHref);
      await page.getByTitle("Add to watchlist").click();
      await expect(page.getByText("Added to watchlist", { exact: true })).toBeVisible();

      await page.goto("/account/watchlist");
      await expect(page.getByRole("heading", { name: "Watchlist" })).toBeVisible();
      const removeButtons = page.getByTitle("Remove from watchlist");
      await expect(removeButtons.first()).toBeVisible();
      const beforeCount = await removeButtons.count();
      await removeButtons.first().click();
      await expect(removeButtons).toHaveCount(Math.max(0, beforeCount - 1));
    }
  }

  // Password change + re-login
  await page.goto("/account/settings");
  await page.getByLabel("Current Password").fill(password);
  const newPassword = "Password123!_new";
  await page.getByLabel("New Password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm New Password").fill(newPassword);
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByText("Password updated", { exact: true })).toBeVisible();

  // Sign out
  await page.goto("/");
  await page.getByRole("button", { name: /e2e/i }).click();
  await page.getByRole("menuitem", { name: /log out/i }).click();
  await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();

  // Re-login with new password
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/");
  await expect(page.getByRole("button", { name: /e2e/i })).toBeVisible();
});
