import type { Metadata, Viewport } from "next";
import { PipDock } from "@/components/mascot/PipDock";
import { AppMotion } from "@/components/ui/AppMotion";
import "./fonts.css";
import "./globals.css";
import { deploymentRecovery } from "@/lib/deployment-recovery";

export const metadata: Metadata = {
  title: "Boilerplate",
  description: "See who is near the red line before anyone blows.",
};

export const viewport: Viewport = {
  themeColor: "#15120E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/6c25f6e897d845a3-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/e4af272ccee01ff0-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/558ca1a6aa3cb55e-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: deploymentRecovery }} />
      </head>
      <body className="antialiased">
        <AppMotion>
          {children}
          <PipDock />
        </AppMotion>
      </body>
    </html>
  );
}
