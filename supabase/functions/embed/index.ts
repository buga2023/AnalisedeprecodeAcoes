// Supabase Edge Function — gera embeddings com o modelo `gte-small` embutido
// no runtime do Supabase (grátis, 384 dimensões). Usado pelo cache semântico
// do chat da Pra (`api/_semanticCache.ts`).
//
// Deploy:  supabase functions deploy embed
// Invoca:  POST {SUPABASE_URL}/functions/v1/embed  body { "text": "..." }
//          → { "embedding": number[384] }
//
// Roda no runtime Deno do Supabase — NÃO faz parte do build TS/Vite do app
// (fica fora de src/ e api/). Os globais `Supabase`/`Deno` só existem aqui.

// @ts-nocheck — ambiente Deno/Supabase; tipos não disponíveis no tsconfig do app.

const session = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method-not-allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "invalid-json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (typeof text !== "string" || !text.trim()) {
    return new Response(JSON.stringify({ error: "text-required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // mean_pool + normalize → vetor pronto pra distância de cosseno.
  const embedding = await session.run(text, { mean_pool: true, normalize: true });

  return new Response(JSON.stringify({ embedding }), {
    headers: { "Content-Type": "application/json" },
  });
});
