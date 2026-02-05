import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load environment variables from .env.local for local/dev usage.
// Deployment platforms (Vercel/Netlify) provide env vars directly.
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("<") && trimmed.endsWith(">");
}

function printError(message: string) {
  console.error(`- ${message}`);
}

const EnvSchema = z
  .object({
    ACCOUNT_ID: z.string().min(1),
    NEXT_PUBLIC_ACCOUNT_ID: z.string().min(1),
    API_KEY: z.string().min(1),

    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),

    TURSO_DATABASE_URL: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().min(1),

    STRIPE_SECRET_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),

    BASTA_WEBHOOK_SECRET: z.string().min(1),

    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (isPlaceholder(env.API_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_KEY"],
        message: "API_KEY looks like a placeholder value",
      });
    }

    if (env.NEXT_PUBLIC_ACCOUNT_ID !== env.ACCOUNT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_ACCOUNT_ID"],
        message: "NEXT_PUBLIC_ACCOUNT_ID must match ACCOUNT_ID",
      });
    }

    const url = env.TURSO_DATABASE_URL.trim();
    if (url.startsWith("file:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TURSO_DATABASE_URL"],
        message:
          'TURSO_DATABASE_URL must be a remote URL for deployment (not "file:...")',
      });
    }

    const stripeSecret = env.STRIPE_SECRET_KEY.trim();
    if (!/^sk_(test|live)_/.test(stripeSecret)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_SECRET_KEY"],
        message: "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_",
      });
    }

    const stripePublishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim();
    if (!/^pk_(test|live)_/.test(stripePublishable)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
        message:
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_",
      });
    }

    const webhookSecret = env.STRIPE_WEBHOOK_SECRET.trim();
    if (!/^whsec_/.test(webhookSecret)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_WEBHOOK_SECRET"],
        message: "STRIPE_WEBHOOK_SECRET must start with whsec_",
      });
    }

    if (env.NEXT_PUBLIC_POSTHOG_KEY?.trim() && !env.NEXT_PUBLIC_POSTHOG_HOST?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_POSTHOG_HOST"],
        message: "NEXT_PUBLIC_POSTHOG_HOST is required when NEXT_PUBLIC_POSTHOG_KEY is set",
      });
    }
  });

function main() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Deployment environment check failed:");
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "env";
      printError(`${key}: ${issue.message}`);
    }
    console.error("");
    console.error("Set the missing/invalid variables in your deploy environment and retry.");
    process.exitCode = 1;
    return;
  }

  const env = result.data;

  const notes: string[] = [];
  if (env.STRIPE_SECRET_KEY.trim().startsWith("sk_live_")) {
    notes.push("STRIPE_SECRET_KEY is a LIVE key (expected test keys until you confirm).");
  }
  if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim().startsWith("pk_live_")) {
    notes.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a LIVE key (expected test keys until you confirm).");
  }

  console.log("Environment OK.");
  for (const note of notes) {
    console.warn(`WARN: ${note}`);
  }
}

main();
