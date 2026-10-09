import type { Metadata } from "next";
import { db } from "@/lib/db";
import { publicationRowToPayload, type PublishedWebsitePayload } from "@/lib/publications";
import { PublishedTemplateViewer } from "@/components/PublishedTemplateViewer";

interface PageProps {
  params: Promise<{
    username: string;
    viewer: string;
    templateId: string;
  }>;
}

/** Public sites are shareable by URL, but personal messages are not indexed by default. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, viewer, templateId } = await params;
  const safeViewer = decodeURIComponent(viewer).replace(/-/g, " ");
  const safeUsername = decodeURIComponent(username);
  let title = safeViewer || "Personal website";

  try {
    const id = decodeURIComponent(templateId);
    const row = id && id.length <= 64
      ? await db.publication.findUnique({ where: { templateId: id } })
      : null;
    if (row?.title?.trim()) title = row.title.trim();
  } catch {
    // Metadata should not prevent the page's public error state from rendering.
  }

  return {
    title: title + " · Paper Stish",
    description: "A personal website shared through Paper Stish.",
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      title,
      description: "A personal website shared through Paper Stish.",
      type: "website",
    },
  };
}

export default async function PublishedPage({ params }: PageProps) {
  const { username, viewer, templateId } = await params;

  let publication: PublishedWebsitePayload | null = null;
  const id = decodeURIComponent(templateId);
  if (id && id.length <= 64) {
    try {
      const row = await db.publication.findUnique({ where: { templateId: id } });
      if (row) publication = publicationRowToPayload(row);
    } catch {
      publication = null;
    }
  }

  return (
    <PublishedTemplateViewer
      username={decodeURIComponent(username)}
      viewerName={decodeURIComponent(viewer)}
      templateId={id}
      initialPublication={publication}
    />
  );
}
