import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Edit Website Draft | Paper Stish",
  description: "Continue editing your saved Paper Stish website draft.",
  robots: { index: false, follow: false },
};

const editableTemplates = new Set([
  "red-letter",
  "introducing-him",
  "love-of-my-life",
  "birthday-template",
  "birthday-today",
  "photo-album",
  "love-heart",
  "forever-and-ever",
  "our-calendar",
]);

export default async function WebsiteTemplateEditPage({
  params,
}: {
  params: Promise<{ templateSlug: string }>;
}) {
  const { templateSlug } = await params;
  if (!editableTemplates.has(templateSlug)) notFound();

  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="website-templates" />
      </FolioProvider>
    </AuthProvider>
  );
}
