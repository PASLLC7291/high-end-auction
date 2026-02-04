import Stripe from "stripe";
import fs from "fs";
import path from "path";

function loadEnv() {
    const env = { ...process.env };
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
            if (!line || line.startsWith("#") || !line.includes("=")) continue;
            const index = line.indexOf("=");
            const key = line.slice(0, index);
            const value = line.slice(index + 1);
            if (!(key in env)) env[key] = value;
        }
    }
    return env;
}

function createCookieJar() {
    const jar = new Map();
    return {
        addFromResponse(res) {
            const setCookies =
                typeof res.headers.getSetCookie === "function"
                    ? res.headers.getSetCookie()
                    : [];
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

async function main() {
    const env = loadEnv();
    const baseUrl = env.NEXTAUTH_URL || "http://localhost:3000";
    const userId = process.env.TEST_USER_ID || "1";

    if (!env.STRIPE_SECRET_KEY) {
        throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const jar = createCookieJar();

    const csrf = await request(baseUrl, jar, "GET", "/api/auth/csrf");
    const csrfToken = csrf.data?.csrfToken;
    if (!csrfToken) {
        throw new Error("Failed to fetch CSRF token");
    }

    const form = new URLSearchParams();
    form.set("csrfToken", csrfToken);
    form.set("userId", userId);
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

    const session = await request(baseUrl, jar, "GET", "/api/auth/session");
    if (!session.data?.user) {
        throw new Error("No session after sign-in");
    }

    const beforeStatus = await request(baseUrl, jar, "GET", "/api/payments/status");

    const setupIntentRes = await request(baseUrl, jar, "POST", "/api/payments/setup-intent");
    const clientSecret = setupIntentRes.data?.clientSecret;
    if (!clientSecret) {
        throw new Error("Failed to create setup intent");
    }
    const setupIntentId = clientSecret.split("_secret_")[0];

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
    });

    const confirmed = await stripe.setupIntents.confirm(setupIntentId, {
        payment_method: paymentMethod.id,
    });
    if (confirmed.status !== "succeeded") {
        throw new Error(`Setup intent not succeeded: ${confirmed.status}`);
    }

    const storeRes = await request(baseUrl, jar, "POST", "/api/payments/store-method", {
        body: JSON.stringify({
            setupIntentId,
            billingAddress: {
                name: session.data.user.name || "Test User",
                line1: "123 Test St",
                city: "Test City",
                state: "CA",
                postalCode: "94105",
                country: "US",
            },
        }),
        headers: { "Content-Type": "application/json" },
    });
    if (!storeRes.res.ok) {
        throw new Error(`Store payment method failed: ${storeRes.res.status}`);
    }

    const afterStatus = await request(baseUrl, jar, "GET", "/api/payments/status");
    const tokenRes = await request(baseUrl, jar, "POST", "/api/protected/token", {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
    });

    console.log("Headless payment flow results:");
    console.log(`- User: ${session.data.user.id}`);
    console.log(`- Payment status before: ${beforeStatus.data?.hasPaymentMethod}`);
    console.log(`- Payment status after: ${afterStatus.data?.hasPaymentMethod}`);
    console.log(`- Bidder token status: ${tokenRes.res.status}`);
    if (tokenRes.data?.token) {
        console.log("- Bidder token issued");
    } else if (tokenRes.data?.error) {
        console.log(`- Bidder token error: ${tokenRes.data.error}`);
    }
}

main().catch((error) => {
    console.error("Headless payment flow failed:", error.message);
    process.exit(1);
});
