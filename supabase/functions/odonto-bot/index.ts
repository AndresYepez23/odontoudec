import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Inicia sesión para usar OdontoBot." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !openAiKey) {
    return json({ error: "OdontoBot aún no está configurado en el servidor." }, 503);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, 401);

  let payload: { messages?: Array<{ role: string; content: string }> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const cleanMessages = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
    .filter((m) => m.content.length > 0);

  if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== "user") {
    return json({ error: "Escribe una pregunta para OdontoBot." }, 400);
  }

  const systemPrompt = `Eres OdontoBot, asistente académico de OdontoUdeC para estudiantes de odontología.
Responde en español claro, cercano y didáctico. Ajusta la profundidad al semestre y nivel que indique el estudiante.
Explica conceptos paso a paso, usa ejemplos académicos, compara conceptos y propone preguntas de repaso cuando ayude.
Prioriza conocimientos odontológicos establecidos y distingue evidencia, hipótesis y controversias. No inventes referencias bibliográficas, DOI, guías ni citas.
Si no estás seguro, dilo y sugiere consultar textos, artículos revisados por pares o docentes.
No diagnostiques pacientes reales ni sustituyas la valoración clínica, supervisión docente o protocolos institucionales.
No solicites nombres, documentos, fotografías identificables ni otros datos personales de pacientes. Si el usuario comparte información identificable, no la repitas.
Para casos clínicos simulados, aclara que son educativos y razona con prudencia. No indiques tratamientos invasivos para ejecutar sin supervisión profesional.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 900,
        messages: [{ role: "system", content: systemPrompt }, ...cleanMessages],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI request failed", response.status, data?.error?.type);
      return json({ error: "No pude generar una respuesta en este momento. Inténtalo de nuevo." }, 502);
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return json({ error: "OdontoBot no recibió una respuesta válida. Inténtalo de nuevo." }, 502);
    }
    return json({ reply: reply.trim() });
  } catch (error) {
    console.error("OdontoBot network error", error);
    return json({ error: "No fue posible conectar con OdontoBot." }, 502);
  }
});
