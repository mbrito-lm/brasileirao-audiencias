import Nav from "@/components/Nav";
import ChatBox from "@/components/ChatBox";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="max-w-screen-2xl mx-auto px-6">{children}</main>
      <ChatBox />
    </>
  );
}
