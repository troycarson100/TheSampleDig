import type { Metadata } from "next";
import { Geist, Geist_Mono, Halant } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const halant = Halant({
  variable: "--font-halant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sample Roll - Discover Rare Vinyl Samples",
  description: "Find and save rare vinyl samples for beat making",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${halant.variable} font-sans antialiased flex flex-col min-h-screen`}
      >
        <SessionProvider>
          <div className="flex flex-col min-h-screen">
            {children}
            <Footer />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
