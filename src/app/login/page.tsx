"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-white">Audiências Brasileirão</h1>
          <p className="text-sm text-gray-400">Entre com seu e-mail @livemode.com</p>
        </div>

        <form action={action} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="voce@livemode.com"
            required
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />

          {state?.error && (
            <p className="text-red-400 text-sm">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
