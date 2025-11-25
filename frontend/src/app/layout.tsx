import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "BuhBot Admin",
  description: "Платформа автоматизации коммуникаций для бухгалтерских фирм",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <TRPCProvider>{children}</TRPCProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
