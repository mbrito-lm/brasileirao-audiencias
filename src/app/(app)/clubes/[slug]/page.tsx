"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { games, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { ALL_SCHEDULE } from "@/data/schedule";
import { LOGOS } from "@/data/logos";
import { teamColor } from "@/data/teamColors";
import { getMetric, formatMetric, normalizeHorario, avg, parseDate } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";
import GamesTable from "@/components/GamesTable";

interface RankItem { id: string; left: string; right: string; meta?: string; cap?: boolean }

function push(m: Map<string, number[]>, k: string, v: number) {
  const a = m.get(k);
  if (a) a.push(v); else m.set(k, [v]);
}
function rankAvg(m: Map<string, number[]>) {
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
  const clubSeasons = useMemo(
    () => Array.from(new Set(clubGames.map((g) => g.ano))).sort((a, b) => b - a),
    [clubGames]
  );

  // Bloco de direitos (Libra/FFU) = liga dos jogos em que o clube é mandante.
  const liga = useMemo(
    () => ALL_SCHEDULE.find((sg) => sg.mandante === club)?.liga ?? null,
    [club]
  );

  // Detentores com dados, ordenados por nº de jogos.
  const detentores = useMemo(() => {
    const s = new Map<string, number>();
    clubGames.forEach((g) => {
      if (getMetric(g) !== null) s.set(g.detentor, (s.get(g.detentor) ?? 0) + 1);
    });
    return Array.from(s.entries()).sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }, [clubGames]);

  const [selDetState, setSelDetState] = useState<string | null>(null);
  const selDet = selDetState && detentores.includes(selDetState) ? selDetState : (detentores[0] ?? null);

  const [rankSeasons, setRankSeasons] = useState<Set<number>>(() => new Set(clubSeasons));
  const activeSeasons = useMemo(() => {
    const valid = clubSeasons.filter((a) => rankSeasons.has(a));
    return new Set(valid.length ? valid : clubSeasons);
  }, [rankSeasons, clubSeasons]);
  const toggleSeason = (a: number) => setRankSeasons((prev) => {
    // parte do conjunto atual válido (com fallback para todas, se estiver vazio/obsoleto)
    const cur = clubSeasons.filter((s) => prev.has(s));
    const n = new Set(cur.length ? cur : clubSeasons);
    if (n.has(a)) { if (n.size > 1) n.delete(a); } else n.add(a);
    return n;
  });

  const seasonClubGames = useMemo(
    () => clubGames.filter((g) => activeSeasons.has(g.ano)),
    [clubGames, activeSeasons]
  );
  const detGames = useMemo(
    () => seasonClubGames.filter((g) => g.detentor === selDet && getMetric(g) !== null),
    [seasonClubGames, selDet]
  );

  const lastGame = useMemo(() => {
    if (!seasonClubGames.length) return null;
    return [...seasonClubGames].sort((a, b) => parseDate(b.data) - parseDate(a.data) || b.rodada - a.rodada)[0];
  }, [seasonClubGames]);

  const media = useMemo(() => {
    const vals = detGames.map((g) => getMetric(g) as number);
    return vals.length ? avg(vals) : null;
  }, [detGames]);

  const det = selDet ?? "";
  const opponent = (g: typeof games[number]) => (g.mandante === club ? g.visitante : g.mandante);

  const audItems: RankItem[] = useMemo(() =>
    [...detGames]
      .sort((a, b) => (getMetric(b) as number) - (getMetric(a) as number))
      .map((g) => ({
        id: `${g.ano}-${g.rodada}-${g.mandante}-${g.visitante}`,
        left: opponent(g),
        right: formatMetric(g.detentor, getMetric(g)),
        meta: g.data.substring(0, 5),
      })),
    [detGames, club]
  );

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
    const toItems = (rows: { k: string; avg: number; n: number }[], cap?: boolean): RankItem[] =>
      rows.map((r) => ({ id: r.k, left: r.k, right: formatMetric(det, r.avg), meta: `${r.n}j`, cap }));
    return {
      dias: toItems(rankAvg(byDia), true),
      horarios: toItems(rankAvg(byHor)),
      slots: toItems(rankAvg(bySlot), true),
    };
  }, [detGames, det]);

  if (clubGames.length === 0) {
    return (
      <div className="py-10">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white text-sm mb-6">← Voltar</button>
        <p className="text-white/40">Clube não encontrado.</p>
      </div>
    );
  }

  const col = teamColor(club);

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
          <div className="flex items-center gap-2 mt-1.5">
            {liga && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${liga === "FFU" ? "bg-blue-500/25 text-[var(--accent-fg)]" : "bg-white/10 text-white/55"}`}>
                {liga}
              </span>
            )}
            <span className="text-white/30 text-xs">· {clubGames.length} jogos</span>
          </div>
        </div>
      </div>

      {/* Recortes: detentor + temporadas */}
      <div className="flex flex-col gap-3 mb-5">
        {detentores.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-white/30 w-32 shrink-0">Recorte por detentor</span>
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
        {clubSeasons.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-white/30 w-32 shrink-0">Temporadas</span>
            {clubSeasons.map((a) => (
              <button key={a} type="button" onClick={() => toggleSeason(a)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
                style={activeSeasons.has(a)
                  ? { color: SEASON_COLORS[a], borderColor: SEASON_COLORS[a] + "66", background: SEASON_COLORS[a] + "1a" }
                  : { color: "rgba(var(--ink-c),0.3)", borderColor: "rgba(var(--ink-c),0.1)" }}>
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs (do recorte selecionado) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="Jogos (total)" value={String(seasonClubGames.length)} />
        <Kpi label={selDet ? `Jogos · ${selDet}` : "Jogos"} value={String(detGames.length)} />
        <Kpi label="Média" value={selDet ? formatMetric(selDet, media) : "—"} />
        <Kpi label="Último jogo"
          value={lastGame ? formatMetric(lastGame.detentor, getMetric(lastGame)) : "—"}
          sub={lastGame ? `vs ${opponent(lastGame)} · ${lastGame.data.substring(0, 5)}` : undefined} />
      </div>

      {/* Rankings */}
      <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Rankings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RankCard title="Audiência" items={audItems} />
        <RankCard title="Dias" items={rankings.dias} />
        <RankCard title="Horários" items={rankings.horarios} />
        <RankCard title="Slots (dia · horário)" items={rankings.slots} />
      </div>

      {/* linha fina separando rankings da lista de jogos */}
      <div className="h-px bg-white/[0.08] my-6" />

      {/* Lista de todos os jogos (reverse-cronológico, com filtros) */}
      <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Todos os jogos</h2>
      <GamesTable games={clubGames} allGames={games} detentor={null} showDeltas={false} />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] text-white/40 mt-1.5 truncate">{sub}</p>}
    </div>
  );
}

function RankCard({ title, items }: { title: string; items: RankItem[] }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-white/25">Sem dados</p>
      ) : (
        <div className="no-scrollbar overflow-y-auto flex flex-col gap-1.5" style={{ maxHeight: 128 }}>
          {items.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-white/30 tabular-nums text-xs">{i + 1}</span>
              <span className={`text-white/75 truncate ${r.cap ? "capitalize" : ""}`}>{r.left}</span>
              <span className="ml-auto font-bold text-white tabular-nums text-xs whitespace-nowrap">{r.right}</span>
              {r.meta && <span className="text-white/25 text-[10px] tabular-nums w-7 text-right shrink-0">{r.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
