import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { auth } from "@/auth";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Brasileirão | FFU",
  description: "Dashboard de audiências do Brasileirão",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const hdrs = await headers();
  const pathname = hdrs.get("x-invoke-path") ?? hdrs.get("next-url") ?? "";
  const isLoginPage = pathname.startsWith("/login") || pathname.includes("/api/auth");

  const showNav = session && !isLoginPage;

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {showNav && <Nav />}
        <main className={showNav ? "max-w-screen-2xl mx-auto px-6" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
