/* OdontoUdeC · Fotografías seguras para los chats existentes */
(() => {
  "use strict";

  const BUCKET = "chat-media";
  const PREFIX = "[[ODONTO_IMAGE_V1]]";
  const GIF_PREFIX = "[[ODONTO_GIF_V1]]";
  const MAX_INPUT = 15 * 1024 * 1024;
  const MAX_OUTPUT = 1400000;
  const MAX_CAPTION = 300;
  const signedCache = new Map();

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
  }

  function setStatus(callback, message) {
    if (typeof callback === "function") callback(message);
  }

  function validGifPreviewUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && /^media\d*\.giphy\.com$/i.test(url.hostname) && url.pathname.length > 1;
    } catch (_) {
      return false;
    }
  }

  function validGifId(value) {
    return /^[A-Za-z0-9_-]{1,120}$/.test(String(value || ""));
  }

  function normalizeGif(item) {
    if (!item?.id || !validGifId(String(item.id))) return null;
    const rendition = item?.images?.fixed_width || item?.images?.fixed_width_small || item?.images?.fixed_height_small || {};
    const previewMp4 = validGifPreviewUrl(rendition.mp4) ? rendition.mp4 : "";
    const previewWebp = validGifPreviewUrl(rendition.webp) ? rendition.webp : "";
    const previewUrl = validGifPreviewUrl(rendition.url) ? rendition.url : "";
    let source = "";
    try {
      const parsedSource = new URL(String(item.source || ""));
      if (parsedSource.protocol === "https:" || parsedSource.protocol === "http:") {
        source = parsedSource.hostname.replace(/^www\./i, "").slice(0, 45);
      }
    } catch (_) {}
    return {
      id: String(item.id),
      previewMp4,
      previewWebp,
      previewUrl,
      title: String(item.title || "GIF compartido").slice(0, 60),
      username: String(item.username || "").replace(/^@/, "").slice(0, 40),
      source,
      analytics: item.analytics || null
    };
  }

  function encodeGifContent(gif, caption) {
    if (!gif || !validGifId(gif.id)) throw new Error("Este GIF no es válido. Selecciona otro.");
    return GIF_PREFIX + JSON.stringify({
      id: String(gif.id),
      title: String(gif.title || "GIF compartido").slice(0, 60),
      username: String(gif.username || "").replace(/^@/, "").slice(0, 40),
      source: String(gif.source || "").slice(0, 45),
      caption: String(caption || "").trim().slice(0, 60)
    });
  }

  function parseGifContent(content) {
    const value = String(content ?? "");
    if (!value.startsWith(GIF_PREFIX)) return null;
    try {
      const data = JSON.parse(value.slice(GIF_PREFIX.length));
      if (!data || !validGifId(data.id)) return null;
      return {
        id: String(data.id),
        title: String(data.title || "GIF compartido").slice(0, 60),
        username: String(data.username || "").replace(/^@/, "").slice(0, 40),
        source: String(data.source || "").slice(0, 45),
        caption: String(data.caption || "").slice(0, 60)
      };
    } catch (_) {
      return null;
    }
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la fotografía.")), type, quality);
    });
  }

  async function loadBitmap(file) {
    if (typeof window.createImageBitmap === "function") {
      try {
        return await window.createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_) {
        return window.createImageBitmap(file);
      }
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("No se pudo abrir esa fotografía. Intenta con JPG o PNG."));
      });
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: image,
        close() { URL.revokeObjectURL(objectUrl); }
      };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  async function compressImage(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("Selecciona una fotografía o imagen válida.");
    }
    if (file.size > MAX_INPUT) {
      throw new Error("La imagen original supera 15 MB. Elige una más ligera.");
    }

    let bitmap;
    try {
      bitmap = await loadBitmap(file);
    } catch (error) {
      throw new Error(error?.message || "No se pudo abrir la imagen. Prueba con JPG o PNG.");
    }

    try {
      const width = bitmap.width;
      const height = bitmap.height;
      if (!width || !height) throw new Error("La imagen no tiene dimensiones válidas.");

      const plans = [
        { max: 1600, quality: 0.82 },
        { max: 1440, quality: 0.72 },
        { max: 1280, quality: 0.62 },
        { max: 1100, quality: 0.55 }
      ];

      let output = null;
      for (const plan of plans) {
        const scale = Math.min(1, plan.max / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("No se pudo preparar la imagen.");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap.draw || bitmap, 0, 0, canvas.width, canvas.height);

        output = await canvasBlob(canvas, "image/webp", plan.quality);
        if (output.type !== "image/webp") {
          output = await canvasBlob(canvas, "image/jpeg", plan.quality);
        }
        if (output.type !== "image/jpeg" && output.type !== "image/webp") {
          throw new Error("Este navegador no pudo convertir la fotografía a un formato compatible.");
        }
        if (output.size <= MAX_OUTPUT) break;
      }

      if (!output || output.size > MAX_OUTPUT) {
        throw new Error("La imagen sigue siendo demasiado pesada. Prueba con otra fotografía.");
      }

      const extension = output.type === "image/webp" ? "webp" : "jpg";
      return new File([output], "odontoudec-" + randomId() + "." + extension, {
        type: output.type,
        lastModified: Date.now()
      });
    } finally {
      if (typeof bitmap.close === "function") bitmap.close();
    }
  }

  function validPath(path) {
    if (typeof path !== "string" || path.includes("..") || path.startsWith("/")) return false;
    const parts = path.split("/");
    const id = /^[a-f0-9-]{32,36}$/i;
    const file = /^[a-f0-9-]{32,36}\.(?:webp|jpg)$/i;

    if (parts[0] === "community") {
      return parts.length === 3 && id.test(parts[1]) && file.test(parts[2]);
    }
    if (parts[0] === "private" || parts[0] === "groups") {
      return parts.length === 4 && id.test(parts[1]) && id.test(parts[2]) && file.test(parts[3]);
    }
    return false;
  }

  async function uploadImage(db, file, scope, scopeId, userId) {
    if (!userId) throw new Error("Inicia sesión para compartir fotografías.");
    const compressed = await compressImage(file);
    let folder;

    if (scope === "community") {
      folder = "community/" + userId;
    } else if (scope === "private" && scopeId) {
      folder = "private/" + scopeId + "/" + userId;
    } else if (scope === "groups" && scopeId) {
      folder = "groups/" + scopeId + "/" + userId;
    } else {
      throw new Error("No se pudo identificar la conversación.");
    }

    const extension = compressed.type === "image/webp" ? "webp" : "jpg";
    const path = folder + "/" + randomId() + "." + extension;
    const { error } = await db.storage.from(BUCKET).upload(path, compressed, {
      cacheControl: "3600",
      contentType: compressed.type,
      upsert: false
    });
    if (error) throw error;
    return { path, size: compressed.size, type: compressed.type };
  }

  async function removeAttachment(db, path) {
    if (!path || !validPath(path)) return;
    signedCache.delete(path);
    const { error } = await db.storage.from(BUCKET).remove([path]);
    if (error) console.warn("[OdontoUdeC] No se pudo retirar una imagen no enviada:", error.message);
  }

  function parseContent(content) {
    const value = String(content ?? "");
    if (!value.startsWith(PREFIX)) return { caption: value, path: null };

    try {
      const data = JSON.parse(value.slice(PREFIX.length));
      if (!data || !validPath(data.path)) return { caption: value, path: null };
      return {
        caption: String(data.caption || "").slice(0, MAX_CAPTION),
        path: data.path
      };
    } catch (_) {
      return { caption: value, path: null };
    }
  }

  function encodeContent(caption, path) {
    return PREFIX + JSON.stringify({
      path,
      caption: String(caption || "").trim().slice(0, MAX_CAPTION)
    });
  }

  async function signedUrl(db, path) {
    const cached = signedCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      throw error || new Error("No se pudo abrir la fotografía.");
    }
    signedCache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + 50 * 60 * 1000
    });
    return data.signedUrl;
  }

  async function renderMessageContent(container, content, db) {
    const rawContent = String(content ?? "");
    container.replaceChildren();
    container.classList.remove("chat-gif-message");

    if (rawContent.startsWith(GIF_PREFIX)) {
      const gif = parseGifContent(rawContent);
      container.classList.add("chat-gif-message");
      if (!gif) {
        container.textContent = "GIF no disponible.";
        return;
      }
      if (gif.caption) {
        const caption = document.createElement("span");
        caption.className = "chat-gif-caption";
        caption.textContent = gif.caption;
        container.appendChild(caption);
      }
      const frame = document.createElement("iframe");
      frame.className = "chat-gif-frame";
      frame.src = "https://giphy.com/embed/" + encodeURIComponent(gif.id);
      frame.title = gif.title || "GIF compartido de GIPHY";
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("scrolling", "no");
      container.appendChild(frame);

      if (gif.username || gif.source) {
        const creator = document.createElement("span");
        creator.className = "chat-gif-source";
        creator.textContent = gif.username ? "GIF de @" + gif.username : "Fuente: " + gif.source;
        container.appendChild(creator);
      }
      const credit = document.createElement("a");
      credit.className = "chat-gif-credit";
      credit.href = "https://giphy.com/";
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      credit.textContent = "Powered by GIPHY";
      container.appendChild(credit);
      return;
    }

    const parsed = parseContent(content);

    if (parsed.caption) {
      container.appendChild(document.createTextNode(parsed.caption));
    }
    if (!parsed.path) return;

    if (parsed.caption) container.appendChild(document.createElement("br"));

    try {
      const url = await signedUrl(db, parsed.path);
      const link = document.createElement("a");
      link.className = "chat-attachment-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "Abrir fotografía compartida");

      const image = document.createElement("img");
      image.className = "chat-attachment";
      image.src = url;
      image.alt = "Fotografía compartida en la conversación";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        link.replaceChildren(document.createTextNode("Fotografía no disponible"));
        link.classList.add("chat-attachment-unavailable");
      }, { once: true });

      link.appendChild(image);
      container.appendChild(link);
    } catch (_) {
      const unavailable = document.createElement("span");
      unavailable.className = "chat-attachment-unavailable";
      unavailable.textContent = "Fotografía no disponible para esta cuenta.";
      container.appendChild(unavailable);
    }
  }

  function mountComposer({ form, input, sendButton, status, db, getScope, getUser }) {
    if (!form || !input || !sendButton || !db) {
      throw new Error("No se pudo preparar el envío de fotografías.");
    }

    let row = input.closest(".compose, .row") || input.parentElement;
    if (!row) throw new Error("No se encontró el área de escritura.");
    if (row === form) {
      const composerRow = document.createElement("div");
      composerRow.className = "chat-compose-row";
      form.insertBefore(composerRow, input);
      composerRow.append(input, sendButton);
      row = composerRow;
      form.classList.add("chat-compose-form");
    } else {
      row.classList.add("chat-compose-row");
    }

    const originalRequired = input.required;
    let available = !input.disabled;
    const originalMaxLength = input.maxLength;
    let pendingFile = null;
    let pendingGif = null;
    let previewUrl = null;
    let busy = false;
    let giphyKey = null;
    let giphyKeyPromise = null;
    let gifSearchController = null;
    const gifRequestTimes = [];
    const giphyCustomerId = randomId();

    const controls = document.createElement("div");
    controls.className = "chat-attach-wrap";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "chat-attach-trigger";
    trigger.title = "Adjuntar fotografía";
    trigger.setAttribute("aria-label", "Adjuntar fotografía");
    trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-16A1.5 1.5 0 0 1 2.5 18v-9A1.5 1.5 0 0 1 4 7.5Z"/><circle cx="12" cy="13" r="3.4"/></svg>';

    const menu = document.createElement("div");
    menu.className = "chat-attach-menu";
    menu.hidden = true;

    const gallery = document.createElement("input");
    gallery.type = "file";
    gallery.accept = "image/*";
    gallery.className = "chat-file-input";
    gallery.tabIndex = -1;
    gallery.setAttribute("aria-hidden", "true");

    const camera = document.createElement("input");
    camera.type = "file";
    camera.accept = "image/*";
    camera.capture = "environment";
    camera.className = "chat-file-input";
    camera.tabIndex = -1;
    camera.setAttribute("aria-hidden", "true");

    const galleryButton = document.createElement("button");
    galleryButton.type = "button";
    galleryButton.textContent = "Elegir de galería";
    galleryButton.addEventListener("click", () => {
      menu.hidden = true;
      gallery.click();
    });

    const cameraButton = document.createElement("button");
    cameraButton.type = "button";
    cameraButton.textContent = "Tomar fotografía";
    cameraButton.addEventListener("click", () => {
      menu.hidden = true;
      camera.click();
    });

    menu.append(galleryButton, cameraButton);
    controls.append(trigger, menu, gallery, camera);
    row.insertBefore(controls, input);

    // Un único botón GIF compacto junto al adjunto; el selector va en body
    // para no quedar recortado por los paneles estrechos de conversación.
    const gifWrap = document.createElement("div");
    gifWrap.className = "chat-gif-wrap";
    const gifTrigger = document.createElement("button");
    gifTrigger.type = "button";
    gifTrigger.className = "chat-gif-trigger";
    gifTrigger.textContent = "GIF";
    gifTrigger.title = "Buscar GIF";
    gifTrigger.setAttribute("aria-label", "Buscar y enviar un GIF");
    gifTrigger.setAttribute("aria-expanded", "false");
    gifTrigger.disabled = !available;

    const gifPicker = document.createElement("section");
    gifPicker.className = "chat-gif-picker";
    gifPicker.hidden = true;
    gifPicker.setAttribute("role", "dialog");
    gifPicker.setAttribute("aria-label", "Buscar GIF en GIPHY");
    gifPicker.innerHTML = '<div class="chat-gif-picker-head"><strong>GIFs para tu chat</strong><button type="button" class="chat-gif-close" aria-label="Cerrar buscador GIF">×</button></div><form class="chat-gif-search"><input type="search" maxlength="50" placeholder="Buscar en GIPHY…" aria-label="Buscar GIF"><button type="submit">Buscar</button></form><div class="chat-gif-grid" aria-live="polite"><p class="chat-gif-empty">Abre el buscador para ver los GIF populares.</p></div><footer class="chat-gif-footer"><span>Powered by GIPHY</span><span>Contenido filtrado · PG</span></footer>';
    const gifSearchForm = gifPicker.querySelector(".chat-gif-search");
    const gifSearchInput = gifPicker.querySelector('input[type="search"]');
    const gifGrid = gifPicker.querySelector(".chat-gif-grid");
    const gifClose = gifPicker.querySelector(".chat-gif-close");
    gifWrap.appendChild(gifTrigger);
    row.insertBefore(gifWrap, input);
    document.body.appendChild(gifPicker);

    const preview = document.createElement("div");
    preview.className = "chat-attachment-preview";
    preview.hidden = true;
    form.insertBefore(preview, row);

    function report(message) {
      if (status) status.textContent = message || "";
    }

    function revokePreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    function clear() {
      revokePreview();
      pendingFile = null;
      pendingGif = null;
      preview.hidden = true;
      preview.replaceChildren();
      gallery.value = "";
      camera.value = "";
      input.required = originalRequired;
      if (originalMaxLength > 0) input.maxLength = originalMaxLength;
    }

    function selectGif(gif) {
      if (!gif || !validGifId(gif.id)) return;
      clear();
      pendingGif = {
        id: gif.id,
        title: gif.title || "GIF compartido",
        username: gif.username || "",
        source: gif.source || "",
        analytics: gif.analytics || null
      };
      input.required = false;
      input.maxLength = Math.min(originalMaxLength > 0 ? originalMaxLength : 60, 60);

      let thumbnail;
      if (gif.previewWebp || gif.previewUrl) {
        thumbnail = document.createElement("img");
        thumbnail.className = "chat-preview-thumb chat-gif-preview-thumb";
        thumbnail.src = gif.previewWebp || gif.previewUrl;
        thumbnail.alt = gif.title || "GIF seleccionado";
      } else {
        thumbnail = document.createElement("iframe");
        thumbnail.className = "chat-preview-thumb chat-gif-preview-frame";
        thumbnail.src = "https://giphy.com/embed/" + encodeURIComponent(gif.id);
        thumbnail.title = gif.title || "GIF seleccionado";
        thumbnail.setAttribute("allowfullscreen", "");
      }
      const details = document.createElement("div");
      details.className = "chat-preview-details";
      const title = document.createElement("strong");
      title.textContent = "GIF listo para enviar";
      const subtitle = document.createElement("span");
      subtitle.textContent = "Powered by GIPHY · Puedes añadir un texto";
      details.append(title, subtitle);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chat-preview-remove";
      remove.textContent = "Quitar";
      remove.addEventListener("click", () => {
        clear();
        report("GIF retirado. Puedes seguir escribiendo.");
      });
      preview.append(thumbnail, details, remove);
      preview.hidden = false;
      closeGifPicker();
      report("GIF seleccionado. Pulsa Enviar para compartirlo.");
    }

    function selectFile(file) {
      if (!file) return;
      if (!String(file.type || "").startsWith("image/")) {
        report("Selecciona una fotografía o imagen válida.");
        return;
      }
      if (file.size > MAX_INPUT) {
        report("La imagen supera 15 MB. Elige una más ligera.");
        return;
      }

      clear();
      pendingFile = file;
      previewUrl = URL.createObjectURL(file);
      input.required = false;
      input.maxLength = MAX_CAPTION;

      const thumbnail = document.createElement("img");
      thumbnail.className = "chat-preview-thumb";
      thumbnail.src = previewUrl;
      thumbnail.alt = "Vista previa de la fotografía";

      const details = document.createElement("div");
      details.className = "chat-preview-details";
      const title = document.createElement("strong");
      title.textContent = "Fotografía lista";
      const subtitle = document.createElement("span");
      subtitle.textContent = "Se optimizará antes de enviarse";
      details.append(title, subtitle);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chat-preview-remove";
      remove.textContent = "Quitar";
      remove.addEventListener("click", () => {
        clear();
        report("Fotografía retirada. Puedes seguir escribiendo.");
      });

      preview.append(thumbnail, details, remove);
      preview.hidden = false;
      report("Puedes añadir un texto de hasta 300 caracteres o enviar solo la fotografía.");
    }

    gallery.addEventListener("change", () => {
      selectFile(gallery.files?.[0]);
      gallery.value = "";
    });
    camera.addEventListener("change", () => {
      selectFile(camera.files?.[0]);
      camera.value = "";
    });

    function closeGifPicker() {
      gifPicker.hidden = true;
      gifTrigger.setAttribute("aria-expanded", "false");
      if (gifSearchController) {
        gifSearchController.abort();
        gifSearchController = null;
      }
      // GIPHY no permite cachear respuestas ni URLs de medios: se descartan
      // los resultados en cuanto se cierra el selector.
      gifGrid.replaceChildren();
    }

    function positionGifPicker() {
      const rect = gifTrigger.getBoundingClientRect();
      const width = Math.max(200, Math.min(340, window.innerWidth - 24));
      const maxHeight = Math.max(220, Math.min(370, window.innerHeight - 24));
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      let top = rect.top - maxHeight - 8;
      if (top < 12) top = Math.min(window.innerHeight - maxHeight - 12, rect.bottom + 8);
      gifPicker.style.width = width + "px";
      gifPicker.style.maxHeight = maxHeight + "px";
      gifPicker.style.left = left + "px";
      gifPicker.style.top = Math.max(12, top) + "px";
    }

    function showGifMessage(message, isError) {
      gifGrid.replaceChildren();
      const note = document.createElement("p");
      note.className = "chat-gif-empty" + (isError ? " is-error" : "");
      note.textContent = message;
      gifGrid.appendChild(note);
    }

    function trackGiphyAction(gif, action) {
      const rawUrl = gif?.analytics?.[action]?.url;
      if (!rawUrl) return;
      try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:" || url.hostname !== "giphy-analytics.giphy.com") return;
        url.searchParams.set("ts", String(Date.now()));
        url.searchParams.set("customer_id", giphyCustomerId);
        fetch(url.toString(), { method: "GET", mode: "no-cors", credentials: "omit", cache: "no-store", keepalive: true }).catch(() => {});
      } catch (_) {}
    }

    function renderGifResults(items) {
      gifGrid.replaceChildren();
      const gifs = (items || []).map(normalizeGif).filter(Boolean);
      if (!gifs.length) {
        showGifMessage("No encontramos GIFs. Prueba con otra palabra.", false);
        return;
      }
      gifs.forEach(gif => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "chat-gif-option";
        option.title = gif.title || "Seleccionar GIF";
        option.setAttribute("aria-label", "Seleccionar GIF: " + (gif.title || "GIF"));
        if (gif.previewMp4) {
          const video = document.createElement("video");
          video.src = gif.previewMp4;
          video.autoplay = true;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.addEventListener("loadeddata", () => trackGiphyAction(gif, "onload"), { once: true });
          option.appendChild(video);
        } else if (gif.previewWebp || gif.previewUrl) {
          const image = document.createElement("img");
          image.src = gif.previewWebp || gif.previewUrl;
          image.alt = "";
          image.loading = "lazy";
          image.decoding = "async";
          image.addEventListener("load", () => trackGiphyAction(gif, "onload"), { once: true });
          option.appendChild(image);
        } else {
          const label = document.createElement("span");
          label.className = "chat-gif-option-fallback";
          label.textContent = gif.title || "GIF";
          option.appendChild(label);
          trackGiphyAction(gif, "onload");
        }
        option.addEventListener("click", () => {
          trackGiphyAction(gif, "onclick");
          selectGif(gif);
        });
        gifGrid.appendChild(option);
      });
    }

    async function getGiphyKey() {
      if (giphyKey) return giphyKey;
      if (giphyKeyPromise) return giphyKeyPromise;
      giphyKeyPromise = (async () => {
        const { data, error } = await db.auth.getSession();
        const token = data?.session?.access_token;
        if (error || !token) throw new Error("Inicia sesión para buscar GIFs.");
        const response = await fetch("/.netlify/functions/giphy-config", {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store"
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "No se pudo activar el buscador de GIFs.");
        if (!payload.apiKey) throw new Error("El buscador de GIFs aún no está configurado.");
        giphyKey = payload.apiKey;
        return giphyKey;
      })().finally(() => { giphyKeyPromise = null; });
      return giphyKeyPromise;
    }

    async function requestGiphy(query, signal) {
      const normalized = String(query || "").trim();
      const now = Date.now();
      while (gifRequestTimes.length && now - gifRequestTimes[0] > 60 * 60 * 1000) gifRequestTimes.shift();
      if (gifRequestTimes.length >= 75) {
        throw new Error("Se alcanzó el límite de búsquedas de esta sesión. Inténtalo más tarde.");
      }

      const apiKey = await getGiphyKey();
      const endpoint = normalized ? "search" : "trending";
      const params = new URLSearchParams({
        api_key: apiKey,
        limit: "12",
        rating: "pg",
        lang: "es",
        bundle: "messaging_non_clips",
        customer_id: giphyCustomerId
      });
      if (normalized) params.set("q", normalized.slice(0, 50));
      gifRequestTimes.push(now);
      const response = await fetch("https://api.giphy.com/v1/gifs/" + endpoint + "?" + params.toString(), {
        signal,
        mode: "cors",
        credentials: "omit",
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.meta?.status !== 200) {
        if (response.status === 429) throw new Error("GIPHY alcanzó el límite temporal de búsquedas. Inténtalo más tarde.");
        throw new Error("No se pudieron cargar los GIFs. Comprueba la conexión e inténtalo de nuevo.");
      }
      return Array.isArray(payload.data) ? payload.data : [];
    }

    async function loadTrendingGifs() {
      showGifMessage("Cargando GIFs populares…", false);
      try {
        const items = await requestGiphy("");
        if (!gifPicker.hidden) renderGifResults(items);
      } catch (error) {
        if (!gifPicker.hidden) showGifMessage(error?.message || "No se pudieron cargar los GIFs.", true);
      }
    }

    async function searchGifs(query) {
      if (gifSearchController) gifSearchController.abort();
      gifSearchController = new AbortController();
      const controller = gifSearchController;
      showGifMessage("Buscando GIFs…", false);
      try {
        const items = await requestGiphy(query, controller.signal);
        if (!controller.signal.aborted && !gifPicker.hidden) renderGifResults(items);
      } catch (error) {
        if (error?.name !== "AbortError" && !gifPicker.hidden) showGifMessage(error?.message || "No se pudo completar la búsqueda.", true);
      } finally {
        if (gifSearchController === controller) gifSearchController = null;
      }
    }

    async function openGifPicker() {
      if (busy || !available) return;
      menu.hidden = true;
      if (!gifPicker.hidden) {
        closeGifPicker();
        return;
      }
      gifPicker.hidden = false;
      gifTrigger.setAttribute("aria-expanded", "true");
      positionGifPicker();
      gifSearchInput.value = "";
      await loadTrendingGifs();
    }

    gifTrigger.addEventListener("click", openGifPicker);
    gifClose.addEventListener("click", closeGifPicker);
    gifSearchForm.addEventListener("submit", event => {
      event.preventDefault();
      const query = gifSearchInput.value.trim();
      if (query.length < 2) {
        showGifMessage("Escribe al menos dos caracteres para buscar.", false);
        return;
      }
      void searchGifs(query);
    });
    window.addEventListener("resize", () => { if (!gifPicker.hidden) positionGifPicker(); });
    window.addEventListener("scroll", () => { if (!gifPicker.hidden) positionGifPicker(); }, true);
    document.addEventListener("pointerdown", event => {
      if (!gifWrap.contains(event.target) && !gifPicker.contains(event.target)) closeGifPicker();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !gifPicker.hidden) closeGifPicker();
    });

    trigger.addEventListener("click", () => {
      if (busy) return;
      closeGifPicker();
      menu.hidden = !menu.hidden;
    });

    document.addEventListener("click", event => {
      if (!controls.contains(event.target)) menu.hidden = true;
    });

    function setBusy(value) {
      busy = Boolean(value);
      trigger.disabled = busy || !available;
      galleryButton.disabled = busy || !available;
      cameraButton.disabled = busy || !available;
      gifTrigger.disabled = busy || !available;
      if (busy) closeGifPicker();
    }

    function setAvailable(value) {
      available = Boolean(value);
      trigger.disabled = busy || !available;
      galleryButton.disabled = busy || !available;
      cameraButton.disabled = busy || !available;
      gifTrigger.disabled = busy || !available;
      if (!available) {
        menu.hidden = true;
        closeGifPicker();
      }
    }

    async function prepare({ text, scope, scopeId, userId }) {
      const caption = String(text || "").trim();
      const target = scope || getScope?.();
      if (pendingGif) {
        if (caption.length > 60) throw new Error("Con un GIF puedes añadir una leyenda de hasta 60 caracteres.");
        const content = encodeGifContent(pendingGif, caption);
        const maxLength = target?.type === "community" ? 500 : 2000;
        if (content.length > maxLength) throw new Error("Reduce el texto que acompaña el GIF e inténtalo de nuevo.");
        report("Enviando GIF…");
        return { content, path: null, kind: "gif", gifAnalytics: pendingGif.analytics || null };
      }
      if (!pendingFile) return { content: caption, path: null };
      if (caption.length > MAX_CAPTION) {
        throw new Error("Con una fotografía puedes añadir un texto de hasta 300 caracteres.");
      }

      report("Optimizando fotografía…");
      let uploaded = null;
      try {
        const owner = userId || getUser?.()?.id;
        uploaded = await uploadImage(db, pendingFile, target?.type, scopeId || target?.id, owner);
        const content = encodeContent(caption, uploaded.path);
        if (content.length > 500 && target?.type === "community") {
          await removeAttachment(db, uploaded.path);
          uploaded = null;
          throw new Error("Reduce el texto que acompaña la fotografía e inténtalo de nuevo.");
        }
        report("Enviando fotografía…");
        return { content, path: uploaded.path };
      } catch (error) {
        if (uploaded?.path) await removeAttachment(db, uploaded.path);
        throw error;
      }
    }

    return {
      hasPending: () => Boolean(pendingFile || pendingGif),
      prepare,
      clear,
      rollback: path => removeAttachment(db, path),
      setBusy,
      setAvailable,
      report,
      trackGif: (prepared, action) => trackGiphyAction({ analytics: prepared?.gifAnalytics }, action)
    };
  }

  window.OdontoChatUI = Object.freeze({
    mountComposer,
    renderMessageContent,
    parseContent,
    parseGifContent,
    encodeGifContent,
    removeAttachment
  });
})();
