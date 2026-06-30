"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/geral", label: "Geral" },
    { href: "/comparacoes", label: "Comparações" },
  ];

  return (
    <header className="border-b border-[#1f2937] bg-[#111827]">
      <div className="max-w-screen-2xl mx-auto px-4 flex items-center gap-6 h-14">
        <span className="text-white font-bold text-lg tracking-tight">
          ⚽ Audiências Brasileirão
        </span>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#1f2937]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
