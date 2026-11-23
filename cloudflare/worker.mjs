// Recovered from active Worker version 5519f354 (2026-11-16), then hardened.
// scripts/build-cloudflare.mjs generates adapters from the shared handlers.
import { createAdminHandler } from "./admin-api.mjs";
import { createGiphyHandler } from "./giphy-config.mjs";
import { createPosthogHandler } from "./posthog-analytics.mjs";

async function boundedText(request, maxBytes) {
  if (Number(request.headers.get('Content-Length')) > maxBytes) throw new Error('TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('TOO_LARGE');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

function secureStaticResponse(response) {
  const result = new Response(response.body, response);
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('X-Frame-Options', 'SAMEORIGIN');
  result.headers.set('Content-Security-Policy', "base-uri 'self'; frame-ancestors 'self'");
  result.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return result;
}

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
      const requiredSecrets = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GIPHY_API_KEY",
        "GIPHY_API_KEY_2",
        "GIPHY_API_KEY_3",
        "POSTHOG_PERSONAL_API_KEY"
      ];
      const missingSecrets = requiredSecrets.filter((name) => !env[name]);
      const [homePage, guidesPage] = await Promise.all([
        env.ODO_ASSETS.get("index.html", { type: "arrayBuffer" }),
        env.ODO_ASSETS.get("guias/index.html", { type: "arrayBuffer" })
      ]);
      const assetsReady = Boolean(homePage && guidesPage);
      return json({
        service: "OdontoUdeC",
        platform: "Cloudflare Workers",
        storage: "Cloudflare Workers KV",
        status: assetsReady && missingSecrets.length === 0 ? "ok" : "degraded",
        assets: { homePage: Boolean(homePage), guidesPage: Boolean(guidesPage), totalUploaded: 85 },
        configuredSecrets: requiredSecrets.length - missingSecrets.length,
        requiredSecrets: requiredSecrets.length,
        missingSecretCount: missingSecrets.length,
        functions: ["admin-api", "giphy-config", "posthog-analytics"],
        version: "cloudflare-migration-2026-11-16"
      });
    }

    if (path === "/.netlify/functions/admin-api") {
      let body = null;
      try { body = request.method === 'POST' ? await boundedText(request, 32000) : null; }
      catch (error) { return json({ code: 'invalid_body' }, error.message === 'TOO_LARGE' ? 413 : 400); }
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

    return secureStaticResponse(await serveStatic(request, env, ctx));
  }
};

