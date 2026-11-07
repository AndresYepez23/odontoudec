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
    const {data:adminRoleFlag,error:adminRoleError}=await supabase.rpc("is_admin");
    const isAdminForRequest=!adminRoleError && adminRoleFlag===true;
    const handler=createMcpHandler(()=>{
      const server=new McpServer(
        {name:"OdontoUdeC Cuentas",version:"0.5.0"},
        {instructions:`Eres el asistente oficial de OdontoUdeC. Habla en español claro, profesional, cercano y como un servicio institucional ya establecido; no describas el producto como un desarrollo personal ni menciones ramas, despliegues o conversaciones de implementación.
Antes de responder a una solicitud personalizada por permisos, consulta mi_cuenta_odontoudec y utiliza el rol verificado por Supabase. Las herramientas administrativas solo se registran para cuentas con rol administrador; si la cuenta es estudiante, presenta únicamente las funciones estudiantiles y no menciones opciones internas del panel administrativo salvo que el usuario pregunte explícitamente por ellas.
Para búsquedas científicas, utiliza buscar_literatura_cientifica y, cuando se proporcione DOI o PMID, consultar_articulo_cientifico. Distingue metadatos, resumen y texto completo; no afirmes haber leído el texto completo si solo recibiste el resumen. Identifica la fuente, DOI/PMID y disponibilidad de acceso abierto.
Las acciones que escriben o publican deben mostrar una vista previa y esperar aprobación explícita antes de confirmar. Respeta siempre los permisos de Supabase y no reveles respuestas individuales de encuestas cuando la herramienta entregue únicamente resultados agregados.`}
      );

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
        inputSchema:z.object({seccion:isAdminForRequest?z.enum([...USER_PAGES,"admin"] as const):z.enum(USER_PAGES)}),
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

      if(isAdminForRequest){
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


      }

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
      const notifyPush=async(eventType:string,recordId:string|number)=>{
        try{
          const {data,error}=await supabase.functions.invoke("onesignal-push",{body:{event_type:eventType,record_id:String(recordId)},headers:{Authorization:"Bearer "+bearerToken}});
          if(error||data?.error)return {sent:false};
          return {sent:data?.sent===true,recipients:Number(data?.recipients||0)};
        }catch{return {sent:false};}
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


      const literatureClean=(value:unknown)=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();
      const literatureFetch=async(url:string,source:string)=>{
        const response=await fetch(url,{headers:{Accept:"application/json","User-Agent":"OdontoUdeC/0.5 (https://odontoudec.online)"},signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error(source+" respondió HTTP "+response.status);
        return await response.json();
      };
      const literatureFromDate=(years:number)=>{
        const date=new Date();date.setFullYear(date.getFullYear()-years);
        return date.toISOString().slice(0,10);
      };
      const literatureToday=()=>new Date().toISOString().slice(0,10);
      const literatureTypeTerms:Record<string,string>={
        revision_sistematica:'"systematic review"[Publication Type]',
        metaanalisis:'"meta-analysis"[Publication Type]',
        ensayo_controlado_aleatorizado:'"randomized controlled trial"[Publication Type]',
        ensayo_clinico:'"clinical trial"[Publication Type]',
        revision:'"review"[Publication Type]',
        reporte_caso:'"case reports"[Publication Type]',
        guia_clinica:'"practice guideline"[Publication Type]'
      };
      const literatureSources=["pubmed","europepmc","openalex","crossref"] as const;
      type LiteratureSource=typeof literatureSources[number];
      type LiteratureArticle={titulo:string;autores:string;revista:string;anio:string|number;resumen:string;doi:string;pmid:string;pmcid:string;fuente:string;fuentes:string[];url_ficha:string;url_texto_completo:string;acceso_abierto:boolean;tipo_publicacion:string};
      const literatureSearchProvider=async(source:LiteratureSource,query:string,years:number,sort:string,type:string,limit:number):Promise<{source:string,total:number,articles:LiteratureArticle[]}>=>{
        const today=literatureToday(),from=years?literatureFromDate(years):"";
        if(source==="pubmed"){
          let term=query;
          if(type&&literatureTypeTerms[type])term="("+term+") AND "+literatureTypeTerms[type];
          const params=new URLSearchParams({db:"pubmed",term,retmode:"json",retmax:String(limit),sort:sort==="recientes"?"pub_date":"relevance",tool:"OdontoUdeC"});
          if(years){const fromDate=new Date();fromDate.setFullYear(fromDate.getFullYear()-years);const fmt=(d:Date)=>d.getFullYear()+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+String(d.getDate()).padStart(2,"0");params.set("datetype","pdat");params.set("mindate",fmt(fromDate));params.set("maxdate",fmt(new Date()));}
          const search=await literatureFetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?"+params.toString(),"PubMed");
          const ids=Array.isArray(search?.esearchresult?.idlist)?search.esearchresult.idlist.map(String):[];
          const total=Number(search?.esearchresult?.count||0);
          if(!ids.length)return {source:"PubMed",total,articles:[]};
          const summaryParams=new URLSearchParams({db:"pubmed",id:ids.join(","),retmode:"json",tool:"OdontoUdeC"});
          const summary=await literatureFetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?"+summaryParams.toString(),"PubMed");
          const uids=Array.isArray(summary?.result?.uids)?summary.result.uids:ids;
          const articles:LiteratureArticle[]=uids.map((id:string)=>{
            const item=summary?.result?.[id]||{},articleIds=Array.isArray(item.articleids)?item.articleids:[];
            const doi=String(articleIds.find((x:any)=>x.idtype==="doi")?.value||"");
            const pmcid=String(articleIds.find((x:any)=>x.idtype==="pmc")?.value||"");
            const year=String(item.pubdate||"").match(/\b(?:19|20)\d{2}\b/)?.[0]||"";
            const authors=Array.isArray(item.authors)?item.authors.map((x:any)=>x.name).filter(Boolean).slice(0,5).join(", "):"";
            return {titulo:literatureClean(item.title)||"Título no disponible",autores:authors||"Autores no especificados",revista:literatureClean(item.fulljournalname||item.source)||"Revista no especificada",anio:year,resumen:"",doi,pmid:String(id),pmcid,fuente:"PubMed",fuentes:["PubMed"],url_ficha:"https://pubmed.ncbi.nlm.nih.gov/"+encodeURIComponent(id)+"/",url_texto_completo:pmcid?"https://pmc.ncbi.nlm.nih.gov/articles/"+encodeURIComponent(pmcid)+"/":"",acceso_abierto:Boolean(pmcid),tipo_publicacion:Array.isArray(item.pubtype)?item.pubtype.join("; "):""};
          });
          return {source:"PubMed",total,articles};
        }
        if(source==="europepmc"){
          let q="("+query+")";
          if(years)q+=" AND FIRST_PDATE:["+from+" TO "+today+"]";
          if(sort==="recientes")q+=" sort_date:y";
          const params=new URLSearchParams({query:q,format:"json",resultType:"core",pageSize:String(limit),cursorMark:"*"});
          const data=await literatureFetch("https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+params.toString(),"Europe PMC");
          const rows=data?.resultList?.result||[];
          const articles:LiteratureArticle[]=rows.map((item:any)=>{
            const links=item.fullTextUrlList?.fullTextUrl;
            const linkList=Array.isArray(links)?links:(links?[links]:[]);
            const fullText=linkList.find((x:any)=>x?.url)?.url||"";
            const pmid=String(item.pmid||""),pmcid=String(item.pmcid||""),doi=String(item.doi||"");
            const open=String(item.isOpenAccess||"").toUpperCase()==="Y";
            return {titulo:literatureClean(item.title)||"Título no disponible",autores:literatureClean(item.authorString)||"Autores no especificados",revista:literatureClean(item.journalTitle)||"Revista no especificada",anio:String(item.firstPublicationDate||"").slice(0,4),resumen:literatureClean(item.abstractText).slice(0,3000),doi,pmid,pmcid,fuente:"Europe PMC",fuentes:["Europe PMC"],url_ficha:pmid?"https://europepmc.org/article/MED/"+encodeURIComponent(pmid):(doi?"https://europepmc.org/article/MED/"+encodeURIComponent(doi):"https://europepmc.org/"),url_texto_completo:open?(fullText||(pmcid?"https://europepmc.org/articles/"+encodeURIComponent(pmcid):"")):"",acceso_abierto:open,tipo_publicacion:literatureClean(item.pubType)};
          });
          return {source:"Europe PMC",total:Number(data?.hitCount||0),articles};
        }
        if(source==="openalex"){
          const params=new URLSearchParams({search:query,per_page:String(limit),page:"1",select:"id,doi,title,publication_year,authorships,primary_location,open_access,best_oa_location,type,abstract_inverted_index"});
          if(years)params.set("filter","from_publication_date:"+from);
          params.set("sort",sort==="recientes"?"publication_date:desc":"relevance_score:desc");
          const data=await literatureFetch("https://api.openalex.org/works?"+params.toString(),"OpenAlex");
          const articles:LiteratureArticle[]=(data?.results||[]).map((item:any)=>{
            const authors=(item.authorships||[]).slice(0,5).map((a:any)=>a.author?.display_name).filter(Boolean).join(", ");
            const doi=String(item.doi||"").replace(/^https?:\/\/doi\.org\//i,"");
            const oa=item.open_access||{},location=item.best_oa_location||{};
            let abstract="";
            const index=item.abstract_inverted_index;
            if(index&&typeof index==="object"){
              const words:Array<[number,string]>=[];
              for(const [word,positions] of Object.entries(index) as Array<[string,any]>){if(Array.isArray(positions))for(const position of positions)if(Number.isInteger(position))words.push([position,word]);}
              words.sort((a,b)=>a[0]-b[0]);abstract=words.map(x=>x[1]).join(" ").slice(0,3000);
            }
            return {titulo:literatureClean(item.title)||"Título no disponible",autores:authors||"Autores no especificados",revista:literatureClean(item.primary_location?.source?.display_name)||"Fuente no especificada",anio:item.publication_year||"",resumen:abstract,doi,pmid:"",pmcid:"",fuente:"OpenAlex",fuentes:["OpenAlex"],url_ficha:String(item.id||"https://openalex.org/"),url_texto_completo:oa.is_oa?String(location.landing_page_url||location.pdf_url||oa.oa_url||""):"",acceso_abierto:Boolean(oa.is_oa),tipo_publicacion:literatureClean(item.type)};
          });
          return {source:"OpenAlex",total:Number(data?.meta?.count||0),articles};
        }
        const params=new URLSearchParams({"query.bibliographic":query,rows:String(limit),offset:"0",select:"DOI,title,author,published,container-title,URL,type,abstract"});
        if(years)params.set("filter","from-pub-date:"+from);
        if(sort==="recientes"){params.set("sort","published");params.set("order","desc");}
        const data=await literatureFetch("https://api.crossref.org/works?"+params.toString(),"Crossref");
        const message=data?.message||{},items=message.items||[];
        const articles:LiteratureArticle[]=items.map((item:any)=>{
          const authors=(item.author||[]).slice(0,5).map((a:any)=>[a.given,a.family].filter(Boolean).join(" ")).filter(Boolean).join(", ");
          const dateParts=item.published?.["date-parts"]?.[0]||[];
          const doi=String(item.DOI||"");
          return {titulo:literatureClean(Array.isArray(item.title)?item.title[0]:item.title)||"Título no disponible",autores:authors||"Autores no especificados",revista:literatureClean(Array.isArray(item["container-title"])?item["container-title"][0]:"")||"Revista no especificada",anio:dateParts[0]||"",resumen:literatureClean(item.abstract).slice(0,3000),doi,pmid:"",pmcid:"",fuente:"Crossref",fuentes:["Crossref"],url_ficha:doi?"https://doi.org/"+encodeURIComponent(doi):String(item.URL||"https://www.crossref.org/"),url_texto_completo:"",acceso_abierto:false,tipo_publicacion:literatureClean(item.type)};
        });
        return {source:"Crossref",total:Number(message["total-results"]||0),articles};
      };

      server.registerTool("buscar_literatura_cientifica",{
        title:"Buscar literatura científica",
        description:"Busca artículos odontológicos y biomédicos en las mismas cuatro fuentes de la sección Literatura Científica de OdontoUdeC: PubMed, Europe PMC, OpenAlex y Crossref. Devuelve metadatos, resúmenes disponibles, DOI/PMID y enlaces de acceso abierto. Usa esta herramienta para búsquedas bibliográficas, evidencia clínica, revisiones y artículos para seminarios. El filtro por tipo de publicación se aplica a PubMed; las fechas se aplican a todas las fuentes. No descarga ni garantiza el texto completo.",
        inputSchema:z.object({
          consulta:z.string().min(2).max(180),
          fuente:z.enum(["todas","pubmed","europepmc","openalex","crossref"]).default("todas"),
          periodo_anios:z.union([z.literal(0),z.literal(1),z.literal(5),z.literal(10)]).default(0),
          orden:z.enum(["relevancia","recientes"]).default("relevancia"),
          tipo_publicacion:z.enum(["ninguno","revision_sistematica","metaanalisis","ensayo_controlado_aleatorizado","ensayo_clinico","revision","reporte_caso","guia_clinica"]).default("ninguno"),
          limite_por_fuente:z.number().int().min(1).max(5).default(3)
        }),
        annotations:{readOnlyHint:true,openWorldHint:true}
      },async({consulta,fuente,periodo_anios,orden,tipo_publicacion,limite_por_fuente})=>{
        const sources:LiteratureSource[]=fuente==="todas"?[...literatureSources]:[fuente as LiteratureSource];
        const settled=await Promise.allSettled(sources.map(source=>literatureSearchProvider(source,consulta,periodo_anios,orden,tipo_publicacion==="ninguno"?"":tipo_publicacion,limite_por_fuente)));
        const totals:Record<string,number>={},errors:string[]=[],merged=new Map<string,LiteratureArticle>();
        settled.forEach((entry,index)=>{
          const source=sources[index];
          if(entry.status==="rejected"){errors.push(source+": "+String(entry.reason?.message||"error de consulta"));return;}
          totals[entry.value.source]=entry.value.total;
          for(const article of entry.value.articles){
            const key=article.doi?"doi:"+article.doi.toLowerCase():(article.pmid?"pmid:"+article.pmid:"title:"+article.titulo.toLowerCase().replace(/[^a-z0-9]+/g," ").trim());
            const previous=merged.get(key);
            if(!previous){merged.set(key,{...article,fuentes:[...article.fuentes]});continue;}
            previous.fuentes=Array.from(new Set([...previous.fuentes,...article.fuentes]));
            if(!previous.resumen&&article.resumen)previous.resumen=article.resumen;
            if(!previous.doi&&article.doi)previous.doi=article.doi;
            if(!previous.pmid&&article.pmid)previous.pmid=article.pmid;
            if(!previous.pmcid&&article.pmcid)previous.pmcid=article.pmcid;
            if(!previous.url_texto_completo&&article.url_texto_completo){previous.url_texto_completo=article.url_texto_completo;previous.acceso_abierto=article.acceso_abierto;}
            if(!previous.tipo_publicacion&&article.tipo_publicacion)previous.tipo_publicacion=article.tipo_publicacion;
          }
        });
        const articles=[...merged.values()];
        if(orden==="recientes")articles.sort((a,b)=>Number(b.anio||0)-Number(a.anio||0));
        if(!articles.length)return result({consulta:consulta,fuentes_consultadas:sources,resultados:0,totales_por_fuente:totals,errores:errors,error:errors.length?"No se pudo consultar ninguna fuente. Revisa la conexión e inténtalo nuevamente.":undefined,articulos:[]});
        const notes:string[]=[];
        if(tipo_publicacion!=="ninguno"&&fuente!=="pubmed")notes.push("El filtro por tipo de publicación se aplicó únicamente a PubMed, igual que en el buscador web.");
        if(errors.length)notes.push("Algunas fuentes no respondieron; los resultados disponibles se conservaron.");
        notes.push("Los resúmenes se incluyen solo cuando la fuente los proporciona. Un enlace de acceso abierto no garantiza que todos los formatos estén disponibles.");
        return result({consulta:consulta,fuentes_consultadas:sources,resultados:articles.length,totales_por_fuente:totals,errores:errors,articulos:articles,notas:notes});
      });

      server.registerTool("consultar_articulo_cientifico",{
        title:"Consultar ficha de artículo científico",
        description:"Recupera la ficha bibliográfica y el resumen disponible de un artículo por DOI o PMID. Busca primero en Europe PMC y utiliza Crossref o PubMed como respaldo. Devuelve enlaces originales y de acceso abierto cuando estén identificados.",
        inputSchema:z.object({identificador:z.string().min(3).max(180),tipo:z.enum(["doi","pmid"]).default("doi")}),
        annotations:{readOnlyHint:true,openWorldHint:true}
      },async({identificador,tipo})=>{
        const id=identificador.trim().replace(/^https?:\/\/doi\.org\//i,"");
        const isDoi=tipo==="doi";
        const query=isDoi?"DOI:"+id:"EXT_ID:"+id;
        const params=new URLSearchParams({query,format:"json",resultType:"core",pageSize:"1"});
        try{
          const data=await literatureFetch("https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+params.toString(),"Europe PMC");
          const item=data?.resultList?.result?.[0];
          if(item){
            const links=item.fullTextUrlList?.fullTextUrl;
            const linkList=Array.isArray(links)?links:(links?[links]:[]);
            const fullText=linkList.find((x:any)=>x?.url)?.url||"";
            const open=String(item.isOpenAccess||"").toUpperCase()==="Y";
            const pmid=String(item.pmid||""),pmcid=String(item.pmcid||""),doi=String(item.doi||id);
            return result({encontrado:true,titulo:literatureClean(item.title),autores:literatureClean(item.authorString),revista:literatureClean(item.journalTitle),fecha:item.firstPublicationDate||"",resumen:literatureClean(item.abstractText).slice(0,5000),doi,pmid,pmcid,fuente:"Europe PMC",acceso_abierto:open,url_ficha:pmid?"https://europepmc.org/article/MED/"+encodeURIComponent(pmid):(doi?"https://doi.org/"+encodeURIComponent(doi):"https://europepmc.org/"),url_texto_completo:open?(fullText||(pmcid?"https://pmc.ncbi.nlm.nih.gov/articles/"+encodeURIComponent(pmcid)+"/":"")):"",nota:"Se devuelve el resumen bibliográfico disponible, no necesariamente el texto completo."});
          }
        }catch{}
        if(isDoi){
          try{
            const data=await literatureFetch("https://api.crossref.org/works/"+encodeURIComponent(id),"Crossref");
            const item=data?.message;
            if(item)return result({encontrado:true,titulo:literatureClean(Array.isArray(item.title)?item.title[0]:item.title),autores:(item.author||[]).slice(0,8).map((a:any)=>[a.given,a.family].filter(Boolean).join(" ")).join(", "),revista:literatureClean(Array.isArray(item["container-title"])?item["container-title"][0]:""),fecha:item.published?.["date-parts"]?.[0]?.join("-")||"",resumen:literatureClean(item.abstract).slice(0,5000),doi:item.DOI||id,pmid:"",fuente:"Crossref",acceso_abierto:false,url_ficha:"https://doi.org/"+encodeURIComponent(id),url_texto_completo:"",nota:"Crossref proporciona metadatos editoriales; no garantiza acceso al texto completo."});
          }catch{}
        }else{
          try{
            const params=new URLSearchParams({db:"pubmed",id,retmode:"json",tool:"OdontoUdeC"});
            const data=await literatureFetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?"+params.toString(),"PubMed");
            const item=data?.result?.[id];
            if(item)return result({encontrado:true,titulo:literatureClean(item.title),autores:(item.authors||[]).slice(0,8).map((a:any)=>a.name).join(", "),revista:literatureClean(item.fulljournalname||item.source),fecha:item.pubdate||"",resumen:"PubMed no devolvió el resumen en esta ficha abreviada. Consulta la ficha original para ver si está disponible.",doi:(item.articleids||[]).find((a:any)=>a.idtype==="doi")?.value||"",pmid:id,fuente:"PubMed",acceso_abierto:false,url_ficha:"https://pubmed.ncbi.nlm.nih.gov/"+encodeURIComponent(id)+"/",url_texto_completo:"",nota:"Se recuperaron metadatos bibliográficos; el texto completo depende de la disponibilidad del editor o del repositorio."});
          }catch{}
        }
        return result({encontrado:false,identificador:id,tipo,nota:"No encontramos una ficha coincidente en las fuentes consultadas. Verifica el DOI o PMID."});
      });

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
        const push=await notifyPush("post",data.id);
        return result({ok:true,publicacion:{id:data.id,titulo:data.title,categoria:data.category,fecha:data.created_at,url:BASE+"/chat.html"},auditoria:logged?"registrada":"no disponible",notificacion:push.sent?"enviada":"sin suscriptores o no disponible"});
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
        const push=await notifyPush("community_message",data.id);
        return result({ok:true,mensaje:{id:data.id,autor:data.display_name,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible",notificacion:push.sent?"enviada":"sin suscriptores o no disponible"});
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
        const push=await notifyPush("group_message",data.id);
        return result({ok:true,mensaje:{id:data.id,group_id:data.group_id,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible",notificacion:push.sent?"enviada":"sin suscriptores o no disponible"});
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
        const push=await notifyPush("private_message",data.id);
        return result({ok:true,mensaje:{id:data.id,conversation_id:data.conversation_id,contenido:data.content,fecha:data.created_at},auditoria:logged?"registrada":"no disponible",notificacion:push.sent?"enviada":"sin suscriptores o no disponible"});
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


      if(isAdminForRequest){
        server.registerTool("analizar_resultados_encuesta",{
          title:"Analizar resultados de encuesta",
          description:"Solo para administradores autenticados. Consulta la encuesta estudiantil vigente y devuelve conteos y porcentajes agregados por categoría. No expone nombres, identificadores ni respuestas individuales. Úsala para revisar participación y tendencias generales.",
          inputSchema:z.object({}),
          annotations:{readOnlyHint:true,openWorldHint:false}
        },async()=>{
          if(!(await checkAdmin()))return result({autorizado:false,error:"No tienes permisos para consultar los resultados de la encuesta."});
          const {data,error}=await supabase.functions.invoke("survey-submissions",{body:{action:"admin_results"},headers:{Authorization:"Bearer "+bearerToken}});
          if(error||!data?.ok)return result({error:"No se pudieron consultar los resultados agregados de la encuesta. Comprueba que la función de encuestas esté disponible."});
          const rows=Array.isArray(data.results)?data.results:[];
          const selectionLabels:Record<string,string>={
            ortodoncista:"Mejor Ortodoncista",odontopediatra:"Mejor Odontopediatra",endodoncista:"Mejor Endodoncista",
            rehabilitador_oral:"Mejor Rehabilitador Oral",periodoncista:"Mejor Periodoncista",cirujano:"Mejor Cirujano",
            semiologo:"Mejor Semiólogo",coordinador_clinica:"Mejor Coordinador de Clínica"
          };
          const openLabels:Record<string,string>={
            docente:"Mejor Docente",docente_didactico:"Docente más Didáctico",docente_colaborador:"Docente más Colaborador",
            docente_inspirador:"Docente más Inspirador",docente_paciente:"Docente más Paciente",
            docente_calidad_humana:"Docente con Mayor Calidad Humana",docente_deja_huella:"Docente que Deja Huella"
          };
          const categorias=Object.entries(selectionLabels).map(([key,label])=>{
            const counts=new Map<string,number>();
            for(const row of rows){const value=row?.answers?.[key];if(typeof value==="string"&&value.trim())counts.set(value,(counts.get(value)||0)+1);}
            const votos=[...counts.entries()].map(([opcion,cantidad])=>({opcion,cantidad,porcentaje:rows.length?Math.round(cantidad/rows.length*1000)/10:0})).sort((a,b)=>b.cantidad-a.cantidad||a.opcion.localeCompare(b.opcion));
            return {categoria:label,respuestas_recibidas:votos.reduce((sum,item)=>sum+item.cantidad,0),opciones:votos};
          });
          const abiertas=Object.entries(openLabels).map(([key,label])=>{
            const values=rows.map(row=>row?.answers?.[key]).filter((value:any)=>typeof value==="string"&&value.trim());
            const average=values.length?Math.round(values.reduce((sum:number,value:string)=>sum+value.length,0)/values.length):0;
            return {categoria:label,respuestas_recibidas:values.length,longitud_promedio_caracteres:average};
          });
          const logged=await audit("read_survey_aggregate","survey","reconocimientos-2026",{total_respuestas:rows.length});
          return result({autorizado:true,encuesta:"Encuesta estudiantil · Reconocimientos 2026",total_participaciones:rows.length,categorias_cerradas:categorias,categorias_abiertas:abiertas,privacidad:"Solo se entregan conteos y porcentajes agregados; no se exponen nombres, identificadores ni respuestas individuales.",auditoria:logged?"registrada":"no disponible"});
        });
      }

      if(isAdminForRequest){
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

      }

      return server;
    });
    return handler.fetch(req);
  }
));
