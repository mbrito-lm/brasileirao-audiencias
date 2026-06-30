"use client";
import { useState, useMemo } from "react";
import { Game } from "@/data/games";
import {
  mediaDetentor,
  mediaDiaHorario,
  mediaTimes,
  deltaPercent,
  formatAudiencia,
  formatDelta,
  deltaClass,
} from "@/lib/stats";

interface Props {
  games: Game[];
  allGames: Game[];
  detentor: string | null;
}

export default function GamesTable({ games, allGames, detentor }: Props) {
  const [search, setSearch] = useState("");

  const enriched = useMemo(() => {
    return games
      .filter((g) => g.audiencia !== null)
      .map((g) => {
        const det = g.detentor;
        const medDet = mediaDetentor(allGames, det);
        const medSlot = mediaDiaHorario(allGames, det, g.dia, g.horario);
        const medTms = mediaTimes(allGames, det, g.mandante, g.visitante);
        const aud = g.audiencia as number;
        return {
          ...g,
          deltaDet: deltaPercent(aud, medDet),
          deltaSlot: deltaPercent(aud, medSlot),
          deltaTimes: deltaPercent(aud, medTms),
        };
      });
  }, [games, allGames]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (g) =>
        g.mandante.toLowerCase().includes(q) ||
        g.visitante.toLowerCase().includes(q) ||
        g.data.includes(q) ||
        g.dia.toLowerCase().includes(q) ||
        g.horario.includes(q) ||
        g.detentor.toLowerCase().includes(q) ||
        g.rodada.toString().includes(q)
    );
  }, [enriched, search]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por time, data, horário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1f2937] border border-[#374151] rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <span className="text-xs text-gray-500">
          {filtered.length} jogo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#1f2937]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1f2937] text-gray-400 text-xs uppercase tracking-wide">
              {!detentor && <th className="px-4 py-3 text-left">Detentor</th>}
              <th className="px-4 py-3 text-left">Jogo</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Dia</th>
              <th className="px-4 py-3 text-left">Horário</th>
              <th className="px-4 py-3 text-right">Audiência</th>
              <th className="px-4 py-3 text-right" title="vs média geral do detentor">Δ Detentor</th>
              <th className="px-4 py-3 text-right" title="vs média do mesmo dia+horário do detentor">Δ Slot</th>
              <th className="px-4 py-3 text-right" title="vs média combinada dos times">Δ Times</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={detentor ? 8 : 9}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  Nenhum jogo encontrado
                </td>
              </tr>
            ) : (
              filtered.map((g, i) => (
                <tr
                  key={i}
                  className="hover:bg-[#1f2937]/60 transition-colors"
                >
                  {!detentor && (
                    <td className="px-4 py-3 text-xs font-medium text-gray-400">
                      {g.detentor}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-gray-100 whitespace-nowrap">
                    {g.mandante} <span className="text-gray-500 font-normal">vs</span> {g.visitante}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{g.data}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{g.dia}</td>
                  <td className="px-4 py-3 text-gray-400">{g.horario}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-100 tabular-nums">
                    {formatAudiencia(g.audiencia)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-xs font-medium ${deltaClass(g.deltaDet)}`}>
                    {formatDelta(g.deltaDet)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-xs font-medium ${deltaClass(g.deltaSlot)}`}>
                    {formatDelta(g.deltaSlot)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-xs font-medium ${deltaClass(g.deltaTimes)}`}>
                    {formatDelta(g.deltaTimes)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
