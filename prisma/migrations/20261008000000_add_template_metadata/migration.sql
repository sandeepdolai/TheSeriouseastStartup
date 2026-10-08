-- Template publish workflow: admin-provided metadata + stored preview.
--
-- Additive only — existing templates keep working after this migration:
--   • description  → NULL (the UI shows a sensible fallback line)
--   • previewUrl   → NULL (TemplateBrowser renders the document live,
--                    exactly as it did before this feature)
--   • previewPublicId → NULL (only present for Cloudinary-hosted previews)
--
-- Local development uses `prisma db push` (see package.json); this file is
-- the explicit migration for migrate-based deployments.

ALTER TABLE "CommunityTemplate" ADD COLUMN "description" TEXT;
ALTER TABLE "CommunityTemplate" ADD COLUMN "previewUrl" TEXT;
ALTER TABLE "CommunityTemplate" ADD COLUMN "previewPublicId" TEXT;
