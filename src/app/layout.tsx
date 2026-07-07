import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

// Grotesca geométrica auto-hospedada (aproximação da Styrene, fonte do Claude).
// Baixada no build e servida do próprio domínio — não depende de recurso externo.
const claudeFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-claude",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brasileirão | FFU",
  description: "Dashboard de audiências do Brasileirão",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={claudeFont.variable}>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
