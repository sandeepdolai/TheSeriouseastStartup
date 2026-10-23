import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Website Template | Paper Stish",
  description: "Preview a Paper Stish website template.",
  robots: { index: false, follow: false },
};

export default function WebsiteTemplateDetailPage() {
  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="website-templates" />
      </FolioProvider>
    </AuthProvider>
  );
}
