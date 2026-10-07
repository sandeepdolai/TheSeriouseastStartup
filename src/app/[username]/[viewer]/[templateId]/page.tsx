import type { Metadata } from "next";
import { PublishedTemplateViewer } from "@/components/PublishedTemplateViewer";

interface PageProps {
  params: Promise<{
    username: string;
    viewer: string;
    templateId: string;
  }>;
}

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
 * Rendered on demand by the server; the viewer resolves the templateId
 * against the publication API (or a legacy #data= payload in the fragment).
 */
export default async function PublishedPage({ params }: PageProps) {
  const { username, viewer, templateId } = await params;
  return (
    <PublishedTemplateViewer
      username={decodeURIComponent(username)}
      viewerName={decodeURIComponent(viewer)}
      templateId={decodeURIComponent(templateId)}
    />
  );
}
