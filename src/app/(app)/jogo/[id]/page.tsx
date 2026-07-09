"use client";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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

function DetLogo({ det, size = 20 }: { det: string; size?: number }) {
  const bg = DETENTOR_COLORS[det] || "#444";
  return (
    <span className="rounded flex items-center justify-center shrink-0"
      style={{ width: size + 8, height: size + 8, background: bg }}>
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

type G = (typeof games)[number];

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
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Por praça · <span className="text-white/50">pts domiciliar</span> / <span className="text-white/50">individual</span></p>
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
      .filter((g) => g.ano === key.ano && g.rodada === key.rodada && g.mandante === key.mandante && g.visitante === key.visitante)
      .sort((a, b) => (getMetric(b, "pontos") ?? 0) - (getMetric(a, "pontos") ?? 0));
  }, [key]);

  const history = useMemo(() => {
    if (!key) return [];
    const same = games.filter((g) =>
      ((g.mandante === key.mandante && g.visitante === key.visitante) ||
       (g.mandante === key.visitante && g.visitante === key.mandante)) &&
      !(g.ano === key.ano && g.rodada === key.rodada && g.mandante === key.mandante && g.visitante === key.visitante)
    );
    const map = new Map<string, { ano: number; rodada: number; mandante: string; visitante: string; data: string; dets: G[] }>();
    for (const g of same) {
      const k = `${g.ano}~${g.rodada}~${g.mandante}~${g.visitante}`;
      if (!map.has(k)) map.set(k, { ano: g.ano, rodada: g.rodada, mandante: g.mandante, visitante: g.visitante, data: g.data, dets: [] });
      map.get(k)!.dets.push(g);
    }
    return Array.from(map.values()).sort((a, b) => a.ano - b.ano || a.rodada - b.rodada);
  }, [key]);

  const ranking = useMemo(() => {
    if (!key || !rows.length) return [];
    const clubs = [key.mandante, key.visitante];
    return clubs.map((club) => {
      const perDet = rows.map((row) => {
        const list = games
          .filter((x) => x.detentor === row.detentor && (x.mandante === club || x.visitante === club) && getMetric(x, "pontos") != null)
          .sort((a, b) => (getMetric(b, "pontos") ?? 0) - (getMetric(a, "pontos") ?? 0));
        const idx = list.findIndex((x) =>
          x.ano === row.ano && x.rodada === row.rodada && x.mandante === row.mandante && x.visitante === row.visitante && x.detentor === row.detentor);
        return { detentor: row.detentor, rank: idx >= 0 ? idx + 1 : null, total: list.length };
      }).filter((r) => r.rank != null);
      return { club, perDet };
    });
  }, [key, rows]);

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

      {/* Hero */}
      <div className="glass rounded-2xl p-6 md:p-8 mb-4"
        style={{ background: `radial-gradient(90% 120% at 50% -10%, ${SEASON_COLORS[info.ano]}22, transparent 60%), rgba(255,255,255,0.03)` }}>
        <div className="flex items-center justify-center gap-5 md:gap-10">
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <TeamLogo team={info.mandante} size={64} />
            <span className="text-white font-semibold text-center text-sm md:text-base truncate max-w-full">{info.mandante}</span>
          </div>
          <span className="text-white/25 text-2xl md:text-3xl font-light">×</span>
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <TeamLogo team={info.visitante} size={64} />
            <span className="text-white font-semibold text-center text-sm md:text-base truncate max-w-full">{info.visitante}</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 md:gap-3 mt-5 text-xs md:text-sm text-white/45 flex-wrap">
          <span className="font-bold tabular-nums" style={{ color: SEASON_COLORS[info.ano] }}>{info.ano}</span>
          <span className="text-white/20">·</span>
          <span>Rodada {info.rodada}</span>
          <span className="text-white/20">·</span>
          <span className="capitalize">{info.dia}</span>
          <span className="text-white/20">·</span>
          <span className="tabular-nums">{info.data}</span>
          <span className="text-white/20">·</span>
          <span className="tabular-nums">{normalizeHorario(info.horario.substring(0, 5))}</span>
        </div>
      </div>

      {/* Detentores */}
      <div className="flex flex-col gap-3 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Histórico */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">Histórico do confronto</h2>
          {history.length === 0 ? (
            <p className="text-sm text-white/30">Sem outros registros deste confronto.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((h, i) => (
                <a key={i} href={matchHref(h)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <span className="text-xs font-bold tabular-nums w-9 shrink-0" style={{ color: SEASON_COLORS[h.ano] }}>{h.ano}</span>
                  <span className="text-[11px] text-white/30 w-12 shrink-0">Rod. {h.rodada}</span>
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <TeamLogo team={h.mandante} size={16} />
                    <span className="text-white/20 text-[10px]">×</span>
                    <TeamLogo team={h.visitante} size={16} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {h.dets.map((d, j) => (
                      <span key={j} className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                        style={{ color: DETENTOR_COLORS[d.detentor] || "#aaa", background: (DETENTOR_COLORS[d.detentor] || "#666") + "1a" }}>
                        {formatMetric(d.detentor, getMetric(d, "pontos"), "pontos")}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Ranking */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">Ranking por clube</h2>
          <div className="flex flex-col gap-4">
            {ranking.map(({ club, perDet }) => (
              <div key={club}>
                <div className="flex items-center gap-2 mb-2">
                  <TeamLogo team={club} size={18} />
                  <span className="text-white/70 font-semibold text-sm">{club}</span>
                </div>
                {perDet.length === 0 ? (
                  <p className="text-xs text-white/25 pl-6">Sem ranking disponível.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 pl-6">
                    {perDet.map((r) => (
                      <div key={r.detentor} className="flex items-center gap-2 text-sm">
                        <DetLogo det={r.detentor} size={14} />
                        <span className="text-white/45 text-xs flex-1">{r.detentor}</span>
                        <span className="tabular-nums">
                          <span className="font-bold text-white">{r.rank}º</span>
                          <span className="text-white/35 text-xs"> de {r.total}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
