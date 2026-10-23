import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Paper Stish Workspace",
  robots: { index: false, follow: false },
};

const sections = ["my", "saved", "website-templates"] as const;

export default async function CreateSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();

  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView={section as (typeof sections)[number]} />
      </FolioProvider>
    </AuthProvider>
  );
}
