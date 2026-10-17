import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { BillingPage } from "@/components/BillingPage";

export const metadata: Metadata = {
  title: "Manage Subscription · Paper Stish",
  description: "Review your Paper Stish plan and manage billing securely.",
  robots: { index: false, follow: false },
};

export default function ManageSubscriptionPage() {
  return <AuthProvider><BillingPage mode="manage" /></AuthProvider>;
}
