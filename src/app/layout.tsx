import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nyaksai — Invisible AI Assistant for Interviews",
  description:
    "One overlay, no tab, no trace. Nyaksai reads your screen, listens to the call and streams the right answer — invisible to screen sharing and absent from the taskbar in the desktop shell.",
  keywords: [
    "Nyaksai",
    "invisible AI",
    "interview assistant",
    "screen share overlay",
    "live transcription",
    "BYOK",
  ],
  icons: {
    icon: "/nyaksai-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b0e14] text-neutral-100`}
      >
        {children}
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
