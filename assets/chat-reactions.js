(() => {
  "use strict";

  const OPTIONS = [
    { key: "apoyo", emoji: "👍", label: "Me gusta" },
    { key: "me_encanta", emoji: "❤️", label: "Me encanta" },
    { key: "idea", emoji: "💡", label: "Buena idea" },
    { key: "gracias", emoji: "🙏", label: "Gracias" },
    { key: "divertido", emoji: "😂", label: "Me divierte" },
    { key: "sorprendido", emoji: "😮", label: "Me sorprende" }
  ];

  function mount(container, config) {
    if (!container || !config?.db || !config.table || !config.targetColumn) return;
    const { db, table, targetColumn, targetId, userId, onStatus } = config;
    let rows = Array.isArray(config.rows) ? [...config.rows] : [];
    container.classList.add("reaction-bar");

    function draw() {
      container.replaceChildren();
      OPTIONS.forEach(option => {
        const matching = rows.filter(row => row.reaction === option.key);
        const active = Boolean(userId && matching.some(row => row.user_id === userId));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reaction-chip" + (active ? " is-active" : "");
        button.disabled = !userId;
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", option.label + ", " + matching.length + " reacciones");
        button.title = option.label;
        button.textContent = option.emoji + (matching.length ? " " + matching.length : "");
        button.addEventListener("click", async () => {
          if (!userId || button.disabled) return;
          button.disabled = true;
          try {
            const { data: existing, error: readError } = await db
              .from(table).select("id,reaction")
              .eq(targetColumn, targetId).eq("user_id", userId).maybeSingle();
            if (readError) throw readError;

            if (existing?.reaction === option.key) {
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
            draw();
            if (typeof onStatus === "function") onStatus("Reacción actualizada.");
          } catch (error) {
            draw();
            if (typeof onStatus === "function") onStatus("No se pudo guardar la reacción. Inténtalo de nuevo.");
            console.warn("[OdontoUdeC reactions]", error);
          }
        });
        container.appendChild(button);
      });
    }

    draw();
  }

  window.OdontoReactions = Object.freeze({ mount, options: OPTIONS });
})();
