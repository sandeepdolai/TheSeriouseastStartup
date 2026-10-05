import type { Metadata } from "next";
import { PublishedTemplateViewer } from "@/components/PublishedTemplateViewer";

interface PageProps {
  params: Promise<{
    username: string;
    viewer: string;
    templateId: string;
  }>;
}

export function generateStaticParams() {
  return [];
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

export default function PublishedPage() {
  return <PublishedTemplateViewer />;
}
