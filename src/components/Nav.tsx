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
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#D97757] hover:bg-[#c96442] transition-colors"
            style={{ fontFamily: "var(--font-claude), sans-serif", boxShadow: "0 1px 8px rgba(217,119,87,0.35)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
                <line x1="12" y1="12" x2="22" y2="12" />
                <line x1="12" y1="12" x2="18.06" y2="15.5" />
                <line x1="12" y1="12" x2="16.75" y2="20.2" />
                <line x1="12" y1="12" x2="12" y2="18.5" />
                <line x1="12" y1="12" x2="7" y2="20.66" />
                <line x1="12" y1="12" x2="5.5" y2="15.75" />
                <line x1="12" y1="12" x2="2" y2="12" />
                <line x1="12" y1="12" x2="6.37" y2="8.75" />
                <line x1="12" y1="12" x2="7.25" y2="3.77" />
                <line x1="12" y1="12" x2="12" y2="5" />
                <line x1="12" y1="12" x2="17" y2="3.34" />
                <line x1="12" y1="12" x2="18.5" y2="8.25" />
              </g>
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
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
