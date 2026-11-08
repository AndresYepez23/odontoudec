/* OdontoUdeC · Video independiente del chat textual, con Daily Prebuilt. */
(() => {
  "use strict";
  if (window.OdontoVideo) return;
  let active = null, sdkLoading = null;
  const svg = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>';

  function toast(message) {
    document.querySelector(".ou-video-toast")?.remove();
    const node = document.createElement("div");
    node.className = "ou-video-toast";
    node.setAttribute("role", "status");
    node.textContent = message;
    document.body.append(node);
    window.setTimeout(() => node.remove(), 4200);
  }

  function sdk() {
    if (window.DailyIframe || window.Daily) return Promise.resolve(window.DailyIframe || window.Daily);
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@daily-co/daily-js@0.94.0";
      script.crossOrigin = "anonymous";
      script.onload = () => {
        const daily = window.DailyIframe || window.Daily;
        daily ? resolve(daily) : reject(new Error("No fue posible cargar el reproductor de video."));
      };
      script.onerror = () => reject(new Error("No fue posible descargar el reproductor de video."));
      document.head.append(script);
    }).catch(error => { sdkLoading = null; throw error; });
    return sdkLoading;
  }

  async function open(context, { db, onClose } = {}) {
    if (active) { active.modal.querySelector(".ou-video-exit")?.focus(); return; }
    if (!context || !["community", "private", "groups"].includes(context.scope)) {
      toast("Abre primero una conversación o un grupo para iniciar la videollamada.");
      return;
    }
    const modal = document.createElement("div");
    modal.className = "ou-video-overlay";
    modal.innerHTML = '<section class="ou-video-window" role="dialog" aria-modal="true" aria-labelledby="ouVideoTitle"><header class="ou-video-head"><span class="ou-video-camera">' + svg + '</span><div class="ou-video-heading"><strong id="ouVideoTitle">Videollamada · OdontoUdeC</strong><small id="ouVideoRoom"></small></div><button class="ou-video-exit" type="button" aria-label="Salir de la videollamada">✕ <span>Salir</span></button></header><div class="ou-video-stage" id="ouVideoStage"><div class="ou-video-wait"><span class="ou-video-spinner" aria-hidden="true"></span><strong>Preparando la videollamada…</strong><p>Podrás decidir si habilitas la cámara y el micrófono antes de entrar.</p></div></div><footer class="ou-video-footer"><span class="ou-video-dot" aria-hidden="true"></span><span id="ouVideoState" role="status" aria-live="polite">Conectando de forma segura</span><span class="ou-video-daily">Video por Daily</span></footer></section>';
    modal.querySelector("#ouVideoRoom").textContent = String(context.label || (context.scope === "community" ? "Sala comunitaria" : "Conversación")).slice(0, 95);
    document.body.append(modal);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = null, closing = false;
    const state = { modal };
    active = state;
    const stateLabel = modal.querySelector("#ouVideoState");
    const stage = modal.querySelector("#ouVideoStage");
    const release = async () => {
      if (closing) return;
      closing = true;
      modal.querySelector(".ou-video-exit").disabled = true;
      try {
        if (frame) { await frame.leave().catch(() => {}); frame.destroy(); }
      } catch (_) {}
      if (active === state) active = null;
      modal.remove();
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      if (typeof onClose === "function") onClose();
    };
    function onKey(event) {
      if (event.key === "Escape" && !event.repeat) release();
    }
    document.addEventListener("keydown", onKey);
    modal.querySelector(".ou-video-exit").addEventListener("click", release);
    modal.querySelector(".ou-video-exit").focus();

    try {
      const client = db || window.ouSupabaseClient;
      if (!client?.auth) throw new Error("Inicia sesión en OdontoUdeC para usar las videollamadas.");
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session?.access_token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      const res = await fetch("/.netlify/functions/daily-call", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
        body: JSON.stringify({ scope: context.scope, id: context.id || null }),
        cache: "no-store"
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "No se pudo preparar la videollamada.");
      if (closing) return;
      stateLabel.textContent = "Preparando cámara y micrófono";
      const daily = await sdk();
      if (closing) return;
      stage.replaceChildren();
      frame = daily.createFrame(stage, {
        showLeaveButton: true,
        iframeStyle: { width: "100%", height: "100%", position: "relative", border: "0" }
      });
      frame.on("joined-meeting", () => { stateLabel.textContent = "Conectado · Sala privada"; });
      frame.on("left-meeting", () => { void release(); });
      frame.on("error", () => { stateLabel.textContent = "Se produjo un error de conexión."; });
      await frame.join({ url: payload.url, token: payload.token });
    } catch (err) {
      if (closing) return;
      stage.innerHTML = '<div class="ou-video-error"><strong>No se pudo iniciar la videollamada</strong><p></p><button type="button">Volver al chat</button></div>';
      stage.querySelector("p").textContent = err?.message || "No se pudo establecer la conexión.";
      stage.querySelector("button").addEventListener("click", release);
      stateLabel.textContent = "Sin conexión";
    }
  }

  function mountAction({ host, before, resolve, db }) {
    if (!host || typeof resolve !== "function") return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ou-video-trigger";
    button.title = "Iniciar o unirse a una videollamada";
    button.setAttribute("aria-label", "Iniciar o unirse a una videollamada");
    button.innerHTML = svg + '<span class="ou-video-action-text">Videollamada</span>';
    host.insertBefore(button, before || null);
    const refresh = () => { button.hidden = !resolve(); };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    button.addEventListener("click", () => {
      const context = resolve();
      if (!context) { toast("Selecciona primero un chat o un grupo para usar videollamadas."); return; }
      const embedded = new URLSearchParams(location.search).get("embed") === "1" && window.parent !== window;
      if (embedded) {
        window.parent.postMessage({ type: "odontoudec:video-request", context }, location.origin);
      } else {
        void open(context, { db });
      }
    });
    window.addEventListener("message", event => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (event.data?.type !== "odontoudec:video-activate") return;
      if (button.hidden) toast("Abre una conversación o un grupo antes de iniciar una videollamada.");
      else button.click();
    });
    return { button, refresh, destroy: () => observer.disconnect() };
  }
  window.OdontoVideo = { open, mountAction };
})();
