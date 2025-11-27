// src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context"; // 🚨 Import du Provider
import { ThemeProvider } from "next-themes";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kpaya Agent Dashboard",
  description: "Espace de gestion pour les agents de recyclage Kpaya.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        {/* 🚨 Utilisation du ThemeProvider et du AuthProvider */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
                {children}
            </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}