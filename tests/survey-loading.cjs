const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root=path.join(__dirname,'..');
(async () => {
 const browser = await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try {
 for (const mode of ['guest','student','completed','bad-mime','missing-sdk','session-error','status-error','session-timeout','status-timeout']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Shorten only our access deadline; never make real authentication requests.
  await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===12000?50:ms,...args);});
  function installMock(mode){
   window.testActions=[];
   window.supabase={createClient:()=>({
    auth:{getSession:()=>{
     if(mode==='session-timeout')return new Promise(()=>{});
     if(mode==='session-error')return Promise.reject(new Error('test'));
     return Promise.resolve({data:{session:mode==='guest'?null:{user:{id:'test-user'}}}});
    }},
    functions:{invoke:async(name,options)=>{
     window.testActions.push(options.body.action);
     if(mode==='status-timeout')return new Promise(()=>{});
     if(mode==='status-error')return {error:new Error('test')};
     return {data:{ok:true,submitted:mode==='completed',is_admin:false}};
    }}
   })};
  }
  const sdk=`(${installMock.toString()})(${JSON.stringify(mode)});`;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='cdn.jsdelivr.net') return route.fulfill({contentType:'application/javascript',body:mode==='missing-sdk'?'':sdk});
   if(url.pathname.endsWith('encuesta-estudiantil-data.js')) return route.fulfill({headers:{'content-type':mode==='bad-mime'?'application/octet-stream':'application/javascript','x-content-type-options':'nosniff'},body:fs.readFileSync(path.join(root,'assets/encuesta-estudiantil-data.js'),'utf8')});
   if(url.pathname.endsWith('.html')) return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'encuesta-estudiantil.html'),'utf8')});
   return route.fulfill({status:404,body:''});
  });
  await page.goto('https://survey.test/encuesta-estudiantil.html');
  await page.waitForFunction(()=>!document.getElementById('status').textContent.includes('Comprobando'));
  const status=await page.locator('#status').innerText();
  assert.equal(errors.length,0,`${mode}: ${errors.join("; ")}`);
  if(mode==='student'){
   assert.match(status,/Sesión iniciada/);assert.equal(await page.locator('#survey').isVisible(),true);
   assert.equal(await page.locator('#questions > *').count(),15);
   assert.equal(await page.locator('#adminPanel').isVisible(),false);
  }else{
   assert.equal(await page.locator('#survey').isVisible(),false);
   if(mode==='completed')assert.match(status,/Encuesta completada/);
   else if(mode==='guest'){assert.match(status,/requiere iniciar sesión/);assert.match(await page.locator('#loginLink').getAttribute('href'),/returnTo=/);}
   else{assert.match(status,/No pudimos cargar/);assert.equal(await page.getByRole('button',{name:'Reintentar',exact:true}).isVisible(),true);}
  }
  assert.ok((await page.evaluate(()=>window.testActions||[])).every(x=>x==='status'),'No responses may be submitted');
  console.log(`PASS ${mode}`);
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
