import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://odontoudec.online",
  "https://deploy-preview-13--odontoudec.netlify.app",
  "https://deploy-preview-13--odontoudec1.netlify.app",
]);
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://odontoudec.online",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const reply = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

async function hashIp(ip: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return reply(req, { error: "Método no permitido." }, 405);
  try {
    const body = await req.json();
    const name = clean(body.name, 100);
    const phone = clean(body.phone, 30);
    const summary = clean(body.summary, 500);
    const area = clean(body.area, 80);
    const availability = clean(body.availability, 100);
    const source = body.source === "student" ? "student" : "patient";

    if (body.consent !== true) return reply(req, { error: "Necesitamos tu autorización para gestionar la solicitud." }, 400);
    if (name.length < 2 || phone.replace(/\D/g, "").length < 6 || summary.length < 5) {
      return reply(req, { error: "Revisa el nombre, teléfono y descripción antes de enviar." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let studentId: string | null = null;

    if (source === "student") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "");
      if (!token) return reply(req, { error: "Inicia sesión para compartir un paciente." }, 401);
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user) return reply(req, { error: "Tu sesión no es válida." }, 401);
      studentId = user.id;
    }

    const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("cf-connecting-ip") || "unknown";
    const { data, error } = await admin.rpc("patient_bank_submit", {
      p_ip_hash: await hashIp(ip, serviceKey),
      p_name: name,
      p_phone: phone,
      p_summary: summary,
      p_area: area || null,
      p_availability: availability || null,
      p_source: source,
      p_student_id: studentId,
    });
    if (error) throw error;
    return reply(req, { ok: true, case_id: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar la solicitud.";
    return reply(req, {
      error: message.includes("varias solicitudes")
        ? message
        : "No pudimos registrar la solicitud. Revisa los datos e inténtalo nuevamente.",
    }, 400);
  }
});
