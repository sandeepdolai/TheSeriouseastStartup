import test from "node:test";
import assert from "node:assert/strict";

import {
  FREE_SMART_EDIT_PHOTO_LIMIT,
  hasProAccess,
  hasProOrAdminAccess,
} from "../src/lib/planAccess.ts";

const NOW = Date.parse("2026-10-17T00:00:00.000Z");

test("only active subscriptions with a future or absent end date unlock Pro", () => {
  assert.equal(hasProAccess({ subscriptionStatus: "free" }, NOW), false);
  assert.equal(hasProAccess({ subscriptionStatus: "cancelled" }, NOW), false);
  assert.equal(hasProAccess({ subscriptionStatus: "active", subscriptionPeriodEnd: "2026-10-16T00:00:00Z" }, NOW), false);
  assert.equal(hasProAccess({ subscriptionStatus: "active", subscriptionPeriodEnd: "not-a-date" }, NOW), false);
  assert.equal(hasProAccess({ subscriptionStatus: "active", subscriptionPeriodEnd: "2026-10-18T00:00:00Z" }, NOW), true);
  assert.equal(hasProAccess({ subscriptionStatus: "active", subscriptionPeriodEnd: null }, NOW), true);
});

test("admin access is explicit and Free photo allowance is ten active photo layers", () => {
  assert.equal(hasProOrAdminAccess({ subscriptionStatus: "free" }, true, NOW), true);
  assert.equal(hasProOrAdminAccess({ subscriptionStatus: "free" }, false, NOW), false);
  assert.equal(FREE_SMART_EDIT_PHOTO_LIMIT, 10);
});
