import Anthropic from "@anthropic-ai/sdk";
import { games } from "@/data/games";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Contexto construído UMA vez (módulo carregado): os jogos são estáticos.
// Bytes idênticos a cada request = pré-requisito para o prompt cache dar "hit".
const GAMES_CONTEXT = buildContext();

const nf = new Intl.NumberFormat("pt-BR");

// Estatísticas calculadas em CÓDIGO (determinístico). LLM soma mal dezenas de
// números; entregamos médias/somas/máximos prontos para o modelo só ler.
function buildStats(): string {
  const withAud = games.filter((g) => g.audiencia != null);
  const key = (g: (typeof games)[number]) => `${g.ano}|${g.detentor}`;
  const groups = new Map<string, typeof games>();
  for (const g of withAud) {
    const k = key(g);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(g);
  }

  const label = (g: (typeof games)[number]) =>
    `${g.mandante} x ${g.visitante} R${g.rodada}`;

  const lines: string[] = [];
  const sorted = [...groups.keys()].sort();
  for (const k of sorted) {
    const gs = groups.get(k)!;
    const [ano, detentor] = k.split("|");
    const auds = gs.map((g) => g.audiencia!);
    const soma = auds.reduce((a, b) => a + b, 0);
    const media = Math.round(soma / auds.length);
    const maiorG = gs.reduce((a, b) => (b.audiencia! > a.audiencia! ? b : a));
    const menorG = gs.reduce((a, b) => (b.audiencia! < a.audiencia! ? b : a));
    lines.push(
      `${ano} ${detentor}: ${auds.length} jogos | média ${nf.format(media)} | ` +
        `total ${nf.format(soma)} | maior ${nf.format(maiorG.audiencia!)} (${label(maiorG)}) | ` +
        `menor ${nf.format(menorG.audiencia!)} (${label(menorG)})`
    );
  }
  return (
    "RESUMO PRÉ-CALCULADO (audiência em pessoas) — use estes valores para médias, totais, máximos e mínimos:\n" +
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
- Para médias, totais, maiores e menores audiências, USE os valores do bloco RESUMO PRÉ-CALCULADO. NÃO recalcule somando os jogos.
- Audiência: formate com pontos de milhar (ex: 1.340.317 pessoas).
- Pontos de ibope: use vírgula decimal (ex: 2,5 pts).
- Se a informação não estiver nos dados, diga apenas que não há registro.`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const messages: { role: "user" | "assistant"; content: string }[] = body.messages;
    if (!messages?.length) return new Response("Bad request", { status: 400 });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [
        { type: "text", text: INSTRUCTIONS },
        {
          type: "text",
          text: `${GAMES_STATS}\n\nDADOS DOS JOGOS:\n${GAMES_CONTEXT}`,
          // Cacheia todo o prefixo (instruções + dados). Leituras seguintes
          // dentro da janela do cache custam ~10% do preço de entrada.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return Response.json({ text });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
