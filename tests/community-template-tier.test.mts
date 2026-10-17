import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeCommunityTemplateDescription,
  encodeCommunityTemplateDescription,
} from "../src/lib/communityTemplateTier.ts";

test("Pro template metadata is stored without changing the public description", () => {
  const stored = encodeCommunityTemplateDescription("A lovely template", true);
  assert.notEqual(stored, "A lovely template");
  assert.deepEqual(decodeCommunityTemplateDescription(stored), {
    description: "A lovely template",
    isPro: true,
  });
});

test("Free and legacy templates stay Free and reveal no internal marker", () => {
  assert.deepEqual(decodeCommunityTemplateDescription("Free template"), {
    description: "Free template",
    isPro: false,
  });
  assert.deepEqual(decodeCommunityTemplateDescription(null), {
    description: "",
    isPro: false,
  });
  assert.deepEqual(decodeCommunityTemplateDescription(encodeCommunityTemplateDescription("", true)), {
    description: "",
    isPro: true,
  });
});
