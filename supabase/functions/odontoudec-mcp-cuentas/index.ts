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
      const server=new McpServer({name:"OdontoUdeC Cuentas",version:"0.4.0"});

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
        const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
        const {data:{user},error}=await supabase.auth.getUser(jwt);
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


      const bearerToken=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
      const requireUser=async()=>{
        if(!bearerToken) throw new Error("Conecta tu cuenta de OdontoUdeC para continuar.");
        const {data,error}=await supabase.auth.getUser(bearerToken);
        if(error||!data.user) throw new Error("La sesión de OdontoUdeC no es válida. Vuelve a autorizar el conector.");
        return data.user;
      };
      const requireAdmin=async()=>{
        const user=await requireUser();
        const {data,error}=await supabase.rpc("is_admin");
        if(error||data!==true) throw new Error("Esta acción está reservada a administradores de OdontoUdeC.");
        return user;
      };
      const audit=async(action:string,targetType:string,targetId:string|null,metadata:Record<string,unknown>={})=>{
        const {error}=await supabase.rpc("mcp_log_action",{
          p_action:action,p_target_type:targetType,p_target_id:targetId,p_metadata:metadata
        });
        return !error;
      };
      const safeDbError=(error:any,fallback:string)=> {
        const code=String(error?.code||"");
        if(code==="42501"||code==="PGRST301") return "Tu cuenta no tiene permisos para realizar esta operación.";
        if(code==="23505") return "Ese registro ya existe.";
        if(code==="23503") return "No encontramos el contenido relacionado.";
        return fallback;
      };
      const getOwnProfile=async(userId:string)=>{
        const {data}=await supabase.from("profiles").select("display_name,username,semester,public_id").eq("id",userId).maybeSingle();
        return data??null;
      };

      server.registerTool("listar_publicaciones",{
        title:"Ver publicaciones de la comunidad",
        description:"Muestra publicaciones recientes de OdontoUdeC. Disponible para cuentas autenticadas; solo devuelve contenido público.",
        inputSchema:z.object({limite:z.number().int().min(1).max(30).default(10)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({limite})=>{
        await requireUser();
        const {data,error}=await supabase.from("posts").select("id,title,content,category,author_id,created_at").order("created_at",{ascending:false}).limit(limite);
        if(error)return result({error:"No se pudieron consultar las publicaciones."});
        const ids=[...new Set((data??[]).map((p:any)=>p.author_id))];
        const {data:profiles}=ids.length?await supabase.from("profiles").select("id,display_name").in("id",ids):{data:[]};
        const names=new Map((profiles??[]).map((p:any)=>[p.id,p.display_name]));
        return result({publicaciones:(data??[]).map((p:any)=>({id:p.id,titulo:p.title,contenido:p.content,categoria:p.category,autor:names.get(p.author_id)||"Miembro de OdontoUdeC",fecha:p.created_at,url:BASE+"/chat.html"}))});
      });

      server.registerTool("crear_publicacion",{
        title:"Crear publicación en OdontoUdeC",
        description:"Prepara o publica una publicación en la comunidad. Por seguridad, primero muestra una vista previa; solo escribe en la plataforma cuando confirmar=true.",
        inputSchema:z.object({
          titulo:z.string().min(3).max(120),
          contenido:z.string().min(1).max(5000),
          categoria:z.enum(["General","Académico","Pregunta","Anuncio","No al abuso"]).default("General"),
          confirmar:z.boolean().default(false)
        }),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({titulo,contenido,categoria,confirmar})=>{
        const user=await requireUser();
        if(!confirmar)return result({requiere_confirmacion:true,accion:"crear_publicacion",vista_previa:{titulo,contenido,categoria},mensaje:"La publicación será visible para la comunidad. Confirma expresamente para publicarla."});
        const {data,error}=await supabase.from("posts").insert({author_id:user.id,title:titulo.trim(),content:contenido.trim(),category:categoria}).select("id,title,category,created_at").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo crear la publicación.")});
        const logged=await audit("create_post","post",String(data.id),{category:categoria});
        return result({ok:true,publicacion:{id:data.id,titulo:data.title,categoria:data.category,fecha:data.created_at,url:BASE+"/chat.html"},auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("comentar_publicacion",{
        title:"Comentar una publicación",
        description:"Añade un comentario como la cuenta autenticada. Requiere confirmación explícita antes de enviarlo.",
        inputSchema:z.object({post_id:z.number().int().positive(),comentario:z.string().min(1).max(2000),confirmar:z.boolean().default(false)}),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({post_id,comentario,confirmar})=>{
        const user=await requireUser();
        if(!confirmar)return result({requiere_confirmacion:true,accion:"comentar_publicacion",post_id,comentario,mensaje:"El comentario se publicará en la comunidad. Confirma para enviarlo."});
        const {data,error}=await supabase.from("post_comments").insert({post_id,author_id:user.id,content:comentario.trim()}).select("id,post_id,content,created_at").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo publicar el comentario.")});
        const logged=await audit("comment_post","post_comment",String(data.id),{post_id});
        return result({ok:true,comentario:{id:data.id,post_id:data.post_id,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("listar_chat_general",{
        title:"Leer el chat general",
        description:"Lee los mensajes recientes del chat comunitario. Requiere una cuenta autenticada; el chat general es visible a los miembros.",
        inputSchema:z.object({limite:z.number().int().min(1).max(50).default(20)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({limite})=>{
        await requireUser();
        const {data,error}=await supabase.from("chat_messages").select("id,display_name,content,created_at").order("created_at",{ascending:false}).limit(limite);
        if(error)return result({error:"No se pudo consultar el chat general."});
        return result({mensajes:(data??[]).reverse().map((m:any)=>({id:m.id,autor:m.display_name,contenido:m.content,fecha:m.created_at})),url:BASE+"/chat.html"});
      });

      server.registerTool("enviar_mensaje_chat_general",{
        title:"Enviar mensaje al chat general",
        description:"Envía un mensaje real al chat comunitario con tu identidad de OdontoUdeC. Primero solicita confirmación; no envía nada mientras confirmar=false.",
        inputSchema:z.object({mensaje:z.string().min(1).max(2000),confirmar:z.boolean().default(false)}),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({mensaje,confirmar})=>{
        const user=await requireUser();
        if(!confirmar)return result({requiere_confirmacion:true,accion:"enviar_mensaje_chat_general",mensaje,mensaje_de_confirmacion:"Este texto se enviará al chat general y será visible para los miembros. Confirma para enviarlo."});
        const profile=await getOwnProfile(user.id);
        const {data,error}=await supabase.from("chat_messages").insert({user_id:user.id,display_name:profile?.display_name||"Estudiante",content:mensaje.trim()}).select("id,display_name,content,created_at").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo enviar el mensaje al chat general.")});
        const logged=await audit("send_public_chat","chat_message",String(data.id));
        return result({ok:true,mensaje:{id:data.id,autor:data.display_name,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("listar_grupos_estudio",{
        title:"Explorar grupos de estudio",
        description:"Lista grupos abiertos y grupos a los que pertenece tu cuenta. Las políticas de Supabase limitan los grupos privados.",
        inputSchema:z.object({limite:z.number().int().min(1).max(50).default(30)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({limite})=>{
        const user=await requireUser();
        const [{data:groups,error:groupError},{data:members,error:memberError}]=await Promise.all([
          supabase.from("study_groups").select("id,name,description,subject,semester,created_by,is_open,created_at").order("created_at",{ascending:false}).limit(limite),
          supabase.from("study_group_members").select("group_id,role").eq("user_id",user.id)
        ]);
        if(groupError||memberError)return result({error:"No se pudieron consultar los grupos autorizados."});
        const memberMap=new Map((members??[]).map((m:any)=>[m.group_id,m.role]));
        return result({grupos:(groups??[]).map((g:any)=>({id:g.id,nombre:g.name,descripcion:g.description,asignatura:g.subject,semestre:g.semester,abierto:g.is_open,miembro:memberMap.has(g.id),mi_rol:memberMap.get(g.id)||null,fecha:g.created_at,url:BASE+"/grupos-estudio.html"}))});
      });

      server.registerTool("crear_grupo_estudio",{
        title:"Crear grupo de estudio",
        description:"Crea un grupo real. Supabase registra automáticamente al creador como propietario. Primero muestra una vista previa y exige confirmar=true para crear.",
        inputSchema:z.object({
          nombre:z.string().min(3).max(80),
          descripcion:z.string().max(500).default(""),
          asignatura:z.string().max(100).optional(),
          semestre:z.number().int().min(1).max(10).optional(),
          abierto:z.boolean().default(true),
          confirmar:z.boolean().default(false)
        }),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({nombre,descripcion,asignatura,semestre,abierto,confirmar})=>{
        const user=await requireUser();
        const draft={nombre:nombre.trim(),descripcion:descripcion.trim(),asignatura:asignatura?.trim()||null,semestre:semestre??null,abierto};
        if(!confirmar)return result({requiere_confirmacion:true,accion:"crear_grupo_estudio",vista_previa:draft,mensaje:"Se creará el grupo y tu cuenta quedará como propietaria. Confirma para continuar."});
        const {data,error}=await supabase.from("study_groups").insert({
          name:draft.nombre,description:draft.descripcion,subject:draft.asignatura,semester:draft.semestre,
          is_open:draft.abierto,created_by:user.id
        }).select("id,name,description,subject,semester,is_open,created_at").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo crear el grupo.")});
        const logged=await audit("create_group","study_group",data.id,{semester:draft.semestre,subject:draft.asignatura});
        return result({ok:true,grupo:{id:data.id,nombre:data.name,descripcion:data.description,asignatura:data.subject,semestre:data.semester,abierto:data.is_open,fecha:data.created_at,url:BASE+"/grupos-estudio.html"},propietario:true,auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("unirse_grupo_estudio",{
        title:"Unirse a un grupo de estudio",
        description:"Añade tu cuenta a un grupo abierto. Los grupos cerrados o privados no admiten unirse mediante esta herramienta.",
        inputSchema:z.object({group_id:z.string().uuid(),confirmar:z.boolean().default(false)}),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({group_id,confirmar})=>{
        const user=await requireUser();
        if(!confirmar)return result({requiere_confirmacion:true,accion:"unirse_grupo_estudio",group_id,mensaje:"Tu cuenta se unirá al grupo y podrá acceder a sus mensajes. Confirma para continuar."});
        const {error}=await supabase.from("study_group_members").insert({group_id,user_id:user.id});
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo unir al grupo. Comprueba si está abierto o si ya eres miembro.")});
        const logged=await audit("join_group","study_group",group_id);
        return result({ok:true,group_id,unido:true,url:BASE+"/grupos-estudio.html",auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("listar_mensajes_grupo",{
        title:"Leer mensajes de un grupo",
        description:"Lee mensajes de un grupo del que tu cuenta sea miembro. RLS bloquea cualquier grupo ajeno.",
        inputSchema:z.object({group_id:z.string().uuid(),limite:z.number().int().min(1).max(100).default(40)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({group_id,limite})=>{
        await requireUser();
        const {data,error}=await supabase.from("study_group_messages").select("id,sender_id,content,created_at").eq("group_id",group_id).order("created_at",{ascending:false}).limit(limite);
        if(error)return result({error:safeDbError(error,"No se pudieron leer los mensajes. Puede que no pertenezcas a este grupo.")});
        const ids=[...new Set((data??[]).map((m:any)=>m.sender_id))];
        const {data:profiles}=ids.length?await supabase.from("profiles").select("id,display_name").in("id",ids):{data:[]};
        const names=new Map((profiles??[]).map((p:any)=>[p.id,p.display_name]));
        return result({group_id,mensajes:(data??[]).reverse().map((m:any)=>({id:m.id,autor:names.get(m.sender_id)||"Miembro",contenido:m.content,fecha:m.created_at})),url:BASE+"/grupos-estudio.html"});
      });

      server.registerTool("enviar_mensaje_grupo",{
        title:"Enviar mensaje a un grupo",
        description:"Envía un mensaje real al grupo indicado. Solo los miembros pueden escribir. Primero muestra una vista previa y exige confirmar=true.",
        inputSchema:z.object({group_id:z.string().uuid(),mensaje:z.string().min(1).max(2000),confirmar:z.boolean().default(false)}),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({group_id,mensaje,confirmar})=>{
        const user=await requireUser();
        if(!confirmar)return result({requiere_confirmacion:true,accion:"enviar_mensaje_grupo",group_id,mensaje,mensaje_de_confirmacion:"El mensaje será visible para los miembros del grupo. Confirma para enviarlo."});
        const {data,error}=await supabase.from("study_group_messages").insert({group_id,sender_id:user.id,content:mensaje.trim()}).select("id,group_id,content,created_at").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo enviar el mensaje. Comprueba que pertenezcas al grupo.")});
        const logged=await audit("send_group_message","group_message",data.id,{group_id});
        return result({ok:true,mensaje:{id:data.id,group_id:data.group_id,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("listar_conversaciones_privadas",{
        title:"Ver tus conversaciones privadas",
        description:"Muestra únicamente conversaciones en las que tu cuenta es participante. No revela correos ni conversaciones de terceros.",
        inputSchema:z.object({limite:z.number().int().min(1).max(40).default(20)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({limite})=>{
        const user=await requireUser();
        const {data,error}=await supabase.from("private_conversations").select("id,user_one,user_two,last_message_at").or("user_one.eq."+user.id+",user_two.eq."+user.id).order("last_message_at",{ascending:false}).limit(limite);
        if(error)return result({error:"No se pudieron consultar tus conversaciones."});
        const others=[...new Set((data??[]).map((c:any)=>c.user_one===user.id?c.user_two:c.user_one))];
        const {data:profiles}=others.length?await supabase.from("profiles").select("id,display_name,public_id,semester").in("id",others):{data:[]};
        const map=new Map((profiles??[]).map((p:any)=>[p.id,p]));
        return result({conversaciones:(data??[]).map((c:any)=>{
          const otherId=c.user_one===user.id?c.user_two:c.user_one,person=map.get(otherId) as any;
          return {conversation_id:c.id,participante:person?.display_name||"Compañero",id_publico:person?.public_id||null,semestre:person?.semester??null,ultimo_mensaje:c.last_message_at};
        }),url:BASE+"/mensajes.html"});
      });

      server.registerTool("iniciar_conversacion_privada",{
        title:"Iniciar una conversación privada",
        description:"Inicia una conversación con un perfil público de OdontoUdeC identificado por su ID público. Primero muestra la persona y exige confirmación.",
        inputSchema:z.object({id_publico:z.string().min(4).max(40),confirmar:z.boolean().default(false)}),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({id_publico,confirmar})=>{
        const user=await requireUser();
        const {data:person,error:personError}=await supabase.from("profiles").select("id,display_name,public_id,semester").eq("public_id",id_publico.trim()).eq("profile_visibility","public").maybeSingle();
        if(personError||!person||person.id===user.id)return result({error:"No encontramos un perfil público válido con ese ID."});
        if(!confirmar)return result({requiere_confirmacion:true,accion:"iniciar_conversacion_privada",destinatario:{nombre:person.display_name,id_publico:person.public_id,semestre:person.semester},mensaje:"Se abrirá una conversación privada con esta persona. Confirma para continuar."});
        const [one,two]=[user.id,person.id].sort();
        let {data:conversation,error}=await supabase.from("private_conversations").select("id").eq("user_one",one).eq("user_two",two).maybeSingle();
        if(!conversation){
          const created=await supabase.from("private_conversations").insert({user_one:one,user_two:two}).select("id").single();
          conversation=created.data;
          if(created.error&&!conversation){
            const retry=await supabase.from("private_conversations").select("id").eq("user_one",one).eq("user_two",two).maybeSingle();
            conversation=retry.data;
          }
        }
        if(!conversation)return result({error:safeDbError(error,"No se pudo iniciar la conversación.")});
        const logged=await audit("start_private_conversation","private_conversation",conversation.id);
        return result({ok:true,conversation_id:conversation.id,destinatario:person.display_name,url:BASE+"/mensajes.html"});
      });

      server.registerTool("leer_mensajes_privados",{
        title:"Leer una conversación privada",
        description:"Devuelve mensajes solo si la cuenta conectada participa en la conversación. RLS valida cada fila.",
        inputSchema:z.object({conversation_id:z.string().uuid(),limite:z.number().int().min(1).max(100).default(50)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({conversation_id,limite})=>{
        const user=await requireUser();
        const {data,error}=await supabase.from("private_messages").select("id,sender_id,content,created_at").eq("conversation_id",conversation_id).order("created_at",{ascending:false}).limit(limite);
        if(error)return result({error:safeDbError(error,"No se pudo leer la conversación privada.")});
        const ids=[...new Set((data??[]).map((m:any)=>m.sender_id))];
        const {data:profiles}=ids.length?await supabase.from("profiles").select("id,display_name").in("id",ids):{data:[]};
        const names=new Map((profiles??[]).map((p:any)=>[p.id,p.display_name]));
        return result({conversation_id,mensajes:(data??[]).reverse().map((m:any)=>({id:m.id,autor:names.get(m.sender_id)||"Participante",propio:m.sender_id===user.id,contenido:m.content,fecha:m.created_at})),url:BASE+"/mensajes.html"});
      });

      server.registerTool("enviar_mensaje_privado",{
        title:"Enviar mensaje privado",
        description:"Envía un mensaje real a una conversación en la que participas. Primero muestra una vista previa y exige confirmar=true.",
        inputSchema:z.object({conversation_id:z.string().uuid(),mensaje:z.string().min(1).max(2000),confirmar:z.boolean().default(false)}),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({conversation_id,mensaje,confirmar})=>{
        const user=await requireUser();
        if(!confirmar)return result({requiere_confirmacion:true,accion:"enviar_mensaje_privado",conversation_id,mensaje,mensaje_de_confirmacion:"El mensaje se enviará únicamente a los participantes de esta conversación. Confirma para enviarlo."});
        const {data,error}=await supabase.from("private_messages").insert({conversation_id,sender_id:user.id,content:mensaje.trim()}).select("id,conversation_id,content,created_at").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo enviar el mensaje privado. Comprueba que participes en la conversación.")});
        const logged=await audit("send_private_message","private_message",data.id,{conversation_id});
        return result({ok:true,mensaje:{id:data.id,conversation_id:data.conversation_id,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible"});
      });

      server.registerTool("listar_recursos_biblioteca",{
        title:"Consultar recursos de la Biblioteca",
        description:"Busca recursos académicos públicos de OdontoUdeC por materia o semestre.",
        inputSchema:z.object({asignatura:z.string().max(100).optional(),semestre:z.number().int().min(1).max(10).optional(),limite:z.number().int().min(1).max(50).default(25)}),
        annotations:{readOnlyHint:true,openWorldHint:false}
      },async({asignatura,semestre,limite})=>{
        await requireUser();
        let query=supabase.from("academic_resources").select("id,title,subject,description,url,resource_type,semester,created_at").order("created_at",{ascending:false}).limit(limite);
        if(asignatura)query=query.ilike("subject","%"+asignatura.trim()+"%");
        if(semestre)query=query.eq("semester",semestre);
        const {data,error}=await query;
        if(error)return result({error:"No se pudieron consultar los recursos académicos."});
        return result({recursos:(data??[]).map((r:any)=>({id:r.id,titulo:r.title,asignatura:r.subject,descripcion:r.description,enlace:r.url,tipo:r.resource_type,semestre:r.semester,fecha:r.created_at})),url:BASE+"/academia.html"});
      });

      server.registerTool("agregar_recurso_biblioteca",{
        title:"Añadir enlace a la Biblioteca",
        description:"Añade un enlace HTTPS a los recursos académicos de OdontoUdeC. La ficha será visible en la Biblioteca. Requiere confirmar=true para guardar.",
        inputSchema:z.object({
          titulo:z.string().min(3).max(150),enlace:z.string().url().max(1000),
          asignatura:z.string().max(100).optional(),descripcion:z.string().max(1200).optional(),
          tipo:z.enum(["Apuntes","Guía","Video","Artículo","Libro","Otro"]).default("Otro"),
          semestre:z.number().int().min(1).max(10).optional(),confirmar:z.boolean().default(false)
        }),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:true}
      },async({titulo,enlace,asignatura,descripcion,tipo,semestre,confirmar})=>{
        const user=await requireUser();
        let parsed:URL;try{parsed=new URL(enlace);}catch{return result({error:"El enlace no es válido."});}
        if(parsed.protocol!=="https:")return result({error:"Por seguridad, la Biblioteca solo admite enlaces HTTPS."});
        const draft={titulo:titulo.trim(),enlace:parsed.toString(),asignatura:asignatura?.trim()||null,descripcion:descripcion?.trim()||null,tipo,semestre:semestre??null};
        if(!confirmar)return result({requiere_confirmacion:true,accion:"agregar_recurso_biblioteca",vista_previa:draft,mensaje:"El enlace se añadirá a la Biblioteca y será visible para la comunidad. Confirma para guardar."});
        const {data,error}=await supabase.from("academic_resources").insert({
          title:draft.titulo,subject:draft.asignatura,description:draft.descripcion,url:draft.enlace,
          resource_type:draft.tipo,semester:draft.semestre,created_by:user.id
        }).select("id,title,url,subject,semester,resource_type").single();
        if(error)return result({ok:false,error:safeDbError(error,"No se pudo añadir el recurso.")});
        const logged=await audit("add_library_link","academic_resource",String(data.id),{semester:draft.semestre,resource_type:draft.tipo});
        return result({ok:true,recurso:{id:data.id,titulo:data.title,enlace:data.url,asignatura:data.subject,semestre:data.semester,tipo:data.resource_type},auditoria:logged?"registrada":"no disponible"});
      });

      const fileSpecs:Record<string,{extensions:string[];signature:(b:Uint8Array)=>boolean}>={
        "application/pdf":{extensions:["pdf"],signature:b=>b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46},
        "image/png":{extensions:["png"],signature:b=>b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47},
        "image/jpeg":{extensions:["jpg","jpeg"],signature:b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff},
        "image/webp":{extensions:["webp"],signature:b=>String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"},
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":{extensions:["docx"],signature:b=>b[0]===0x50&&b[1]===0x4b&&b[2]===0x03&&b[3]===0x04},
        "application/vnd.openxmlformats-officedocument.presentationml.presentation":{extensions:["pptx"],signature:b=>b[0]===0x50&&b[1]===0x4b&&b[2]===0x03&&b[3]===0x04},
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":{extensions:["xlsx"],signature:b=>b[0]===0x50&&b[1]===0x4b&&b[2]===0x03&&b[3]===0x04}
      };
      const slugify=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"general";

      server.registerTool("preparar_subida_archivo_biblioteca",{
        title:"Preparar subida de archivo a la Biblioteca",
        description:"Genera un enlace temporal de carga para que el administrador seleccione el archivo en una página segura de OdontoUdeC. Admite PDF, DOCX, PPTX, XLSX, JPEG, PNG y WebP hasta 15 MB. No publica todavía el recurso; luego se confirma desde ChatGPT.",
        inputSchema:z.object({
          titulo:z.string().min(3).max(150),nombre_archivo:z.string().min(1).max(180),
          mime_type:z.enum([
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/jpeg","image/png","image/webp"
          ]),
          tamano_bytes:z.number().int().min(1).max(15728640),
          asignatura:z.string().max(100).optional(),descripcion:z.string().max(1200).optional(),
          semestre:z.number().int().min(1).max(10).optional(),
          tipo:z.enum(["Apuntes","Guía","Video","Artículo","Libro","Otro"]).default("Apuntes")
        }),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({titulo,nombre_archivo,mime_type,tamano_bytes,asignatura,descripcion,semestre,tipo})=>{
        await requireAdmin();
        const ext=(nombre_archivo.split(".").pop()||"").toLowerCase(),spec=fileSpecs[mime_type];
        if(!spec||!spec.extensions.includes(ext))return result({error:"La extensión del archivo no coincide con el tipo MIME seleccionado."});
        const path=(semestre?"semestre-"+semestre:"general")+"/"+slugify(asignatura||"general")+"/"+crypto.randomUUID()+"."+ext;
        const {data,error}=await supabase.storage.from("academic-library").createSignedUploadUrl(path,{upsert:false});
        if(error||!data?.token)return result({error:"No se pudo preparar la carga temporal. Inténtalo nuevamente."});
        const fragment=new URLSearchParams({path,token:data.token}).toString();
        const uploadPage=BASE+"/biblioteca-upload.html#"+fragment;
        return result({
          preparado:true,archivo:{titulo,nombre:nombre_archivo,tamano_bytes,tipo:mime_type,asignatura:asignatura||null,semestre:semestre??null,categoria:tipo},
          ruta:path,enlace_de_carga:uploadPage,expira_en_minutos:120,
          siguiente_paso:"Abre el enlace, selecciona y sube el archivo. Cuando la página confirme que terminó, vuelve a ChatGPT y ejecuta confirmar_subida_archivo_biblioteca con la ruta y los datos del recurso.",
          visibilidad:"El archivo se almacena en el bucket público, pero no aparecerá en la Biblioteca hasta confirmar el registro."
        });
      });

      server.registerTool("confirmar_subida_archivo_biblioteca",{
        title:"Confirmar y publicar archivo en la Biblioteca",
        description:"Verifica que el archivo exista, comprueba tamaño y firma del contenido y registra el recurso en la Biblioteca pública. Solo administradores. Requiere confirmar=true para publicar.",
        inputSchema:z.object({
          ruta:z.string().min(10).max(300),
          titulo:z.string().min(3).max(150),asignatura:z.string().max(100).optional(),
          descripcion:z.string().max(1200).optional(),semestre:z.number().int().min(1).max(10).optional(),
          tipo:z.enum(["Apuntes","Guía","Video","Artículo","Libro","Otro"]).default("Apuntes"),
          confirmar:z.boolean().default(false)
        }),
        annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}
      },async({ruta,titulo,asignatura,descripcion,semestre,tipo,confirmar})=>{
        await requireAdmin();
        const pathPattern=/^(?:general|semestre-(?:[1-9]|10))\/[a-z0-9-]{1,50}\/[0-9a-f-]{36}\.(?:pdf|docx|pptx|xlsx|jpg|jpeg|png|webp)$/i;
        if(!pathPattern.test(ruta))return result({error:"La ruta de carga no tiene un formato válido."});
        const {data:publicData}=supabase.storage.from("academic-library").getPublicUrl(ruta);
        let fileResponse:Response;
        try{fileResponse=await fetch(publicData.publicUrl,{signal:AbortSignal.timeout(15000)});}
        catch{return result({error:"No pudimos comprobar el archivo subido. Inténtalo nuevamente."});}
        if(!fileResponse.ok)return result({error:"No encontramos el archivo subido. Revisa si completó la carga o si el enlace temporal expiró."});
        const declaredSize=Number(fileResponse.headers.get("content-length")||0);
        if(declaredSize>15728640)return result({error:"El archivo debe pesar como máximo 15 MB."});
        const bytes=new Uint8Array(await fileResponse.arrayBuffer());
        if(bytes.length<8||bytes.length>15728640)return result({error:"El archivo debe pesar como máximo 15 MB."});
        const ext=ruta.split(".").pop()!.toLowerCase(),mimeByExt:Record<string,string>={
          pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
          xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"
        };
        const mime=mimeByExt[ext],spec=fileSpecs[mime];
        if(!spec||!spec.signature(bytes))return result({error:"El contenido del archivo no coincide con su extensión. No se publicará."});
        const {data:existing}=await supabase.from("academic_resources").select("id,title,url").eq("url",publicData.publicUrl).maybeSingle();
        if(existing)return result({ok:true,ya_registrado:true,recurso:{id:existing.id,titulo:existing.title,enlace:existing.url}});
        const draft={titulo:titulo.trim(),ruta,asignatura:asignatura?.trim()||null,descripcion:descripcion?.trim()||null,semestre:semestre??null,tipo,tamano_bytes:file.size,mime,visibilidad:"Público"};
        if(!confirmar)return result({requiere_confirmacion:true,accion:"confirmar_subida_archivo_biblioteca",vista_previa:draft,mensaje:"El archivo se añadirá a la Biblioteca y será accesible públicamente. Confirma para publicarlo."});
        const user=await requireUser();
        const {data:resource,error}=await supabase.from("academic_resources").insert({
          title:draft.titulo,subject:draft.asignatura,description:draft.descripcion,url:publicData.publicUrl,
          resource_type:tipo,semester:draft.semestre,created_by:user.id
        }).select("id,title,url,subject,semester,resource_type").single();
        if(error)return result({ok:false,error:safeDbError(error,"El archivo está subido, pero no se pudo registrar en la Biblioteca.")});
        const logged=await audit("upload_library_file","academic_resource",String(resource.id),{semester:draft.semestre,resource_type:tipo,mime_type:mime,size_bytes:file.size});
        return result({ok:true,recurso:{id:resource.id,titulo:resource.title,enlace:resource.url,asignatura:resource.subject,semestre:resource.semester,tipo:resource.resource_type,tamano_bytes:file.size},auditoria:logged?"registrada":"no disponible",visibilidad:"público"});
      });

      return server;
    });
    return handler.fetch(req);
  }
));
