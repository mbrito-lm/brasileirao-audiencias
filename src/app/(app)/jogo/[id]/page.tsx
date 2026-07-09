"use client";
import { useMemo, useState, useRef, useEffect, useLayoutEffect, type Ref } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ALL_SCHEDULE } from "@/data/schedule";
import {
  games, DETENTOR_COLORS, SEASON_COLORS,
  AMAZON_EXTRA_METRICS, YOUTUBE_EXTRA_METRICS,
  RECORD_EXTRA_METRICS, RECORD_PRACAS,
  GLOBO_EXTRA_METRICS, GLOBO_PRACAS, globoKey,
} from "@/data/games";
import { LOGOS } from "@/data/logos";
import { teamColor } from "@/data/teamColors";
import { getMetric, formatMetric, normalizeHorario } from "@/lib/stats";
import { parseMatchSlug, matchHref } from "@/lib/gameLink";
import TeamLogo from "@/components/TeamLogo";
import FilterDialog, { FilterState } from "@/components/FilterDialog";

const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const t2m = (h: string) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + (mm || 0); };
const SEASONS = Array.from(new Set(games.map((g) => g.ano))).sort((a, b) => a - b);
const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
type G = (typeof games)[number];
const isSame = (g: { ano: number; rodada: number; mandante: string; visitante: string }, k: { ano: number; rodada: number; mandante: string; visitante: string }) =>
  g.ano === k.ano && g.rodada === k.rodada && g.mandante === k.mandante && g.visitante === k.visitante;

function DetLogo({ det, size = 20 }: { det: string; size?: number }) {
  const bg = DETENTOR_COLORS[det] || "#444";
  return (
    <span className="rounded flex items-center justify-center shrink-0" style={{ width: size + 8, height: size + 8, background: bg }}>
      {LOGOS[det]
        ? <img src={LOGOS[det]} alt={det} style={{ height: size, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: .95, maxWidth: size + 26 }} />
        : <span className="text-[10px] font-bold text-white">{det}</span>}
    </span>
  );
}

function Matchup({ m, v, size = 20 }: { m: string; v: string; size?: number }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <TeamLogo team={m} size={size} />
      <span className="text-white/20 text-xs">×</span>
      <TeamLogo team={v} size={size} />
    </div>
  );
}

// Extra metrics de um jogo como pares label/valor — uma linha por métrica.
function extraItems(g: G): { label: string; value: string }[] {
  const det = g.detentor;
  if (det === "Amazon") {
    const e = AMAZON_EXTRA_METRICS[g.data];
    if (!e) return [];
    return [
      { label: "Pico", value: fmtInt(e.peak) },
      { label: "Streams", value: fmtInt(e.streams) },
      { label: "Min/stream", value: e.liveMinutes.toFixed(2).replace(".", ",") },
      { label: "Total", value: fmtInt(e.totalViewers) },
    ];
  }
  if (det === "YouTube") {
    const e = YOUTUBE_EXTRA_METRICS[g.data];
    if (!e) return [];
    const arr = [{ label: "Pico", value: fmtInt(e.peak) }];
    if (e.alcance != null) arr.push({ label: "Alcance", value: fmtInt(e.alcance) });
    return arr;
  }
  if (det === "Record") {
    const e = RECORD_EXTRA_METRICS[g.data];
    if (!e) return [];
    return RECORD_PRACAS.filter((p) => e[p] != null).map((p) => ({ label: p, value: e[p]!.toFixed(1).replace(".", ",") }));
  }
  if (det === "Globo") {
    const e = GLOBO_EXTRA_METRICS[globoKey(g)];
    if (!e) return [];
    return GLOBO_PRACAS.filter((p) => e[p]).map((p) => ({ label: p, value: e[p]!.dom.toFixed(1).replace(".", ",") }));
  }
  return [];
}

function hasExtra(g: G): boolean {
  return extraItems(g).length > 0;
}

// Box único com a lista de extra metrics (uma linha cada, fonte pequena).
function ExtraBox({ g, flex }: { g: G; flex: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = extraItems(g);
  useEffect(() => { ref.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" }); }, []);
  return (
    <div ref={ref} style={{ flex }}
      className="glass rounded-2xl px-4 py-2 min-h-0 overflow-y-auto no-scrollbar flex flex-col justify-start">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-3 py-[3px] border-b border-white/[0.05] last:border-0">
          <span className="text-[11px] uppercase tracking-wider text-white/40 truncate">{it.label}</span>
          <span className="text-xs font-semibold text-white tabular-nums whitespace-nowrap">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

// Box de detentor. Clicar abre/fecha as extra metrics (só quando há extras).
function DetCollapsed({ g, onClick, boxRef, active }: {
  g: G;
  onClick: (el: HTMLElement) => void;
  boxRef?: Ref<HTMLButtonElement>;
  active?: boolean;
}) {
  const primary = getMetric(g, "pontos");
  const clickable = hasExtra(g);
  return (
    <button ref={boxRef} type="button" disabled={!clickable} onClick={(e) => onClick(e.currentTarget)}
      className={`glass rounded-2xl px-4 flex-1 min-h-0 w-full flex items-center gap-3 text-left transition-colors ${clickable ? "hover:bg-white/[0.06] cursor-pointer" : "cursor-default"}`}
      style={active ? { boxShadow: "inset 0 0 0 1.5px rgba(var(--ink-c),0.16)" } : undefined}>
      <DetLogo det={g.detentor} size={22} />
      <span className="text-white/80 font-semibold text-base truncate">{g.detentor}</span>
      <span className="ml-auto text-2xl font-bold text-white tabular-nums whitespace-nowrap">{formatMetric(g.detentor, primary, "pontos")}</span>
    </button>
  );
}

export default function JogoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const key = useMemo(() => parseMatchSlug(params.id), [params.id]);
  const clickedDet = key?.detentor;

  const rows = useMemo(() => {
    if (!key) return [];
    return games.filter((g) => isSame(g, key)).sort((a, b) => {
      if (clickedDet) {
        const ac = a.detentor === clickedDet, bc = b.detentor === clickedDet;
        if (ac && !bc) return -1;
        if (bc && !ac) return 1;
      }
      return (getMetric(b, "pontos") ?? 0) - (getMetric(a, "pontos") ?? 0);
    });
  }, [key, clickedDet]);

  const [selDetState, setSelDetState] = useState<string | null>(null);
  const selDet = selDetState && rows.some((r) => r.detentor === selDetState)
    ? selDetState
    : (clickedDet && rows.some((r) => r.detentor === clickedDet) ? clickedDet : (rows[0]?.detentor ?? null));

  const [rankSeasons, setRankSeasons] = useState<Set<number>>(() => new Set(SEASONS));
  const toggleSeason = (a: number) => setRankSeasons((prev) => {
    const n = new Set(prev);
    if (n.has(a)) { if (n.size > 1) n.delete(a); } else n.add(a);
    return n;
  });

  const [histFilters, setHistFilters] = useState<FilterState>({ anos: [], dias: [], horarios: [], rodadas: [], times: [], detentores: [], concorrencia: [] });

  const [expanded, setExpanded] = useState<string | null>(null);
  const singleDet = rows.length === 1;
  const expDetName = singleDet ? rows[0]?.detentor : (expanded && rows.some((r) => r.detentor === expanded) ? expanded : null);
  const expandedRow = expDetName ? (rows.find((r) => r.detentor === expDetName) ?? null) : null;
  const detOpen = expandedRow != null && hasExtra(expandedRow);
  // Box do detentor sempre 1/3 e extra metrics 2/3 (igual ao caso de 3 detentores).
  const extraFlex = 2;

  // Slide FLIP: o box clicado desliza para a primeira posição.
  const box1Ref = useRef<HTMLButtonElement>(null);
  const slideFrom = useRef<number | null>(null);
  const openDet = (g: G, el: HTMLElement) => {
    if (!hasExtra(g)) return;
    slideFrom.current = el.getBoundingClientRect().top;
    setExpanded(g.detentor);
  };
  useLayoutEffect(() => {
    const from = slideFrom.current;
    slideFrom.current = null;
    if (from == null || !box1Ref.current) return;
    const dy = from - box1Ref.current.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    box1Ref.current.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [expanded]);

  const concurrent = useMemo(() => {
    if (!rows.length) return [];
    const info = rows[0];
    const gm = t2m(info.horario.substring(0, 5));
    return ALL_SCHEDULE
      .filter((sg) => sg.data === info.data && sg.hora && !(sg.mandante === info.mandante && sg.visitante === info.visitante) && Math.abs(t2m(sg.hora) - gm) < 120)
      .sort((a, b) => t2m(a.hora) - t2m(b.hora));
  }, [rows]);

  const historyLines = useMemo(() => {
    if (!key) return [];
    return games
      .filter((g) =>
        ((g.mandante === key.mandante && g.visitante === key.visitante) || (g.mandante === key.visitante && g.visitante === key.mandante)) &&
        !isSame(g, key) && getMetric(g, "pontos") != null)
      .sort((a, b) => a.ano - b.ano || a.rodada - b.rodada);
  }, [key]);

  const histOptions = useMemo(() => ({
    anos: Array.from(new Set(historyLines.map((g) => g.ano))).sort((a, b) => a - b),
    dias: DIA_ORDER.filter((d) => historyLines.some((g) => g.dia === d)),
    horarios: Array.from(new Set(historyLines.map((g) => normalizeHorario(g.horario.substring(0, 5))))).sort(),
    rodadas: [] as number[], times: [] as string[], concorrencia: [] as number[],
    detentores: Array.from(new Set(historyLines.map((g) => g.detentor))),
  }), [historyLines]);
  const shownHistory = useMemo(() => historyLines.filter((g) => {
    const f = histFilters;
    return (!f.anos.length || f.anos.includes(g.ano)) &&
      (!f.dias.length || f.dias.includes(g.dia)) &&
      (!f.horarios.length || f.horarios.includes(normalizeHorario(g.horario.substring(0, 5)))) &&
      (!(f.detentores?.length) || f.detentores!.includes(g.detentor));
  }), [historyLines, histFilters]);

  // Ranking por clube — sempre 5 jogos; encaixa o jogo atual mesmo em outra temporada.
  const rankings = useMemo(() => {
    if (!key || !selDet) return [];
    const currentRow = rows.find((r) => r.detentor === selDet) ?? null;
    return [key.mandante, key.visitante].map((club) => {
      let list = games.filter((x) => x.detentor === selDet && rankSeasons.has(x.ano) && (x.mandante === club || x.visitante === club) && getMetric(x, "pontos") != null);
      if (currentRow && (currentRow.mandante === club || currentRow.visitante === club) && !list.some((x) => isSame(x, key) && x.detentor === selDet)) {
        list = [...list, currentRow];
      }
      list = list.sort((a, b) => (getMetric(b, "pontos") ?? 0) - (getMetric(a, "pontos") ?? 0));
      const idx = list.findIndex((x) => isSame(x, key) && x.detentor === selDet);
      const start = idx < 0 ? 0 : Math.max(0, Math.min(idx - 2, list.length - 5));
      const win = list.slice(start, start + 5).map((x) => ({ g: x, pos: list.indexOf(x) + 1, current: isSame(x, key) }));
      return { club, total: list.length, currentPos: idx >= 0 ? idx + 1 : null, win };
    });
  }, [key, selDet, rankSeasons, rows]);

  if (!key || rows.length === 0) {
    return (
      <div className="py-10">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white text-sm mb-6">← Voltar</button>
        <p className="text-white/40">Jogo não encontrado.</p>
      </div>
    );
  }

  const info = rows[0];
  // Link para a página do clube já com o detentor atual selecionado.
  const clubHref = (team: string) =>
    `/clubes/${encodeURIComponent(team)}${selDet ? `?det=${encodeURIComponent(selDet)}` : ""}`;

  return (
    <div className="py-6">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* ─── ESQUERDA ─── */}
        <div className="flex flex-col gap-4">
          {/* Jogo + detentores na mesma linha (detentores dividem a altura do box do jogo) */}
          <div className="flex gap-4 items-stretch">
            <div className="glass rounded-2xl p-6 flex-1 min-w-0" style={{ border: `1.5px solid ${SEASON_COLORS[info.ano]}` }}>
              {/* topo: temporada + rodada */}
              <div className="flex items-center justify-center gap-2 mb-4 text-xs">
                <span className="font-bold tabular-nums" style={{ color: SEASON_COLORS[info.ano] }}>{info.ano}</span>
                <span className="text-white/20">·</span>
                <span className="text-white/50">Rodada {info.rodada}</span>
              </div>
              {/* escudos (mais próximos) */}
              <div className="flex items-center justify-center gap-4">
                <Link href={clubHref(info.mandante)} title={`Ver ${info.mandante}`}
                  className="group flex flex-col items-center gap-2 hover:opacity-90 transition-opacity" style={{ maxWidth: 120 }}>
                  <TeamLogo team={info.mandante} size={52} />
                  <span className="text-white font-semibold text-center text-sm truncate max-w-full group-hover:text-[var(--accent-fg)] transition-colors">{info.mandante}</span>
                </Link>
                <span className="text-white/25 text-2xl font-light">×</span>
                <Link href={clubHref(info.visitante)} title={`Ver ${info.visitante}`}
                  className="group flex flex-col items-center gap-2 hover:opacity-90 transition-opacity" style={{ maxWidth: 120 }}>
                  <TeamLogo team={info.visitante} size={52} />
                  <span className="text-white font-semibold text-center text-sm truncate max-w-full group-hover:text-[var(--accent-fg)] transition-colors">{info.visitante}</span>
                </Link>
              </div>
              {/* rodapé: DD/MM/AA | Dia · Horário */}
              <div className="text-center mt-4 text-xs text-white/45">
                <span className="tabular-nums">{info.data.slice(0, 6)}{info.data.slice(8)}</span>
                <span className="text-white/20 mx-2">|</span>
                <span className="capitalize">{info.dia}</span> · <span className="tabular-nums">{normalizeHorario(info.horario.substring(0, 5))}</span>
              </div>
            </div>

            {/* Detentores: travados na altura do box do jogo (via absolute) para não
                esticar a linha quando as extra metrics forem grandes (Globo/Record). */}
            <div className="flex-1 min-w-0 relative">
              <div className="absolute inset-0 flex flex-col gap-2">
                {detOpen ? (
                  <>
                    <DetCollapsed g={expandedRow!} boxRef={box1Ref} active
                      onClick={() => { if (!singleDet) setExpanded(null); }} />
                    <ExtraBox g={expandedRow!} flex={extraFlex} />
                  </>
                ) : (
                  rows.map((g) => <DetCollapsed key={g.detentor} g={g} onClick={(el) => openDet(g, el)} />)
                )}
              </div>
            </div>
          </div>

          {/* linha separando os boxes do jogo dos jogos concorrentes */}
          <div className="h-px bg-white/[0.08]" />

          {/* Jogos concorrentes (sem box envoltório) */}
          <div>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Jogos concorrentes</h2>
            {concurrent.length === 0 ? (
              <p className="text-sm text-white/30">Nenhum jogo simultâneo.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {concurrent.map((sg, i) => (
                  <div key={i} className="glass flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.06]">
                    <span className={`w-12 shrink-0 text-center text-[10px] font-bold py-0.5 rounded ${sg.liga === "FFU" ? "bg-blue-500/25 text-[var(--accent-fg)]" : "bg-white/10 text-white/45"}`}>{sg.liga}</span>
                    <span className="text-[11px] text-white/35 shrink-0 w-11">Rod {sg.rodada}</span>
                    <Matchup m={sg.mandante} v={sg.visitante} />
                    <span className="text-[11px] text-white/35 tabular-nums whitespace-nowrap ml-1">{sg.hora}</span>
                    <div className="flex gap-1 ml-auto">{sg.detentores.map((d) => <DetLogo key={d} det={d} size={16} />)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ─── DIREITA ─── (linha vertical separando da esquerda) */}
        <div className="lg:border-l lg:border-white/[0.08] lg:pl-6">
          {/* Ranking por clube (sem box envoltório) */}
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Ranking por clube</h2>
            <div className="flex items-center gap-4 flex-wrap mt-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-white/30">Temporadas</span>
                {SEASONS.map((a) => (
                  <button key={a} type="button" onClick={() => toggleSeason(a)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold border transition-all"
                    style={rankSeasons.has(a)
                      ? { color: SEASON_COLORS[a], borderColor: SEASON_COLORS[a] + "66", background: SEASON_COLORS[a] + "1a" }
                      : { color: "rgba(var(--ink-c),0.3)", borderColor: "rgba(var(--ink-c),0.1)" }}>
                    {a}
                  </button>
                ))}
              </div>
              {rows.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-white/30">Detentor</span>
                  {rows.map((r) => (
                    <button key={r.detentor} type="button" onClick={() => setSelDetState(r.detentor)} title={r.detentor}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={selDet === r.detentor
                        ? { background: (DETENTOR_COLORS[r.detentor] || "#666"), boxShadow: `0 0 12px ${(DETENTOR_COLORS[r.detentor] || "#666")}66` }
                        : { background: "rgba(var(--ink-c),0.05)", border: "1px solid rgba(var(--ink-c),0.08)" }}>
                      {LOGOS[r.detentor]
                        ? <img src={LOGOS[r.detentor]} alt={r.detentor} style={{ height: 18, width: "auto", objectFit: "contain", filter: selDet === r.detentor ? "brightness(0) invert(1)" : "var(--logo-filter)", opacity: selDet === r.detentor ? 1 : 0.5, maxWidth: 26 }} />
                        : <span className="text-[9px] text-white/70">{r.detentor}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-6">
              {rankings.map(({ club, total, currentPos, win }, i) => {
                const col = teamColor(club);
                return (
                <div key={club} className={i > 0 ? "border-t border-white/[0.03] pt-5 md:border-t-0 md:pt-0 md:border-l md:pl-5" : ""}>
                  <div className="flex items-center gap-2 mb-2">
                    <TeamLogo team={club} size={20} />
                    <span className="text-white/70 font-semibold text-sm">{club}</span>
                    {currentPos && <span className="ml-auto text-xs text-white/40 tabular-nums">{currentPos}º de {total}</span>}
                  </div>
                  {win.length === 0 ? (
                    <p className="text-xs text-white/25 pl-1">Sem jogos nas temporadas/detentor selecionados.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {win.map(({ g, pos, current }) => (
                        <div key={`${g.ano}-${g.rodada}-${g.mandante}`} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg"
                          style={current ? { background: `${col}22`, border: `1px solid ${col}66` } : { border: "1px solid rgba(var(--ink-c),0.05)" }}>
                          <span className="w-5 shrink-0 tabular-nums font-bold text-xs" style={{ color: current ? col : "rgba(var(--ink-c),0.4)" }}>{pos}º</span>
                          <span className="text-[11px] font-bold tabular-nums shrink-0 w-8" style={{ color: SEASON_COLORS[g.ano] }}>{g.ano}</span>
                          <Matchup m={g.mandante} v={g.visitante} size={18} />
                          <span className="text-white/40 tabular-nums text-[11px] ml-1 min-w-0 truncate capitalize">{g.dia} {normalizeHorario(g.horario.substring(0, 5))}</span>
                          <span className="ml-auto font-bold text-white tabular-nums text-xs whitespace-nowrap shrink-0">{formatMetric(g.detentor, getMetric(g, "pontos"), "pontos")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* linha horizontal separando ranking do histórico */}
            <div className="h-px bg-white/[0.08] my-5" />

            {/* Histórico do confronto */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Histórico do confronto</h2>
                {historyLines.length > 0 && <FilterDialog state={histFilters} onChange={setHistFilters} options={histOptions} />}
              </div>
              {historyLines.length === 0 ? (
                <p className="text-sm text-white/30">Não há outros registros para esse confronto.</p>
              ) : shownHistory.length === 0 ? (
                <p className="text-sm text-white/30">Sem registros para o filtro selecionado.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {shownHistory.map((g, i) => (
                    <Link key={i} href={matchHref(g, g.detentor)}
                      className="glass flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                      <span className="text-sm font-bold tabular-nums w-12 shrink-0" style={{ color: SEASON_COLORS[g.ano] }}>{g.ano}</span>
                      <span className="text-[11px] text-white/35 shrink-0 w-11">Rod {g.rodada}</span>
                      <Matchup m={g.mandante} v={g.visitante} />
                      <span className="text-[11px] text-white/35 tabular-nums whitespace-nowrap capitalize ml-1">{g.dia} {normalizeHorario(g.horario.substring(0, 5))}</span>
                      <span className="ml-auto text-sm font-bold text-white tabular-nums whitespace-nowrap">{formatMetric(g.detentor, getMetric(g, "pontos"), "pontos")}</span>
                      <DetLogo det={g.detentor} size={18} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
