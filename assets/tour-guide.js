(()=>{"use strict";
let loading=null,active=false;
const url="https://cdn.jsdelivr.net/npm/driver.js@1.10.2/dist/driver.js.iife.js";
function load(){
 if(window.driver?.js?.driver)return Promise.resolve(window.driver.js.driver);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=url;script.async=true;script.onload=()=>window.driver?.js?.driver?resolve(window.driver.js.driver):reject(Error("Driver.js no disponible"));script.onerror=()=>reject(Error("No cargó Driver.js"));document.head.append(script);}).catch(e=>{loading=null;throw e;});
 return loading;
}
function visible(sel){const e=document.querySelector(sel);if(!e)return false;const s=getComputedStyle(e);return s.display!=="none"&&s.visibility!=="hidden"&&e.getClientRects().length>0;}
const cases=[
["#inicio .hero-grid","¡Bienvenido a OdontoUdeC!","Tu comunidad para aprender, participar y compartir recursos."],
[".survey-invite","Tu opinión cuenta","Aquí puedes participar en las encuestas estudiantiles."],
[".quick-grid","Accesos directos","Accede a las herramientas más utilizadas sin navegar por muchos menús."],
["#aiLabQuick","Nuevo Laboratorio IA","Transcribe audio, crea imágenes y trabaja con documentos: elige la función, no el modelo."],
["#agenda","Calendario académico","Consulta fechas importantes y actividades de la facultad."],
["#biblioteca","Biblioteca","Encuentra materiales por semestre y asignatura."],
["#comunidad","Comunidad","Conversa con estudiantes, descubre publicaciones y únete a grupos."]
];
async function start(onFinish){
 if(active)return false;active=true;
 try{
  const driver=await load(),steps=cases.filter(c=>visible(c[0])).map(c=>({element:c[0],popover:{title:c[1],description:c[2],side:"bottom",align:"start"}}));
  if(!steps.length)throw Error("No hay elementos visibles en el recorrido");
  let finished=false;
  const finalize=()=>{if(finished)return;finished=true;active=false;if(typeof onFinish==="function")Promise.resolve().then(onFinish).catch(e=>console.warn("Error al guardar el recorrido",e));};
  const instance=driver({steps,showProgress:true,animate:true,allowClose:true,overlayClickBehavior:"none",stagePadding:9,stageRadius:13,popoverClass:"ou-tour-popover",nextBtnText:"Siguiente",prevBtnText:"Anterior",doneBtnText:"Finalizar",closeBtnLabel:"Cerrar recorrido",progressText:"{{current}} de {{total}}",onDoneClick:()=>instance.destroy(),onDestroyed:finalize});
  instance.drive();return true;
 }catch(e){active=false;console.warn("No se pudo mostrar el recorrido",e);return false;}
}
window.OdontoTour={start};
document.addEventListener("click",e=>{const trigger=e.target.closest("[data-tour-trigger]");if(!trigger)return;e.preventDefault();void start();});
})();