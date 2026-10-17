import DodoPayments from "dodopayments";

export type DodoPaymentsEnvironment = "test_mode" | "live_mode";

/**
 * Treat an unset environment as test mode. Reject any other value so a typo
 * can never silently select a different payment environment.
 */
export function getDodoPaymentsEnvironment(): DodoPaymentsEnvironment | null {
  const value = process.env.DODO_PAYMENTS_ENVIRONMENT?.trim();
  if (!value) return "test_mode";
  return value === "test_mode" || value === "live_mode" ? value : null;
}

/**
 * Checkout must stay disabled until the API key, subscription product and
 * webhook signing key are all present. Without the webhook key, a paid
 * checkout could succeed but Paper Stish would never verify Pro activation.
 */
export function isDodoPaymentsConfigured(): boolean {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY?.trim() &&
    process.env.DODO_PAYMENTS_PRODUCT_ID?.trim() &&
    process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() &&
    getDodoPaymentsEnvironment(),
  );
}

/** All Dodo API traffic and webhook verification stay server-side. */
export function getDodoPaymentsClient() {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) throw new Error("DODO_PAYMENTS_API_KEY is not configured.");

  const environment = getDodoPaymentsEnvironment();
  if (!environment) throw new Error("DODO_PAYMENTS_ENVIRONMENT must be test_mode or live_mode.");

  return new DodoPayments({
    bearerToken,
    environment,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim(),
  });
}
