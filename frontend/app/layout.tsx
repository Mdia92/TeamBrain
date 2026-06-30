import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { CapacitorBootstrap } from "@/components/capacitor-bootstrap";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TeamBrain — Plateforme d'équipe",
  description: "TeamBrain — coordination d'équipe pour organisations avec agents terrain",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TeamBrain" },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen font-sans antialiased`}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <CapacitorBootstrap />
              <ServiceWorkerRegister />
              {children}
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
