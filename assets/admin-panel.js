// OdontoUdeC · Centro de administración
// La interfaz consume exclusivamente la función privada admin-api de Netlify.
(function () {
  const panel = document.getElementById("adminPanel");
  if (!panel || typeof supabaseClient === "undefined") return;

  const state = {
    overview: null,
    posts: [],
    postReports: [],
    chatReports: [],
    events: [],
    resources: [],
    groups: []
  };
  let mounted = false;
  let initPromise = null;
  let refreshing = false;

  const numberFormat = new Intl.NumberFormat("es-CO");
  const formatNumber = (value) => numberFormat.format(Number(value) || 0);
  const formatDate = (value, withTime) => {
    if (!value) return "Sin fecha";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-CO", withTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" }).format(date);
  };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const makeButton = (label, className, handler) => {
    const button = make("button", className || "ou-admin-btn ou-admin-btn-light", label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  };
  const safeHttpUrl = (value) => {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (_) {
      return "";
    }
  };

  function mount() {
    if (mounted) return;
    mounted = true;

    const legacyStatus = document.getElementById("adminStatus");
    const analytics = document.getElementById("adminAnalytics");
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/assets/admin-panel.css";
    document.head.appendChild(style);

    const shell = make("div", "ou-admin-shell");
    shell.innerHTML = `
      <header class="ou-admin-head">
        <div class="ou-admin-title">
          <span class="ou-admin-eyebrow">ODONTOUDEC · ADMINISTRACIÓN</span>
          <h2>Centro de control</h2>
          <p>Gestiona la comunidad, los recursos académicos y la actividad de la plataforma desde un solo lugar.</p>
        </div>
        <div class="ou-admin-head-actions">
          <div class="ou-admin-connection"><span class="ou-admin-live-dot"></span><span id="ouAdminConnection">Verificando permisos…</span></div>
          <button type="button" class="ou-admin-btn ou-admin-btn-primary" id="ouAdminRefresh">↻ Actualizar</button>
        </div>
      </header>

      <nav class="ou-admin-tabs" role="tablist" aria-label="Secciones de administración">
        <button type="button" class="ou-admin-tab is-active" role="tab" aria-selected="true" data-admin-tab="overview">Resumen</button>
        <button type="button" class="ou-admin-tab" role="tab" aria-selected="false" data-admin-tab="community">Comunidad</button>
        <button type="button" class="ou-admin-tab" role="tab" aria-selected="false" data-admin-tab="reports">Reportes <span class="ou-admin-tab-count" id="ouAdminReportBadge">0</span></button>
        <button type="button" class="ou-admin-tab" role="tab" aria-selected="false" data-admin-tab="academic">Academia</button>
        <button type="button" class="ou-admin-tab" role="tab" aria-selected="false" data-admin-tab="groups">Grupos</button>
        <button type="button" class="ou-admin-tab" role="tab" aria-selected="false" data-admin-tab="analytics">Analítica</button>
      </nav>

      <div class="ou-admin-toast" id="ouAdminToast" role="status" aria-live="polite"></div>

      <section class="ou-admin-pane is-active" role="tabpanel" data-admin-pane="overview">
        <div class="ou-admin-section-heading">
          <div><span class="ou-admin-eyebrow">VISTA GENERAL</span><h3>Estado de la plataforma</h3><p>Indicadores generales de OdontoUdeC. Se muestran cifras agregadas, no datos personales.</p></div>
        </div>
        <div class="ou-admin-metrics">
          <article class="ou-admin-metric"><span>Perfiles de estudiante</span><strong data-admin-stat="students">—</strong><small>Perfiles creados</small></article>
          <article class="ou-admin-metric"><span>Publicaciones</span><strong data-admin-stat="posts">—</strong><small>En la comunidad</small></article>
          <article class="ou-admin-metric"><span>Recursos académicos</span><strong data-admin-stat="resources">—</strong><small>En la biblioteca</small></article>
          <article class="ou-admin-metric"><span>Fechas académicas</span><strong data-admin-stat="events">—</strong><small>En el calendario</small></article>
          <article class="ou-admin-metric"><span>Grupos abiertos</span><strong data-admin-stat="openGroups">—</strong><small><span data-admin-stat="groups">—</span> grupos creados</small></article>
          <article class="ou-admin-metric ou-admin-metric-alert"><span>Reportes pendientes</span><strong data-admin-stat="reports">—</strong><small>Publicaciones y chat</small></article>
        </div>
        <div class="ou-admin-overview-grid">
          <section class="ou-admin-card">
            <div class="ou-admin-card-heading"><div><h4>Accesos rápidos</h4><p>Atajos para las tareas habituales.</p></div></div>
            <div class="ou-admin-quick-actions">
              <button type="button" data-admin-open="community"><span>＋</span><b>Publicar un aviso</b><small>Compartir información oficial</small></button>
              <button type="button" data-admin-open="reports"><span>⚑</span><b>Revisar reportes</b><small>Moderar contenido señalado</small></button>
              <button type="button" data-admin-open="academic"><span>＋</span><b>Añadir recurso o fecha</b><small>Actualizar la academia</small></button>
              <button type="button" data-admin-open="groups"><span>◉</span><b>Gestionar grupos</b><small>Revisar espacios de estudio</small></button>
            </div>
          </section>
          <section class="ou-admin-card">
            <div class="ou-admin-card-heading"><div><h4>Publicaciones recientes</h4><p>Últimas conversaciones de la comunidad.</p></div><button type="button" class="ou-admin-link-btn" data-admin-open="community">Ver todas ↗</button></div>
            <div id="ouAdminRecentPosts" class="ou-admin-recent-list"><p class="ou-admin-empty">Cargando actividad…</p></div>
          </section>
        </div>
        <div class="ou-admin-privacy-note"><span>🔒</span><p><b>Privacidad y seguridad</b> El panel no muestra conversaciones privadas, respuestas identificadas de encuestas ni datos de contacto de pacientes. La moderación se limita al contenido comunitario reportado.</p></div>
      </section>

      <section class="ou-admin-pane" role="tabpanel" data-admin-pane="community" hidden>
        <div class="ou-admin-section-heading"><div><span class="ou-admin-eyebrow">COMUNIDAD</span><h3>Publicaciones y avisos</h3><p>Publica comunicaciones desde la cuenta administradora y modera publicaciones existentes.</p></div></div>
        <div class="ou-admin-content-grid">
          <section class="ou-admin-card">
            <div class="ou-admin-card-heading"><div><h4 id="ouAdminPostFormTitle">Crear publicación</h4><p>Los avisos se publicarán en el feed comunitario.</p></div></div>
            <form id="ouAdminPostForm" class="ou-admin-form">
              <label for="ouAdminPostTitle">Título</label><input id="ouAdminPostTitle" name="title" maxlength="120" minlength="3" required placeholder="Ej. Información importante">
              <label for="ouAdminPostCategory">Categoría</label><select id="ouAdminPostCategory" name="category"><option>Anuncio</option><option>Académico</option><option>General</option><option>Pregunta</option><option>No al abuso</option></select>
              <label for="ouAdminPostContent">Mensaje</label><textarea id="ouAdminPostContent" name="content" rows="5" maxlength="5000" required placeholder="Escribe el comunicado para los estudiantes…"></textarea>
              <div class="ou-admin-form-actions"><button class="ou-admin-btn ou-admin-btn-primary" type="submit" id="ouAdminPostSubmit">Publicar en la comunidad</button><button class="ou-admin-btn ou-admin-btn-light" type="button" id="ouAdminPostCancel" hidden>Cancelar edición</button></div>
            </form>
          </section>
          <section class="ou-admin-card">
            <div class="ou-admin-card-heading"><div><h4>Publicaciones existentes</h4><p>Las más recientes aparecen primero.</p></div><span class="ou-admin-counter" id="ouAdminPostsCount">0</span></div>
            <div id="ouAdminPostsList" class="ou-admin-list"><p class="ou-admin-empty">Cargando publicaciones…</p></div>
          </section>
        </div>
      </section>

      <section class="ou-admin-pane" role="tabpanel" data-admin-pane="reports" hidden>
        <div class="ou-admin-section-heading"><div><span class="ou-admin-eyebrow">MODERACIÓN</span><h3>Reportes de la comunidad</h3><p>Revisa el contenido señalado por estudiantes. Puedes descartar un reporte o retirar el contenido si incumple las normas.</p></div></div>
        <div class="ou-admin-report-columns">
          <section class="ou-admin-card"><div class="ou-admin-card-heading"><div><h4>Publicaciones reportadas</h4><p>Reportes sobre el feed comunitario.</p></div><span class="ou-admin-counter" id="ouAdminPostReportsCount">0</span></div><div id="ouAdminPostReports" class="ou-admin-list"><p class="ou-admin-empty">Cargando reportes…</p></div></section>
          <section class="ou-admin-card"><div class="ou-admin-card-heading"><div><h4>Mensajes del chat reportados</h4><p>Mensajes del chat comunitario, no mensajes privados.</p></div><span class="ou-admin-counter" id="ouAdminChatReportsCount">0</span></div><div id="ouAdminChatReports" class="ou-admin-list"><p class="ou-admin-empty">Cargando reportes…</p></div></section>
        </div>
      </section>

      <section class="ou-admin-pane" role="tabpanel" data-admin-pane="academic" hidden>
        <div class="ou-admin-section-heading"><div><span class="ou-admin-eyebrow">CONTENIDO ACADÉMICO</span><h3>Biblioteca y calendario</h3><p>Añade, corrige o retira recursos de estudio y fechas académicas compartidas.</p></div></div>
        <div class="ou-admin-content-grid">
          <section class="ou-admin-card">
            <div class="ou-admin-card-heading"><div><h4 id="ouAdminEventFormTitle">Añadir fecha al calendario</h4><p>La fecha aparecerá en el calendario académico.</p></div></div>
            <form id="ouAdminEventForm" class="ou-admin-form">
              <label for="ouAdminEventTitle">Nombre del evento</label><input id="ouAdminEventTitle" name="title" maxlength="120" minlength="3" required placeholder="Ej. Parcial de Operatoria">
              <label for="ouAdminEventDate">Fecha y hora</label><input id="ouAdminEventDate" name="event_date" type="datetime-local" required>
              <div class="ou-admin-form-row">
                <div><label for="ouAdminEventCategory">Tipo de evento</label><select id="ouAdminEventCategory" name="category"><option>Parcial</option><option>Entrega</option><option>Práctica</option><option>Clínica</option><option>Evento</option><option>Receso</option><option>Personal</option><option>Otro</option></select></div>
                <div><label for="ouAdminEventSemester">Semestre</label><select id="ouAdminEventSemester" name="semester"><option value="">Todos</option><option value="1">1.º</option><option value="2">2.º</option><option value="3">3.º</option><option value="4">4.º</option><option value="5">5.º</option><option value="6">6.º</option><option value="7">7.º</option><option value="8">8.º</option><option value="9">9.º</option><option value="10">10.º</option></select></div>
              </div>
              <label for="ouAdminEventDescription">Descripción (opcional)</label><textarea id="ouAdminEventDescription" name="description" rows="3" maxlength="1200" placeholder="Detalles de la fecha…"></textarea>
              <div class="ou-admin-form-actions"><button class="ou-admin-btn ou-admin-btn-primary" type="submit" id="ouAdminEventSubmit">Guardar fecha</button><button class="ou-admin-btn ou-admin-btn-light" type="button" id="ouAdminEventCancel" hidden>Cancelar edición</button></div>
            </form>
          </section>
          <section class="ou-admin-card">
            <div class="ou-admin-card-heading"><div><h4 id="ouAdminResourceFormTitle">Añadir recurso académico</h4><p>Comparte material con un enlace válido.</p></div></div>
            <form id="ouAdminResourceForm" class="ou-admin-form">
              <label for="ouAdminResourceTitle">Título del recurso</label><input id="ouAdminResourceTitle" name="title" maxlength="150" minlength="3" required placeholder="Ej. Guía de anatomía dental">
              <label for="ouAdminResourceSubject">Asignatura</label><input id="ouAdminResourceSubject" name="subject" maxlength="100" placeholder="Ej. Anatomía dental">
              <div class="ou-admin-form-row">
                <div><label for="ouAdminResourceType">Tipo</label><select id="ouAdminResourceType" name="resource_type"><option>Apuntes</option><option>Guía</option><option>Video</option><option>Artículo</option><option>Libro</option><option>Otro</option></select></div>
                <div><label for="ouAdminResourceSemester">Semestre</label><select id="ouAdminResourceSemester" name="semester"><option value="">General</option><option value="1">1.º</option><option value="2">2.º</option><option value="3">3.º</option><option value="4">4.º</option><option value="5">5.º</option><option value="6">6.º</option><option value="7">7.º</option><option value="8">8.º</option><option value="9">9.º</option><option value="10">10.º</option></select></div>
              </div>
              <label for="ouAdminResourceUrl">Enlace</label><input id="ouAdminResourceUrl" name="url" type="url" maxlength="1000" required placeholder="https://…">
              <label for="ouAdminResourceDescription">Descripción (opcional)</label><textarea id="ouAdminResourceDescription" name="description" rows="3" maxlength="1200" placeholder="Qué contiene y cómo puede ayudar…"></textarea>
              <div class="ou-admin-form-actions"><button class="ou-admin-btn ou-admin-btn-primary" type="submit" id="ouAdminResourceSubmit">Guardar recurso</button><button class="ou-admin-btn ou-admin-btn-light" type="button" id="ouAdminResourceCancel" hidden>Cancelar edición</button></div>
            </form>
          </section>
        </div>
        <div class="ou-admin-academic-lists">
          <section class="ou-admin-card"><div class="ou-admin-card-heading"><div><h4>Fechas del calendario</h4><p>Eventos publicados en la plataforma.</p></div><span class="ou-admin-counter" id="ouAdminEventsCount">0</span></div><div id="ouAdminEventsList" class="ou-admin-list"><p class="ou-admin-empty">Cargando fechas…</p></div></section>
          <section class="ou-admin-card"><div class="ou-admin-card-heading"><div><h4>Biblioteca académica</h4><p>Recursos compartidos por estudiantes y administración.</p></div><span class="ou-admin-counter" id="ouAdminResourcesCount">0</span></div><div id="ouAdminResourcesList" class="ou-admin-list"><p class="ou-admin-empty">Cargando recursos…</p></div></section>
        </div>
      </section>

      <section class="ou-admin-pane" role="tabpanel" data-admin-pane="groups" hidden>
        <div class="ou-admin-section-heading"><div><span class="ou-admin-eyebrow">GRUPOS DE ESTUDIO</span><h3>Espacios de colaboración</h3><p>Consulta los grupos creados y controla si aceptan nuevas incorporaciones.</p></div></div>
        <section class="ou-admin-card"><div class="ou-admin-card-heading"><div><h4>Grupos registrados</h4><p>Puedes abrir o cerrar temporalmente la entrada de nuevos miembros.</p></div><span class="ou-admin-counter" id="ouAdminGroupsCount">0</span></div><div id="ouAdminGroupsList" class="ou-admin-list"><p class="ou-admin-empty">Cargando grupos…</p></div></section>
      </section>

      <section class="ou-admin-pane" role="tabpanel" data-admin-pane="analytics" hidden>
        <div class="ou-admin-section-heading"><div><span class="ou-admin-eyebrow">ANALÍTICA</span><h3>Tráfico y uso de OdontoUdeC</h3><p>Estadísticas agregadas de visitas y secciones consultadas.</p></div></div>
        <div id="ouAdminAnalyticsSlot"></div>
      </section>
    `;

    panel.replaceChildren(shell);
    const statusSlot = shell.querySelector(".ou-admin-connection");
    if (legacyStatus) statusSlot.appendChild(legacyStatus);
    if (analytics) shell.querySelector("#ouAdminAnalyticsSlot").appendChild(analytics);

    shell.querySelectorAll("[data-admin-tab]").forEach((tab) => {
      tab.addEventListener("click", () => setTab(tab.dataset.adminTab));
    });
    shell.querySelectorAll("[data-admin-open]").forEach((button) => {
      button.addEventListener("click", () => setTab(button.dataset.adminOpen));
    });
    shell.querySelector("#ouAdminRefresh").addEventListener("click", refreshAll);
    shell.querySelector("#ouAdminPostForm").addEventListener("submit", savePost);
    shell.querySelector("#ouAdminPostCancel").addEventListener("click", resetPostForm);
    shell.querySelector("#ouAdminEventForm").addEventListener("submit", saveEvent);
    shell.querySelector("#ouAdminResourceForm").addEventListener("submit", saveResource);
    shell.querySelector("#ouAdminEventCancel").addEventListener("click", resetEventForm);
    shell.querySelector("#ouAdminResourceCancel").addEventListener("click", resetResourceForm);
  }

  function setTab(name) {
    if (!mounted) return;
    panel.querySelectorAll("[data-admin-tab]").forEach((tab) => {
      const active = tab.dataset.adminTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panel.querySelectorAll("[data-admin-pane]").forEach((pane) => {
      const active = pane.dataset.adminPane === name;
      pane.classList.toggle("is-active", active);
      pane.hidden = !active;
    });
    if (name === "analytics") {
      const refresh = document.getElementById("refreshAdminAnalytics");
      if (refresh) refresh.click();
    }
  }

  function toast(message, isError) {
    const box = document.getElementById("ouAdminToast");
    if (!box) return;
    box.textContent = message;
    box.classList.toggle("is-error", Boolean(isError));
    box.classList.add("is-visible");
    window.clearTimeout(box.__hideTimer);
    box.__hideTimer = window.setTimeout(() => box.classList.remove("is-visible"), 4200);
  }

  async function api(action, method, payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.access_token) throw new Error("Tu sesión terminó. Inicia sesión nuevamente.");
    const response = await fetch("/.netlify/functions/admin-api?action=" + encodeURIComponent(action), {
      method: method || "GET",
      headers: {
        Authorization: "Bearer " + session.access_token,
        ...(payload ? { "Content-Type": "application/json" } : {})
      },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || "No se pudo completar la solicitud.");
    }
    return result;
  }

  function renderOverview() {
    const metrics = state.overview?.metrics || {};
    Object.keys(metrics).forEach((key) => {
      const target = panel.querySelector('[data-admin-stat="' + key + '"]');
      if (target) target.textContent = formatNumber(metrics[key]);
    });
    const reportBadge = document.getElementById("ouAdminReportBadge");
    if (reportBadge) reportBadge.textContent = formatNumber(metrics.reports);
    const recent = document.getElementById("ouAdminRecentPosts");
    recent.replaceChildren();
    if (!state.posts.length) {
      recent.appendChild(make("p", "ou-admin-empty", "Todavía no hay publicaciones."));
      return;
    }
    state.posts.slice(0, 5).forEach((post) => {
      const row = make("article", "ou-admin-recent-item");
      const copy = make("div");
      copy.append(make("b", "", post.title || "Sin título"));
      copy.append(make("small", "", (post.category || "General") + " · " + formatDate(post.created_at, false)));
      row.append(copy);
      row.append(make("span", "ou-admin-mini-arrow", "↗"));
      recent.append(row);
    });
  }

  function renderPosts() {
    const list = document.getElementById("ouAdminPostsList");
    document.getElementById("ouAdminPostsCount").textContent = formatNumber(state.posts.length);
    list.replaceChildren();
    if (!state.posts.length) {
      list.append(make("p", "ou-admin-empty", "No hay publicaciones para mostrar."));
      return;
    }
    state.posts.forEach((post) => {
      const card = make("article", "ou-admin-item");
      const header = make("div", "ou-admin-item-header");
      const titleWrap = make("div");
      titleWrap.append(make("h5", "", post.title || "Sin título"));
      titleWrap.append(make("span", "ou-admin-tag", (post.category || "General") + " · " + formatDate(post.created_at, false)));
      header.append(titleWrap);
      card.append(header);
      card.append(make("p", "ou-admin-item-copy", post.content || ""));
      const actions = make("div", "ou-admin-item-actions");
      actions.append(makeButton("Editar", "ou-admin-btn ou-admin-btn-light ou-admin-btn-small", () => editPost(post)));
      actions.append(makeButton("Eliminar", "ou-admin-btn ou-admin-btn-danger ou-admin-btn-small", async () => {
        if (!window.confirm("¿Eliminar esta publicación permanentemente? También se eliminarán sus comentarios, reacciones y reportes asociados.")) return;
        try {
          await api("delete-post", "POST", { id: post.id });
          toast("Publicación eliminada.");
          await refreshAll();
          if (typeof window.loadPosts === "function") await window.loadPosts();
        } catch (error) { toast(error.message, true); }
      }));
      card.append(actions);
      list.append(card);
    });
  }

  function renderReportList(containerId, items, type) {
    const list = document.getElementById(containerId);
    list.replaceChildren();
    if (!items.length) {
      list.append(make("p", "ou-admin-empty", "No hay reportes pendientes."));
      return;
    }
    items.forEach((item) => {
      const card = make("article", "ou-admin-item ou-admin-report-item");
      const content = item.content;
      const header = make("div", "ou-admin-item-header");
      const heading = make("div");
      heading.append(make("h5", "", type === "post"
        ? (content?.title || "Publicación no disponible")
        : (content?.display_name || "Mensaje del chat")));
      heading.append(make("span", "ou-admin-tag", item.reports.length + (item.reports.length === 1 ? " reporte" : " reportes")));
      header.append(heading);
      card.append(header);
      card.append(make("p", "ou-admin-item-copy", content
        ? (type === "post" ? content.content : content.content)
        : "El contenido original ya no está disponible."));
      if (content?.created_at) card.append(make("small", "ou-admin-muted", "Publicado · " + formatDate(content.created_at, true)));
      const reasons = make("div", "ou-admin-reasons");
      item.reports.forEach((report) => {
        const reason = make("div", "ou-admin-reason");
        reason.append(make("span", "", report.reason || "Sin motivo indicado"));
        reason.append(make("small", "", formatDate(report.createdAt, true)));
        reason.append(makeButton("Descartar", "ou-admin-btn ou-admin-btn-light ou-admin-btn-small", async () => {
          try {
            await api("resolve-report", "POST", { type, reportId: report.id, contentId: item.contentId, decision: "dismiss" });
            toast("Reporte descartado.");
            await refreshAll();
          } catch (error) { toast(error.message, true); }
        }));
        reasons.append(reason);
      });
      card.append(reasons);
      if (content) {
        card.append(makeButton("Retirar contenido y cerrar reportes", "ou-admin-btn ou-admin-btn-danger ou-admin-btn-small", async () => {
          const label = type === "post" ? "publicación" : "mensaje";
          if (!window.confirm("¿Retirar este " + label + "? Se eliminará el contenido y se cerrarán todos sus reportes." + (type === "post" ? " También se eliminarán sus comentarios y reacciones." : ""))) return;
          try {
            await api("resolve-report", "POST", { type, reportId: item.reports[0].id, contentId: item.contentId, decision: "remove" });
            toast("Contenido retirado y reportes cerrados.");
            await refreshAll();
            if (type === "post" && typeof window.loadPosts === "function") await window.loadPosts();
          } catch (error) { toast(error.message, true); }
        }));
      }
      list.append(card);
    });
  }

  function renderReports() {
    const postCount = state.postReports.reduce((sum, item) => sum + item.reports.length, 0);
    const chatCount = state.chatReports.reduce((sum, item) => sum + item.reports.length, 0);
    document.getElementById("ouAdminPostReportsCount").textContent = formatNumber(postCount);
    document.getElementById("ouAdminChatReportsCount").textContent = formatNumber(chatCount);
    renderReportList("ouAdminPostReports", state.postReports, "post");
    renderReportList("ouAdminChatReports", state.chatReports, "chat");
  }

  function localDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function renderEvents() {
    const list = document.getElementById("ouAdminEventsList");
    document.getElementById("ouAdminEventsCount").textContent = formatNumber(state.events.length);
    list.replaceChildren();
    if (!state.events.length) {
      list.append(make("p", "ou-admin-empty", "Todavía no hay fechas registradas."));
      return;
    }
    state.events.forEach((event) => {
      const card = make("article", "ou-admin-item");
      card.append(make("h5", "", event.title || "Evento sin título"));
      card.append(make("span", "ou-admin-tag", [event.category || "Evento", event.semester ? "Semestre " + event.semester : "Todos los semestres", formatDate(event.event_date, true)].join(" · ")));
      if (event.description) card.append(make("p", "ou-admin-item-copy", event.description));
      const actions = make("div", "ou-admin-item-actions");
      actions.append(makeButton("Editar", "ou-admin-btn ou-admin-btn-light ou-admin-btn-small", () => editEvent(event)));
      actions.append(makeButton("Eliminar", "ou-admin-btn ou-admin-btn-danger ou-admin-btn-small", async () => {
        if (!window.confirm("¿Eliminar esta fecha del calendario?")) return;
        try {
          await api("delete-event", "POST", { id: event.id });
          toast("Fecha eliminada.");
          await refreshAll();
        } catch (error) { toast(error.message, true); }
      }));
      card.append(actions);
      list.append(card);
    });
  }

  function renderResources() {
    const list = document.getElementById("ouAdminResourcesList");
    document.getElementById("ouAdminResourcesCount").textContent = formatNumber(state.resources.length);
    list.replaceChildren();
    if (!state.resources.length) {
      list.append(make("p", "ou-admin-empty", "Todavía no hay recursos registrados."));
      return;
    }
    state.resources.forEach((resource) => {
      const card = make("article", "ou-admin-item");
      card.append(make("h5", "", resource.title || "Recurso sin título"));
      card.append(make("span", "ou-admin-tag", [resource.resource_type || "Otro", resource.subject || "Sin asignatura", resource.semester ? "Semestre " + resource.semester : "General"].join(" · ")));
      if (resource.description) card.append(make("p", "ou-admin-item-copy", resource.description));
      const url = safeHttpUrl(resource.url);
      if (url) {
        const link = make("a", "ou-admin-resource-link", "Abrir recurso ↗");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.append(link);
      }
      const actions = make("div", "ou-admin-item-actions");
      actions.append(makeButton("Editar", "ou-admin-btn ou-admin-btn-light ou-admin-btn-small", () => editResource(resource)));
      actions.append(makeButton("Eliminar", "ou-admin-btn ou-admin-btn-danger ou-admin-btn-small", async () => {
        if (!window.confirm("¿Eliminar este recurso de la biblioteca? También se quitarán los marcadores que los estudiantes hayan guardado.")) return;
        try {
          await api("delete-resource", "POST", { id: resource.id });
          toast("Recurso eliminado.");
          await refreshAll();
        } catch (error) { toast(error.message, true); }
      }));
      card.append(actions);
      list.append(card);
    });
  }

  function renderGroups() {
    const list = document.getElementById("ouAdminGroupsList");
    document.getElementById("ouAdminGroupsCount").textContent = formatNumber(state.groups.length);
    list.replaceChildren();
    if (!state.groups.length) {
      list.append(make("p", "ou-admin-empty", "Todavía no hay grupos creados."));
      return;
    }
    state.groups.forEach((group) => {
      const card = make("article", "ou-admin-item ou-admin-group-item");
      const info = make("div");
      info.append(make("h5", "", group.name || "Grupo sin nombre"));
      info.append(make("span", "ou-admin-tag", [
        group.subject || "Sin asignatura",
        group.semester ? "Semestre " + group.semester : "General",
        formatNumber(group.memberCount) + (group.memberCount === 1 ? " miembro" : " miembros")
      ].join(" · ")));
      if (group.description) info.append(make("p", "ou-admin-item-copy", group.description));
      card.append(info);
      const status = make("span", group.is_open ? "ou-admin-status is-open" : "ou-admin-status is-closed", group.is_open ? "Abierto" : "Cerrado");
      card.append(status);
      card.append(makeButton(group.is_open ? "Cerrar nuevas incorporaciones" : "Abrir incorporaciones",
        group.is_open ? "ou-admin-btn ou-admin-btn-light ou-admin-btn-small" : "ou-admin-btn ou-admin-btn-primary ou-admin-btn-small",
        async () => {
          try {
            await api("set-group-status", "POST", { id: group.id, is_open: !group.is_open });
            toast(group.is_open ? "Grupo cerrado a nuevas incorporaciones." : "Grupo abierto a nuevas incorporaciones.");
            await refreshAll();
          } catch (error) { toast(error.message, true); }
        }));
      list.append(card);
    });
  }

  function editEvent(event) {
    const form = document.getElementById("ouAdminEventForm");
    form.dataset.editId = event.id;
    form.elements.title.value = event.title || "";
    form.elements.event_date.value = localDateTime(event.event_date);
    form.elements.category.value = event.category || "Otro";
    form.elements.semester.value = event.semester || "";
    form.elements.description.value = event.description || "";
    document.getElementById("ouAdminEventFormTitle").textContent = "Editar fecha académica";
    document.getElementById("ouAdminEventSubmit").textContent = "Guardar cambios";
    document.getElementById("ouAdminEventCancel").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetEventForm() {
    const form = document.getElementById("ouAdminEventForm");
    form.reset();
    delete form.dataset.editId;
    document.getElementById("ouAdminEventFormTitle").textContent = "Añadir fecha al calendario";
    document.getElementById("ouAdminEventSubmit").textContent = "Guardar fecha";
    document.getElementById("ouAdminEventCancel").hidden = true;
  }

  function editResource(resource) {
    const form = document.getElementById("ouAdminResourceForm");
    form.dataset.editId = resource.id;
    form.elements.title.value = resource.title || "";
    form.elements.subject.value = resource.subject || "";
    form.elements.resource_type.value = resource.resource_type || "Otro";
    form.elements.semester.value = resource.semester || "";
    form.elements.url.value = resource.url || "";
    form.elements.description.value = resource.description || "";
    document.getElementById("ouAdminResourceFormTitle").textContent = "Editar recurso académico";
    document.getElementById("ouAdminResourceSubmit").textContent = "Guardar cambios";
    document.getElementById("ouAdminResourceCancel").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetResourceForm() {
    const form = document.getElementById("ouAdminResourceForm");
    form.reset();
    delete form.dataset.editId;
    document.getElementById("ouAdminResourceFormTitle").textContent = "Añadir recurso académico";
    document.getElementById("ouAdminResourceSubmit").textContent = "Guardar recurso";
    document.getElementById("ouAdminResourceCancel").hidden = true;
  }

  function editPost(post) {
    const form = document.getElementById("ouAdminPostForm");
    form.dataset.editId = post.id;
    form.elements.title.value = post.title || "";
    form.elements.category.value = post.category || "Anuncio";
    form.elements.content.value = post.content || "";
    document.getElementById("ouAdminPostFormTitle").textContent = "Editar publicación";
    document.getElementById("ouAdminPostSubmit").textContent = "Guardar cambios";
    document.getElementById("ouAdminPostCancel").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetPostForm() {
    const form = document.getElementById("ouAdminPostForm");
    form.reset();
    delete form.dataset.editId;
    document.getElementById("ouAdminPostFormTitle").textContent = "Crear publicación";
    document.getElementById("ouAdminPostSubmit").textContent = "Publicar en la comunidad";
    document.getElementById("ouAdminPostCancel").hidden = true;
  }

  async function savePost(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.dataset.editId || null,
      title: form.elements.title.value.trim(),
      category: form.elements.category.value,
      content: form.elements.content.value.trim()
    };
    try {
      await api("save-post", "POST", payload);
      resetPostForm();
      toast(payload.id ? "Publicación actualizada." : "Publicación creada y añadida al feed.");
      await refreshAll();
      if (typeof window.loadPosts === "function") await window.loadPosts();
    } catch (error) { toast(error.message, true); }
  }

  async function saveEvent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const localDate = form.elements.event_date.value;
    const date = new Date(localDate);
    if (!localDate || Number.isNaN(date.getTime())) {
      toast("Selecciona una fecha y hora válidas.", true);
      return;
    }
    const payload = {
      id: form.dataset.editId || null,
      title: form.elements.title.value.trim(),
      event_date: date.toISOString(),
      category: form.elements.category.value,
      semester: form.elements.semester.value || null,
      description: form.elements.description.value.trim()
    };
    try {
      await api("save-event", "POST", payload);
      resetEventForm();
      toast(payload.id ? "Fecha actualizada." : "Fecha añadida al calendario.");
      await refreshAll();
    } catch (error) { toast(error.message, true); }
  }

  async function saveResource(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      id: form.dataset.editId || null,
      title: form.elements.title.value.trim(),
      subject: form.elements.subject.value.trim(),
      resource_type: form.elements.resource_type.value,
      semester: form.elements.semester.value || null,
      url: form.elements.url.value.trim(),
      description: form.elements.description.value.trim()
    };
    if (!safeHttpUrl(payload.url)) {
      toast("Introduce un enlace que comience por https:// o http://.", true);
      return;
    }
    try {
      await api("save-resource", "POST", payload);
      resetResourceForm();
      toast(payload.id ? "Recurso actualizado." : "Recurso añadido a la biblioteca.");
      await refreshAll();
    } catch (error) { toast(error.message, true); }
  }

  async function refreshAll() {
    if (refreshing || !mounted) return;
    refreshing = true;
    const connection = document.getElementById("ouAdminConnection");
    connection.textContent = "Actualizando información…";
    try {
      const [overviewData, postsData, reportsData, academicData, groupsData] = await Promise.all([
        api("overview"),
        api("posts"),
        api("reports"),
        api("academic"),
        api("groups")
      ]);
      state.overview = overviewData;
      state.posts = postsData.posts || [];
      state.postReports = reportsData.postReports || [];
      state.chatReports = reportsData.chatReports || [];
      state.events = academicData.events || [];
      state.resources = academicData.resources || [];
      state.groups = groupsData.groups || [];
      renderOverview();
      renderPosts();
      renderReports();
      renderEvents();
      renderResources();
      renderGroups();
      if (panel.querySelector('[data-admin-pane="analytics"]')?.classList.contains("is-active")) {
        const analyticsRefresh = document.getElementById("refreshAdminAnalytics");
        if (analyticsRefresh) analyticsRefresh.click();
      }
      connection.textContent = "Administrador activo · Datos actualizados";
    } catch (error) {
      connection.textContent = "No se pudo actualizar";
      toast(error.message, true);
    } finally {
      refreshing = false;
    }
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user) {
          panel.classList.add("hidden");
          return;
        }
        const { data, error } = await supabaseClient.rpc("is_admin");
        if (error || data !== true) {
          panel.classList.add("hidden");
          return;
        }
        panel.classList.remove("hidden");
        mount();
        await refreshAll();
      } catch (_) {
        panel.classList.add("hidden");
      }
    })().finally(() => { initPromise = null; });
    return initPromise;
  }

  window.OdontoAdmin = Object.freeze({ init, refresh: refreshAll });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session || !session.user) {
      panel.classList.add("hidden");
    } else {
      init();
    }
  });

  init();
})();
