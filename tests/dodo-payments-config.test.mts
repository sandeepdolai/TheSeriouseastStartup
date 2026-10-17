import test from "node:test";
import assert from "node:assert/strict";

import {
  getDodoPaymentsEnvironment,
  isDodoPaymentsConfigured,
} from "../src/lib/dodoPayments.ts";

test("Dodo checkout stays disabled until all server settings are ready", () => {
  const names = [
    "DODO_PAYMENTS_API_KEY",
    "DODO_PAYMENTS_PRODUCT_ID",
    "DODO_PAYMENTS_WEBHOOK_KEY",
    "DODO_PAYMENTS_ENVIRONMENT",
  ] as const;
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  try {
    for (const name of names) delete process.env[name];

    assert.equal(getDodoPaymentsEnvironment(), "test_mode");
    assert.equal(isDodoPaymentsConfigured(), false);

    process.env.DODO_PAYMENTS_API_KEY = "test_api_key";
    process.env.DODO_PAYMENTS_PRODUCT_ID = "prod_test";
    assert.equal(isDodoPaymentsConfigured(), false, "a webhook signing secret is required before checkout");

    process.env.DODO_PAYMENTS_WEBHOOK_KEY = "test_webhook_key";
    assert.equal(isDodoPaymentsConfigured(), true, "complete settings default safely to test mode");

    process.env.DODO_PAYMENTS_ENVIRONMENT = "test_mode";
    assert.equal(isDodoPaymentsConfigured(), true);

    process.env.DODO_PAYMENTS_ENVIRONMENT = "live_mode";
    assert.equal(isDodoPaymentsConfigured(), true);

    process.env.DODO_PAYMENTS_ENVIRONMENT = "production";
    assert.equal(getDodoPaymentsEnvironment(), null);
    assert.equal(isDodoPaymentsConfigured(), false, "unknown environment values must block checkout");
  } finally {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
