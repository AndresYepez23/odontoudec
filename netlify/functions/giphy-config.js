"use strict";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Authorization"
  },
  body: JSON.stringify(body)
});

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Método no permitido." });
  }

  const origin = event.headers?.origin;
  const host = event.headers?.host;
  if (origin && (!host || (() => {
    try { return new URL(origin).host !== host; }
    catch (_) { return true; }
  })())) {
    return json(403, { error: "Origen no permitido." });
  }

  const bearer = String(event.headers?.authorization || event.headers?.Authorization || "");
  if (!/^Bearer\s+\S+$/i.test(bearer)) {
    return json(401, { error: "Inicia sesión para utilizar los GIFs." });
  }

  const section = String(event.queryStringParameters?.scope || "");
  const keyBySection = {
    community: "GIPHY_API_KEY",
    private: "GIPHY_API_KEY_PRIVATE",
    groups: "GIPHY_API_KEY_GROUPS"
  };
  const envName = keyBySection[section];
  if (!envName) {
    return json(400, { error: "Sección de chat no válida." });
  }

  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = process.env.SUPABASE_ANON_KEY;
  const apiKey = process.env[envName];
  if (!base || !anon) {
    return json(503, { error: "No está configurada la autenticación de OdontoUdeC." });
  }
  if (!apiKey) {
    const sectionName = section === "community" ? "Comunidad" : section === "private" ? "Mensajes privados" : "Grupos";
    return json(503, { error: "El buscador de GIFs aún no está configurado para " + sectionName + ". Falta agregar su clave de GIPHY en Netlify." });
  }

  try {
    const auth = await fetch(base + "/auth/v1/user", {
      headers: {
        apikey: anon,
        Authorization: bearer
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) {
      return json(401, { error: "Tu sesión ha expirado. Vuelve a iniciar sesión." });
    }
    const user = await auth.json().catch(() => ({}));
    if (!user?.id) {
      return json(401, { error: "No se pudo validar tu sesión." });
    }

    // GIPHY exige que Search/Trending se consulten desde el cliente.
    // La clave se entrega solo a usuarios autenticados y nunca se guarda en Git.
    return json(200, { apiKey });
  } catch (error) {
    console.error("[giphy-config] Auth check failed:", error?.message || "request failed");
    return json(503, { error: "No se pudo validar tu sesión. Inténtalo de nuevo." });
  }
};
