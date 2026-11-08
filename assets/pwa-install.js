(()=>{"use strict";
const button=document.getElementById("installPwaButton"),help=document.getElementById("pwaInstallHelp");
if(!button||!help||window.top!==window.self)return;
const standalone=window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches||navigator.standalone===true;
if(standalone){button.hidden=true;help.hidden=true;return;}
const ua=navigator.userAgent||"";
const ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const android=/Android/i.test(ua);
let promptEvent=null;
const icons={
 apple:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12.1c.1-2 1.6-3.1 1.7-3.2-.9-1.3-2.3-1.5-2.8-1.5-1.2-.1-2.4.7-3 .7-.6 0-1.5-.7-2.5-.7-1.3 0-2.5.8-3.2 1.9-1.4 2.4-.4 5.9 1 7.9.7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6s1.6.6 2.6.6c1.1 0 1.7-1 2.4-2 .8-1.2 1.1-2.3 1.2-2.4-2.3-.9-2.5-2.7-2.5-2.7zM14.7 6.1c.6-.7 1-1.7.9-2.7-.9.1-2 .6-2.6 1.3-.6.6-1.1 1.6-1 2.5 1 .1 2-.4 2.7-1.1z"/></svg>',
 android:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.2a7.7 7.7 0 0 1 14 0H5zm1.5-4.8.9-.5 1.4 2.2-.9.5-1.4-2.2zm10 0 .9.5-1.4 2.2-.9-.5 1.4-2.2zM5 9.3h14v8.2a2 2 0 0 1-2 2h-1v2.1h-2v-2.1h-4v2.1H8v-2.1H7a2 2 0 0 1-2-2V9.3zm4 3.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>',
 desktop:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7v2h4v2H7v-2h4v-2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v11h16V5H4zm8 2a1 1 0 0 1 1 1v3.6l1.3-1.3 1.4 1.4-3.7 3.7-3.7-3.7 1.4-1.4 1.3 1.3V8a1 1 0 0 1 1-1z"/></svg>'
};
const platform=ios?"apple":android?"android":"desktop";
const label=ios?"Instalar en iPhone o iPad":android?"Instalar en Android":"Instalar en mi computador";
function render(){button.replaceChildren();const icon=document.createElement("span");icon.className="pwa-platform-icon";icon.setAttribute("aria-hidden","true");icon.innerHTML=icons[platform];const span=document.createElement("span");span.textContent=label;button.append(icon,span);}
render();
button.hidden=false;
function explain(message){help.textContent=message;help.hidden=false;button.setAttribute("aria-expanded","true");}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();promptEvent=e;button.hidden=false;});
button.addEventListener("click",async()=>{
 if(promptEvent){const p=promptEvent;promptEvent=null;try{await p.prompt();const choice=await p.userChoice;if(choice?.outcome==="accepted"){button.hidden=true;help.hidden=true;}else explain("Puedes volver a instalar OdontoUdeC desde el menú de instalación de tu navegador.");}catch(error){console.warn("[PWA] Instalación no disponible:",error);explain("Abre el menú de tu navegador y selecciona Instalar aplicación o Añadir a pantalla de inicio.");}return;}
 if(ios)explain("En Safari, toca Compartir y luego Añadir a pantalla de inicio. Confirma con Añadir. OdontoUdeC se abrirá como una aplicación web, sin las barras del navegador. No necesitas App Store.");
 else if(android)explain("En Chrome, abre el menú ⋮ y selecciona Instalar aplicación o Añadir a pantalla de inicio. No necesitas descargar nada desde Google Play.");
 else explain("En Chrome o Edge, busca el icono Instalar en la barra de direcciones o abre el menú del navegador y selecciona Instalar aplicación. Disponible cuando el navegador permita instalar esta PWA.");
});
window.addEventListener("appinstalled",()=>{button.hidden=true;help.hidden=true;});
})();