import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { JobProvider } from "@/lib/job-context";

export const metadata: Metadata = {
  title: "Site Buddy | Intelligent Construction Workflow Management",
  description: "AI-powered construction workflow platform with voice notes, document processing, and real-time collaboration for field teams",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Site Buddy",
  },
};

export const viewport: Viewport = {
  themeColor: "#0078D4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <JobProvider>
            {children}
          </JobProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

