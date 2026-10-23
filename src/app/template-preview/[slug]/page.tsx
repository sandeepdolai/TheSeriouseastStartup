import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  WebsiteTemplatePreviewRenderer,
  type WebsiteTemplatePreviewSlug,
} from "@/components/website-templates/WebsiteTemplatePreviewRenderer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website template preview",
  robots: { index: false, follow: false },
};

const PREVIEW_SLUGS: WebsiteTemplatePreviewSlug[] = [
  "red-letter",
  "love-heart",
  "forever-and-ever",
  "our-calendar",
  "birthday-today",
  "love-of-my-life",
  "birthday-template",
  "photo-album",
  "introducing-him",
];

export default async function WebsiteTemplatePreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!PREVIEW_SLUGS.includes(slug as WebsiteTemplatePreviewSlug)) notFound();

  return <WebsiteTemplatePreviewRenderer slug={slug as WebsiteTemplatePreviewSlug} />;
}
