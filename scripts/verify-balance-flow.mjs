import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function createCookieJar() {
  const jar = new Map();
  return {
    addFromResponse(res) {
      const setCookies =
        typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const cookie of setCookies) {
        const [pair] = cookie.split(";");
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        const key = pair.slice(0, idx);
        const value = pair.slice(idx + 1);
        jar.set(key, value);
      }
    },
    header() {
      if (jar.size === 0) return undefined;
      return Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
  };
}

async function request(baseUrl, jar, method, url, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookieHeader = jar.header();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers,
    body: options.body,
  });
  jar.addFromResponse(res);
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createPromo({ code, amountCents, description }) {
  const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./db/local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  const db = createClient({ url, authToken });

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO balance_promotions (
        id, code, amount_cents, currency, description, active, created_at
      ) VALUES (?, ?, ?, 'USD', ?, 1, ?)
    `,
    args: [id, code, amountCents, description ?? null, createdAt],
  });
  db.close();

  return { id };
}

async function main() {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const password = process.env.TEST_PASSWORD || "Password123!";
  const email = process.env.TEST_EMAIL || `balance_flow_${Date.now()}@example.com`;
  const name = process.env.TEST_NAME || "Balance Flow User";

  const code = `BAL${Date.now().toString(36).toUpperCase()}`;
  const amountCents = 500;

  await createPromo({ code, amountCents, description: "Balance promo smoke test" });

  const jar = createCookieJar();

  const signup = await request(baseUrl, jar, "POST", "/api/auth/signup", {
    body: JSON.stringify({ email, password, name }),
    headers: { "Content-Type": "application/json" },
  });
  if (!signup.res.ok && signup.res.status !== 409) {
    throw new Error(`Signup failed: ${signup.res.status}`);
  }

  const csrf = await request(baseUrl, jar, "GET", "/api/auth/csrf");
  const csrfToken = csrf.data?.csrfToken;
  if (!csrfToken) {
    throw new Error("Failed to fetch CSRF token");
  }

  const form = new URLSearchParams();
  form.set("csrfToken", csrfToken);
  form.set("email", email);
  form.set("password", password);
  form.set("callbackUrl", baseUrl);
  form.set("json", "true");
  form.set("redirect", "false");

  const signin = await request(baseUrl, jar, "POST", "/api/auth/callback/credentials", {
    body: form.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!signin.res.ok) {
    throw new Error(`Sign-in failed: ${signin.res.status}`);
  }

  const before = await request(baseUrl, jar, "GET", "/api/account/balance");
  if (!before.res.ok) {
    throw new Error(`Balance before failed: ${before.res.status}`);
  }

  const redeem = await request(baseUrl, jar, "POST", "/api/balance/redeem", {
    body: JSON.stringify({ code }),
    headers: { "Content-Type": "application/json" },
  });
  if (!redeem.res.ok) {
    throw new Error(`Redeem failed: ${redeem.res.status} ${JSON.stringify(redeem.data)}`);
  }

  let after = await request(baseUrl, jar, "GET", "/api/account/balance");
  for (let attempt = 0; attempt < 5; attempt++) {
    if (after.res.ok && Number(after.data?.balanceCents ?? 0) >= amountCents) break;
    await sleep(500);
    after = await request(baseUrl, jar, "GET", "/api/account/balance");
  }

  console.log("Headless balance flow results:");
  console.log(`- Code: ${code}`);
  console.log(`- Balance before: ${before.data?.balanceCents} cents`);
  console.log(`- Balance after: ${after.data?.balanceCents} cents`);
}

main().catch((error) => {
  console.error("Headless balance flow failed:", error.message);
  process.exit(1);
});
