"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

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
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://claude.ai/project/019f3ceb-d1a4-73bb-ac1c-3acd08aeea1a"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir o projeto de análise no Claude (nova aba)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-white/[0.10] text-white/60 hover:text-white hover:bg-white/[0.06]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 5.8L20 10.7l-4.9 3.6L17 20l-5-3.6L7 20l1.9-5.7L4 10.7l6.1-1.9z" />
            </svg>
            Analisar no Claude
          </a>
          <form action={logout}>
            <button type="submit"
              className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
