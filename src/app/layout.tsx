import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ChatBox from "@/components/ChatBox";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Brasileirão | FFU",
  description: "Dashboard de audiências do Brasileirão",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {session && <Nav />}
        <main className={session ? "max-w-screen-2xl mx-auto px-6" : ""}>
          {children}
        </main>
        {session && <ChatBox />}
      </body>
    </html>
  );
}
