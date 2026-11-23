import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import worker from '../.cloudflare-build/worker.mjs';
import { createAdminHandler } from '../.cloudflare-build/admin-api.mjs';
import { createGiphyHandler } from '../.cloudflare-build/giphy-config.mjs';
import { createPosthogHandler } from '../.cloudflare-build/posthog-analytics.mjs';

const uri = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const helper = stripTypeScriptTypes(await readFile(new URL('../supabase/functions/_shared/request-body.ts',import.meta.url),'utf8'),{mode:'transform'});
const helperUrl = uri(helper);
const {readJsonObject}=await import(helperUrl);
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'private-test',GROQ_API_KEY:'groq-test',POSTHOG_PERSONAL_API_KEY:'posthog-test',GIPHY_API_KEY:'gif-public',GIPHY_API_KEY_2:'gif-private',GIPHY_API_KEY_3:'gif-groups'};
const request = (body, token='valid') => new Request('https://example.test/',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});

async function edge(slug,client){
 let handler;
 globalThis.Deno={env:{get:name=>env[name]},serve:fn=>{handler=fn;}};
 globalThis.__testCreateClient=client;
 let source=await readFile(new URL(`../supabase/functions/${slug}/index.ts`,import.meta.url),'utf8');
 source=source.replace(/^import "jsr:[^\n]+\n/m,'')
  .replace(/import \{ createClient \} from "[^"]+";/,'const createClient=globalThis.__testCreateClient;')
  .replace("'../_shared/request-body.ts'",JSON.stringify(helperUrl));
 await import(uri(stripTypeScriptTypes(source,{mode:'transform'})+'\n// '+Math.random()));
 return handler;
}

test('stream bounds reject null/array JSON and cancel oversized chunked UTF-8',async()=>{
 for(const body of [null,[],1,'bad'])await assert.rejects(readJsonObject(request(body),100),e=>e.status===400);
 let cancelled=false;
 const body=new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('é'.repeat(100)));},cancel(){cancelled=true;}});
 await assert.rejects(readJsonObject(new Request('https://test/',{method:'POST',body,duplex:'half'}),100),e=>e.status===413);
 assert.equal(cancelled,true);
 assert.deepEqual(await readJsonObject(request({text:'á'}),100),{text:'á'});
});

test('bot never calls Groq for invalid identity or unavailable/exhausted quota',async t=>{
 const original=fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=()=>{throw Error('unexpected provider request');};
 for(const scenario of ['invalid','quota-error','quota-denied']){
  let quotaCalls=0;
  const handler=await edge('odonto-bot',()=>({auth:{getUser:async()=>({data:{user:scenario==='invalid'?null:{id:'verified-user'}},error:null})},rpc:async(_name,args)=>{
   quotaCalls++;assert.equal(args.p_user_id,'verified-user');
   return scenario==='quota-error'?{error:{message:'private error'}}:{data:{allowed:false,retry_after:30}};
  }}));
  const res=await handler(request({messages:[{role:'user',content:'question'}],user_id:'attacker-chosen'}));
  assert.equal(res.status,scenario==='invalid'?401:scenario==='quota-error'?503:429);
  if(scenario==='invalid')assert.equal(quotaCalls,0);
  if(scenario==='quota-denied')assert.equal(res.headers.get('Retry-After'),'30');
  assert.doesNotMatch(await res.text(),/private error/);
 }
});

test('bot success preserves output and bounds upstream request',async t=>{
 const original=fetch;t.after(()=>{globalThis.fetch=original;});let reserved=false;
 const handler=await edge('odonto-bot',()=>({auth:{getUser:async()=>({data:{user:{id:'verified-user'}}})},rpc:async()=>{reserved=true;return {data:{allowed:true}};}}));
 globalThis.fetch=async(url,init)=>{assert.equal(reserved,true);assert.match(url,/api.groq.com/);assert.ok(init.signal);assert.equal(JSON.parse(init.body).max_tokens,900);return Response.json({choices:[{message:{content:'Respuesta académica'}}]});};
 const res=await handler(request({messages:[{role:'system',content:'forbidden'},{role:'user',content:'pregunta'}]}));
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{reply:'Respuesta académica'});
});

test('patient intake rejects oversized, malformed and unauthenticated student input before submission',async()=>{
 let submitted=false;
 const handler=await edge('patient-bank-intake',()=>({auth:{getUser:async()=>({data:{user:null},error:{}})},rpc:async()=>{submitted=true;throw Error('must not submit');}}));
 assert.equal((await handler(request(null))).status,400);
 assert.equal((await handler(request({name:'x'.repeat(12001)}))).status,413);
 assert.equal((await handler(request({name:'Test',phone:'123456789',summary:'Test description',source:'student',consent:true},''))).status,401);
 assert.equal(submitted,false);
});

test('admin and analytics reject anonymous and ordinary users before privileged requests',async t=>{
 const original=fetch;t.after(()=>{globalThis.fetch=original;});let calls=[];
 globalThis.fetch=async(url,init)=>{
  calls.push(url);assert.equal(init.headers.apikey,'public-test');
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'ordinary-user'});
  assert.ok(url.endsWith('/rpc/is_admin'));return Response.json(false);
 };
 for(const handler of [createAdminHandler(env),createPosthogHandler(env)]){
  assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,401);
  assert.equal((await handler({httpMethod:'GET',headers:{authorization:'Bearer ordinary'},queryStringParameters:{action:'overview'}})).statusCode,403);
 }
 assert.equal(calls.length,3);
});

test('survey denies non-admin results and rejects oversized data before table access',async()=>{
 let reads=0;
 const handler=await edge('survey-submissions',()=>({
  auth:{getUser:async()=>({data:{user:{id:'student'}}})},
  from(table){reads++;assert.equal(table,'user_roles');return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'student'},error:null})})})};}
 }));
 assert.equal((await handler(request({action:'admin_results'}))).status,403);
 assert.equal(reads,1);
 assert.equal((await handler(request({action:'submit',answers:'x'.repeat(32000)}))).status,413);
 assert.equal(reads,1);
});

test('authorized admin keeps write behavior with server-only credentials',async t=>{
 const original=fetch;t.after(()=>{globalThis.fetch=original;});let writes=0;
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'admin-user'});
  if(url.endsWith('/rpc/is_admin'))return Response.json(true);
  writes++;assert.equal(init.method,'POST');assert.equal(init.headers.apikey,'private-test');
  assert.equal(JSON.parse(init.body)[0].author_id,'admin-user');return Response.json([{id:1}]);
 };
 const response=await createAdminHandler(env)({httpMethod:'POST',headers:{authorization:'Bearer admin'},queryStringParameters:{action:'save-post'},body:JSON.stringify({title:'Title',content:'A valid post',category:'General'})});
 assert.equal(response.statusCode,200);assert.equal(writes,1);assert.doesNotMatch(response.body,/private-test/);
});

test('Cloudflare bounds admin stream before auth and applies headers even to cached assets',async t=>{
 const original=fetch;t.after(()=>{globalThis.fetch=original;});globalThis.fetch=()=>{throw Error('must not authenticate oversized request');};
 const req=new Request('https://odontoudec.online/.netlify/functions/admin-api',{method:'POST',body:'é'.repeat(16001)});
 assert.equal((await worker.fetch(req,env,{})).status,413);
 globalThis.caches={default:{match:async()=>new Response('cached HTML')}};
 const response=await worker.fetch(new Request('https://odontoudec.online/'),env,{});
 assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors/);
});

test('GIPHY authenticates and preserves deployed scope-to-key mapping',async t=>{
 const original=fetch;t.after(()=>{globalThis.fetch=original;});globalThis.fetch=async()=>Response.json({id:'user'});
 for(const [scope,key] of [['private','gif-private'],['groups','gif-groups']]){
  const response=await createGiphyHandler(env)({httpMethod:'GET',headers:{authorization:'Bearer valid'},queryStringParameters:{scope}});
  assert.equal(response.statusCode,200);assert.equal(JSON.parse(response.body).apiKey,key);
 }
 assert.equal((await createGiphyHandler(env)({httpMethod:'GET',headers:{},queryStringParameters:{scope:'private'}})).statusCode,401);
});
