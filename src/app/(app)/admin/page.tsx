import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admins";

export default async function AdminPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) redirect("/geral");

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Administração</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Área restrita — visível apenas para administradores.
        </p>
      </div>

      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-white/50 text-sm">
          Em breve. Logado como <span className="text-white/80 font-medium">{session?.user?.email}</span>.
        </p>
      </div>
    </div>
  );
}
