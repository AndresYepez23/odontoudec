import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1";
import { z } from "npm:zod@4.3.6";

// Requiere OAuth de Supabase Auth, sesión verificada y RLS.
// El plugin público anterior permanece intacto.
// Las autorizaciones NUNCA se basan en la descripción del usuario dada a la IA.
const BASE = "https://odontoudec.online";
const ROUTES: Record<string,string> = {
  inicio:"/", academia:"/academia.html", trivia:"/academia.html#trivia",
  odontobot:"/academia.html#odonto-bot",
  banco:"/banco-pacientes.html", chat:"/chat.html", grupos:"/grupos-estudio.html",
  literatura:"/literatura-cientifica.html", encuestas:"/encuesta-estudiantil.html",
  espacio:"/mi-espacio.html", admin:"/#adminPanel"
};
const USER_PAGES = ["inicio","academia","trivia","odontobot","banco","chat","grupos","literatura","encuestas","espacio"] as const;
function result(data: Record<string,unknown>) {
  return { content:[{type:"text" as const,text:JSON.stringify(data)}], structuredContent:data };
}
Deno.serve(pipeline(
  [withOAuthProtectedResource(),withSupabase({auth:"user"})],
  async (req,{supabase})=>{
    const handler=createMcpHandler(()=>{
      const server=new McpServer({name:"OdontoUdeC Cuentas",version:"0.2.0"});

      const checkAdmin=async()=>{
        const {data,error}=await supabase.rpc("is_admin");
        if(error) throw new Error("No se pudieron verificar los permisos administrativos.");
        return data===true;
      };

      server.registerTool("mi_cuenta_odontoudec",{
        title:"Mi cuenta en OdontoUdeC",
        description:"Verifica la cuenta autenticada con OAuth de OdontoUdeC y su rol real de administrador. Nunca revela contraseñas ni datos de otros usuarios.",
        inputSchema:z.object({}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async()=>{
        const {data:{user},error}=await supabase.auth.getUser();
        if(error||!user) return result({error:"Debes conectar tu cuenta de OdontoUdeC mediante OAuth."});
        const [{data:profile},{data:admin,error:roleError}]=await Promise.all([
          supabase.from("profiles").select("display_name,username,semester,public_id,profile_visibility").eq("id",user.id).maybeSingle(),
          supabase.rpc("is_admin")
        ]);
        if(roleError) return result({error:"No se pudo verificar el rol de la cuenta."});
        return result({
          autenticado:true,rol:admin===true?"administrador":"estudiante",
          perfil:profile??null,permiso_administrativo:admin===true,
          alcance:"Tu cuenta solamente. Los permisos se comprueban en Supabase en cada operación."
        });
      });

      server.registerTool("navegar_odontoudec",{
        title:"Navegar secciones autorizadas de OdontoUdeC",
        description:"Localiza una sección de la interfaz para abrirla. La herramienta devuelve el enlace directo y verifica el permiso para el panel de administración; NO controla visualmente una pestaña ni hace clic en ella.",
        inputSchema:z.object({seccion:z.enum(["inicio","academia","trivia","odontobot","banco","chat","grupos","literatura","encuestas","espacio","admin"])}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({seccion})=>{
        if(seccion==="admin" && !(await checkAdmin()))
          return result({autorizado:false,error:"La cuenta conectada no tiene rol administrador."});
        return result({
          seccion,url:BASE+ROUTES[seccion],autorizado:true,
          descripcion:"Enlace a la sección real de OdontoUdeC. La navegación visual debe abrirse en el navegador.",
          permisos:seccion==="admin"?"Solo administradores":"Según sesión y políticas de OdontoUdeC"
        });
      });

      server.registerTool("resumen_administrativo_odontoudec",{
        title:"Resumen del panel administrador",
        description:"Solo para administradores autenticados: devuelve contadores agregados reales de perfiles, publicaciones, grupos, encuestas y reportes. No entrega datos de pacientes ni mensajes.",
        inputSchema:z.object({}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async()=>{
        if(!(await checkAdmin()))return result({autorizado:false,error:"No tienes permisos de administrador."});
        const {data,error}=await supabase.rpc("odontoudec_mcp_admin_resumen");
        if(error)return result({error:"No se pudo consultar el resumen administrativo."});
        return result({autorizado:true,metricas:data,fuente:"Supabase con rol validado"});
      });

      server.registerTool("trafico_administrativo_odontoudec",{
        title:"Tráfico web de OdontoUdeC (PostHog)",
        description:"Solo para administradores: consulta las estadísticas de tráfico que ya ofrece el panel de OdontoUdeC (PostHog), para 7 o 30 días. No entrega identificadores personales.",
        inputSchema:z.object({dias:z.union([z.literal(7),z.literal(30)]).default(7)}),
        annotations:{readOnlyHint:true,openWorldHint:true}
      },async({dias})=>{
        if(!(await checkAdmin()))return result({autorizado:false,error:"No tienes permisos de administrador."});
        const token=req.headers.get("Authorization");
        if(!token?.startsWith("Bearer "))return result({error:"No hay token OAuth válido."});
        try{
          const r=await fetch(BASE+"/.netlify/functions/posthog-analytics?range="+dias,{
            method:"GET",
            headers:{Authorization:token,Accept:"application/json"},
            signal:AbortSignal.timeout(12000)
          });
          if(!r.ok)return result({error:"No se pudieron leer los datos de tráfico.",codigo:r.status});
          const body=await r.json();
          return result({
            dias,metricas:body.metrics??{},
            visitas_por_dia:Array.isArray(body.daily)?body.daily.slice(0,30):[],
            paginas_populares:Array.isArray(body.topPages)?body.topPages.slice(0,10):[],
            fuente:"Panel PostHog de OdontoUdeC"
          });
        }catch{return result({error:"No fue posible comunicarse con el servicio de analítica."});}
      });

      return server;
    });
    return handler.fetch(req);
  }
));
