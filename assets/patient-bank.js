const PB_URL="https://jqbrheonqqsiijrprsqs.supabase.co";
const PB_KEY="sb_publishable_bXfNGlIlersAhrUNR99wlA_golwgRC8";
const pbClient=window.supabase.createClient(PB_URL,PB_KEY);
const pbTabs=[...document.querySelectorAll(".pb-tab")];
const patientPanel=document.getElementById("pb-patient-panel"),studentPanel=document.getElementById("pb-student-panel");
function pbSelectTab(name){pbTabs.forEach(t=>t.classList.toggle("active",t.dataset.tab===name));patientPanel.hidden=name!=="patient";studentPanel.hidden=name!=="student";}
pbTabs.forEach(t=>t.addEventListener("click",()=>pbSelectTab(t.dataset.tab)));
const pbStatusLabels={available:"Disponible",claimed:"En gestión",completed:"Finalizado"};
let pbCases=[],pbFilter="all",pbSession=null;
async function pbInvokeIntake(form,source,statusEl){
 const button=form.querySelector('button[type="submit"]');button.disabled=true;statusEl.textContent="Enviando solicitud…";
 try{
  const data=Object.fromEntries(new FormData(form).entries());
  const response=await fetch(PB_URL+"/functions/v1/patient-bank-intake",{method:"POST",headers:{"Content-Type":"application/json","apikey":PB_KEY,...(pbSession?{Authorization:"Bearer "+pbSession.access_token}:{})},body:JSON.stringify({name:data.name,phone:data.phone,summary:data.summary,area:data.area||null,availability:data.availability||null,source,consent:data.consent==="on"})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||"No se pudo enviar la solicitud.");
  form.reset();statusEl.textContent="¡Solicitud recibida! Revisaremos la información para incorporarla al banco.";
 }catch(error){statusEl.textContent=error.message;}finally{button.disabled=false;}
}
document.getElementById("pb-intake-form").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;pbInvokeIntake(e.currentTarget,"patient",document.getElementById("pb-intake-status"));});
function pbRender(){
 const list=document.getElementById("pb-case-list"),filtered=pbCases.filter(c=>pbFilter==="all"||c.status===pbFilter);
 document.getElementById("pb-count-available").textContent=pbCases.filter(c=>c.status==="available").length;
 document.getElementById("pb-count-progress").textContent=pbCases.filter(c=>c.status==="claimed").length;
 document.getElementById("pb-count-completed").textContent=pbCases.filter(c=>c.status==="completed").length;
 if(!filtered.length){list.innerHTML='<div class="pb-empty">No hay pacientes en esta categoría por ahora.</div>';return;}
 list.innerHTML=filtered.map(c=>{const status=pbStatusLabels[c.status]||"Disponible";const source=c.source==="student"?"Compartido por un estudiante":"Solicitud de paciente";let actions="";
 if(c.status==="available")actions='<button class="primary" data-action="claim" data-id="'+c.id+'">Gestionar este caso</button>';
 if(c.status==="claimed")actions=c.is_mine?'<button data-action="release" data-id="'+c.id+'">Devolver al banco</button><button class="primary" data-action="complete" data-id="'+c.id+'">Marcar finalizado</button>':'<span class="pb-case-meta">Este caso ya está siendo gestionado.</span>';
 if(c.status==="completed")actions='<span class="pb-case-meta">Caso finalizado · Registro histórico</span>';
 return '<article class="pb-case"><div class="pb-case-top"><span class="pb-code">'+c.public_code+'</span><span class="pb-status '+c.status+'">'+status+'</span></div><h3>'+pbEscape(c.reason_summary)+'</h3><p>'+source+'</p><div class="pb-case-meta">'+(c.general_area?'<span>⌖ '+pbEscape(c.general_area)+'</span>':"")+(c.availability?'<span>◷ '+pbEscape(c.availability)+'</span>':"")+'</div><div class="pb-case-actions">'+actions+'</div><div class="pb-contact" id="pb-contact-'+c.id+'" hidden></div></article>';}).join("");
}
function pbEscape(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function pbLoadAdminQueue(){
 const panel=document.getElementById("pb-admin-review"),list=document.getElementById("pb-admin-list");
 const {data:isAdmin,error:adminError}=await pbClient.rpc("patient_bank_is_admin");
 if(adminError||!isAdmin)return;
 panel.hidden=false;
 const {data,error}=await pbClient.rpc("patient_bank_admin_pending");
 if(error){list.innerHTML='<div class="pb-empty">No se pudo cargar la cola de revisión.</div>';return;}
 if(!data?.length){list.innerHTML='<div class="pb-empty">No hay solicitudes pendientes de revisión.</div>';return;}
 list.innerHTML=data.map(c=>'<article class="pb-case"><div class="pb-case-top"><span class="pb-code">'+pbEscape(c.public_code)+'</span><span class="pb-status claimed">Pendiente de revisión</span></div><h3>'+pbEscape(c.reason_summary)+'</h3><p>'+(c.source==="student"?"Compartido por un estudiante":"Solicitud directa de paciente")+'</p><div class="pb-case-actions"><button data-admin-action="contact" data-id="'+c.id+'">Ver contacto privado</button><button class="primary" data-admin-action="approve" data-id="'+c.id+'">Aprobar y publicar</button><button data-admin-action="reject" data-id="'+c.id+'">Rechazar</button></div><div class="pb-contact" id="pb-admin-contact-'+c.id+'" hidden></div></article>').join("");
}
async function pbLoadCases(){
 const list=document.getElementById("pb-case-list");list.innerHTML='<div class="pb-empty">Actualizando casos…</div>';
 const {data,error}=await pbClient.rpc("patient_bank_list_cases");
 if(error){list.innerHTML='<div class="pb-empty">No pudimos cargar el banco. Intenta actualizar.</div>';return;}
 pbCases=data||[];pbRender();await Promise.all(pbCases.filter(x=>x.status==="claimed"&&x.is_mine).map(x=>pbLoadPrivateContact(x.id)));await pbLoadAdminQueue();
}
async function pbLoadPrivateContact(id){
 const {data,error}=await pbClient.rpc("patient_bank_my_contact",{p_case_id:id});
 const box=document.getElementById("pb-contact-"+id);if(error||!box||!data?.length)return;
 box.hidden=false;box.textContent="Contacto privado · "+data[0].patient_name+" · "+data[0].phone;
}
async function pbHandleAction(button){
 const id=button.dataset.id,action=button.dataset.action;button.disabled=true;
 try{
  if(action==="claim"){
   if(!confirm("¿Confirmas que deseas gestionar este caso? Al continuar, dejará de estar disponible para otros estudiantes."))return;
   const {data,error}=await pbClient.rpc("patient_bank_claim_case",{p_case_id:id});if(error)throw error;if(!data)throw new Error("Otro estudiante acaba de tomar este caso. Actualiza el banco.");
   await pbLoadCases();
  }else if(action==="release"||action==="complete"){
   const promptText=action==="release"?"¿Quieres devolver este caso al banco para que otro estudiante pueda gestionarlo?":"¿Confirmas que la atención de este caso ya finalizó?";
   if(!confirm(promptText))return;
   const rpc=action==="release"?"patient_bank_release_case":"patient_bank_complete_case";
   const {data,error}=await pbClient.rpc(rpc,{p_case_id:id});if(error)throw error;
   if(!data)throw new Error("No se pudo actualizar el estado del caso.");
   await pbLoadCases();
  }
 }catch(error){alert(error.message||"No se pudo actualizar el caso.");}finally{button.disabled=false;}
}
document.getElementById("pb-case-list").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(b)pbHandleAction(b);});
document.getElementById("pb-admin-list").addEventListener("click",async e=>{
 const b=e.target.closest("button[data-admin-action]");if(!b)return;const id=b.dataset.id,action=b.dataset.adminAction;b.disabled=true;
 try{
  if(action==="contact"){
   const {data,error}=await pbClient.rpc("patient_bank_my_contact",{p_case_id:id});if(error)throw error;
   const box=document.getElementById("pb-admin-contact-"+id);box.hidden=false;
   box.textContent=data?.length?("Contacto privado · "+data[0].patient_name+" · "+data[0].phone):"No se encontró contacto.";
  }else{
   const verb=action==="approve";if(!confirm(verb?"¿Aprobar esta solicitud y hacerla visible para los estudiantes?":"¿Rechazar esta solicitud?"))return;
   const {data,error}=await pbClient.rpc("patient_bank_admin_review",{p_case_id:id,p_approve:verb});if(error)throw error;if(!data)throw new Error("La solicitud ya no está pendiente.");
   await pbLoadCases();
  }
 }catch(error){alert(error.message||"No se pudo revisar la solicitud.");}finally{b.disabled=false;}
});
document.querySelectorAll(".pb-filters button").forEach(b=>b.addEventListener("click",()=>{pbFilter=b.dataset.filter;document.querySelectorAll(".pb-filters button").forEach(x=>x.classList.toggle("active",x===b));pbRender();}));
document.getElementById("pb-refresh").addEventListener("click",pbLoadCases);
document.getElementById("pb-share-toggle").addEventListener("click",()=>{const f=document.getElementById("pb-student-share-form");f.hidden=!f.hidden;});
document.getElementById("pb-student-share-form").addEventListener("submit",e=>{e.preventDefault();if(e.currentTarget.reportValidity())pbInvokeIntake(e.currentTarget,"student",document.getElementById("pb-share-status"));});
async function pbInit(){
 const {data}=await pbClient.auth.getSession();pbSession=data.session;
 const gate=document.getElementById("pb-student-gate"),content=document.getElementById("pb-student-content");
 if(pbSession){gate.hidden=true;content.hidden=false;await pbLoadCases();}
 pbClient.auth.onAuthStateChange(async(_event,session)=>{pbSession=session;if(session){gate.hidden=true;content.hidden=false;await pbLoadCases();}else{gate.hidden=false;content.hidden=true;}});
}
pbInit();