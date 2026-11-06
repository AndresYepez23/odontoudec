(()=>{
if(new URLSearchParams(location.search).get('embed')==='1'||document.getElementById('ouCommunityDock'))return;
const root=document.createElement('div');
root.id='ouCommunityDock';
root.innerHTML='<section id="ouDockPanel" aria-label="Centro de conversaciones"><header id="ouDockHead"><span class="ou-dock-brand"><img src="assets/odontoudec-logo.svg" alt=""><strong>OdontoUdeC</strong></span><div style="display:flex;gap:6px"><button id="ouDockExpand" type="button" aria-label="Ampliar chat">↗</button><button id="ouDockClose" type="button" aria-label="Minimizar chat">—</button></div></header><nav id="ouDockTabs" aria-label="Conversaciones"><button type="button" data-page="chat.html" aria-selected="true">Comunidad</button><button type="button" data-page="mensajes.html" aria-selected="false">Privados</button><button type="button" data-page="grupos-estudio.html" aria-selected="false">Grupos</button></nav><iframe id="ouDockFrame" title="Conversaciones de OdontoUdeC" loading="lazy"></iframe><div id="ouDockGuest"><h3>Conecta con tu comunidad</h3><p>Inicia sesión o crea tu cuenta para participar en el chat general, enviar mensajes privados y entrar a grupos de estudio.</p><a href="index.html#acceso">Iniciar sesión o registrarme</a></div></section><button id="ouDockButton" type="button" aria-expanded="false"><span class="ou-icon">◉</span><span>Chat</span><span id="ouDockUnread" aria-label="Mensajes privados sin leer">0</span></button>';
document.body.appendChild(root);
const panel=root.querySelector('#ouDockPanel'),button=root.querySelector('#ouDockButton'),frame=root.querySelector('#ouDockFrame'),guest=root.querySelector('#ouDockGuest'),tabs=[...root.querySelectorAll('#ouDockTabs button')],tabbar=root.querySelector('#ouDockTabs');
let logged=false,unreadTimer=null;
function setUnreadUnavailable(){const badge=root.querySelector('#ouDockUnread');badge.classList.remove('ou-visible');badge.removeAttribute('title');badge.setAttribute('aria-label','No se pudo consultar el contador de mensajes privados sin leer');}
function syncOnboardingShortcut(){
 const menu=document.querySelector('.nav-more-menu'),existing=menu?.querySelector('[data-ou-onboarding-shortcut]');
 if(!menu)return;
 if(!logged){existing?.remove();return;}
 if(existing)return;
 const link=document.createElement('a');
 link.href='#onboardingGuide';link.textContent='Guía de bienvenida';link.dataset.ouOnboardingShortcut='true';
 link.addEventListener('click',event=>{
  event.preventDefault();
  const modal=document.getElementById('onboardingGuide');
  if(!modal)return;
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  const finishButton=document.getElementById('finishOnboarding');
  if(finishButton)finishButton.onclick=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');};
  menu.closest('details')?.removeAttribute('open');
  document.getElementById('navlinks')?.classList.remove('open');
  document.getElementById('closeOnboarding')?.focus();
 });
 menu.appendChild(link);
}
async function refreshUnread(client,userId){
 try{
  const {data:conversations,error}=await client.from('private_conversations').select('id,created_at').or('user_one.eq.'+userId+',user_two.eq.'+userId).order('created_at',{ascending:false}).limit(50);
  if(error)throw error;
  const ids=(conversations||[]).map(c=>c.id),badge=root.querySelector('#ouDockUnread');
  if(!ids.length){badge.textContent='0';badge.classList.remove('ou-visible');badge.setAttribute('aria-label','0 mensajes privados sin leer');return;}
  const {data:reads,error:readsError}=await client.from('private_message_reads').select('conversation_id,last_read_at').eq('user_id',userId).in('conversation_id',ids);
  if(readsError)throw readsError;
  const readMap=new Map((reads||[]).map(x=>[x.conversation_id,x.last_read_at]));
  let total=0;
  for(const conversation of conversations){
   const after=readMap.get(conversation.id)||conversation.created_at;
   const {count,error:countError}=await client.from('private_messages').select('id',{count:'exact',head:true}).eq('conversation_id',conversation.id).neq('sender_id',userId).gt('created_at',after);
   if(countError)throw countError;
   total+=count||0;
  }
  badge.textContent=total>99?'99+':String(total);
  badge.classList.toggle('ou-visible',total>0);
  badge.removeAttribute('title');
  badge.setAttribute('aria-label',total+' mensajes privados sin leer');
 }catch(e){setUnreadUnavailable();console.info('No se pudo actualizar el contador de mensajes:',e.message);}
}
function open(){panel.classList.add('ou-open');button.setAttribute('aria-expanded','true');if(logged&&!frame.hasAttribute('src'))frame.src='chat.html?embed=1';}
function close(){panel.classList.remove('ou-open');panel.classList.remove('ou-expanded');button.setAttribute('aria-expanded','false');}
button.addEventListener('click',()=>panel.classList.contains('ou-open')?close():open());
root.querySelector('#ouDockClose').addEventListener('click',close);
root.querySelector('#ouDockExpand').addEventListener('click',()=>panel.classList.toggle('ou-expanded'));
tabs.forEach(t=>t.addEventListener('click',()=>{tabs.forEach(x=>x.setAttribute('aria-selected',String(x===t)));frame.src=t.dataset.page+'?embed=1';}));
async function init(){
 try{
  const client=window.supabase?.createClient?.('https://jqbrheonqqsiijrprsqs.supabase.co','sb_publishable_bXfNGlIlersAhrUNR99wlA_golwgRC8');
  if(!client){guest.style.display='block';frame.style.display='none';tabbar.style.display='none';return;}
  const {data}=await client.auth.getSession();logged=!!data.session;
  syncOnboardingShortcut();
  if(logged){await refreshUnread(client,data.session.user.id);unreadTimer=setInterval(()=>refreshUnread(client,data.session.user.id),30000);}
  if(!logged){guest.style.display='block';frame.style.display='none';tabbar.style.display='none';}
  client.auth.onAuthStateChange(async(_event,session)=>{
   logged=!!session;syncOnboardingShortcut();guest.style.display=logged?'none':'block';frame.style.display=logged?'block':'none';tabbar.style.display=logged?'grid':'none';
   if(logged&&!frame.hasAttribute('src'))frame.src='chat.html?embed=1';
   if(logged){if(unreadTimer)clearInterval(unreadTimer);await refreshUnread(client,session.user.id);unreadTimer=setInterval(()=>refreshUnread(client,session.user.id),30000);}
   if(!logged){if(unreadTimer)clearInterval(unreadTimer);frame.removeAttribute('src');const badge=root.querySelector('#ouDockUnread');badge.classList.remove('ou-visible');badge.textContent='0';}
  });
 }catch(_){guest.style.display='block';frame.style.display='none';tabbar.style.display='none';}
}
init();
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();