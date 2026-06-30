import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Audiências Brasileirão",
  description: "Dashboard de audiências do Brasileirão",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <Nav />
        <main className="max-w-screen-2xl mx-auto px-6">{children}</main>
      </body>
    </html>
  );
}
