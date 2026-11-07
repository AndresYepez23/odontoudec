import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.0.0";
import { z } from "npm:zod@4.3.6";

// Solo datos PUBLICOS. No publicar usuarios, pacientes, mensajes o secretos.
const BASE = "https://odontoudec.online";
const MODULES = [
  { id:"inicio",name:"Inicio",description:"Portada de la comunidad odontológica",path:"/" },
  { id:"trivia",name:"OdontoTrivia",description:"Preguntas y juegos de odontología",path:"/academia.html#trivia" },
  { id:"odontobot",name:"OdontoBot",description:"Asistente odontológico de OdontoUdeC",path:"/academia.html#odonto-bot" },
  { id:"banco",name:"Banco de Pacientes",description:"Solicitudes de atención voluntarias y oportunidades clínicas con acceso restringido",path:"/banco-pacientes.html" },
  { id:"biblioteca",name:"Literatura científica",description:"Recursos y literatura odontológica",path:"/literatura-cientifica.html" },
  { id:"chat",name:"Chat estudiantil",description:"Conversaciones privadas de la comunidad",path:"/chat.html" },
  { id:"grupos",name:"Grupos de estudio",description:"Grupos y colaboración estudiantil",path:"/grupos-estudio.html" },
  { id:"espacio",name:"Mi Espacio",description:"Área académica personalizada con inicio de sesión",path:"/mi-espacio.html" },
  { id:"encuestas",name:"Encuestas",description:"Encuestas estudiantiles",path:"/encuesta-estudiantil.html" }
] as const;
const PAGES: Record<string,string> = { inicio:"/", academia:"/academia.html", banco:"/banco-pacientes.html", chat:"/chat.html", literatura:"/literatura-cientifica.html", encuesta:"/encuesta-estudiantil.html" };
function response(data: Record<string,unknown>) { return { content:[{type:"text" as const,text:JSON.stringify(data)}],structuredContent:data }; }

const handler = createMcpHandler(() => {
  const server = new McpServer({name:"OdontoUdeC",version:"0.1.0"});

  server.registerTool("explorar_odontoudec",{
    title:"Explorar OdontoUdeC",
    description:"Devuelve enlaces reales a los módulos de OdontoUdeC. Solo información pública, sin datos personales.",
    inputSchema:z.object({consulta:z.string().max(80).optional()}),
    annotations:{readOnlyHint:true,openWorldHint:false}
  },({consulta})=>{
    const q=(consulta??"").trim().toLocaleLowerCase("es");
    const found=MODULES.filter(m=>!q||[m.id,m.name,m.description].some(s=>s.toLocaleLowerCase("es").includes(q)));
    return response({sitio:BASE,total:found.length,modulos:found.map(m=>({nombre:m.name,descripcion:m.description,url:BASE+m.path})),nota:"Las secciones privadas requieren iniciar sesión en OdontoUdeC."});
  });

  server.registerTool("estado_publico_odontoudec",{
    title:"Consultar estado público de OdontoUdeC",
    description:"Consulta en vivo materias y número de preguntas activas de OdontoTrivia. No consulta perfiles, pacientes ni tráfico privado.",
    inputSchema:z.object({}),
    annotations:{readOnlyHint:true,openWorldHint:false}
  },async()=>{
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
    if(!url||!key) return response({error:"Falta configuración pública de Supabase."});
    try {
      const r=await fetch(url+"/rest/v1/rpc/odontoudec_mcp_public_summary",{
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":key,"Authorization":"Bearer "+key},
        body:"{}",
        signal:AbortSignal.timeout(8000)
      });
      if(!r.ok) return response({error:"Consulta pública temporalmente indisponible.",http_status:r.status});
      return response({datos:await r.json(),alcance:"Solo información pública de OdontoTrivia."});
    }catch{return response({error:"No se pudo contactar con Supabase."});}
  });

  server.registerTool("comprobar_pagina_odontoudec",{
    title:"Comprobar disponibilidad de una página",
    description:"Comprueba la respuesta HTTP de una página conocida de odontoudec.online, sin acceder a datos privados.",
    inputSchema:z.object({pagina:z.enum(["inicio","academia","banco","chat","literatura","encuesta"])}),
    annotations:{readOnlyHint:true,openWorldHint:true}
  },async({pagina})=>{
    const url=BASE+PAGES[pagina];
    try {
      const r=await fetch(url,{method:"HEAD",redirect:"follow",signal:AbortSignal.timeout(7000)});
      return response({pagina,url,http_status:r.status,disponible:r.ok,nota:"Solo comprueba disponibilidad HTTP de la página pública."});
    }catch{return response({pagina,url,disponible:false,error:"La página no respondió."});}
  });
  return server;
});

Deno.serve((request:Request)=>{
  if(request.method==="GET" && new URL(request.url).pathname.endsWith("/health")){
    return new Response(JSON.stringify({ok:true,service:"OdontoUdeC MCP",version:"0.1.0",acceso:"publico_solo_lectura"}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  }
  return handler.fetch(request);
});
