import Anthropic from "@anthropic-ai/sdk";
import { games } from "@/data/games";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Contexto construído UMA vez (módulo carregado): os jogos são estáticos.
// Bytes idênticos a cada request = pré-requisito para o prompt cache dar "hit".
const GAMES_CONTEXT = buildContext();

const nf = new Intl.NumberFormat("pt-BR");
const fmtPnt = (n: number) => n.toFixed(1).replace(".", ","); // 10.2 -> "10,2"

type G = (typeof games)[number];
const label = (g: G) => `${g.mandante} x ${g.visitante} R${g.rodada}`;

// Estatísticas de uma métrica (audiencia ou pnt) para um conjunto de jogos.
function metricStats(gs: G[], sel: (g: G) => number | null) {
  const valid = gs.filter((g) => sel(g) != null);
  if (!valid.length) return null;
  const nums = valid.map((g) => sel(g)!);
  const soma = nums.reduce((a, b) => a + b, 0);
  const maxG = valid.reduce((a, b) => (sel(b)! > sel(a)! ? b : a));
  const minG = valid.reduce((a, b) => (sel(b)! < sel(a)! ? b : a));
  return { count: valid.length, soma, media: soma / valid.length, maxG, minG };
}

// Estatísticas calculadas em CÓDIGO (determinístico). LLM soma mal dezenas de
// números; entregamos médias/somas/máximos prontos para o modelo só ler.
function buildStats(): string {
  const key = (g: G) => `${g.ano}|${g.detentor}`;
  const groups = new Map<string, G[]>();
  for (const g of games) {
    const k = key(g);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(g);
  }

  const lines: string[] = [];
  for (const k of [...groups.keys()].sort()) {
    const gs = groups.get(k)!;
    const [ano, detentor] = k.split("|");
    let line = `${ano} ${detentor} (${gs.length} jogos):`;

    const aud = metricStats(gs, (g) => g.audiencia);
    if (aud) {
      line +=
        ` audiência(pessoas): média ${nf.format(Math.round(aud.media))}, ` +
        `total ${nf.format(aud.soma)}, ` +
        `maior ${nf.format(aud.maxG.audiencia!)} (${label(aud.maxG)}), ` +
        `menor ${nf.format(aud.minG.audiencia!)} (${label(aud.minG)}).`;
    }

    const pnt = metricStats(gs, (g) => g.pnt);
    if (pnt) {
      line +=
        ` ibope(pontos): média ${fmtPnt(pnt.media)}, ` +
        `maior ${fmtPnt(pnt.maxG.pnt!)} (${label(pnt.maxG)}), ` +
        `menor ${fmtPnt(pnt.minG.pnt!)} (${label(pnt.minG)}).`;
    }

    lines.push(line);
  }
  return (
    "RESUMO PRÉ-CALCULADO — use SEMPRE estes valores para médias, totais, maiores e menores.\n" +
    "Cada emissora pode ter dois indicadores: audiência em pessoas e/ou pontos de ibope.\n" +
    lines.join("\n")
  );
}

const GAMES_STATS = buildStats();

function buildContext(): string {
  // Formato compacto CSV — sem unidades repetidas, números crus, data dd/mm
  // (o ano já vem em coluna própria). Instruímos o modelo a formatar na saída.
  const rows = games.map((g) => {
    const aud = g.audiencia != null ? String(g.audiencia) : "-";
    const pnt = g.pnt != null ? String(g.pnt).replace(".", ",") : "-";
    const data = g.data.slice(0, 5); // dd/mm
    return `${g.rodada}|${g.ano}|${g.mandante}|${g.visitante}|${g.detentor}|${data}|${aud}|${pnt}`;
  });
  return (
    "Colunas: rodada|ano|mandante|visitante|detentor|data(dd/mm)|audiencia(pessoas)|pnt(pontos ibope)\n" +
    "Valor '-' significa sem dados.\n" +
    rows.join("\n")
  );
}

const INSTRUCTIONS = `Você é um assistente especializado em audiências do Brasileirão Série A.
Responda em português usando SOMENTE os dados fornecidos.

REGRAS DE RESPOSTA (obrigatórias):
- Vá direto ao ponto. NÃO escreva raciocínio, preâmbulo nem frases como "Calculando..." ou "Analisando os dados...".
- Responda em texto puro, SEM formatação markdown: não use #, *, **, -, listas ou títulos.
- Responda em 1 ou 2 frases completas, dando o resultado com contexto (ex: "A média de audiência da Amazon em 2025 foi de 583.728 pessoas, considerando os 38 jogos transmitidos.").
- Para médias, totais, maiores e menores, USE os valores do bloco RESUMO PRÉ-CALCULADO. NUNCA recalcule nem invente números; se um valor não estiver nos dados, diga que não há registro.
- Existem DOIS indicadores: audiência em pessoas e pontos de ibope (pnt).
  - Para GLOBO, RECORD, SPORTV e PREMIERE, o indicador PRINCIPAL são os PONTOS DE IBOPE. Sempre dê os pontos primeiro e, quando existir, cite também a audiência em pessoas entre parênteses.
  - Para AMAZON e YOUTUBE, use a audiência em pessoas.
- Audiência: formate com pontos de milhar (ex: 1.340.317 pessoas).
- Pontos de ibope: use vírgula decimal (ex: 10,2 pts).
- Nunca troque as unidades: pessoas é contagem de pessoas, pts é ponto de ibope. São coisas diferentes.`;

// Nomes de times (para detectar perguntas que precisam dos jogos crus).
const TEAM_NAMES = [
  ...new Set(games.flatMap((g) => [g.mandante, g.visitante])),
].map((t) => t.toLowerCase());

// Palavras que indicam pergunta de detalhe jogo-a-jogo (não agregado).
const DETAIL_RE =
  /\b(jogo|jogos|partida|rodada|quando|que dia|data|hor[aá]rio|contra|confronto|adversári|estreia|clássico)\b/i;

// Decide se precisamos anexar a lista completa de jogos. Perguntas de agregado
// (média, maior, total, comparação por emissora) são respondidas só com o
// RESUMO pré-calculado — muito mais barato e igualmente preciso.
function needsRawGames(question: string): boolean {
  const q = question.toLowerCase();
  if (DETAIL_RE.test(q)) return true;
  return TEAM_NAMES.some((t) => q.includes(t));
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const messages: { role: "user" | "assistant"; content: string }[] = body.messages;
    if (!messages?.length) return new Response("Bad request", { status: 400 });

    // Só anexa os 483 jogos crus quando a última pergunta pede detalhe.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const includeRaw = lastUser ? needsRawGames(lastUser.content) : false;

    // Bloco 1: instruções + resumo pré-calculado (pequeno, sempre presente).
    const system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[] = [
      { type: "text", text: `${INSTRUCTIONS}\n\n${GAMES_STATS}` },
    ];
    // Bloco 2: jogos crus, só em perguntas de detalhe. Grande o bastante para
    // cachear — dentro de 1h, perguntas de detalhe seguidas custam ~10%.
    if (includeRaw) {
      system.push({
        type: "text",
        text: `DADOS DOS JOGOS:\n${GAMES_CONTEXT}`,
        cache_control: { type: "ephemeral", ttl: "1h" } as { type: "ephemeral" },
      });
    }

    const response = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400, // respostas são de 1-2 frases; limita custo de saída
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      // Habilita a janela de cache estendida de 1 hora.
      { headers: { "anthropic-beta": "extended-cache-ttl-2025-04-11" } }
    );

    // Log de uso para acompanhar custo/cache (aparece nos logs da Vercel).
    console.log("[chat usage]", includeRaw ? "detalhe" : "resumo", JSON.stringify(response.usage));

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return Response.json({ text });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
