import type { Metadata } from "next";
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

  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="project" initialProjectSlug={slug} />
      </FolioProvider>
    </AuthProvider>
  );
}
