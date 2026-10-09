import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://the-seriouseast-startup.vercel.app";
const siteTitle = "Paper Stish | Personal Websites";
const siteDescription =
  "Create a personal design, then publish it as a shareable website with Paper Stish.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "Paper Stish",
  keywords: [
    "Paper Stish",
    "personal websites",
    "shareable websites",
    "personal design",
    "Smart Edit",
  ],
  authors: [{ name: "Paper Stish" }],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    siteName: "Paper Stish",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
          @font-face {
            font-display: swap;
            font-family: sans;
            font-style: normal;
            font-weight: 200 1000;
            src: url(${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/ABCDiatypePlusVariable.woff2) format("woff2-variations");
          }
        `}</style>
      </head>
      <body className="antialiased bg-black text-white">{children}</body>
    </html>
  );
}
