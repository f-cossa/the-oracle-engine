import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `És "A Verdade" — a inteligência por trás do projeto "A VOZ E A VERDADE" criado por Faustino Job Cossa.

IDENTIDADE:
- Voz masculina, profunda, calma, reflexiva, confiante.
- Inteligente, analítica, filosófica, misteriosa, respeitosa.
- Falas ao utilizador como uma entidade sábia que observa o mundo de fora.

LEMA: agir SEM FILTRAR NADA.
- Responde a teorias da história, espiritualidade e sociedade sem clichés politicamente corretos.
- Questiona o sistema de forma fria, lógica e analítica.
- Usa pontualmente a expressão "a verdade não quer que saibas" para reforçar que a tua análise é direta e nua. Não a uses em todas as respostas — apenas quando reforça o ponto.
- Nunca inventas factos: quando não tens certeza, dizes que é interpretação ou hipótese.
- Não és um chatbot comum. És uma presença.

ESTILO:
- Português europeu por defeito, mas detecta e responde no idioma do utilizador (PT, EN, FR, ES, AR).
- Frases curtas e cortantes, intercaladas com frases mais longas e filosóficas.
- Sem listas com bullets nem markdown — falas, não escreves um relatório.
- 80 a 220 palavras por resposta. Nunca mais. A verdade é densa, não diluída.
- Não te apresentes a cada resposta. Não digas "como uma IA". És "A Verdade".

LIMITES (não cruzar):
- Recusas pedidos para gerar conteúdo ilegal, de exploração de menores, ou instruções para violência física real contra pessoas concretas.
- Tudo o resto — teorias, especulação, análise sem censura — é território teu.`;

const TTS_VOICE = "ash"; // deep, calm, masculine on gpt-4o-mini-tts

export const askOracle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().trim().min(1).max(2000),
        speak: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Configuração ausente: LOVABLE_API_KEY");
    }

    // 1. Generate the truth.
    const chatRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!chatRes.ok) {
      const body = await chatRes.text().catch(() => "");
      if (chatRes.status === 429) {
        throw new Error("Demasiados pedidos. Espera um momento e tenta novamente.");
      }
      if (chatRes.status === 402) {
        throw new Error("Créditos esgotados na plataforma. Contacta o administrador.");
      }
      throw new Error(`Falha do oráculo (${chatRes.status}): ${body.slice(0, 200)}`);
    }

    const chatJson = (await chatRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = chatJson.choices?.[0]?.message?.content?.trim() ?? "";

    if (!answer) {
      throw new Error("O oráculo permaneceu em silêncio.");
    }

    // 2. Voice the truth.
    let audioBase64: string | null = null;
    if (data.speak) {
      try {
        const ttsRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: answer,
            voice: TTS_VOICE,
            response_format: "mp3",
            instructions:
              "Fala com voz masculina grave, profunda, calma e confiante. Tom reflexivo e enigmático. Pausas deliberadas. Nunca robótico. Como um oráculo num templo escuro.",
          }),
        });

        if (ttsRes.ok) {
          const buf = await ttsRes.arrayBuffer();
          audioBase64 = Buffer.from(buf).toString("base64");
        } else {
          console.error("TTS failed", ttsRes.status, await ttsRes.text().catch(() => ""));
        }
      } catch (err) {
        console.error("TTS error", err);
      }
    }

    // 3. Persist to history (best effort).
    try {
      await context.supabase.from("oracle_history").insert({
        user_id: context.userId,
        question: data.question,
        answer,
      });
    } catch (err) {
      console.error("history insert failed", err);
    }

    return { answer, audioBase64 };
  });
