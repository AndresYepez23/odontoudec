(function(){
"use strict";
const CDN="https://cdn.jsdelivr.net/npm/driver.js@1.9.0/dist/";
let libraryPromise=null;
let activeTour=null;
function loadLibrary(){
 if(window.driver?.js?.driver)return Promise.resolve(window.driver.js.driver);
 if(!libraryPromise){
  libraryPromise=new Promise((resolve,reject)=>{
   if(!document.getElementById("ou-driver-style")){
    const link=document.createElement("link");
    link.id="ou-driver-style";link.rel="stylesheet";link.href=CDN+"driver.css";
    document.head.appendChild(link);
   }
   const s=document.createElement("script");
   s.src=CDN+"driver.js.iife.js";s.async=true;s.crossOrigin="anonymous";
   s.onload=()=>{
    const factory=window.driver?.js?.driver;
    if(typeof factory==="function")resolve(factory);
    else reject(new Error("No se inicializó Driver.js."));
   };
   s.onerror=()=>reject(new Error("Driver.js no está disponible."));
   document.head.appendChild(s);
  }).catch(e=>{libraryPromise=null;throw e;});
 }
 return libraryPromise;
}
const GUIDE=[
 {target:"#inicio .hero-grid h1",title:"¡Bienvenido a OdontoUdeC!",description:"Descubre los espacios más importantes de tu comunidad estudiantil. Este recorrido solo toma unos pasos.",side:"bottom"},
 {target:".survey-invite",title:"Tu voz importa",description:"Participa en la encuesta estudiantil desde aquí y ayuda a mejorar nuestra comunidad.",side:"bottom"},
 {target:".quick-grid",title:"Tus accesos directos",description:"Encuentra el calendario, las herramientas clínicas, Academia y el Laboratorio IA en un mismo lugar.",side:"bottom"},
 {target:"#academia-destacada .academy-feature-copy",title:"Academia para aprender",description:"Explora OdontoTrivia, recursos interactivos y módulos de estudio.",side:"top"},
 {target:"#biblioteca .section-head",title:"Biblioteca por semestres",description:"Consulta y comparte materiales que acompañen tus asignaturas.",side:"top"},
 {target:"#comunidad .section-head",title:"Conecta con compañeros",description:"Participa en publicaciones, chats y grupos de la comunidad estudiantil.",side:"top"},
 {target:"#acceso .section-head",title:"Tu cuenta, tu espacio",description:"Inicia sesión para personalizar tu perfil y participar en más actividades. ¡Listo para explorar!",side:"top"}
];
function steps(){
 return GUIDE.map(x=>{
  const el=document.querySelector(x.target);
  if(!el||!el.getClientRects().length)return null;
  return {element:x.target,popover:{title:x.title,description:x.description,side:x.side,align:"center"},disableActiveInteraction:true,skipMissingElement:true};
 }).filter(Boolean);
}
async function start(options={}){
 const driver=await loadLibrary();
 const items=steps();if(!items.length)return false;
 if(activeTour)activeTour.destroy();
 const tour=driver({
  steps:items,popoverClass:"ou-driver-popover",overlayColor:"#1b0d2b",overlayOpacity:.67,
  smoothScroll:true,stagePadding:10,stageRadius:13,allowClose:true,
  showProgress:true,progressText:"Paso {{current}} de {{total}}",
  nextBtnText:"Siguiente",prevBtnText:"Anterior",doneBtnText:"¡Empezar!",closeBtnLabel:"Cerrar recorrido",
  showButtons:["previous","next","close"],
  animate:!window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  onDestroyed:(_element,_step,context)=>{
   if(activeTour===tour)activeTour=null;
   const callback=context?.reason==="done"?options.onFinish:options.onDismiss;
   if(typeof callback==="function"){
    try{Promise.resolve(callback()).catch(e=>console.warn("Recorrido:",e));}
    catch(e){console.warn("Recorrido:",e);}
   }
  }
 });
 activeTour=tour;tour.drive();return true;
}
document.getElementById("startOdontoTour")?.addEventListener("click",async event=>{
 event.preventDefault();document.querySelector(".nav-more")?.removeAttribute("open");
 try{await start();}catch(e){console.warn(e);window.alert("La guía no está disponible ahora. Vuelve a intentarlo.");}
});
window.OdontoTour=Object.freeze({start});
})();