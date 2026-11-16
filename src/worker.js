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

function cacheControlFor(key) {
  if (key === "OneSignalSDKWorker.js" || key === "manifest.webmanifest" || key === "robots.txt" || key === "sitemap.xml") {
    return "public, max-age=60, s-maxage=300";
  }
  if (/\.(?:html?)$/i.test(key)) return "public, max-age=60, s-maxage=300";
  if (/\.(?:css|js)$/i.test(key)) return "public, max-age=300, s-maxage=3600";
  return "public, max-age=3600, s-maxage=86400";
}

function resolveAssetKeys(pathname) {
  if (pathname === "/") return ["index.html"];
  if (pathname === "/guias") return ["guias/index.html"];
  if (pathname.endsWith("/")) return [pathname.slice(1) + "index.html"];
  const key = pathname.replace(/^\/+/, "");
  const candidates = [key];
  if (!/\.[^/]+$/.test(key)) candidates.push(key + ".html", key + "/index.html");
  return candidates;
}

async function serveStatic(request, env, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" }
    });
  }

  const url = new URL(request.url);
  if (url.pathname === "/guias") {
    return Response.redirect(new URL("/guias/", url), 301);
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(request.method === "HEAD" ? null : cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: cached.headers
    });
  }

  const candidates = resolveAssetKeys(url.pathname);
  for (const key of candidates) {
    const asset = await env.ODO_ASSETS.getWithMetadata(key, { type: "arrayBuffer" });
    if (!asset || asset.value === null) continue;

    const headers = new Headers({
      "Content-Type": asset.metadata?.contentType || "application/octet-stream",
      "Cache-Control": cacheControlFor(key),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    const response = new Response(request.method === "HEAD" ? null : asset.value, {
      status: 200,
      headers
    });
    if (request.method === "GET") ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }

  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (path === "/_cloudflare/health") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return json({
        service: "OdontoUdeC",
        platform: "Cloudflare Workers",
        storage: "Cloudflare Workers KV",
        status: "ok",
        functions: ["admin-api", "giphy-config", "posthog-analytics"],
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

    return serveStatic(request, env, ctx);
  }
};
