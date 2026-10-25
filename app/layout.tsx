import type { Metadata, Viewport } from "next";
import { PipDock } from "@/components/mascot/PipDock";
import { AppMotion } from "@/components/ui/AppMotion";
import "./fonts.css";
import "./globals.css";
import "@/components/ui/flame-loader.css";
import { deploymentRecovery } from "@/lib/deployment-recovery";
import { PipConversationProvider } from "@/components/mascot/PipConversation";

export const metadata: Metadata = {
  metadataBase: new URL("https://boilerplate.select"),
  title: "Boilerplate",
  description: "ARE YOU NEAR THE RED LINE?",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Boilerplate",
    url: "https://boilerplate.select/",
    title: "Boilerplate",
    description: "ARE YOU NEAR THE RED LINE?",
    images: [{
      url: "/social/boilerplate-v4.png",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "Boilerplate — ARE YOU NEAR THE RED LINE? Pip, the boiler companion, waves beside the headline.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boilerplate",
    description: "ARE YOU NEAR THE RED LINE?",
    images: [{
      url: "/social/boilerplate-v4.png",
      alt: "Boilerplate — ARE YOU NEAR THE RED LINE? Pip, the boiler companion, waves beside the headline.",
    }],
  },
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
          <PipConversationProvider>
          {children}
          <PipDock />
          </PipConversationProvider>
        </AppMotion>
      </body>
    </html>
  );
}
