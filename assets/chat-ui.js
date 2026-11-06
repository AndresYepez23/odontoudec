/* OdontoUdeC · Fotografías seguras para los chats existentes */
(() => {
  "use strict";

  const BUCKET = "chat-media";
  const PREFIX = "[[ODONTO_IMAGE_V1]]";
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

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la fotografía.")), type, quality);
    });
  }

  async function loadBitmap(file) {
    if (typeof window.createImageBitmap === "function") {
      return window.createImageBitmap(file, { imageOrientation: "from-image" });
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
        close() {}
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
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
    const parsed = parseContent(content);
    container.replaceChildren();

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

    const row = input.closest(".compose, .row") || input.parentElement;
    if (!row) throw new Error("No se encontró el área de escritura.");
    row.classList.add("chat-compose-row");

    const originalRequired = input.required;
    const originalMaxLength = input.maxLength;
    let pendingFile = null;
    let previewUrl = null;
    let busy = false;

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
      preview.hidden = true;
      preview.replaceChildren();
      gallery.value = "";
      camera.value = "";
      input.required = originalRequired;
      if (originalMaxLength > 0) input.maxLength = originalMaxLength;
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

    trigger.addEventListener("click", () => {
      if (busy) return;
      menu.hidden = !menu.hidden;
    });

    document.addEventListener("click", event => {
      if (!controls.contains(event.target)) menu.hidden = true;
    });

    function setBusy(value) {
      busy = Boolean(value);
      trigger.disabled = busy;
      galleryButton.disabled = busy;
      cameraButton.disabled = busy;
    }

    async function prepare({ text, scope, scopeId, userId }) {
      const caption = String(text || "").trim();
      if (!pendingFile) return { content: caption, path: null };
      if (caption.length > MAX_CAPTION) {
        throw new Error("Con una fotografía puedes añadir un texto de hasta 300 caracteres.");
      }

      setBusy(true);
      report("Optimizando fotografía…");
      let uploaded = null;
      try {
        const target = scope || getScope?.();
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
      } finally {
        setBusy(false);
      }
    }

    return {
      hasPending: () => Boolean(pendingFile),
      prepare,
      clear,
      rollback: path => removeAttachment(db, path),
      setBusy,
      report
    };
  }

  window.OdontoChatUI = Object.freeze({
    mountComposer,
    renderMessageContent,
    parseContent,
    removeAttachment
  });
})();
