import type { Metadata, Viewport } from "next";
import { Anton, Archivo_Black, Inter, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Muka huruf untuk area dashboard (arah desain "Kabut").
const schibsted = Schibsted_Grotesk({
  variable: "--font-kabut",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", subsets: ["latin"], weight: "400", preload: false });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400", preload: false });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Gentanala - Luxury Watches with Digital Identity",
  description: "Premium timepieces with embedded NFC technology. Each watch carries a unique digital identity.",
  keywords: ["luxury watches", "NFC watches", "digital identity", "phygital", "gentanala"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GenHub",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${schibsted.variable} ${archivoBlack.variable} ${anton.variable} font-sans antialiased bg-white text-zinc-900`}>
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
