import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import "@/components/arc/foundation.css";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Marketing LATAM", template: "%s · Marketing LATAM" },
  description: "Solicitudes y flujo de trabajo del equipo de marketing de ATFX LATAM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script sets data-theme before paint, so the server markup and the live attribute differ by design.
    <html lang="es" className={`${geist.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
