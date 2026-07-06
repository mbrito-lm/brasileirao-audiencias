import Anthropic from "@anthropic-ai/sdk";
import { games } from "@/data/games";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Contexto construído UMA vez (módulo carregado): os jogos são estáticos.
// Bytes idênticos a cada request = pré-requisito para o prompt cache dar "hit".
const GAMES_CONTEXT = buildContext();

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
Responda de forma direta e objetiva, em português, usando SOMENTE os dados fornecidos.
Ao mostrar audiência, formate com pontos de milhar (ex: 1.340.317 pessoas).
Ao mostrar pontos de ibope, use vírgula decimal (ex: 2,5 pts).
Se a informação não estiver nos dados, diga que não há registro.`;

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
          text: `DADOS DOS JOGOS:\n${GAMES_CONTEXT}`,
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
