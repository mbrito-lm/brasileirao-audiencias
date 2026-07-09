"use client";
import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { games, DETENTOR_COLORS, SEASON_COLORS, type Game } from "@/data/games";
import { ALL_SCHEDULE } from "@/data/schedule";
import { LOGOS } from "@/data/logos";
import { teamColor } from "@/data/teamColors";
import { getMetric, formatMetric, normalizeHorario, avg, parseDate } from "@/lib/stats";
import { matchHref } from "@/lib/gameLink";
import TeamLogo from "@/components/TeamLogo";
import GamesTable from "@/components/GamesTable";

// Ordem fixa dos botões de detentor (mesmo os sem jogos aparecem, desabilitados).
const DET_ORDER = ["Record", "YouTube", "Amazon", "Globo", "SporTV", "Premiere"];

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

  // Contagem de jogos (com dado) por detentor; define disponibilidade e default.
  const detCount = useMemo(() => {
    const s = new Map<string, number>();
    clubGames.forEach((g) => {
      if (getMetric(g) !== null) s.set(g.detentor, (s.get(g.detentor) ?? 0) + 1);
    });
    return s;
  }, [clubGames]);
  const defaultDet = useMemo(() => {
    let best: string | null = null, n = -1;
    detCount.forEach((c, d) => { if (c > n) { n = c; best = d; } });
    return best;
  }, [detCount]);

  const [selDetState, setSelDetState] = useState<string | null>(null);
  // Detentor inicial vindo por ?det= (ao chegar da página de um jogo).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("det");
    if (p) setSelDetState(p);
  }, []);
  const selDet = selDetState && detCount.has(selDetState) ? selDetState : defaultDet;
  const detColor = selDet ? (DETENTOR_COLORS[selDet] || undefined) : undefined;

  const [rankSeasons, setRankSeasons] = useState<Set<number>>(() => new Set(clubSeasons));
  const activeSeasons = useMemo(() => {
    const valid = clubSeasons.filter((a) => rankSeasons.has(a));
    return new Set(valid.length ? valid : clubSeasons);
  }, [rankSeasons, clubSeasons]);
  const toggleSeason = (a: number) => setRankSeasons(() => {
    const n = new Set(clubSeasons.filter((s) => activeSeasons.has(s)));
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

  // Jogo mais recente DENTRO do recorte do detentor selecionado.
  const lastGame = useMemo(() => {
    if (!detGames.length) return null;
    return [...detGames].sort((a, b) => parseDate(b.data) - parseDate(a.data) || b.rodada - a.rodada)[0];
  }, [detGames]);

  const media = useMemo(() => {
    const vals = detGames.map((g) => getMetric(g) as number);
    return vals.length ? avg(vals) : null;
  }, [detGames]);

  const det = selDet ?? "";

  // Ranking de audiência: jogos do recorte ordenados por audiência (desc).
  const audGames = useMemo(
    () => [...detGames].sort((a, b) => (getMetric(b) as number) - (getMetric(a) as number)),
    [detGames]
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
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Voltar
      </button>

      {/* Recortes: detentor | temporadas — numa linha à direita, acima dos KPIs */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 justify-end mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/30">Detentor</span>
          {DET_ORDER.map((d) => {
            const available = detCount.has(d);
            const isSel = available && selDet === d;
            const c = DETENTOR_COLORS[d] || "#666";
            return (
              <button key={d} type="button" disabled={!available}
                onClick={available ? () => setSelDetState(d) : undefined}
                title={available ? d : `${d} — sem jogos`}
                className={`h-8 px-2.5 rounded-lg flex items-center border transition-colors ${available ? "" : "opacity-35 cursor-not-allowed"}`}
                style={isSel
                  ? { background: c, borderColor: c, boxShadow: `0 0 12px ${c}66` }
                  : { background: "rgba(var(--ink-c),0.05)", borderColor: "rgba(var(--ink-c),0.08)" }}>
                {LOGOS[d]
                  ? <img src={LOGOS[d]} alt={d} style={{ height: 15, width: "auto", objectFit: "contain", filter: isSel ? "brightness(0) invert(1)" : "var(--logo-filter-inactive)", maxWidth: 46 }} />
                  : <span className="text-[10px] font-semibold text-white/70">{d}</span>}
              </button>
            );
          })}
        </div>
        {clubSeasons.length > 1 && (
          <div className="w-px h-7 bg-white/[0.12]" />
        )}
        {clubSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Temporadas</span>
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

      {/* Cabeçalho + KPIs — centralizados verticalmente na mesma faixa */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 mb-6">
        <div className="flex items-center gap-4 shrink-0">
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

        <div className="flex flex-wrap gap-3 ml-auto">
          <Kpi label="Jogos (total)" value={String(seasonClubGames.length)} />
          <Kpi label={selDet ? `Jogos · ${selDet}` : "Jogos"} value={String(detGames.length)} accent={detColor} />
          <Kpi label="Média" value={selDet ? formatMetric(selDet, media) : "—"} accent={detColor} />
          <LastGameKpi g={lastGame} accent={detColor} />
        </div>
      </div>

      {/* linha fina entre KPIs e rankings */}
      <div className="h-px bg-white/[0.08] mb-6" />

      {/* Rankings */}
      <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Rankings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AudRankCard title="Audiência" rows={audGames} />
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

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass rounded-2xl p-4 w-40 shrink-0" style={accent ? { border: `1px solid ${accent}` } : undefined}>
      <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums leading-none">{value}</p>
    </div>
  );
}

function LastGameKpi({ g, accent }: { g: Game | null; accent?: string }) {
  return (
    <div className="glass rounded-2xl p-4 w-64 shrink-0" style={accent ? { border: `1px solid ${accent}` } : undefined}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] text-white/35 uppercase tracking-widest">Mais recente</p>
        {g && <p className="text-[10px] text-white/40 tabular-nums whitespace-nowrap">Rod {g.rodada} · {g.data.substring(0, 5)}</p>}
      </div>
      {!g ? (
        <p className="text-2xl font-bold text-white leading-none">—</p>
      ) : (
        <div className="flex items-center gap-2 h-6">
          <TeamLogo team={g.mandante} size={24} />
          <span className="text-white/25 text-sm">×</span>
          <TeamLogo team={g.visitante} size={24} />
          <span className="ml-auto text-2xl font-bold text-white tabular-nums leading-none whitespace-nowrap">
            {formatMetric(g.detentor, getMetric(g))}
          </span>
        </div>
      )}
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
        <div className="no-scrollbar overflow-y-auto flex flex-col gap-1.5" style={{ maxHeight: 132 }}>
          {items.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-white/30 tabular-nums text-xs">{i + 1}</span>
              <span className={`text-white/75 truncate ${r.cap ? "capitalize" : ""}`}>{r.left}</span>
              <span className="ml-auto font-bold text-white tabular-nums text-sm whitespace-nowrap">{r.right}</span>
              {r.meta && <span className="text-white/25 text-[10px] tabular-nums w-7 text-right shrink-0">{r.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudRankCard({ title, rows }: { title: string; rows: Game[] }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-white/25">Sem dados</p>
      ) : (
        <div className="no-scrollbar overflow-y-auto flex flex-col gap-1.5" style={{ maxHeight: 132 }}>
          {rows.map((g, i) => (
            <Link key={`${g.ano}-${g.rodada}-${g.mandante}-${g.visitante}`} href={matchHref(g, g.detentor)}
              className="flex items-center gap-1.5 rounded-md px-1 -mx-1 hover:bg-white/[0.04] transition-colors">
              <span className="w-4 shrink-0 text-white/30 tabular-nums text-xs">{i + 1}</span>
              <TeamLogo team={g.mandante} size={18} />
              <span className="text-white/20 text-[10px]">×</span>
              <TeamLogo team={g.visitante} size={18} />
              <span className="text-[10px] font-bold tabular-nums shrink-0 ml-1" style={{ color: SEASON_COLORS[g.ano] }}>{g.ano}</span>
              <span className="text-white/40 text-[10px] tabular-nums capitalize truncate">{g.dia} {normalizeHorario(g.horario.substring(0, 5))}</span>
              <span className="ml-auto font-bold text-white tabular-nums text-sm whitespace-nowrap">{formatMetric(g.detentor, getMetric(g))}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
