import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Edit Website Draft | Paper Stish",
  description: "Continue editing your saved Paper Stish website draft.",
  robots: { index: false, follow: false },
};

export default function WebsiteTemplateEditPage() {
  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="website-templates" />
      </FolioProvider>
    </AuthProvider>
  );
}
