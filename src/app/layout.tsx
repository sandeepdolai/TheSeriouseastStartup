import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jesper Landberg",
  description:
    "Jesper Landberg, Swedish design engineer, named Awwwards Independent of the Year in 2022 and 2024, building visually rich, motion-driven websites.",
  keywords: [
    "Jesper Landberg",
    "design engineer",
    "creative developer",
    "WebGL",
    "motion design",
  ],
  authors: [{ name: "Jesper Landberg" }],
  openGraph: {
    title: "Jesper Landberg",
    description:
      "Design engineer building visually rich, motion-driven websites. 77 awards — 30× Awwwards, 40× FWA, 3× Webby, 2× Lovie.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
