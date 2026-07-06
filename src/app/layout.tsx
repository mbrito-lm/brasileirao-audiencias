import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brasileirão | FFU",
  description: "Dashboard de audiências do Brasileirão",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
