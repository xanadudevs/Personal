import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miúdos 2026",
  description: "Com quem ficam os miúdos, dia a dia",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Miúdos", statusBarStyle: "default" },
  icons: { icon: "/miudos-icon.svg", apple: "/miudos-icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#2f86c4", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#f3f5f7] px-4 py-5 text-[#1d2530]">{children}</body>
    </html>
  );
}
