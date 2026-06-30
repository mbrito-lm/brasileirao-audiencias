"use client";
import { useState, useMemo } from "react";
import { games, DETENTORES, DETENTOR_COLORS } from "@/data/games";
import {
  mediaDetentor,
  mediaDiaHorario,
  mediaTimes,
  deltaPercent,
  formatAudiencia,
  formatDelta,
  deltaClass,
  getAllTeams,
} from "@/lib/stats";

const DIAS = ["dom.", "sáb.", "sex.", "qui.", "qua.", "ter.", "seg."];
const HORARIOS = Array.from(new Set(games.map((g) => g.horario.substring(0, 5)))).sort();
const RODADAS = Array.from(new Set(games.map((g) => g.rodada))).sort((a, b) => a - b);
const ANOS = [2025, 2026];
const ALL_TEAMS = getAllTeams(games);

export default function ComparacoesPage() {
  const [selDetentores, setSelDetentores] = useState<string[]>([]);
  const [selAnos, setSelAnos] = useState<number[]>([]);
  const [selDias, setSelDias] = useState<string[]>([]);
  const [selHorarios, setSelHorarios] = useState<string[]>([]);
  const [selRodadas, setSelRodadas] = useState<number[]>([]);
  const [selTimes, setSelTimes] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return games
      .filter((g) => g.audiencia !== null)
      .filter((g) => !selDetentores.length || selDetentores.includes(g.detentor))
      .filter((g) => !selAnos.length || selAnos.includes(g.ano))
      .filter((g) => !selDias.length || selDias.includes(g.dia))
      .filter(
        (g) =>
          !selHorarios.length ||
          selHorarios.includes(g.horario.substring(0, 5))
      )
      .filter((g) => !selRodadas.length || selRodadas.includes(g.rodada))
      .filter(
        (g) =>
          !selTimes.length ||
          selTimes.some((t) => g.mandante === t || g.visitante === t)
      )
      .filter(
        (g) =>
          !search.trim() ||
          g.mandante.toLowerCase().includes(search.toLowerCase()) ||
          g.visitante.toLowerCase().includes(search.toLowerCase())
      )
      .map((g) => {
        const aud = g.audiencia as number;
        const medDet = mediaDetentor(games, g.detentor);
        const medSlot = mediaDiaHorario(games, g.detentor, g.dia, g.horario);
        const medTms = mediaTimes(games, g.detentor, g.mandante, g.visitante);
        return {
          ...g,
          deltaDet: deltaPercent(aud, medDet),
          deltaSlot: deltaPercent(aud, medSlot),
          deltaTimes: deltaPercent(aud, medTms),
        };
      })
      .sort((a, b) => (b.audiencia ?? 0) - (a.audiencia ?? 0));
  }, [selDetentores, selAnos, selDias, selHorarios, selRodadas, selTimes, search]);

  function toggle<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const activeFilters =
    selDetentores.length +
    selAnos.length +
    selDias.length +
    selHorarios.length +
    selRodadas.length +
    selTimes.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Comparações</h1>
        <p className="text-gray-400 text-sm mt-1">
          Compare audiências cruzando detentores, temporadas, times e horários
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="w-72 flex-shrink-0 space-y-5">
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Filtros</h3>
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setSelDetentores([]);
                    setSelAnos([]);
                    setSelDias([]);
                    setSelHorarios([]);
                    setSelRodadas([]);
                    setSelTimes([]);
                    setSearch("");
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Limpar ({activeFilters})
                </button>
              )}
            </div>

            <FilterSection title="Detentor">
              <div className="flex flex-wrap gap-1.5">
                {DETENTORES.map((d) => (
                  <FilterChip
                    key={d}
                    label={d}
                    active={selDetentores.includes(d)}
                    color={DETENTOR_COLORS[d]}
                    onClick={() => toggle(selDetentores, d, setSelDetentores)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Temporada">
              <div className="flex gap-1.5">
                {ANOS.map((a) => (
                  <FilterChip
                    key={a}
                    label={a.toString()}
                    active={selAnos.includes(a)}
                    onClick={() => toggle(selAnos, a, setSelAnos)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Dia da semana">
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => (
                  <FilterChip
                    key={d}
                    label={d}
                    active={selDias.includes(d)}
                    onClick={() => toggle(selDias, d, setSelDias)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Horário">
              <div className="flex flex-wrap gap-1.5">
                {HORARIOS.map((h) => (
                  <FilterChip
                    key={h}
                    label={h}
                    active={selHorarios.includes(h)}
                    onClick={() => toggle(selHorarios, h, setSelHorarios)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Rodada">
              <div className="flex flex-wrap gap-1">
                {RODADAS.map((r) => (
                  <button
                    key={r}
                    onClick={() => toggle(selRodadas, r, setSelRodadas)}
                    className={`w-8 h-7 text-xs rounded transition-colors ${
                      selRodadas.includes(r)
                        ? "bg-blue-600 text-white font-bold"
                        : "bg-[#1f2937] text-gray-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Time" last>
              <select
                multiple
                value={selTimes}
                onChange={(e) =>
                  setSelTimes(Array.from(e.target.selectedOptions, (o) => o.value))
                }
                className="w-full h-32 bg-[#1f2937] border border-[#374151] rounded-lg text-sm text-gray-300 p-1 focus:outline-none focus:border-blue-500"
              >
                {ALL_TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {selTimes.length > 0 && (
                <button
                  onClick={() => setSelTimes([])}
                  className="text-xs text-gray-500 hover:text-gray-300 mt-1"
                >
                  Limpar times
                </button>
              )}
            </FilterSection>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
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
                placeholder="Buscar por time..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1f2937] border border-[#374151] rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <span className="text-sm text-gray-500">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#1f2937]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1f2937] text-gray-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Detentor</th>
                  <th className="px-4 py-3 text-left">Ano</th>
                  <th className="px-4 py-3 text-left">Rod.</th>
                  <th className="px-4 py-3 text-left">Jogo</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Dia</th>
                  <th className="px-4 py-3 text-left">Horário</th>
                  <th className="px-4 py-3 text-right">Audiência</th>
                  <th className="px-4 py-3 text-right">Δ Detentor</th>
                  <th className="px-4 py-3 text-right">Δ Slot</th>
                  <th className="px-4 py-3 text-right">Δ Times</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500">
                      Nenhum jogo encontrado com esses filtros
                    </td>
                  </tr>
                ) : (
                  filtered.map((g, i) => (
                    <tr key={i} className="hover:bg-[#1f2937]/60 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: DETENTOR_COLORS[g.detentor] || "#9ca3af" }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: DETENTOR_COLORS[g.detentor] || "#9ca3af" }}
                          />
                          {g.detentor}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{g.ano}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{g.rodada}</td>
                      <td className="px-4 py-3 font-medium text-gray-100 whitespace-nowrap">
                        {g.mandante} <span className="text-gray-500 font-normal text-xs">vs</span> {g.visitante}
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
      </div>
    </div>
  );
}

function FilterSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`${last ? "" : "border-b border-[#1f2937] pb-4 mb-4"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? "text-white"
          : "bg-[#1f2937] text-gray-400 hover:text-white"
      }`}
      style={active ? { backgroundColor: color || "#3b82f6" } : undefined}
    >
      {color && !active && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}
