import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Smart Edit | Paper Stish",
  description: "Continue editing your saved Paper Stish project.",
  robots: { index: false, follow: false },
};

export default async function SmartEditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="smart-edit" initialSmartEditProjectId={projectId} />
      </FolioProvider>
    </AuthProvider>
  );
}
