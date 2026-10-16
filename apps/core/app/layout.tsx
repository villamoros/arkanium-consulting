import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arkanium · Core",
  description: "Core de Arkanium",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider afterSignOutUrl={process.env.NEXT_PUBLIC_WEB_URL}>
      <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* suppressHydrationWarning: extensiones del navegador (p. ej. Grammarly) añaden atributos al body antes de hidratar. */}
        <body suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
