import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
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
    <html lang="es" className={`${geist.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
