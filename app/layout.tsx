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
  // Keep one clickable domain above the large image. Emit these tags explicitly:
  // Next's Open Graph/Twitter helpers otherwise refill omitted titles and descriptions.
  // https://docs.discord.com/developers/link-previews/overview#preview-layouts
  other: {
    "og:type": "website",
    "og:locale": "en_US",
    "og:url": "https://boilerplate.select/",
    "og:title": "boilerplate.select",
    "og:image": "https://boilerplate.select/social/boilerplate-v4.png",
    "og:image:width": 1200,
    "og:image:height": 630,
    "og:image:type": "image/png",
    "og:image:alt": "Boilerplate — ARE YOU NEAR THE RED LINE? Pip, the boiler companion, waves beside the headline.",
    "twitter:card": "summary_large_image",
    "twitter:title": "boilerplate.select",
    "twitter:image": "https://boilerplate.select/social/boilerplate-v4.png",
    "twitter:image:alt": "Boilerplate — ARE YOU NEAR THE RED LINE? Pip, the boiler companion, waves beside the headline.",
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
