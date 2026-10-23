import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURED } from "@/lib/projects";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Project Preview | Paper Stish",
  robots: { index: false, follow: false },
};

export default async function FeaturedProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!FEATURED.some((project) => project.slug === slug)) notFound();

  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="project" initialProjectSlug={slug} />
      </FolioProvider>
    </AuthProvider>
  );
}
