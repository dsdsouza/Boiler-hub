import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import { PipDock } from "@/components/mascot/PipDock";
import { AppMotion } from "@/components/ui/AppMotion";
import "./globals.css";
import { deploymentRecovery } from "@/lib/deployment-recovery";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
    <html lang="en" className={`${bebas.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: deploymentRecovery }} /></head>
      <body className="antialiased">
        <AppMotion>
          {children}
          <PipDock />
        </AppMotion>
      </body>
    </html>
  );
}
