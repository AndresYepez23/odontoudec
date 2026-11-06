/* OdontoUdeC · Avisos en tiempo real para mensajes y actividad */
(() => {
  "use strict";
  if (new URLSearchParams(location.search).get("embed") === "1") return;
  const db = window.ouSupabaseClient;
  if (!db || !db.auth) return;

  const APP_ID = "odontoudec";
  const storageKey = userId => "ou-notifications-v1:" + userId;
  const state = { user: null, cursor: null, seen: new Set(), timer: null, audioReady: false, sound: false, busy: false };
  const routes = { private: "/mensajes.html", group: "/grupos-estudio.html", community: "/chat.html", post: "/#comunidad" };

  const style = document.createElement("style");
  style.textContent = `
    #ouNoticeControl{position:fixed;z-index:9990;left:16px;bottom:16px;border:1px solid #e5d9ef;border-radius:999px;background:#fff;color:#32105f;padding:8px 12px;font:700 12px system-ui;box-shadow:0 5px 20px #24103b20;cursor:pointer}
    #ouNoticeToast{position:fixed;z-index:9999;left:16px;bottom:62px;width:min(340px,calc(100vw - 32px));display:grid;gap:5px;padding:13px 15px;border:1px solid #e6d9f0;border-radius:14px;background:#fff;color:#26133c;box-shadow:0 12px 35px #24103b28;font:14px/1.4 system-ui;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s,transform .18s}
    #ouNoticeToast.ou-show{opacity:1;transform:translateY(0);pointer-events:auto}
    #ouNoticeToast strong{color:#32105f}#ouNoticeToast a{color:#6e35a4;font-weight:750;text-decoration:none}
    #ouNoticeToast button{justify-self:start;border:0;border-radius:8px;background:#f2ebf8;color:#32105f;padding:6px 9px;font-weight:700;cursor:pointer}
    @media(max-width:480px){#ouNoticeControl{left:10px;bottom:10px}#ouNoticeToast{left:10px;bottom:54px;width:calc(100vw - 20px)}}
  `;
  document.head.appendChild(style);
  const control = document.createElement("button");
  control.id = "ouNoticeControl";
  control.type = "button";
  control.textContent = "♧ Activar avisos";
  control.setAttribute("aria-label", "Activar notificaciones y sonido");
  document.body.appendChild(control);
  const toast = document.createElement("div");
  toast.id = "ouNoticeToast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  let toastTimer = null;
  function showToast(title, body, href) {
    toast.replaceChildren();
    const strong = document.createElement("strong"); strong.textContent = title;
    const message = document.createElement("span"); message.textContent = body;
    const link = document.createElement("a"); link.href = href; link.textContent = "Abrir conversación →";
    toast.append(strong, message, link);
    toast.classList.add("ou-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("ou-show"), 6500);
  }
  function beep() {
    if (!state.sound || !state.audioReady || document.hidden) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + .12);
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.09, ctx.currentTime + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .22);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .23);
      osc.onended = () => ctx.close();
    } catch (_) {}
  }
  function notify(title, body, href, key) {
    if (state.seen.has(key)) return;
    state.seen.add(key);
    if (state.seen.size > 250) state.seen = new Set([...state.seen].slice(-150));
    if (document.hidden) {
      // Las notificaciones del sistema en segundo plano las entrega OneSignal.
      // Evitamos crear una segunda notificación nativa para el mismo evento.
      return;
    }
    showToast(title, body, href);
    beep();
  }
  control.addEventListener("click", async () => {
    state.audioReady = true;
    state.sound = !state.sound;
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch (_) {}
    }
    const granted = "Notification" in window && Notification.permission === "granted";
    control.textContent = (state.sound ? "♪ Sonido activo" : "♪ Sonido apagado") + (granted ? " · Push permitido" : " · Avisos en pantalla");
    if (state.sound) beep();
  });
  document.addEventListener("pointerdown", () => { state.audioReady = true; }, { once: true, passive: true });
  document.addEventListener("keydown", () => { state.audioReady = true; }, { once: true });

  function readState(userId) {
    try { return JSON.parse(sessionStorage.getItem(storageKey(userId)) || "null"); } catch (_) { return null; }
  }
  function saveState() {
    if (!state.user || !state.cursor) return;
    try { sessionStorage.setItem(storageKey(state.user.id), JSON.stringify(state.cursor)); } catch (_) {}
  }
  async function latest(table, column, filters) {
    let q = db.from(table).select(column + ",created_at").order("created_at", { ascending: false }).limit(1);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    return data?.[0]?.created_at || new Date().toISOString();
  }
  async function pollTable(table, select, cursor, filters, handler) {
    let q = db.from(table).select(select).gt("created_at", cursor).order("created_at", { ascending: true }).limit(60);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) return cursor;
    for (const row of data || []) handler(row);
    if (data?.length) return data[data.length - 1].created_at;
    return cursor;
  }
  async function seed(user) {
    const old = readState(user.id);
    if (old) { state.cursor = old; return; }
    const cursor = {};
    const tables = [
      ["private", "private_messages", q => q],
      ["groups", "study_group_messages", q => q],
      ["community", "chat_messages", q => q],
      ["posts", "posts", q => q],
      ["comments", "post_comments", q => q],
      ["reactions", "post_reactions", q => q]
    ];
    await Promise.all(tables.map(async ([key, table]) => {
      try { cursor[key] = await latest(table, "id", q => q); }
      catch (_) { cursor[key] = new Date().toISOString(); }
    }));
    state.cursor = cursor;
    saveState();
  }
  async function checkPrivate(user) {
    const { data: convs, error } = await db.from("private_conversations").select("id,user_one,user_two").or("user_one.eq." + user.id + ",user_two.eq." + user.id).limit(100);
    if (error || !convs?.length) return;
    const ids = convs.map(c => c.id);
    const names = new Map();
    const { data: people } = await db.from("profiles").select("id,display_name");
    (people || []).forEach(p => names.set(p.id, p.display_name || "Estudiante"));
    state.cursor.private = await pollTable("private_messages", "id,conversation_id,sender_id,content,created_at", state.cursor.private,
      q => q.in("conversation_id", ids).neq("sender_id", user.id),
      m => notify("Nuevo mensaje privado", (names.get(m.sender_id) || "Un estudiante") + " te envió un mensaje.", routes.private, "pm:" + m.id));
  }
  async function checkGroups(user) {
    const { data: memberships, error } = await db.from("study_group_members").select("group_id").eq("user_id", user.id);
    if (error || !memberships?.length) return;
    const ids = memberships.map(m => m.group_id);
    const { data: groups } = await db.from("study_groups").select("id,name").in("id", ids);
    const names = new Map((groups || []).map(g => [g.id, g.name]));
    state.cursor.groups = await pollTable("study_group_messages", "id,group_id,sender_id,content,created_at", state.cursor.groups,
      q => q.in("group_id", ids).neq("sender_id", user.id),
      m => notify("Nuevo mensaje en " + (names.get(m.group_id) || "un grupo"), "Hay un mensaje nuevo en tu grupo de estudio.", routes.group, "gm:" + m.id));
  }
  async function checkCommunity(user) {
    state.cursor.community = await pollTable("chat_messages", "id,user_id,display_name,content,created_at", state.cursor.community,
      q => q.neq("user_id", user.id),
      m => notify("Nuevo mensaje en la comunidad", (m.display_name || "Un estudiante") + " escribió en el chat general.", routes.community, "cm:" + m.id));
  }
  async function checkPosts(user) {
    state.cursor.posts = await pollTable("posts", "id,author_id,title,content,created_at", state.cursor.posts,
      q => q.neq("author_id", user.id),
      p => notify("Nueva publicación en la comunidad", p.title || (p.content || "Un estudiante compartió una publicación.").slice(0, 120), routes.post, "post:" + p.id));

    const { data: posts, error } = await db.from("posts").select("id").eq("author_id", user.id).limit(100);
    if (!error && posts?.length) {
      const ids = posts.map(p => p.id);
      state.cursor.comments = await pollTable("post_comments", "id,post_id,author_id,content,created_at", state.cursor.comments,
        q => q.in("post_id", ids).neq("author_id", user.id),
        m => notify("Nuevo comentario en tu publicación", "Un estudiante comentó una publicación tuya.", routes.post, "pc:" + m.id));
      state.cursor.reactions = await pollTable("post_reactions", "id,post_id,user_id,reaction,created_at", state.cursor.reactions,
        q => q.in("post_id", ids).neq("user_id", user.id),
        m => notify("Nueva reacción a tu publicación", "Alguien reaccionó a una publicación tuya.", routes.post, "pr:" + m.id));
    }
  }
  async function cycle() {
    if (!state.user || state.busy || !navigator.onLine) return;
    state.busy = true;
    try {
      await Promise.all([checkPrivate(state.user), checkGroups(state.user), checkCommunity(state.user), checkPosts(state.user)]);
      saveState();
    } finally { state.busy = false; }
  }
  async function applySession(session) {
    const user = session?.user || null;
    if (user?.id === state.user?.id) return;
    if (state.timer) clearInterval(state.timer);
    state.timer = null; state.user = user; state.cursor = null; state.seen.clear();
    if (!user) { control.style.display = "none"; toast.classList.remove("ou-show"); return; }
    control.style.display = "block";
    control.textContent = "♧ Activar avisos";
    await seed(user);
    await cycle();
    state.timer = setInterval(cycle, 18000);
  }
  db.auth.onAuthStateChange((_event, session) => { void applySession(session); });
  db.auth.getSession().then(({ data }) => applySession(data?.session || null)).catch(() => {});
})();
