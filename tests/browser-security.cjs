const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.ODONTO_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="message"></div>'}));
  await page.goto('https://security.test/');
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../assets/chat-ui.js'),'utf8')});
  const result=await page.evaluate(async()=>{
   const ui=window.OdontoChatUI,box=document.getElementById('message');
   const attack='<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>';
   await ui.renderMessageContent(box,attack,{});
   const plain=box.textContent===attack&&box.querySelectorAll('img,script').length===0;
   await ui.renderMessageContent(box,ui.encodeGifContent({id:'abc123',title:attack,source:attack},attack),{});
   const gif=box.querySelectorAll('script,[onerror]').length===0&&box.textContent.includes('<img');
   const invalid=ui.parseContent('[[ODONTO_IMAGE_V1]]'+JSON.stringify({path:'javascript:alert(1)',caption:attack}));
   const invalidGif=ui.parseGifContent('[[ODONTO_GIF_V1]]'+JSON.stringify({id:'../evil" onerror="alert(1)'}));
   return {plain,gif,invalidPath:invalid.path,invalidGif,pwned:!!window.pwned};
  });
  assert.deepEqual(result,{plain:true,gif:true,invalidPath:null,invalidGif:null,pwned:false});
  console.log('PASS: existing chat text/GIF renderer and attachment-path validation resist the local XSS corpus.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
