import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Audiências Brasileirão",
  description: "Dashboard de audiências do Brasileirão",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const loggedIn = !!jar.get("auth");

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {loggedIn && <Nav />}
        <main className={loggedIn ? "max-w-screen-2xl mx-auto px-6" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
