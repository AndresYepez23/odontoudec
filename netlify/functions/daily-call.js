"use strict";
const { createHmac } = require("node:crypto");

// Netlify Function. All Daily and Supabase service keys stay on the server.
const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  body: JSON.stringify(body),
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readJSON(res) {
  return res.json().catch(() => ({}));
}

async function daily(path, method = "GET", data) {
  const res = await fetch("https://api.daily.co/v1" + path, {
    method,
    headers: {
      Authorization: "Bearer " + process.env.DAILY_API_KEY,
      "Content-Type": "application/json"
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(12000)
  });
  return { ok: res.ok, status: res.status, data: await readJSON(res) };
}

async function selectRows(base, serviceKey, table, query) {
  const url = base + "/rest/v1/" + table + "?" + query;
  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error("No fue posible validar el acceso a la conversación.");
  return readJSON(r);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return response(405, { error: "Método no permitido." });
  const origin = event.headers?.origin;
  const host = event.headers?.host;
  if (origin && (!host || (() => { try { return new URL(origin).host !== host; } catch { return true; } })())) {
    return response(403, { error: "Origen no permitido." });
  }
  const bearer = String(event.headers?.authorization || event.headers?.Authorization || "");
  if (!/^Bearer\s+\S+$/i.test(bearer)) return response(401, { error: "Inicia sesión para usar videollamadas." });
  if ((event.body || "").length > 2048) return response(413, { error: "Solicitud demasiado grande." });
  let request;
  try { request = JSON.parse(event.body || "{}"); } catch { return response(400, { error: "Solicitud no válida." }); }
  const scope = request.scope;
  const id = request.id;
  if (!["community", "private", "groups"].includes(scope) || (scope !== "community" && !UUID.test(String(id || "")))) {
    return response(400, { error: "Selecciona una conversación válida." });
  }
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !service) return response(503, { error: "El servidor no tiene configurada la autenticación." });

  try {
    const auth = await fetch(base + "/auth/v1/user", {
      headers: { apikey: anon, Authorization: bearer },
      signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) return response(401, { error: "Tu sesión ha expirado. Vuelve a iniciar sesión." });
    const user = await readJSON(auth);
    if (!user.id || !UUID.test(user.id)) return response(401, { error: "No se pudo comprobar tu sesión." });

    if (scope === "private") {
      const rows = await selectRows(base, service, "private_conversations", "select=id,user_one,user_two&id=eq." + encodeURIComponent(id) + "&limit=1");
      if (!rows?.length || (rows[0].user_one !== user.id && rows[0].user_two !== user.id)) {
        return response(403, { error: "Solo los participantes pueden entrar a esta videollamada." });
      }
    }
    if (scope === "groups") {
      const rows = await selectRows(base, service, "study_group_members", "select=group_id&group_id=eq." + encodeURIComponent(id) + "&user_id=eq." + encodeURIComponent(user.id) + "&limit=1");
      if (!rows?.length) return response(403, { error: "Debes pertenecer al grupo para entrar a su videollamada." });
    }
    if (!process.env.DAILY_API_KEY) {
      return response(503, { error: "Las videollamadas estarán disponibles cuando el administrador active Daily." });
    }

    // Reuse the same private video room within each conversation on a given day.
    // HMAC keeps raw private/group IDs out of the external room name.
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const tag = scope === "community" ? "com" : scope === "private" ? "priv" : "grp";
    const key = scope + ":" + (scope === "community" ? "general" : id);
    const digest = createHmac("sha256", process.env.DAILY_API_KEY).update(key).digest("hex").slice(0, 28);
    const roomName = "ou-" + tag + "-" + digest + "-" + day;
    const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
    let room = await daily("/rooms/" + roomName);
    if (room.status === 404) {
      room = await daily("/rooms", "POST", {
        name: roomName,
        privacy: "private",
        properties: {
          exp,
          eject_at_room_exp: true,
          max_participants: scope === "private" ? 2 : scope === "groups" ? 10 : 12,
          enable_prejoin_ui: true,
          enable_chat: false,
          start_video_off: true,
          start_audio_off: true,
          lang: "es"
        }
      });
      // Simultaneous requests can race to create exactly the same room.
      if (!room.ok) room = await daily("/rooms/" + roomName);
    }
    if (!room.ok || !room.data?.url) {
      return response(502, { error: "No se pudo preparar la sala de videollamada. Inténtalo de nuevo." });
    }

    const displayName = String(user.user_metadata?.display_name || user.email?.split("@")[0] || "Estudiante").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40) || "Estudiante";
    const token = await daily("/meeting-tokens", "POST", {
      properties: {
        room_name: roomName,
        user_id: user.id,
        user_name: displayName,
        exp: Math.min(exp - 60, Math.floor(Date.now() / 1000) + 3600),
        eject_at_token_exp: true
      }
    });
    if (!token.ok || !token.data?.token) {
      return response(502, { error: "No se pudo autorizar tu acceso a la videollamada." });
    }
    return response(200, { url: room.data.url, token: token.data.token, room: roomName });
  } catch (err) {
    console.error("[video-call] Unavailable:", err?.message || "request failed");
    return response(502, { error: "No se pudo conectar con el servicio de video. Inténtalo más tarde." });
  }
};