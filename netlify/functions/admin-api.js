// Netlify Function: herramientas administrativas de OdontoUdeC.
// La clave privilegiada permanece en el servidor. Cada petición vuelve a validar
// la sesión de Supabase y el rol admin antes de ejecutar cualquier operación.
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");

function readKeyObject(raw) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return parsed.default || Object.values(parsed)[0] || "";
  } catch (_) {
    return "";
  }
}

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  readKeyObject(process.env.SUPABASE_PUBLISHABLE_KEYS);

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  readKeyObject(process.env.SUPABASE_SECRET_KEYS);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Vary": "Authorization"
    },
    body: JSON.stringify(payload)
  };
}

function serviceHeaders() {
  const headers = { apikey: SERVICE_KEY, Accept: "application/json" };
  // Las claves secret sb_secret_ no son JWT: deben enviarse solo como apikey.
  // La service_role heredada sí necesita Authorization Bearer.
  if (!SERVICE_KEY.startsWith("sb_secret_")) {
    headers.Authorization = "Bearer " + SERVICE_KEY;
  }
  return headers;
}

async function authenticate(event) {
  const headers = event.headers || {};
  const authorization = headers.authorization || headers.Authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: json(401, { code: "unauthorized", message: "Inicia sesión para continuar." }) };

  const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
    method: "GET",
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + token }
  });
  const user = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !user || !user.id) {
    return { error: json(401, { code: "invalid_session", message: "Tu sesión no es válida. Vuelve a iniciar sesión." }) };
  }

  const adminResponse = await fetch(SUPABASE_URL + "/rest/v1/rpc/is_admin", {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: "{}"
  });
  const isAdmin = await adminResponse.json().catch(() => false);
  if (!adminResponse.ok || isAdmin !== true) {
    return { error: json(403, { code: "forbidden", message: "No tienes permisos para administrar OdontoUdeC." }) };
  }
  return { user };
}

async function dbRequest(path, options) {
  const opts = options || {};
  const headers = serviceHeaders();
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.prefer) headers.Prefer = opts.prefer;

  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (_) { data = raw; }
  }
  if (!response.ok) {
    const error = new Error("database_request_failed");
    error.status = response.status;
    throw error;
  }
  return { data, headers: response.headers };
}

function queryString(values) {
  const params = new URLSearchParams();
  Object.keys(values).forEach((key) => {
    if (values[key] !== undefined && values[key] !== null) params.set(key, String(values[key]));
  });
  return params.toString();
}

async function rows(table, values) {
  const query = queryString(values || {});
  const result = await dbRequest(table + (query ? "?" + query : ""));
  return Array.isArray(result.data) ? result.data : [];
}

async function countRows(table, filterName, filterValue) {
  const values = { select: "id", limit: "1" };
  if (filterName) values[filterName] = filterValue;
  const result = await dbRequest(table + "?" + queryString(values), { prefer: "count=exact" });
  const range = result.headers.get("content-range") || "";
  const match = range.match(/\/(\d+|\*)$/);
  if (match && match[1] !== "*") return Number(match[1]);
  return Array.isArray(result.data) ? result.data.length : 0;
}

function requireText(value, min, max, label) {
  const text = String(value || "").trim();
  if (text.length < min || text.length > max) {
    throw new Error("invalid_" + label);
  }
  return text;
}

function semesterValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 10) throw new Error("invalid_semester");
  return number;
}

async function overview() {
  const [
    students, posts, resources, events, contentReports, chatReports,
    groups, openGroups
  ] = await Promise.all([
    countRows("profiles"),
    countRows("posts"),
    countRows("academic_resources"),
    countRows("academic_events"),
    countRows("content_reports"),
    countRows("chat_reports"),
    countRows("study_groups"),
    countRows("study_groups", "is_open", "eq.true")
  ]);
  return {
    metrics: {
      students, posts, resources, events, groups, openGroups,
      reports: contentReports + chatReports,
      postReports: contentReports,
      chatReports
    }
  };
}

async function getPosts() {
  return {
    posts: await rows("posts", {
      select: "id,title,content,category,created_at",
      order: "created_at.desc",
      limit: "40"
    })
  };
}

async function getReports() {
  const [postReports, chatReports] = await Promise.all([
    rows("content_reports", {
      select: "id,post_id,reason,created_at",
      order: "created_at.desc",
      limit: "100"
    }),
    rows("chat_reports", {
      select: "id,message_id,reason,created_at",
      order: "created_at.desc",
      limit: "100"
    })
  ]);

  const postIds = [...new Set(postReports.map((item) => String(item.post_id)))];
  const messageIds = [...new Set(chatReports.map((item) => String(item.message_id)))];

  const [posts, messages] = await Promise.all([
    postIds.length ? rows("posts", {
      select: "id,title,content,category,created_at",
      id: "in.(" + postIds.join(",") + ")"
    }) : [],
    messageIds.length ? rows("chat_messages", {
      select: "id,display_name,content,created_at",
      id: "in.(" + messageIds.join(",") + ")"
    }) : []
  ]);

  const postMap = new Map(posts.map((item) => [String(item.id), item]));
  const messageMap = new Map(messages.map((item) => [String(item.id), item]));

  function group(items, key, sourceMap, kind) {
    const grouped = new Map();
    items.forEach((report) => {
      const contentId = String(report[key]);
      if (!grouped.has(contentId)) {
        grouped.set(contentId, {
          type: kind,
          contentId,
          content: sourceMap.get(contentId) || null,
          reports: []
        });
      }
      grouped.get(contentId).reports.push({
        id: report.id,
        reason: report.reason,
        createdAt: report.created_at
      });
    });
    return [...grouped.values()].sort((a, b) => {
      const latestA = Math.max(...a.reports.map((r) => new Date(r.createdAt).getTime()));
      const latestB = Math.max(...b.reports.map((r) => new Date(r.createdAt).getTime()));
      return latestB - latestA;
    });
  }

  return {
    postReports: group(postReports, "post_id", postMap, "post"),
    chatReports: group(chatReports, "message_id", messageMap, "chat")
  };
}

async function getAcademic() {
  const [events, resources] = await Promise.all([
    rows("academic_events", {
      select: "id,title,description,event_date,category,semester,created_at",
      order: "event_date.asc",
      limit: "150"
    }),
    rows("academic_resources", {
      select: "id,title,subject,description,url,resource_type,semester,created_at",
      order: "created_at.desc",
      limit: "150"
    })
  ]);
  return { events, resources };
}

async function getGroups() {
  const [groups, memberships] = await Promise.all([
    rows("study_groups", {
      select: "id,name,description,subject,semester,is_open,created_at",
      order: "created_at.desc",
      limit: "100"
    }),
    rows("study_group_members", { select: "group_id", limit: "5000" })
  ]);
  const counts = new Map();
  memberships.forEach((item) => counts.set(String(item.group_id), (counts.get(String(item.group_id)) || 0) + 1));
  return {
    groups: groups.map((item) => ({
      ...item,
      memberCount: counts.get(String(item.id)) || 0
    }))
  };
}

async function handlePost(action, body, user) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_body");

  if (action === "create-post") {
    const title = requireText(body.title, 3, 120, "title");
    const content = requireText(body.content, 1, 5000, "content");
    const categories = ["General", "Académico", "Pregunta", "Anuncio", "No al abuso"];
    const category = categories.includes(body.category) ? body.category : "Anuncio";
    const result = await dbRequest("posts", {
      method: "POST",
      prefer: "return=representation",
      body: [{ author_id: user.id, title, content, category }]
    });
    return { ok: true, post: Array.isArray(result.data) ? result.data[0] : null };
  }

  if (action === "delete-post") {
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("invalid_id");
    await dbRequest("posts?id=eq." + id, { method: "DELETE" });
    return { ok: true };
  }

  if (action === "resolve-report") {
    const type = body.type === "chat" ? "chat" : body.type === "post" ? "post" : "";
    const decision = body.decision === "remove" ? "remove" : body.decision === "dismiss" ? "dismiss" : "";
    const reportId = Number(body.reportId);
    const contentId = Number(body.contentId);
    if (!type || !decision || !Number.isSafeInteger(reportId) || reportId < 1) throw new Error("invalid_report");

    const table = type === "post" ? "content_reports" : "chat_reports";
    const foreignKey = type === "post" ? "post_id" : "message_id";
    const reportRows = await rows(table, {
      select: "id," + foreignKey,
      id: "eq." + reportId,
      limit: "1"
    });
    if (!reportRows.length) return { ok: true, alreadyResolved: true };
    if (decision === "dismiss") {
      await dbRequest(table + "?id=eq." + reportId, { method: "DELETE" });
      return { ok: true };
    }
    if (!Number.isSafeInteger(contentId) || contentId < 1 || Number(reportRows[0][foreignKey]) !== contentId) {
      throw new Error("invalid_report_target");
    }
    const target = type === "post" ? "posts" : "chat_messages";
    await dbRequest(target + "?id=eq." + contentId, { method: "DELETE" });
    // Las claves foráneas eliminan automáticamente los reportes del contenido retirado.
    return { ok: true };
  }

  if (action === "save-event") {
    const title = requireText(body.title, 3, 120, "title");
    const date = new Date(body.event_date);
    if (!body.event_date || Number.isNaN(date.getTime())) throw new Error("invalid_date");
    const payload = {
      title,
      description: String(body.description || "").trim().slice(0, 1200) || null,
      event_date: date.toISOString(),
      category: String(body.category || "").trim().slice(0, 60) || null,
      semester: semesterValue(body.semester)
    };
    const id = body.id ? Number(body.id) : null;
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw new Error("invalid_id");
    const result = id
      ? await dbRequest("academic_events?id=eq." + id, { method: "PATCH", prefer: "return=representation", body: payload })
      : await dbRequest("academic_events", { method: "POST", prefer: "return=representation", body: [{ ...payload, created_by: user.id }] });
    return { ok: true, event: Array.isArray(result.data) ? result.data[0] : null };
  }

  if (action === "delete-event") {
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("invalid_id");
    await dbRequest("academic_events?id=eq." + id, { method: "DELETE" });
    return { ok: true };
  }

  if (action === "save-resource") {
    const title = requireText(body.title, 3, 150, "title");
    const url = requireText(body.url, 8, 1000, "url");
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch (_) { throw new Error("invalid_url"); }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") throw new Error("invalid_url");
    const types = ["Apuntes", "Guía", "Video", "Artículo", "Libro", "Otro"];
    const resourceType = types.includes(body.resource_type) ? body.resource_type : "Otro";
    const payload = {
      title,
      subject: String(body.subject || "").trim().slice(0, 100) || null,
      description: String(body.description || "").trim().slice(0, 1200) || null,
      url: parsedUrl.toString(),
      resource_type: resourceType,
      semester: semesterValue(body.semester)
    };
    const id = body.id ? Number(body.id) : null;
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw new Error("invalid_id");
    const result = id
      ? await dbRequest("academic_resources?id=eq." + id, { method: "PATCH", prefer: "return=representation", body: payload })
      : await dbRequest("academic_resources", { method: "POST", prefer: "return=representation", body: [{ ...payload, created_by: user.id }] });
    return { ok: true, resource: Array.isArray(result.data) ? result.data[0] : null };
  }

  if (action === "delete-resource") {
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("invalid_id");
    await dbRequest("academic_resources?id=eq." + id, { method: "DELETE" });
    return { ok: true };
  }

  if (action === "set-group-status") {
    const id = String(body.id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("invalid_id");
    }
    if (typeof body.is_open !== "boolean") throw new Error("invalid_status");
    await dbRequest("study_groups?id=eq." + id, {
      method: "PATCH",
      prefer: "return=representation",
      body: { is_open: body.is_open }
    });
    return { ok: true };
  }

  throw new Error("unknown_action");
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Cache-Control": "no-store" }, body: "" };
  }
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json(405, { code: "method_not_allowed", message: "Método no permitido." });
  }
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json(503, {
      code: "missing_server_config",
      message: "Falta configurar las claves privadas de Supabase en las variables de entorno de Netlify."
    });
  }

  try {
    const auth = await authenticate(event);
    if (auth.error) return auth.error;

    const params = event.queryStringParameters || {};
    const action = String(params.action || "");
    if (event.httpMethod === "GET") {
      if (action === "overview") return json(200, await overview());
      if (action === "posts") return json(200, await getPosts());
      if (action === "reports") return json(200, await getReports());
      if (action === "academic") return json(200, await getAcademic());
      if (action === "groups") return json(200, await getGroups());
      return json(400, { code: "unknown_action", message: "La consulta solicitada no existe." });
    }

    let body = {};
    if (event.body) {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body;
      try { body = JSON.parse(raw); } catch (_) {
        return json(400, { code: "invalid_json", message: "La solicitud tiene un formato inválido." });
      }
    }
    const result = await handlePost(action, body, auth.user);
    return json(200, result);
  } catch (error) {
    const code = String(error && error.message || "");
    const validationErrors = new Set([
      "invalid_body", "invalid_title", "invalid_content", "invalid_semester",
      "invalid_id", "invalid_report", "invalid_report_target", "invalid_date",
      "invalid_url", "invalid_status", "unknown_action"
    ]);
    if (validationErrors.has(code)) {
      return json(400, { code, message: "Revisa los datos del formulario e inténtalo nuevamente." });
    }
    console.error("[OdontoUdeC admin API] Operation failed:", error && error.status || error && error.message || "unknown");
    return json(502, {
      code: "admin_operation_failed",
      message: "No se pudo completar la operación. Comprueba la configuración del servidor e inténtalo de nuevo."
    });
  }
};
