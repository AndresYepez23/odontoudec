import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SURVEY_KEY = "reconocimientos-2026";
const MAX_TEXT = 500;
const OPTIONS: Record<string, string[]> = {
  ortodoncista: ["LINCE VIDES FANNY ELVIRA","VARGAS ESPINOSA GERMAN","INSIGNARES ARANA INGRID MARIA","RESTREPO FRANCO ANGELICA MARIA","PATERNINA HERNANDEZ ADOLFO"],
  odontopediatra: ["PLAZAS ROMAN JAIME ENRIQUE","MARTELO GOMEZ PIEDA MARY","LLAMAS GARCIA JOSE IGNACIO","GOMEZ RAMIREZ SANDRA PATRICIA","CACERES MATTA SANDRA VIVIANA","CARMONA ARANGO LUIS EDUARDO","PÉREZ TRESPALACIOS GLORIA E."],
  endodoncista: ["VELASCO ZÚÑIGA GUSTAVO","BARCHA BARRETO DEMETRIO ALFONSO","BURGOS FUENTES TERESITA","ALVEAR PÉREZ JAVIER IGNACIO","COVO MORALES EDUARDO E.","RAMOS MANOTAS JACOBO","OSORIO CABARCAS GISELLA ISABEL","FLOREZ ARIZA JOSE ELIAS"],
  rehabilitador_oral: ["CASTILLO TOVAR LAURA","ABDALA ESCALA AIZAR","ARIZA MARTINEZ STEPHANYE","CUADRO CAUSIL ALFONSO MANUEL","HERRERA DIAZ PAOLA","MATSON ROBLES ALVARO ANDRES","OSORIO FERNANDEZ MARIA CLAUDIA","REALES GUTIERREZ YURANIS","TORRES REYES LIDIS MARIA","BERROCAL RIVAS JAIRO A.","CARVAJAL CABRALES KATHERINE","MORALES VILLA LUIS MIGUEL","MENDEZ SILVA JAVIER ENRIQUE"],
  periodoncista: ["BENEDETTI ANGULO GUIDO A.","DÍAZ CABALLERO ANTONIO","PULIDO ROZO MIRIAM A.","VEGA GUTIERREZ MARYURY","ACOSTA RAISH HABED EDUARDO","ROVIRA ORTIZ CARMEN JULIA","RICO VELASCO DAVID ALBERTO","CRESCENTE PERTUZ NATALIA ANDREA","PORRAS MENDOZA KARINA"],
  cirujano: ["GUZMAN DE AVILA JAIME","HARRIS RICARDO JONATHAN","LEOTTAU JHON FIDEL","OROZO BONILLA ROBERTO CARLOS","LOPEZ APARICIO ERICH BAYRON","PEREZ BENAVIDES JORGE","RODRÍGUEZ VARGAS FEDERICO V.","TORRES OSORIO LENIN","CANTILLO OSWALDO"],
  semiologo: ["HIGUERA BLANCO JULIAN","ÁLVAREZ VILLADIEGO PATRICIA","CARBONELL MUÑOZ ZOILA","CARMONA LORDUY MARTHA C.","HARRIS RICARDO JONATHAN","JIMÉNEZ MALAGÓN MARIA DEL C.","TETAY SALGADO SINDY","TORRES OSORIO LENIN"],
  coordinador_clinica: ["COVO MORALES EDUARDO E.","DÍAZ CABALLERO ANTONIO","MORALES VILLA LUIS MIGUEL","PÉREZ TRESPALACIOS GLORIA E.","BENEDETTI ANGULO GUIDO A.","RAMOS MANOTAS JACOBO","ÁLVAREZ VILLADIEGO PATRICIA","ALVEAR PÉREZ JAVIER IGNACIO","VEGA GUTIERREZ MARYURY","GUZMAN DE AVILA JAIME","PEREZ BENAVIDES JORGE","RESTREPO FRANCO ANGELICA MARIA","ABDALA ESCALA AIZAR","JIMÉNEZ MALAGÓN MARIA DEL C."]
};
const TEXT_FIELDS = ["docente","docente_didactico","docente_colaborador","docente_inspirador","docente_paciente","docente_calidad_humana","docente_deja_huella"];
const ALL_FIELDS = [...Object.keys(OPTIONS), ...TEXT_FIELDS];
const cors = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const allowed = origin === "https://odontoudec.online" ||
    /^https:\/\/deploy-preview-\d+--odontoudec\.netlify\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://odontoudec.online",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
};
const reply = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

function validateAnswers(input: unknown): { ok: true; answers: Record<string,string> } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok:false, error:"Respuestas inválidas." };
  const source = input as Record<string, unknown>;
  if (Object.keys(source).length !== ALL_FIELDS.length || ALL_FIELDS.some(k => !(k in source))) {
    return { ok:false, error:"Debes completar todas las categorías de la encuesta." };
  }
  const answers: Record<string,string> = {};
  for (const [key, allowed] of Object.entries(OPTIONS)) {
    const value = source[key];
    if (typeof value !== "string" || !allowed.includes(value)) return { ok:false, error:"Hay una selección no válida. Actualiza la encuesta e inténtalo de nuevo." };
    answers[key] = value;
  }
  for (const key of TEXT_FIELDS) {
    const value = typeof source[key] === "string" ? source[key].trim().replace(/\s+/g," ") : "";
    if (value.length < 2 || value.length > MAX_TEXT) return { ok:false, error:"Cada respuesta escrita debe tener entre 2 y 500 caracteres." };
    answers[key] = value;
  }
  return { ok:true, answers };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req,{error:"Método no permitido."},405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i,"").trim();
    if (!token) return reply(req,{error:"Inicia sesión para continuar."},401);

    const url = Deno.env.get("SUPABASE_URL");
    let secret = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) {
      const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
      if (secretMap) {
        try { secret = JSON.parse(secretMap).default || ""; } catch { secret = ""; }
      }
    }
    if (!url || !secret) throw new Error("Falta configuración segura de Supabase.");
    const admin = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError} = await admin.auth.getUser(token);
    if (authError || !user) return reply(req,{error:"La sesión no es válida. Vuelve a iniciar sesión."},401);

    const body = await req.json().catch(()=>null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(req,{error:"Solicitud inválida."},400);

    if (body.action === "status") {
      const [{data:submission,error:submissionError},{data:role,error:roleError}] = await Promise.all([
        admin.from("survey_submissions").select("id").eq("survey_key",SURVEY_KEY).eq("user_id",user.id).maybeSingle(),
        admin.from("user_roles").select("role").eq("user_id",user.id).maybeSingle()
      ]);
      if (submissionError) throw submissionError;
      if (roleError) throw roleError;
      return reply(req,{ok:true,submitted:!!submission,is_admin:role?.role === "admin"});
    }

    if (body.action === "submit") {
      const checked = validateAnswers(body.answers);
      if (!checked.ok) return reply(req,{error:checked.error},400);
      const {data:profile,error:profileError} = await admin.from("profiles").select("id").eq("id",user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return reply(req,{error:"Completa primero tu perfil de estudiante para participar."},403);

      const {error:insertError} = await admin.from("survey_submissions").insert({
        survey_key:SURVEY_KEY,user_id:user.id,answers:checked.answers
      });
      if (insertError?.code === "23505") return reply(req,{error:"Tu cuenta ya registró una respuesta en esta encuesta."},409);
      if (insertError) throw insertError;
      return reply(req,{ok:true,message:"Tu participación quedó registrada."},201);
    }

    if (body.action === "admin_results") {
      const {data:role,error:roleError} = await admin.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
      if (roleError) throw roleError;
      if (role?.role !== "admin") return reply(req,{error:"No tienes permisos para consultar los resultados."},403);
      const {data:rows,error:readError} = await admin.from("survey_submissions")
        .select("id,user_id,answers,submitted_at").eq("survey_key",SURVEY_KEY)
        .order("submitted_at",{ascending:false}).limit(5000);
      if (readError) throw readError;
      const ids = [...new Set((rows || []).map(row => row.user_id))];
      const {data:profiles,error:profilesError} = ids.length
        ? await admin.from("profiles").select("id,display_name,semester,public_id").in("id",ids)
        : {data:[],error:null};
      if (profilesError) throw profilesError;
      const byId = new Map((profiles || []).map(profile => [profile.id,profile]));
      const results = (rows || []).map(row => ({
        ...row,
        student: byId.get(row.user_id) || {display_name:"Perfil no disponible",semester:null,public_id:null}
      }));
      return reply(req,{ok:true,results});
    }
    return reply(req,{error:"Acción no reconocida."},400);
  } catch (error) {
    console.error("survey-submissions:",error);
    return reply(req,{error:"No pudimos procesar la solicitud. Inténtalo nuevamente."},500);
  }
});
