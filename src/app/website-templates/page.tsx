import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { FolioProvider } from "@/gl/react";
import { App } from "@/components/App";

export const metadata: Metadata = {
  title: "Website Templates | Paper Stish",
  description: "Browse website templates in Paper Stish. Website editing is coming later.",
  robots: { index: false, follow: false },
};

export default function WebsiteTemplatesPage() {
  return (
    <AuthProvider>
      <FolioProvider>
        <App initialView="website-templates" />
      </FolioProvider>
    </AuthProvider>
  );
}
