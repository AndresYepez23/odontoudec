(() => {
  const db = window.odontoDb;
  if (!db) return;
  const extraAtlas = {
    desarrollo:[["bud","Lámina dental","Engrosamiento epitelial que inicia el desarrollo de los órganos dentarios.","Explícame la lámina dental"],["bud","Etapa de brote","Proliferación epitelial que forma brotes dentro del ectomesénquima.","Explícame la etapa de brote"],["dentin","Etapa de casquete","Se distinguen órgano del esmalte, papila dental y folículo dental.","Explícame la etapa de casquete"],["pulp","Etapa de campana","Se diferencian tejidos y se define la morfología de la corona.","Explícame la etapa de campana"],["enamel","Amelogénesis","Proceso de formación y maduración del esmalte por los ameloblastos.","Explícame la amelogénesis"],["dentin","Dentinogénesis","Proceso de formación de dentina por los odontoblastos.","Explícame la dentinogénesis"]],
    oclusion:[["incisor","Guía anterior","Participación de los dientes anteriores en determinados movimientos excursivos mandibulares.","Explícame la guía anterior"],["molar","Relación céntrica","Relación maxilomandibular de referencia definida por la posición articular, independiente del contacto dentario.","Explícame la relación céntrica"],["premolar","Máxima intercuspidación","Posición de máximo engranaje entre dientes antagonistas, determinada por los contactos dentarios.","Explícame la máxima intercuspidación"],["canine","Guía canina","Esquema en el que el contacto de caninos guía la lateralidad y puede desocluir dientes posteriores.","Explícame la guía canina"],["occlusal","Dimensión vertical","Relación de distancia entre dos puntos anatómicos seleccionados en sentido vertical.","Explícame la dimensión vertical"]],
    histologia:[["enamel","Unión amelodentinaria","Interfaz ondulada entre esmalte y dentina que contribuye a su unión mecánica.","Explícame la unión amelodentinaria"],["dentin","Predentina","Matriz dentinaria orgánica recién secretada, todavía no mineralizada, situada junto a los odontoblastos.","Explícame la predentina"],["pulp","Complejo dentinopulpar","Unidad funcional formada por dentina y pulpa, relacionadas estructural y fisiológicamente.","Explícame el complejo dentinopulpar"],["gum","Epitelio de unión","Epitelio especializado que establece la unión entre la encía y la superficie dentaria.","Explícame el epitelio de unión"],["cementum","Cemento acelular","Tipo de cemento radicular que suele predominar en regiones cervicales y carece de cementocitos.","Explícame el cemento acelular"],["bone","Hueso alveolar propio","Porción del proceso alveolar que reviste el alveolo y recibe fibras de inserción periodontal.","Explícame el hueso alveolar propio"]]
  };
  if (typeof atlasTopics !== "undefined") Object.assign(atlasTopics,extraAtlas);
  const tabHost=document.querySelector(".atlas-tabs");
  if(tabHost)[["desarrollo","Desarrollo dental"],["oclusion","Oclusión"],["histologia","Histología oral"]].forEach(([key,label])=>{
    if(tabHost.querySelector('[data-atlas="'+key+'"]'))return;
    const b=document.createElement("button");b.className="atlas-tab";b.dataset.atlas=key;b.textContent=label;
    b.addEventListener("click",()=>{tabHost.querySelectorAll(".atlas-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderAtlas(key);});tabHost.appendChild(b);
  });

  const oldInput=document.getElementById("botInput"),oldAsk=document.getElementById("askBot");
  if(oldInput&&oldAsk){
    const input=oldInput.cloneNode(true),ask=oldAsk.cloneNode(true);oldInput.replaceWith(input);oldAsk.replaceWith(ask);
    const log=document.getElementById("chatlog"),status=document.getElementById("botStatus");let history=[];
    async function send(question){
      question=question.trim();if(!question)return;
      const {data:{session}}=await db.auth.getSession();
      if(!session){status.textContent="Inicia sesión en OdontoUdeC para conversar con OdontoBot.";return;}
      const u=document.createElement("div");u.className="bubble you";u.textContent=question;log.appendChild(u);
      const pending=document.createElement("div");pending.className="bubble bot";pending.textContent="OdontoBot está pensando...";log.appendChild(pending);
      history.push({role:"user",content:question});input.value="";ask.disabled=true;status.textContent="Consultando la IA...";
      try{const {data,error}=await db.functions.invoke("odonto-bot",{body:{messages:history}});if(error)throw error;if(!data?.reply)throw new Error(data?.error||"No llegó una respuesta.");pending.textContent=data.reply;history.push({role:"assistant",content:data.reply});status.textContent="Respuesta generada con IA.";}
      catch(e){pending.textContent="No pude conectar con OdontoBot: "+(e.message||"inténtalo de nuevo.");history.pop();status.textContent="Comprueba que la función y la clave de OpenAI estén configuradas.";}
      finally{ask.disabled=false;log.scrollTop=log.scrollHeight;}
    }
    ask.addEventListener("click",()=>send(input.value));input.addEventListener("keydown",e=>{if(e.key==="Enter")send(input.value);});
    document.querySelectorAll(".bot-topic").forEach(old=>{const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener("click",()=>send(b.textContent));});
    status.textContent="Asistente con IA. Inicia sesión para comenzar.";
  }

  const section=document.getElementById("trivia");if(!section)return;
  section.innerHTML='<div class="wrap"><div class="head"><span class="kicker">Aprendizaje activo · Competencia académica</span><h2>OdontoTrivia</h2><p>Entrena tus conocimientos, acumula puntos permanentes y compite con otros estudiantes de OdontoUdeC.</p></div><div class="trivia-layout"><div class="quiz"><div class="question"><div class="trivia-top"><span class="tag" id="qProgress">Preparando ronda...</span><span class="score" id="qScore">— / 100 puntos</span></div><div id="qMeta" class="muted"></div><h3 id="qText">Cargando preguntas...</h3><div id="answers" class="answers"></div><div id="feedback" class="feedback" aria-live="polite"></div><button id="nextQuestion" class="btn" style="margin-top:14px" hidden>Siguiente pregunta</button><button id="restartQuiz" class="btn alt" style="margin:14px 0 0" hidden>Jugar otra ronda</button></div><p id="triviaStatus" class="muted" aria-live="polite">Inicia sesión para registrar tus puntos.</p></div><aside class="question trivia-board"><span class="kicker">Clasificación global</span><h3>🏆 Ranking OdontoUdeC</h3><p class="muted">Puntos acumulados en tus rondas registradas.</p><div id="leaderboard"><p class="muted">Cargando ranking...</p></div><div class="note"><strong>Cómo se puntúa:</strong> 10 preguntas por ronda, 10 puntos por respuesta correcta. La calificación se valida en Supabase.</div></aside></div></div>';
  const style=document.createElement("style");style.textContent=".trivia-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);gap:18px;align-items:start}.trivia-board{position:sticky;top:90px}.trivia-board h3{color:var(--p);margin:8px 0}.trivia-top{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.leaderboard{display:grid;gap:8px}.leader-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:12px;background:#fff}.leader-rank,.leader-points{font-weight:900;color:var(--p)}.leader-name{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.leader-meta{font-size:.76rem;color:var(--muted)}@media(max-width:850px){.trivia-layout{grid-template-columns:1fr}.trivia-board{position:static}}";document.head.appendChild(style);
  const $=id=>document.getElementById(id);let round=[],index=0,chosen=[],locked=false;
  async function leaderboard(){
    const box=$("leaderboard"),{data,error}=await db.rpc("get_trivia_leaderboard",{limit_count:20});
    if(error){box.textContent="El ranking estará disponible cuando se configure Trivia en Supabase.";return;}
    if(!data?.length){box.textContent="Todavía no hay puntuaciones. ¡Sé el primero!";return;}
    box.className="leaderboard";box.innerHTML=data.map(r=>'<div class="leader-row"><span class="leader-rank">#'+r.position+'</span><div><div class="leader-name"></div><div class="leader-meta">'+r.rounds_played+' rondas · mejor '+r.best_score+'</div></div><span class="leader-points">'+r.total_points+' pts</span></div>').join("");
    box.querySelectorAll(".leader-name").forEach((el,i)=>el.textContent=data[i].display_name+(data[i].username?" · @"+data[i].username:""));
  }
  function render(){
    locked=false;const q=round[index];$("qProgress").textContent="Pregunta "+(index+1)+" de "+round.length;$("qMeta").textContent=q.category+" · Nivel "+q.difficulty;$("qText").textContent=q.question;$("qScore").textContent="— / 100 puntos";$("feedback").textContent="";$("nextQuestion").hidden=true;
    $("answers").innerHTML=q.options.map((_,i)=>'<button class="answer" data-i="'+i+'"></button>').join("");$("answers").querySelectorAll("button").forEach((b,i)=>{b.textContent=q.options[i];b.addEventListener("click",()=>choose(i));});
  }
  function choose(i){
    if(locked)return;locked=true;chosen.push({id:round[index].id,selected_index:i});$("answers").querySelectorAll("button").forEach((b,j)=>{b.disabled=true;if(j===i)b.style.borderColor="var(--p2)";});
    $("feedback").textContent="Respuesta registrada. La corrección se mostrará al terminar la ronda.";$("nextQuestion").textContent=index===round.length-1?"Calificar y guardar resultado":"Siguiente pregunta";$("nextQuestion").hidden=false;
  }
  async function finish(){
    $("nextQuestion").disabled=true;$("triviaStatus").textContent="Validando respuestas y guardando puntuación...";
    const {data,error}=await db.rpc("submit_trivia_attempt",{p_answers:chosen});$("nextQuestion").disabled=false;
    if(error){$("triviaStatus").textContent="No se pudo guardar la ronda: "+error.message;return;}
    $("qProgress").textContent="Ronda completada";$("qScore").textContent=data.score+" / 100 puntos";$("qText").textContent="¡Terminaste!";$("answers").innerHTML="";
    $("feedback").innerHTML="<strong>"+data.correct_answers+" de 10 respuestas correctas.</strong><ol>"+data.details.map(d=>"<li>"+(d.correct?"Correcta. ":"Incorrecta. ")+d.explanation+"</li>").join("")+"</ol>";
    $("nextQuestion").hidden=true;$("restartQuiz").hidden=false;$("triviaStatus").textContent="Puntuación guardada en tu cuenta.";await leaderboard();
  }
  async function start(){
    $("triviaStatus").textContent="Cargando ronda aleatoria...";const {data:{session}}=await db.auth.getSession();
    if(!session){$("qText").textContent="Inicia sesión para jugar";$("answers").innerHTML="";$("qProgress").textContent="Sesión requerida";$("triviaStatus").textContent="Tus resultados se guardan en tu perfil al iniciar sesión.";return;}
    const {data,error}=await db.rpc("get_trivia_round");
    if(error||!Array.isArray(data)||data.length!==10){$("qText").textContent="Trivia aún no está configurada";$("answers").innerHTML="";$("triviaStatus").textContent="Aplica la migración de OdontoTrivia en Supabase para activar las rondas.";return;}
    round=data;index=0;chosen=[];$("restartQuiz").hidden=true;render();$("triviaStatus").textContent="Ronda lista. ¡A jugar!";
  }
  $("nextQuestion").addEventListener("click",()=>{if(index<round.length-1){index++;render();}else finish();});$("restartQuiz").addEventListener("click",start);leaderboard();start();
})();