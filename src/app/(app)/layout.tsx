import Nav from "@/components/Nav";
import ChatBox from "@/components/ChatBox";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admins";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const admin = isAdmin(session?.user?.email);
  return (
    <>
      <Nav isAdmin={admin} />
      <main className="max-w-screen-2xl mx-auto px-6">{children}</main>
      <ChatBox />
    </>
  );
}
