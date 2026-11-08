import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata, Viewport } from "next";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { Agentation } from "agentation";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  applicationName: "Achilias",
  appleWebApp: { capable: true, title: "Achilias", statusBarStyle: "default" },
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
  formatDetection: { telephone: false },
  title: {
    default: "Achilias",
    template: "%s · Achilias",
  },
  description:
    "A calmer frontend for ILIAS courses, files, forums and exercises.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#245c49",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider>
            <PwaProvider>
              {children}
              <Toaster />
            </PwaProvider>
          </TooltipProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
