"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
type G = (typeof games)[number];
const isSame = (g: { ano: number; rodada: number; mandante: string; visitante: string }, k: { ano: number; rodada: number; mandante: string; visitante: string }) =>
  g.ano === k.ano && g.rodada === k.rodada && g.mandante === k.mandante && g.visitante === k.visitante;

function DetLogo({ det, size = 20 }: { det: string; size?: number }) {
  const bg = DETENTOR_COLORS[det] || "#444";
  return (
    <span className="rounded flex items-center justify-center shrink-0" style={{ width: size + 8, height: size + 8, background: bg }}>
      {LOGOS[det]
        ? <img src={LOGOS[det]} alt={det} style={{ height: size * 0.7, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: .95, maxWidth: size + 20 }} />
        : <span className="text-[10px] font-bold text-white">{det}</span>}
    </span>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07]">
      <span className="text-[9px] uppercase tracking-wider text-white/35">{label}</span>
      <span className="text-sm font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}

function ExtraMetrics({ g }: { g: G }) {
  const det = g.detentor;
  if (det === "Amazon") {
    const e = AMAZON_EXTRA_METRICS[g.data];
    if (!e) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        <Chip label="Pico" value={fmtInt(e.peak)} />
        <Chip label="Streams" value={fmtInt(e.streams)} />
        <Chip label="Min./stream" value={e.liveMinutes.toFixed(2).replace(".", ",")} />
        <Chip label="Total viewers" value={fmtInt(e.totalViewers)} />
      </div>
    );
  }
  if (det === "YouTube") {
    const e = YOUTUBE_EXTRA_METRICS[g.data];
    if (!e) return null;
    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Chip label="Pico" value={fmtInt(e.peak)} />
        {e.alcance != null && <Chip label="Alcance" value={fmtInt(e.alcance)} />}
      </div>
    );
  }
  if (det === "Record") {
    const e = RECORD_EXTRA_METRICS[g.data];
    if (!e) return null;
    const items = RECORD_PRACAS.filter((p) => e[p] != null);
    if (!items.length) return null;
    return (
      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Pontos por praça</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {items.map((p) => (
            <div key={p} className="flex flex-col items-center py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] text-white/35">{p}</span>
              <span className="text-xs font-bold text-white tabular-nums">{e[p]!.toFixed(1).replace(".", ",")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (det === "Globo") {
    const e = GLOBO_EXTRA_METRICS[globoKey(g)];
    if (!e) return null;
    const items = GLOBO_PRACAS.filter((p) => e[p]);
    if (!items.length) return null;
    return (
      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Por praça · <span className="text-white/50">domiciliar</span> / <span className="text-white/50">individual</span></p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {items.map((p) => {
            const c = e[p]!;
            return (
              <div key={p} className="flex flex-col items-center py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[9px] text-white/35">{p}</span>
                <span className="text-xs font-bold text-white tabular-nums">{c.dom.toFixed(1).replace(".", ",")}</span>
                <span className="text-[10px] text-white/45 tabular-nums">{c.ind.toFixed(1).replace(".", ",")}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

export default function JogoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const key = useMemo(() => parseMatchSlug(params.id), [params.id]);

  const rows = useMemo(() => {
    if (!key) return [];
    return games
      .filter((g) => isSame(g, key))
      .sort((a, b) => (getMetric(b, "pontos") ?? 0) - (getMetric(a, "pontos") ?? 0));
  }, [key]);

  const [selDetState, setSelDetState] = useState<string | null>(null);
  const selDet = selDetState && rows.some((r) => r.detentor === selDetState) ? selDetState : (rows[0]?.detentor ?? null);

  // Jogos concorrentes (mesma data, início dentro de 120 min)
  const concurrent = useMemo(() => {
    if (!rows.length) return [];
    const info = rows[0];
    const gm = t2m(info.horario.substring(0, 5));
    return ALL_SCHEDULE
      .filter((sg) => sg.data === info.data && sg.hora && !(sg.mandante === info.mandante && sg.visitante === info.visitante) && Math.abs(t2m(sg.hora) - gm) < 120)
      .sort((a, b) => t2m(a.hora) - t2m(b.hora));
  }, [rows]);

  // Histórico do confronto — uma linha por detentor
  const historyLines = useMemo(() => {
    if (!key) return [];
    return games
      .filter((g) =>
        ((g.mandante === key.mandante && g.visitante === key.visitante) || (g.mandante === key.visitante && g.visitante === key.mandante)) &&
        !isSame(g, key) && getMetric(g, "pontos") != null)
      .sort((a, b) => a.ano - b.ano || a.rodada - b.rodada);
  }, [key]);

  // Ranking por clube (janela de 5: até 2 acima e 2 abaixo) no detentor selecionado
  const rankings = useMemo(() => {
    if (!key || !selDet) return [];
    return [key.mandante, key.visitante].map((club) => {
      const list = games
        .filter((x) => x.detentor === selDet && (x.mandante === club || x.visitante === club) && getMetric(x, "pontos") != null)
        .sort((a, b) => (getMetric(b, "pontos") ?? 0) - (getMetric(a, "pontos") ?? 0));
      const idx = list.findIndex((x) => isSame(x, key) && x.detentor === selDet);
      const win = idx < 0 ? [] : list.slice(Math.max(0, idx - 2), idx + 3).map((x) => ({
        g: x, pos: list.indexOf(x) + 1, current: isSame(x, key),
      }));
      return { club, total: list.length, currentPos: idx >= 0 ? idx + 1 : null, win };
    });
  }, [key, selDet]);

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
          <div className="glass rounded-2xl p-6"
            style={{ background: `radial-gradient(90% 120% at 50% -10%, ${SEASON_COLORS[info.ano]}22, transparent 60%), rgba(255,255,255,0.03)` }}>
            <div className="flex items-center justify-center gap-5 md:gap-8">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <TeamLogo team={info.mandante} size={56} />
                <span className="text-white font-semibold text-center text-sm truncate max-w-full">{info.mandante}</span>
              </div>
              <span className="text-white/25 text-2xl font-light">×</span>
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <TeamLogo team={info.visitante} size={56} />
                <span className="text-white font-semibold text-center text-sm truncate max-w-full">{info.visitante}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-white/45 flex-wrap">
              <span className="font-bold tabular-nums" style={{ color: SEASON_COLORS[info.ano] }}>{info.ano}</span>
              <span className="text-white/20">·</span><span>Rodada {info.rodada}</span>
              <span className="text-white/20">·</span><span className="capitalize">{info.dia}</span>
              <span className="text-white/20">·</span><span className="tabular-nums">{info.data}</span>
              <span className="text-white/20">·</span><span className="tabular-nums">{normalizeHorario(info.horario.substring(0, 5))}</span>
            </div>
          </div>

          {/* Boxes por detentor */}
          <div className="flex flex-col gap-3">
            {rows.map((g, i) => {
              const isTv = PNT_TV.has(g.detentor);
              const primary = getMetric(g, "pontos");
              return (
                <div key={i} className="glass rounded-2xl p-5" style={{ borderLeft: `3px solid ${DETENTOR_COLORS[g.detentor] || "#666"}` }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <DetLogo det={g.detentor} size={22} />
                      <span className="text-white/70 font-semibold text-sm">{g.detentor}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white tabular-nums leading-none">{formatMetric(g.detentor, primary, "pontos")}</div>
                      {isTv && g.audiencia != null && (
                        <div className="text-xs text-white/40 tabular-nums mt-1">{formatAudiencia(g.audiencia)} espectadores</div>
                      )}
                    </div>
                  </div>
                  <ExtraMetrics g={g} />
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
                  <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl border border-white/[0.06]">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sg.liga === "FFU" ? "bg-blue-500/25 text-blue-300" : "bg-white/10 text-white/45"}`}>{sg.liga}</span>
                    <TeamLogo team={sg.mandante} size={16} />
                    <span className="text-white/20 text-[10px]">×</span>
                    <TeamLogo team={sg.visitante} size={16} />
                    <span className="text-white/40 text-xs tabular-nums ml-1">{sg.hora}</span>
                    <div className="flex gap-1 ml-auto">
                      {sg.detentores.map((d) => <DetLogo key={d} det={d} size={13} />)}
                    </div>
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
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Ranking por clube</h2>
              {rows.length > 1 && (
                <div className="flex gap-1">
                  {rows.map((r) => (
                    <button key={r.detentor} type="button" onClick={() => setSelDetState(r.detentor)} title={r.detentor}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={selDet === r.detentor
                        ? { background: (DETENTOR_COLORS[r.detentor] || "#666"), boxShadow: `0 0 12px ${(DETENTOR_COLORS[r.detentor] || "#666")}66` }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {LOGOS[r.detentor]
                        ? <img src={LOGOS[r.detentor]} alt={r.detentor} style={{ height: 15, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: selDet === r.detentor ? 1 : 0.5 }} />
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
                    <TeamLogo team={club} size={18} />
                    <span className="text-white/70 font-semibold text-sm">{club}</span>
                    {currentPos && <span className="ml-auto text-xs text-white/40 tabular-nums">{currentPos}º de {total}</span>}
                  </div>
                  {win.length === 0 ? (
                    <p className="text-xs text-white/25 pl-1">Sem ranking neste detentor.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {win.map(({ g, pos, current }) => (
                        <div key={pos} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs"
                          style={current ? { background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.4)" } : { border: "1px solid rgba(255,255,255,0.05)" }}>
                          <span className="w-6 shrink-0 tabular-nums font-bold" style={{ color: current ? "#93c5fd" : "rgba(255,255,255,0.35)" }}>{pos}º</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <TeamLogo team={g.mandante} size={15} />
                            <span className="text-white/20 text-[9px]">×</span>
                            <TeamLogo team={g.visitante} size={15} />
                          </div>
                          <span className="text-white/35 tabular-nums text-[11px] ml-1 whitespace-nowrap capitalize">{g.dia} {normalizeHorario(g.horario.substring(0, 5))}</span>
                          <span className="ml-auto font-bold text-white tabular-nums whitespace-nowrap">{formatMetric(g.detentor, getMetric(g, "pontos"), "pontos")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Histórico do confronto */}
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Histórico do confronto</h2>
            {historyLines.length === 0 ? (
              <p className="text-sm text-white/30">Sem outros registros deste confronto.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {historyLines.map((g, i) => (
                  <a key={i} href={matchHref(g)}
                    className="flex items-center gap-2.5 p-2 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs font-bold tabular-nums w-9 shrink-0" style={{ color: SEASON_COLORS[g.ano] }}>{g.ano}</span>
                    <span className="text-[11px] text-white/30 w-11 shrink-0">Rod. {g.rodada}</span>
                    <TeamLogo team={g.mandante} size={15} />
                    <span className="text-white/20 text-[9px]">×</span>
                    <TeamLogo team={g.visitante} size={15} />
                    <DetLogo det={g.detentor} size={12} />
                    <span className="ml-auto text-xs font-bold text-white tabular-nums whitespace-nowrap">{formatMetric(g.detentor, getMetric(g, "pontos"), "pontos")}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
