import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { BillingPage } from "@/components/BillingPage";

export const metadata: Metadata = {
  title: "Upgrade to Pro · Paper Stish",
  description: "Review the Paper Stish Pro plan and continue to secure checkout.",
  robots: { index: false, follow: false },
};

export default function UpgradePage() {
  return <AuthProvider><BillingPage mode="upgrade" /></AuthProvider>;
}
