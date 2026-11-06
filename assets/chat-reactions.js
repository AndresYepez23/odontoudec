(() => {
  "use strict";
  const OPTIONS = [
    { key: "like", file: "like.svg", label: "Me gusta" },
    { key: "love", file: "love.svg", label: "Me encanta" },
    { key: "laughing", file: "laughing.svg", label: "Me divierte" },
    { key: "soaked", file: "soaked.svg", label: "Me sorprende" },
    { key: "sad", file: "sad.svg", label: "Me entristece" },
    { key: "angry", file: "angry.svg", label: "Me enoja" }
  ];
  const LEGACY = {
    apoyo: "like", me_encanta: "love", divertido: "laughing",
    sorprendido: "soaked"
  };
  const asset = file => "/assets/reactions/" + file;

  function mount(container, config) {
    if (!container || !config?.db || !config.table || !config.targetColumn || !config.targetId) return;
    const { db, table, targetColumn, targetId, userId, onStatus } = config;
    let rows = Array.isArray(config.rows) ? [...config.rows] : [];
    container.classList.add("ou-reactions");
    const shell = document.createElement("div");
    shell.className = "ou-reactions-shell";
    const summary = document.createElement("div");
    summary.className = "ou-reactions-summary";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ou-reactions-toggle";
    toggle.setAttribute("aria-label", "Abrir reacciones");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 14.2s1.2 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01"></path></svg>';
    const menu = document.createElement("div");
    menu.className = "ou-reactions-menu";
    menu.hidden = true;
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", "Elegir reacción");

    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("is-open");
    }
    function openMenu() {
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.classList.add("is-open");
    }
    toggle.addEventListener("click", event => {
      event.stopPropagation();
      menu.hidden ? openMenu() : closeMenu();
    });
    menu.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("click", event => {
      if (!container.contains(event.target)) closeMenu();
    });
    container.addEventListener("keydown", event => {
      if (event.key === "Escape") { closeMenu(); toggle.focus(); }
    });

    function normalized(key) { return LEGACY[key] || key; }
    function drawSummary() {
      summary.replaceChildren();
      const counts = new Map();
      rows.forEach(row => {
        const key = normalized(row.reaction);
        if (OPTIONS.some(option => option.key === key)) counts.set(key, (counts.get(key) || 0) + 1);
      });
      OPTIONS.forEach(option => {
        const count = counts.get(option.key) || 0;
        if (!count) return;
        const chip = document.createElement("span");
        chip.className = "ou-reaction-count";
        chip.title = option.label;
        const img = document.createElement("img");
        img.src = asset(option.file); img.alt = ""; img.width = 18; img.height = 18;
        const number = document.createElement("span"); number.textContent = String(count);
        chip.append(img, number); summary.append(chip);
      });
      toggle.title = rows.length ? "Ver o añadir una reacción" : "Reaccionar";
    }
    function drawMenu() {
      menu.replaceChildren();
      OPTIONS.forEach(option => {
        const matching = rows.filter(row => normalized(row.reaction) === option.key);
        const active = Boolean(userId && matching.some(row => row.user_id === userId));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ou-reaction-option" + (active ? " is-active" : "");
        button.disabled = !userId;
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", option.label + (matching.length ? ", " + matching.length : ""));
        button.title = option.label;
        const img = document.createElement("img");
        img.src = asset(option.file); img.alt = ""; img.width = 30; img.height = 30;
        const count = document.createElement("span");
        count.className = "ou-reaction-option-count";
        count.textContent = matching.length ? String(matching.length) : "";
        button.append(img, count);
        button.addEventListener("click", async () => {
          if (!userId || button.disabled) return;
          button.disabled = true;
          try {
            const { data: existing, error: readError } = await db.from(table)
              .select("id,reaction").eq(targetColumn, targetId).eq("user_id", userId).maybeSingle();
            if (readError) throw readError;
            if (existing && normalized(existing.reaction) === option.key) {
              const { error } = await db.from(table).delete().eq("id", existing.id);
              if (error) throw error;
            } else {
              if (existing) {
                const { error } = await db.from(table).delete().eq("id", existing.id);
                if (error) throw error;
              }
              const payload = { [targetColumn]: targetId, user_id: userId, reaction: option.key };
              const { error } = await db.from(table).insert(payload);
              if (error) throw error;
            }
            const { data, error } = await db.from(table)
              .select("id,user_id,reaction").eq(targetColumn, targetId);
            if (error) throw error;
            rows = data || [];
            closeMenu(); drawSummary(); drawMenu();
            if (typeof onStatus === "function") onStatus("Reacción actualizada.");
          } catch (error) {
            drawMenu();
            if (typeof onStatus === "function") onStatus("No se pudo guardar la reacción. Inténtalo de nuevo.");
            console.warn("[OdontoUdeC reactions]", error);
          }
        });
        menu.append(button);
      });
    }
    shell.append(summary, toggle, menu);
    container.replaceChildren(shell);
    drawSummary(); drawMenu();
  }
  window.OdontoReactions = Object.freeze({ mount, options: OPTIONS });
})();