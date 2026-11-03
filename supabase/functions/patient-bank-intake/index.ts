import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"https://odontoudec.online","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
async function hashIp(ip:string){const bytes=new TextEncoder().encode(ip);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return reply({error:"Método no permitido."},405);
 try{
  const body=await req.json();
  const name=clean(body.name,100),phone=clean(body.phone,30),summary=clean(body.summary,500),area=clean(body.area,80),availability=clean(body.availability,100);
  const source=body.source==="student"?"student":"patient";
  if(body.consent!==true)return reply({error:"Necesitamos tu autorización para gestionar la solicitud."},400);
  if(name.length<2||phone.replace(/\D/g,"").length<7||summary.length<10)return reply({error:"Revisa el nombre, teléfono y descripción antes de enviar."},400);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  let studentId:string|null=null;
  if(source==="student"){
   const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
   if(!token)return reply({error:"Inicia sesión para compartir un paciente."},401);
   const {data:{user},error}=await admin.auth.getUser(token);
   if(error||!user)return reply({error:"Tu sesión no es válida."},401);
   studentId=user.id;
  }
  const forwarded=req.headers.get("x-forwarded-for")||"unknown";
  const ip=forwarded.split(",")[0].trim();
  const {data,error}=await admin.rpc("patient_bank_submit",{p_ip_hash:await hashIp(ip),p_name:name,p_phone:phone,p_summary:summary,p_area:area||null,p_availability:availability||null,p_source:source,p_student_id:studentId});
  if(error)throw error;
  return reply({ok:true,case_id:data});
 }catch(error){
  const message=error instanceof Error?error.message:"No se pudo procesar la solicitud.";
  return reply({error:message.includes("varias solicitudes")?message:"No pudimos registrar la solicitud. Revisa los datos e inténtalo nuevamente."},400);
 }
});