import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admins";
import { getAccessLog, accessLogConfigured } from "@/lib/accessLog";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function AdminPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) redirect("/geral");

  const configured = accessLogConfigured();
  const log = configured ? await getAccessLog(200) : [];

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Administração</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Área restrita — visível apenas para administradores. Logado como{" "}
          <span className="text-white/80 font-medium">{session?.user?.email}</span>.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">
            Histórico de acessos
          </h2>
          {configured && (
            <span className="text-xs text-white/30 tabular-nums shrink-0">
              {log.length} {log.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        {!configured ? (
          <p className="text-sm text-white/40 leading-relaxed">
            Armazenamento não configurado. Crie um banco <span className="text-white/70">Upstash Redis / Vercel KV</span> em{" "}
            <span className="text-white/70">Vercel → Storage</span>, conecte-o a este projeto e reimplante — os acessos passam a ser registrados a partir daí.
          </p>
        ) : log.length === 0 ? (
          <p className="text-sm text-white/40">Nenhum acesso registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider">
                  <th className="font-semibold pb-3 pr-4">Usuário</th>
                  <th className="font-semibold pb-3 pr-4">E-mail</th>
                  <th className="font-semibold pb-3 text-right whitespace-nowrap">Data e hora</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i} className="border-t border-white/[0.06]">
                    <td className="py-2.5 pr-4 text-white/80 font-medium whitespace-nowrap">{e.name || "—"}</td>
                    <td className="py-2.5 pr-4 text-white/55">{e.email}</td>
                    <td className="py-2.5 text-white/55 tabular-nums text-right whitespace-nowrap">
                      {fmt.format(new Date(e.ts))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
