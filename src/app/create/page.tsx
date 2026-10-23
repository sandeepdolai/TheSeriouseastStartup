"use client";

import { FolioProvider } from "@/gl/react";
import { AuthProvider } from "@/components/AuthProvider";
import { App } from "@/components/App";

export default function Page() {
  return (
    <AuthProvider>
      <FolioProvider>
        <App />
      </FolioProvider>
    </AuthProvider>
  );
}
