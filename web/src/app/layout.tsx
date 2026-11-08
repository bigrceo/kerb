import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { SolProvider } from "@/components/SolProvider";
import { Header } from "@/components/Header";
import { Reveal } from "@/components/Reveal";
import { Footer } from "@/components/Footer";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
  description: BRAND.pitch,
  metadataBase: new URL(BRAND.url),
};

export const viewport: Viewport = { themeColor: BRAND.colors.ink, width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Web3Provider>
          <SolProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Reveal />
          </SolProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
