import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { WebsiteTemplateBuilder } from "@/components/website-templates/WebsiteTemplateBuilder";

export const metadata: Metadata = {
  title: "Website Templates | Paper Stish",
  description: "Customize and publish a code-built personal website with Paper Stish.",
  robots: { index: false, follow: false },
};

export default function WebsiteTemplatesPage() {
  return (
    <AuthProvider>
      <WebsiteTemplateBuilder />
    </AuthProvider>
  );
}
