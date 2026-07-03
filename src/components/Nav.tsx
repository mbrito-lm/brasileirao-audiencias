"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();
  const links = [
    { href: "/geral", label: "Geral" },
    { href: "/detentores", label: "Detentores" },
    { href: "/comparacoes", label: "Comparações" },
    { href: "/graficos", label: "Gráficos" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06]"
      style={{ background: "rgba(8, 9, 15, 0.85)", backdropFilter: "blur(24px)" }}>
      <div className="max-w-screen-2xl mx-auto px-6 flex items-center gap-8 h-14">
        <span className="font-semibold text-white tracking-tight text-[15px]">
          Brasileirão FFU <span className="text-white/40 font-normal">Audiências</span>
        </span>
        <nav className="flex gap-1 bg-white/[0.05] rounded-xl p-1 border border-white/[0.06]">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname.startsWith(l.href)
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
