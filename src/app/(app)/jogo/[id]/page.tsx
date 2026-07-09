"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
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
import { getMetric, formatMetric, formatAudiencia, normalizeHorario } from "@/lib/stats";
import { parseMatchSlug, matchHref } from "@/lib/gameLink";
import TeamLogo from "@/components/TeamLogo";

const PNT_TV = new Set(["Globo", "Record", "SporTV", "Premiere"]);
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const t2m = (h: string) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + (mm || 0); };
const SEASONS = Array.from(new Set(games.map((g) => g.ano))).sort((a, b) => a - b);
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

// Faixa de extra metrics com scroll horizontal oculto; roda do mouse (cima/baixo)
// rola para esquerda/direita.
function ExtraScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let target = el.scrollLeft;
    let raf: number | null = null;
    const tick = () => {
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) { el.scrollLeft = target; raf = null; return; }
      el.scrollLeft += diff * 0.18;
      raf = requestAnimationFrame(tick);
    };
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (d === 0) return;
      e.preventDefault();
      target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target + d));
      if (raf === null) raf = requestAnimationFrame(tick);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); if (raf !== null) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className="no-scrollbar overflow-x-auto flex-1 min-w-0">{children}</div>;
}

function SChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] shrink-0 min-w-[54px]">
      <span className="text-[9px] uppercase tracking-wider text-white/35 whitespace-nowrap">{label}</span>
      <span className="text-sm font-bold text-white tabular-nums">{value}</span>
      {sub != null && <span className="text-[11px] text-white/45 tabular-nums">{sub}</span>}
    </div>
  );
}

function ExtraStrip({ g }: { g: G }) {
  const det = g.detentor;
  if (det === "Amazon") {
    const e = AMAZON_EXTRA_METRICS[g.data];
    if (!e) return null;
    return (
      <div className="flex gap-2 w-max">
        <SChip label="Pico" value={fmtInt(e.peak)} />
        <SChip label="Streams" value={fmtInt(e.streams)} />
        <SChip label="Min/stream" value={e.liveMinutes.toFixed(2).replace(".", ",")} />
        <SChip label="Total" value={fmtInt(e.totalViewers)} />
      </div>
    );
  }
  if (det === "YouTube") {
    const e = YOUTUBE_EXTRA_METRICS[g.data];
    if (!e) return null;
    return (
      <div className="flex gap-2 w-max">
        <SChip label="Pico" value={fmtInt(e.peak)} />
        {e.alcance != null && <SChip label="Alcance" value={fmtInt(e.alcance)} />}
      </div>
    );
  }
  if (det === "Record") {
    const e = RECORD_EXTRA_METRICS[g.data];
    if (!e) return null;
    const items = RECORD_PRACAS.filter((p) => e[p] != null);
    if (!items.length) return null;
    return <div className="flex gap-2 w-max">{items.map((p) => <SChip key={p} label={p} value={e[p]!.toFixed(1).replace(".", ",")} />)}</div>;
  }
  if (det === "Globo") {
    const e = GLOBO_EXTRA_METRICS[globoKey(g)];
    if (!e) return null;
    const items = GLOBO_PRACAS.filter((p) => e[p]);
    if (!items.length) return null;
    return <div className="flex gap-2 w-max">{items.map((p) => { const c = e[p]!; return <SChip key={p} label={p} value={c.dom.toFixed(1).replace(".", ",")} sub={c.ind.toFixed(1).replace(".", ",")} />; })}</div>;
  }
  return null;
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

  return (
    <div className="py-6">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ─── ESQUERDA ─── */}
        <div className="flex flex-col gap-4">
          {/* Box do jogo */}
          <div className="glass rounded-2xl p-6" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>
            {/* topo: temporada + rodada */}
            <div className="flex items-center justify-center gap-2 mb-4 text-xs">
              <span className="font-bold tabular-nums" style={{ color: SEASON_COLORS[info.ano] }}>{info.ano}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">Rodada {info.rodada}</span>
            </div>
            {/* escudos (mais próximos) */}
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2" style={{ maxWidth: 132 }}>
                <TeamLogo team={info.mandante} size={56} />
                <span className="text-white font-semibold text-center text-sm truncate max-w-full">{info.mandante}</span>
              </div>
              <span className="text-white/25 text-2xl font-light">×</span>
              <div className="flex flex-col items-center gap-2" style={{ maxWidth: 132 }}>
                <TeamLogo team={info.visitante} size={56} />
                <span className="text-white font-semibold text-center text-sm truncate max-w-full">{info.visitante}</span>
              </div>
            </div>
            {/* rodapé: DD/MM/AA | Dia · Horário */}
            <div className="text-center mt-4 text-xs text-white/45">
              <span className="tabular-nums">{info.data.slice(0, 6)}{info.data.slice(8)}</span>
              <span className="text-white/20 mx-2">|</span>
              <span className="capitalize">{info.dia}</span> · <span className="tabular-nums">{normalizeHorario(info.horario.substring(0, 5))}</span>
            </div>
          </div>

          {/* Boxes por detentor: Logo | Nome | Audiência | ⎪ Extra metrics (scroll) */}
          <div className="flex flex-col gap-3">
            {rows.map((g, i) => {
              const isTv = PNT_TV.has(g.detentor);
              const primary = getMetric(g, "pontos");
              const esp = isTv ? getMetric(g, "espectadores") : null;
              return (
                <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4" style={{ minHeight: 84 }}>
                  <DetLogo det={g.detentor} size={24} />
                  <span className="text-white/70 font-semibold text-sm w-20 shrink-0 truncate">{g.detentor}</span>
                  <div className="shrink-0 text-right" style={{ minWidth: 100 }}>
                    <div className="text-xl font-bold text-white tabular-nums leading-none">{formatMetric(g.detentor, primary, "pontos")}</div>
                    {esp != null && <div className="text-[11px] text-white/40 tabular-nums mt-0.5">{formatAudiencia(esp)} esp.</div>}
                  </div>
                  <div className="w-px self-stretch bg-white/[0.10] shrink-0" />
                  <ExtraScroll><ExtraStrip g={g} /></ExtraScroll>
                </div>
              );
            })}
          </div>

          {/* Jogos concorrentes */}
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Jogos concorrentes</h2>
            {concurrent.length === 0 ? (
              <p className="text-sm text-white/30">Nenhum jogo simultâneo.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {concurrent.map((sg, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.06]">
                    <span className={`w-12 shrink-0 text-center text-[10px] font-bold py-0.5 rounded ${sg.liga === "FFU" ? "bg-blue-500/25 text-blue-300" : "bg-white/10 text-white/45"}`}>{sg.liga}</span>
                    <TeamLogo team={sg.mandante} size={20} />
                    <span className="text-white/20 text-xs">×</span>
                    <TeamLogo team={sg.visitante} size={20} />
                    <div className="flex gap-1 ml-auto">{sg.detentores.map((d) => <DetLogo key={d} det={d} size={16} />)}</div>
                    <span className="text-white/45 text-sm tabular-nums w-11 text-right">{sg.hora}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── DIREITA ─── */}
        <div className="flex flex-col gap-4">
          {/* Ranking por clube */}
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Ranking por clube</h2>
            <div className="flex items-center gap-4 flex-wrap mt-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-white/30">Temporadas</span>
                {SEASONS.map((a) => (
                  <button key={a} type="button" onClick={() => toggleSeason(a)}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold border transition-all"
                    style={rankSeasons.has(a)
                      ? { color: SEASON_COLORS[a], borderColor: SEASON_COLORS[a] + "66", background: SEASON_COLORS[a] + "1a" }
                      : { color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.1)" }}>
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
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {LOGOS[r.detentor]
                        ? <img src={LOGOS[r.detentor]} alt={r.detentor} style={{ height: 18, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: selDet === r.detentor ? 1 : 0.5, maxWidth: 26 }} />
                        : <span className="text-[9px] text-white/70">{r.detentor}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5">
              {rankings.map(({ club, total, currentPos, win }) => (
                <div key={club}>
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
                        <div key={`${g.ano}-${g.rodada}-${g.mandante}`} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={current ? { background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.4)" } : { border: "1px solid rgba(255,255,255,0.05)" }}>
                          <span className="w-7 shrink-0 tabular-nums font-bold text-sm" style={{ color: current ? "#93c5fd" : "rgba(255,255,255,0.4)" }}>{pos}º</span>
                          <span className="text-xs font-bold tabular-nums shrink-0 w-9" style={{ color: SEASON_COLORS[g.ano] }}>{g.ano}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <TeamLogo team={g.mandante} size={18} />
                            <span className="text-white/20 text-[10px]">×</span>
                            <TeamLogo team={g.visitante} size={18} />
                          </div>
                          <span className="text-white/40 tabular-nums text-xs ml-1 whitespace-nowrap capitalize">{g.dia} {normalizeHorario(g.horario.substring(0, 5))}</span>
                          <span className="ml-auto font-bold text-white tabular-nums text-sm whitespace-nowrap">{formatMetric(g.detentor, getMetric(g, "pontos"), "pontos")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Histórico do confronto — uma linha por detentor */}
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Histórico do confronto</h2>
            {historyLines.length === 0 ? (
              <p className="text-sm text-white/30">Sem outros registros deste confronto.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {historyLines.map((g, i) => (
                  <Link key={i} href={matchHref(g, g.detentor)}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                    <span className="text-sm font-bold tabular-nums w-10 shrink-0" style={{ color: SEASON_COLORS[g.ano] }}>{g.ano}</span>
                    <span className="text-xs text-white/35 w-12 shrink-0">Rod {g.rodada}</span>
                    <TeamLogo team={g.mandante} size={18} />
                    <span className="text-white/20 text-[10px]">×</span>
                    <TeamLogo team={g.visitante} size={18} />
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
