import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WEBSITE_TEMPLATES } from "@/lib/projects";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Website Template | Paper Stish",
  description: "Preview a Paper Stish website template.",
  robots: { index: false, follow: false },
};

export default async function WebsiteTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateSlug: string }>;
}) {
  const { templateSlug } = await params;
  if (!WEBSITE_TEMPLATES.some((template) => template.slug === templateSlug)) notFound();

  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="website-templates" />
      </FolioProvider>
    </AuthProvider>
  );
}
