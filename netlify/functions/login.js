exports.handler=async(event)=>{
 const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
 const respond=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
 if(event.httpMethod!=="POST")return respond(405,{error:"Método no permitido."});
 let input;try{input=JSON.parse(event.body||"{}");}catch{return respond(400,{error:"Solicitud no válida."});}
 const username=String(input.username||"").trim().toLowerCase(),password=String(input.password||"");
 if(!/^[a-z0-9._-]{3,24}$/.test(username)||!password)return respond(400,{error:"Usuario o contraseña incorrectos."});
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!anon||!service)return respond(500,{error:"El acceso por usuario no está configurado en el servidor."});
 try{
  const url=new URL("/rest/v1/private_login_index",base);url.searchParams.set("username","eq."+username);url.searchParams.set("select","email");url.searchParams.set("limit","1");
  const lookup=await fetch(url,{headers:{apikey:service,Authorization:"Bearer "+service}});
  if(!lookup.ok)return respond(503,{error:"No pudimos validar el acceso. Inténtalo más tarde."});
  const rows=await lookup.json(),email=rows?.[0]?.email;
  if(!email)return respond(401,{error:"Usuario o contraseña incorrectos."});
  const auth=await fetch(base.replace(/\/$/,"")+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:anon,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const session=await auth.json();
  if(!auth.ok)return respond(401,{error:"Usuario o contraseña incorrectos."});
  return respond(200,{session:{access_token:session.access_token,refresh_token:session.refresh_token}});
 }catch{return respond(503,{error:"No pudimos validar el acceso. Inténtalo más tarde."});}
};
