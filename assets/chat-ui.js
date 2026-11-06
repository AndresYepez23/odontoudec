/* OdontoUdeC shared chat media and reactions */
(() => {
  const BUCKET = "chat-media";
  const MAX_INPUT = 15 * 1024 * 1024;
  const MAX_OUTPUT = 1500 * 1024;
  const signedCache = new Map();
  const reactions = [
    { id: "like", label: "Me gusta", src: "/assets/reactions/like.svg" },
    { id: "love", label: "Me encanta", src: "/assets/reactions/love.svg" },
    { id: "laughing", label: "Me divierte", src: "/assets/reactions/laughing.svg" },
    { id: "angry", label: "Me enfada", src: "/assets/reactions/angry.svg" },
    { id: "sad", label: "Me entristece", src: "/assets/reactions/sad.svg" },
    { id: "soaked", label: "Me conmueve", src: "/assets/reactions/soaked.svg" }
  ];

  function randomId() {
    return window.crypto?.randomUUID?.() ||
      Array.from(window.crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, "0")).join("");
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen.")), type, quality);
    });
  }

  async function compressImage(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("Selecciona una imagen JPG, PNG, WebP o una foto compatible.");
    }
    if (file.size > MAX_INPUT) throw new Error("La imagen original supera 15 MB. Elige una más ligera.");
    if (!window.createImageBitmap) throw new Error("Este navegador no permite optimizar la imagen. Prueba con JPG o PNG en un navegador actualizado.");

    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_) {
      throw new Error("No se pudo abrir esa imagen. Intenta convertirla a JPG o PNG.");
    }

    try {
      const originalWidth = bitmap.width;
      const originalHeight = bitmap.height;
      if (!originalWidth || !originalHeight) throw new Error("La imagen no tiene dimensiones válidas.");
      const plans = [
        { max: 1600, quality: 0.82 },
        { max: 1440, quality: 0.72 },
        { max: 1280, quality: 0.62 }
      ];
      let blob = null;
      for (const plan of plans) {
        const scale = Math.min(1, plan.max / Math.max(originalWidth, originalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(originalWidth * scale));
        canvas.height = Math.max(1, Math.round(originalHeight * scale));
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("No se pudo preparar la imagen.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await canvasBlob(canvas, "image/webp", plan.quality);
        if (!blob.type || blob.type !== "image/webp") {
          blob = await canvasBlob(canvas, "image/jpeg", plan.quality);
        }
        if (blob.size <= MAX_OUTPUT) break;
      }
      if (!blob || blob.size > MAX_OUTPUT) {
        throw new Error("La imagen sigue siendo demasiado pesada después de comprimirla. Prueba con otra foto.");
      }
      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      return new File([blob], "odontoudec-" + randomId() + "." + extension, {
        type: blob.type,
        lastModified: Date.now()
      });
    } finally {
      bitmap.close?.();
    }
  }

  async function uploadImage(db, file, scope, scopeId, userId) {
    if (!userId) throw new Error("Inicia sesión para compartir imágenes.");
    const compressed = await compressImage(file);
    let folder;
    if (scope === "community") folder = "community/" + userId;
    else if (scope === "private" && scopeId) folder = "private/" + scopeId + "/" + userId;
    else if (scope === "groups" && scopeId) folder = "groups/" + scopeId + "/" + userId;
    else throw new Error("No se pudo identificar la conversación.");
    const path = folder + "/" + randomId() + (compressed.type === "image/webp" ? ".webp" : ".jpg");
    const { error } = await db.storage.from(BUCKET).upload(path, compressed, {
      cacheControl: "3600",
      contentType: compressed.type,
      upsert: false
    });
    if (error) throw error;
    return { path, mime: compressed.type, size: compressed.size };
  }

  async function signedUrl(db, path) {
    const cached = signedCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw error || new Error("No se pudo abrir la imagen.");
    signedCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  }

  async function createAttachment(db, path) {
    const url = await signedUrl(db, path);
    const link = document.createElement("a");
    link.className = "chat-attachment-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Abrir imagen adjunta");
    const img = document.createElement("img");
    img.className = "chat-attachment";
    img.src = url;
    img.alt = "Imagen compartida en la conversación";
    img.loading = "lazy";
    img.decoding = "async";
    link.appendChild(img);
    return link;
  }

  async function removeAttachment(db, path) {
    if (!path) return;
    signedCache.delete(path);
    const { error } = await db.storage.from(BUCKET).remove([path]);
    if (error) console.warn("[OdontoUdeC] No se pudo retirar una imagen no enviada:", error.message);
  }

  function normalizeReaction(value) {
    return value === "apoyo" ? "like" : value;
  }

  function createReactionBar(rows, userId, onPick, compact = false) {
    const bar = document.createElement("div");
    bar.className = "reaction-bar" + (compact ? " compact" : "");
    const list = Array.isArray(rows) ? rows : [];
    reactions.forEach(item => {
      const matching = list.filter(row => normalizeReaction(row.reaction) === item.id);
      const active = Boolean(userId && matching.some(row => row.user_id === userId));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reaction-chip" + (active ? " is-active" : "");
      button.disabled = !userId;
      button.title = item.label;
      button.setAttribute("aria-label", item.label + (matching.length ? " · " + matching.length : ""));
      button.setAttribute("aria-pressed", String(active));
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = "";
      img.width = 20;
      img.height = 20;
      const count = document.createElement("span");
      count.className = "reaction-count";
      count.textContent = matching.length ? String(matching.length) : "";
      button.append(img, count);
      button.addEventListener("click", () => onPick?.(item.id));
      bar.appendChild(button);
    });
    return bar;
  }

  async function toggleReaction(db, table, keyColumn, targetId, userId, reaction) {
    if (!userId) throw new Error("Inicia sesión para reaccionar.");
    const { data: mine, error: readError } = await db.from(table)
      .select("reaction")
      .eq(keyColumn, targetId)
      .eq("user_id", userId);
    if (readError) throw readError;
    const current = (mine || []).some(row => normalizeReaction(row.reaction) === reaction);
    const { error: deleteError } = await db.from(table)
      .delete()
      .eq(keyColumn, targetId)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (!current) {
      const { error: insertError } = await db.from(table).insert({
        [keyColumn]: targetId,
        user_id: userId,
        reaction
      });
      if (insertError) throw insertError;
    }
    return !current;
  }

  window.OdontoChatUI = Object.freeze({
    reactions,
    compressImage,
    uploadImage,
    createAttachment,
    removeAttachment,
    createReactionBar,
    toggleReaction
  });
})();
