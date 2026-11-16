import { createAdminHandler } from "./admin-api.js";
import { createGiphyHandler } from "./giphy-config.js";
import { createPosthogHandler } from "./posthog-analytics.js";

function toEvent(request, body = null) {
  const url = new URL(request.url);
  return {
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body,
    isBase64Encoded: false
  };
}

async function invoke(handler, request, body = null) {
  const event = toEvent(request, body);
  const result = await handler(event);
  return new Response(result.body ?? "", {
    status: result.statusCode ?? 200,
    headers: result.headers ?? {}
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (path === "/_cloudflare/health") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return json({
        service: "OdontoUdeC",
        platform: "Cloudflare Workers",
        status: "ok",
        functions: [
          "admin-api",
          "giphy-config",
          "posthog-analytics"
        ],
        version: "cloudflare-migration-2026-11-16"
      });
    }

    if (path === "/.netlify/functions/admin-api") {
      const body = request.method === "POST" ? await request.text() : null;
      return invoke(createAdminHandler(env), request, body);
    }

    if (path === "/.netlify/functions/giphy-config") {
      return invoke(createGiphyHandler(env), request);
    }

    if (path === "/.netlify/functions/posthog-analytics") {
      return invoke(createPosthogHandler(env), request);
    }

    if (path.startsWith("/.netlify/functions/")) {
      return json({ code: "not_found", message: "Función no encontrada." }, 404);
    }

    return new Response("Not Found", { status: 404 });
  }
};
