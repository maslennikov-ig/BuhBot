import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Spectral, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc-provider";
import { Toaster } from "sonner";
import { ScrollProgress } from "@/components/ScrollProgress";
import { ThemeProvider } from "@/components/theme-provider";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--buh-font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontSerif = Spectral({
  subsets: ["latin", "cyrillic"],
  variable: "--buh-font-serif",
  weight: ["400", "500", "600"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--buh-font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "BuhBot Admin",
  description: "Платформа автоматизации коммуникаций для бухгалтерских фирм",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png" },
    ],
  },
  openGraph: {
    title: "BuhBot Admin",
    description: "Платформа автоматизации коммуникаций для бухгалтерских фирм",
    images: ["/images/logo/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BuhBot Admin",
    description: "Платформа автоматизации коммуникаций для бухгалтерских фирм",
    images: ["/images/logo/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`antialiased ${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ScrollProgress />
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
