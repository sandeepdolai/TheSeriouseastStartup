/**
 * Paper Stish — published-media storage policy tests.
 *
 * Run with the plain Node test runner (type stripping needs Node >= 23.6):
 *   node --test tests/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  cloudinaryMediaConfigured,
  embeddedMediaError,
  isEmbeddedImage,
  smartEditEmbeddedImageCount,
  templateValuesEmbeddedImageCount,
} from "../src/lib/publishedMediaPolicy.ts";

const DATA_URL = "data:image/webp;base64,UklGRhoAABXRUJQVlA4TA";
const CLOUDINARY_URL = "https://res.cloudinary.com/demo-cloud/image/upload/v1/paper-stish/x";
const BUNDLED_URL = "/smart-edit/library/stickers/heart.png";
const HTTPS_URL = "https://example.com/photo.jpg";

test("isEmbeddedImage detects only base64 image payloads", () => {
  assert.equal(isEmbeddedImage(DATA_URL), true);
  assert.equal(isEmbeddedImage("data:font/woff2;base64,AAECAW=="), false);
  assert.equal(isEmbeddedImage(CLOUDINARY_URL), false);
  assert.equal(isEmbeddedImage(BUNDLED_URL), false);
  assert.equal(isEmbeddedImage(HTTPS_URL), false);
  assert.equal(isEmbeddedImage(undefined), false);
  assert.equal(isEmbeddedImage(42), false);
});

test("smartEditEmbeddedImageCount counts image/sticker layers only", () => {
  assert.equal(
    smartEditEmbeddedImageCount({
      layers: [
        { type: "image", url: DATA_URL },
        { type: "image", url: CLOUDINARY_URL },
        { type: "sticker", url: DATA_URL },
        { type: "sticker", url: BUNDLED_URL },
        { type: "text", url: DATA_URL }, // text layers never carry image URLs
      ],
    }),
    2,
  );
  assert.equal(smartEditEmbeddedImageCount({ layers: [] }), 0);
  assert.equal(smartEditEmbeddedImageCount({}), 0);
});

test("smartEditEmbeddedImageCount ignores embedded user fonts by design", () => {
  assert.equal(
    smartEditEmbeddedImageCount({
      layers: [],
      fonts: [{ source: "user", dataUrl: "data:font/woff2;base64,AAECAW==" }],
    }),
    0,
  );
});

test("templateValuesEmbeddedImageCount counts photoUrl and album images", () => {
  assert.equal(
    templateValuesEmbeddedImageCount({
      photoUrl: DATA_URL,
      images: [DATA_URL, HTTPS_URL, DATA_URL],
    }),
    3,
  );
  assert.equal(templateValuesEmbeddedImageCount({ photoUrl: HTTPS_URL }), 0);
  assert.equal(templateValuesEmbeddedImageCount({ photoUrl: null }), 0);
  assert.equal(templateValuesEmbeddedImageCount({ images: [HTTPS_URL] }), 0);
  assert.equal(templateValuesEmbeddedImageCount({}), 0);
});

test("cloudinaryMediaConfigured requires the SERVER-side Cloudinary credentials", () => {
  const saved = { ...process.env };

  process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
  process.env.CLOUDINARY_API_KEY = "demo-key";
  process.env.CLOUDINARY_API_SECRET = "demo-secret";
  assert.equal(cloudinaryMediaConfigured(), true);

  // Falls back to the public cloud name when CLOUDINARY_CLOUD_NAME is unset.
  delete process.env.CLOUDINARY_CLOUD_NAME;
  process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME = "demo-cloud";
  assert.equal(cloudinaryMediaConfigured(), true);

  delete process.env.CLOUDINARY_API_SECRET;
  assert.equal(cloudinaryMediaConfigured(), false);

  process.env.CLOUDINARY_API_SECRET = "   ";
  assert.equal(cloudinaryMediaConfigured(), false);

  for (const key of Object.keys(saved)) process.env[key] = saved[key];
  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME",
  ]) {
    if (!(key in saved)) delete process.env[key];
  }
});

test("embeddedMediaError renders singular and plural messages", () => {
  assert.match(embeddedMediaError(1), /a photo that is/);
  assert.match(embeddedMediaError(3), /3 photos that are/);
});
