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

/** The publication is looked up on every request — the database is the
 *  source of truth for published websites. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, viewer } = await params;
  const safeViewer = decodeURIComponent(viewer);
  const safeUsername = decodeURIComponent(username);

  return {
    title: safeViewer + " · Paper Stish",
    description:
      "A personal website made for " +
      safeViewer +
      " by " +
      safeUsername +
      " on Paper Stish.",
  };
}

/**
 * Public published-website route: /{username}/{viewerName}/{templateId}.
 *
 * Rendered on demand by the server: the publication snapshot is loaded
 * from the server-side publication storage here (never from the author's
 * or the visitor's browser) and handed to the read-only viewer. The client
 * component still understands legacy #data= links, but every new
 * publication resolves through this server-side lookup.
 */
export default async function PublishedPage({ params }: PageProps) {
  const { username, viewer, templateId } = await params;

  let publication: PublishedWebsitePayload | null = null;
  const id = decodeURIComponent(templateId);
  if (id && id.length <= 64) {
    try {
      const row = await db.publication.findUnique({ where: { templateId: id } });
      if (row) publication = publicationRowToPayload(row);
    } catch {
      publication = null; // storage hiccup — the viewer shows its missing state
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
