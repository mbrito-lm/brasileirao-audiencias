"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { games, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { teamColor } from "@/data/teamColors";
import { getMetric, formatMetric, normalizeHorario, avg } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";
import GamesTable from "@/components/GamesTable";

interface RankRow { k: string; avg: number; n: number }

function push(m: Map<string, number[]>, k: string, v: number) {
  const a = m.get(k);
  if (a) a.push(v); else m.set(k, [v]);
}
function rank(m: Map<string, number[]>): RankRow[] {
  return Array.from(m.entries())
    .map(([k, vals]) => ({ k, avg: avg(vals), n: vals.length }))
    .sort((a, b) => b.avg - a.avg);
}

export default function ClubePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const club = decodeURIComponent(params.slug);

  const clubGames = useMemo(
    () => games.filter((g) => g.mandante === club || g.visitante === club),
    [club]
  );

  // Detentores com dados para este clube, ordenados por nº de jogos.
  const detentores = useMemo(() => {
    const s = new Map<string, number>();
    clubGames.forEach((g) => {
      if (getMetric(g) !== null) s.set(g.detentor, (s.get(g.detentor) ?? 0) + 1);
    });
    return Array.from(s.entries()).sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }, [clubGames]);

  const [selDetState, setSelDetState] = useState<string | null>(null);
  const selDet = selDetState && detentores.includes(selDetState) ? selDetState : (detentores[0] ?? null);

  const detGames = useMemo(
    () => clubGames.filter((g) => g.detentor === selDet && getMetric(g) !== null),
    [clubGames, selDet]
  );

  const summary = useMemo(() => {
    const vals = detGames.map((g) => getMetric(g) as number);
    return {
      total: clubGames.length,
      n: detGames.length,
      media: vals.length ? avg(vals) : null,
      max: vals.length ? Math.max(...vals) : null,
    };
  }, [clubGames, detGames]);

  const rankings = useMemo(() => {
    const byDia = new Map<string, number[]>();
    const byHor = new Map<string, number[]>();
    const bySlot = new Map<string, number[]>();
    detGames.forEach((g) => {
      const v = getMetric(g) as number;
      const hor = normalizeHorario(g.horario.substring(0, 5));
      push(byDia, g.dia, v);
      push(byHor, hor, v);
      push(bySlot, `${g.dia} · ${hor}`, v);
    });
    return { dias: rank(byDia), horarios: rank(byHor), slots: rank(bySlot) };
  }, [detGames]);

  if (clubGames.length === 0) {
    return (
      <div className="py-10">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white text-sm mb-6">← Voltar</button>
        <p className="text-white/40">Clube não encontrado.</p>
      </div>
    );
  }

  const col = teamColor(club);
  const seasons = Array.from(new Set(clubGames.map((g) => g.ano))).sort((a, b) => b - a);

  return (
    <div className="py-6">
      <Link href="/clubes"
        className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Clubes
      </Link>

      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-6">
        <div className="rounded-2xl p-3 shrink-0" style={{ background: col + "22", border: `1px solid ${col}55` }}>
          <TeamLogo team={club} size={48} />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-white tracking-tight truncate">{club}</h1>
          <div className="flex items-center gap-2 mt-1">
            {seasons.map((a) => (
              <span key={a} className="text-xs font-bold tabular-nums" style={{ color: SEASON_COLORS[a] }}>{a}</span>
            ))}
            <span className="text-white/30 text-xs">· {clubGames.length} jogos</span>
          </div>
        </div>
      </div>

      {/* Recorte por detentor */}
      {detentores.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[10px] uppercase tracking-wider text-white/30 mr-1">Recorte por detentor</span>
          {detentores.map((d) => (
            <button key={d} type="button" onClick={() => setSelDetState(d)} title={d}
              className="h-8 px-2.5 rounded-lg flex items-center transition-all"
              style={selDet === d
                ? { background: (DETENTOR_COLORS[d] || "#666"), boxShadow: `0 0 12px ${(DETENTOR_COLORS[d] || "#666")}66` }
                : { background: "rgba(var(--ink-c),0.05)", border: "1px solid rgba(var(--ink-c),0.08)" }}>
              {LOGOS[d]
                ? <img src={LOGOS[d]} alt={d} style={{ height: 15, width: "auto", objectFit: "contain", filter: selDet === d ? "brightness(0) invert(1)" : "var(--logo-filter-inactive)", maxWidth: 46 }} />
                : <span className="text-[10px] font-semibold text-white/70">{d}</span>}
            </button>
          ))}
        </div>
      )}

      {/* KPIs (do recorte selecionado) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Jogos (total)" value={String(summary.total)} />
        <Kpi label={selDet ? `Jogos · ${selDet}` : "Jogos"} value={String(summary.n)} />
        <Kpi label="Média" value={selDet ? formatMetric(selDet, summary.media) : "—"} />
        <Kpi label="Maior audiência" value={selDet ? formatMetric(selDet, summary.max) : "—"} />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <RankCard title="Dias" rows={rankings.dias} det={selDet} cap />
        <RankCard title="Horários" rows={rankings.horarios} det={selDet} />
        <RankCard title="Slots (dia · horário)" rows={rankings.slots} det={selDet} cap />
      </div>

      {/* Lista de todos os jogos (reverse-cronológico, com filtros) */}
      <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Todos os jogos</h2>
      <GamesTable games={clubGames} allGames={games} detentor={null} showDeltas={false} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function RankCard({ title, rows, det, cap }: { title: string; rows: RankRow[]; det: string | null; cap?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-white/25">Sem dados</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.slice(0, 6).map((r, i) => (
            <div key={r.k} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-white/30 tabular-nums text-xs">{i + 1}</span>
              <span className={`text-white/75 truncate ${cap ? "capitalize" : ""}`}>{r.k}</span>
              <span className="ml-auto font-bold text-white tabular-nums text-xs whitespace-nowrap">{det ? formatMetric(det, r.avg) : "—"}</span>
              <span className="text-white/25 text-[10px] tabular-nums w-7 text-right shrink-0">{r.n}j</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
