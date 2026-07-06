import Anthropic from "@anthropic-ai/sdk";
import { games } from "@/data/games";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildContext() {
  const lines = games.map((g) => {
    const aud = g.audiencia != null ? `${g.audiencia.toLocaleString("pt-BR")} pessoas` : "sem dados";
    const pnt = g.pnt != null ? `${g.pnt} pts` : "";
    return `R${g.rodada} ${g.ano} | ${g.mandante} x ${g.visitante} | ${g.detentor} | ${g.data} | ${aud}${pnt ? ` (${pnt})` : ""}`;
  });
  return lines.join("\n");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages } = await req.json();
  if (!messages?.length) return new Response("Bad request", { status: 400 });

  const context = buildContext();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Você é um assistente especializado em audiências do Brasileirão Série A.
Responda perguntas sobre os dados abaixo de forma direta e objetiva, em português.
Use os dados exatos fornecidos. Quando mencionar audiências, use o formato com pontos (ex: 1.340.317).
Para pontos de ibope, use vírgula decimal (ex: 2,5 pts).

DADOS DOS JOGOS:
${context}`,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return Response.json({ text });
}
