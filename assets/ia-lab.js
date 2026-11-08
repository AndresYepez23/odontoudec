(()=>{"use strict";
const tools=[["resumir","✍️","Redactar y resumir","Explica ideas, mejora textos y crea resúmenes","Texto","apathy-exe/Qwen3.8-27B","apathy-exe-qwen3-8-27b","Qwen · asistente","Utiliza textos de ejemplo o apuntes propios. Comprueba siempre las respuestas."],["imagenes","🎨","Crear imágenes","Convierte tus ideas escritas en ilustraciones","Imagen","black-forest-labs/FLUX.1-schnell","black-forest-labs-flux-1-schnell","FLUX Schnell","Describe en detalle la imagen. Las generaciones públicas pueden tener cola."],["fondo","🪄","Quitar fondos","Obtén una imagen PNG de fondo transparente","Imagen","not-lain/background-removal","not-lain-background-removal","Background Removal","Usa fotos propias o autorizadas. Los bordes complejos pueden necesitar retoques."],["transcribir","🎙️","Audio a texto","Convierte una grabación en texto","Audio","openai/whisper","openai-whisper","Whisper","Revisa cuidadosamente nombres, términos médicos y errores de transcripción."],["ocr","📄","Foto o PDF a texto","Reconoce texto dentro de documentos o imágenes","Documento","baidu/Unlimited-OCR","baidu-unlimited-ocr","Unlimited OCR","Evita subir documentos clínicos, privados o con datos de terceros."],["traducir","🌍","Traducir textos","Traduce entre idiomas sin buscar modelos","Texto","Qwen/Qwen3-MT-Demo","qwen-qwen3-mt-demo","Qwen MT","Comprueba términos académicos o científicos en el resultado."],["voz","🔊","Texto a voz","Genera un audio a partir de texto escrito","Audio","ResembleAI/Chatterbox-Multilingual-TTS","resembleai-chatterbox-multilingual-tts","Chatterbox","No utilices voces de terceros sin autorización. Comprueba idiomas disponibles."],["mejorar","🔎","Mejorar fotos","Aumenta la resolución de una imagen","Imagen","gokaygokay/AuraSR-v2","gokaygokay-aurasr-v2","AuraSR v2","La IA puede inventar detalles. No uses la imagen mejorada para interpretar hallazgos clínicos."]];
const byId=id=>document.getElementById(id);
const list=byId("iaOptions"),category=byId("iaFilter"),name=byId("iaName"),desc=byId("iaDesc"),provider=byId("iaProvider"),note=byId("iaNote"),space=byId("iaSpace"),open=byId("iaOpen"),run=byId("iaRun"),status=byId("iaStatus");
if(!list||!run||!space)return;
let selected=tools[0],frame=null;
function choose(t){
 selected=t;name.textContent=t[2];desc.textContent=t[3];provider.textContent=t[7];note.textContent=t[8];
 open.href="https://huggingface.co/spaces/"+t[5];
 list.querySelectorAll("[data-task]").forEach(b=>{const match=b.dataset.task===t[0];b.classList.toggle("active",match);b.setAttribute("aria-pressed",String(match));});
 if(frame){frame.remove();frame=null;}space.classList.remove("ready");run.hidden=false;
 status.textContent="La aplicación externa se carga únicamente cuando pulsas «Usar herramienta».";
 try{history.replaceState(null,"","#tarea-"+t[0]);}catch(e){}
}
function render(){
 list.replaceChildren();
 for(const t of tools){
  if(category.value!=="Todas"&&t[4]!==category.value)continue;
  const button=document.createElement("button");button.type="button";button.className="ia-option";button.dataset.task=t[0];
  const emoji=document.createElement("span");emoji.className="ia-emoji";emoji.textContent=t[1];emoji.setAttribute("aria-hidden","true");
  const content=document.createElement("span"),title=document.createElement("strong"),small=document.createElement("small");
  title.textContent=t[2];small.textContent=t[3];content.append(title,small);button.append(emoji,content);
  button.addEventListener("click",()=>choose(t));list.append(button);
 } choose(selected);
}
run.addEventListener("click",()=>{
 if(frame)return;
 const iframe=document.createElement("iframe");iframe.className="ia-frame";iframe.title="IA para "+selected[2];
 iframe.referrerPolicy="strict-origin-when-cross-origin";
 iframe.allow="microphone; camera; clipboard-read; clipboard-write";
 iframe.src="https://"+selected[6]+".hf.space";frame=iframe;
 space.append(iframe);space.classList.add("ready");run.hidden=true;
 status.textContent="Cargando… Si la demo se suspende, solicita acceso o bloquea su visualización, usa «Abrir en Hugging Face».";
 iframe.addEventListener("load",()=>{if(frame===iframe)status.textContent="Herramienta externa abierta. Si no funciona o queda en blanco, prueba «Abrir en Hugging Face».";});
});
category.addEventListener("change",render);
render();choose(tools.find(t=>window.location.hash==="#tarea-"+t[0])||tools[0]);
})();