// Netlify Function: estadísticas agregadas de PostHog para administradores.
const POSTHOG_PROJECT_ID = "714898";
const POSTHOG_API_HOST = "https://us.posthog.com";

function json(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Vary": "Authorization"
    },
    body: JSON.stringify(payload)
  };
}

async function runHogQL(apiKey, query, name) {
  const response = await fetch(POSTHOG_API_HOST + "/api/projects/" + POSTHOG_PROJECT_ID + "/query/", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: query, name: name }
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !Array.isArray(data.results)) {
    throw new Error("PostHog query failed with status " + response.status);
  }
  return data.results;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return json(405, { code: "method_not_allowed", message: "Método no permitido." });
  }
  const authorization = event.headers && (event.headers.authorization || event.headers.Authorization) || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json(401, { code: "unauthorized", message: "Inicia sesión para continuar." });

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const posthogKey = process.env.POSTHOG_PERSONAL_API_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(503, { code: "missing_supabase_config", message: "Falta la configuración de autenticación del servidor." });
  }

  try {
    // La autorización se comprueba en el servidor, no solo ocultando el panel en el navegador.
    const adminResponse = await fetch(supabaseUrl + "/rest/v1/rpc/is_admin", {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    const isAdmin = await adminResponse.json().catch(() => false);
    if (!adminResponse.ok || isAdmin !== true) {
      return json(403, { code: "forbidden", message: "Solo los administradores autorizados pueden consultar estas métricas." });
    }
    if (!posthogKey) {
      return json(503, {
        code: "missing_posthog_key",
        message: "Falta configurar POSTHOG_PERSONAL_API_KEY en las variables de entorno de Netlify."
      });
    }

    const requestedRange = Number(event.queryStringParameters && event.queryStringParameters.range || 30);
    const days = requestedRange === 7 ? 7 : 30;
    const baseWhere = "event = '$pageview' AND properties.environment = 'production' AND timestamp >= now() - INTERVAL " + days + " DAY";
    const metricsQuery =
      "SELECT count() AS pageviews, uniqExact(distinct_id) AS unique_visitors, " +
      "uniqExactIf(distinct_id, timestamp >= now() - INTERVAL 7 DAY) AS active_7d " +
      "FROM events WHERE " + baseWhere;
    const dailyQuery =
      "SELECT toDate(toTimeZone(timestamp, 'America/Bogota')) AS day, count() AS views " +
      "FROM events WHERE " + baseWhere + " GROUP BY day ORDER BY day ASC";
    const pagesQuery =
      "SELECT properties.page_name AS page_name, count() AS views " +
      "FROM events WHERE " + baseWhere + " GROUP BY page_name ORDER BY views DESC LIMIT 8";

    const results = await Promise.all([
      runHogQL(posthogKey, metricsQuery, "OdontoUdeC admin metrics"),
      runHogQL(posthogKey, dailyQuery, "OdontoUdeC daily pageviews"),
      runHogQL(posthogKey, pagesQuery, "OdontoUdeC top pages")
    ]);
    const metricRow = results[0][0] || [0, 0, 0];
    const daily = results[1].map(function (row) {
      return { day: String(row[0] || ""), views: Number(row[1] || 0) };
    });
    const topPages = results[2].map(function (row) {
      return { page: String(row[0] || "Otra página"), views: Number(row[1] || 0) };
    });
    return json(200, {
      rangeDays: days,
      metrics: {
        pageviews: Number(metricRow[0] || 0),
        uniqueVisitors: Number(metricRow[1] || 0),
        activeVisitors7d: Number(metricRow[2] || 0)
      },
      daily: daily,
      topPages: topPages
    });
  } catch (error) {
    console.error("[PostHog admin analytics] Query failed:", error && error.message || "unknown error");
    return json(502, {
      code: "posthog_query_failed",
      message: "No se pudieron consultar las métricas. Verifica que la clave de PostHog tenga permiso query:read."
    });
  }
};