# OdontoUdeC — Cloudflare migration handoff

Date: 2026-11-16

## Goal and safety rules

Move OdontoUdeC hosting and its three Netlify Functions to Cloudflare without changing Supabase data, Resend, PostHog, or OneSignal. Keep the Netlify site available until the Cloudflare Worker is attached to the custom domain and the complete browser test matrix passes.

Do not commit secret values. Do not change registrar nameservers or delete the Netlify site before the DNS cutover is verified.

## Git state

- Repository: `AndresYepez23/odontoudec`
- Migration branch: `migration/cloudflare-workers`
- Branch baseline: latest successful Netlify production commit `ddc1822157570d9a48e68416a2b78de11397223a` (SEO Cartagena guide cluster).
- Backup branch: `backup/pre-seo-rollback-20261116`.
- Netlify production remains on deployment `6af4d7718906c2b57d1e72d9`; the later rollback deployment was skipped because the Netlify account exceeded its credit usage limit.
- The live SEO pages are preserved in the migration branch.

## Application architecture

- Multi-page static site: HTML, CSS and JavaScript at the repository root.
- No root `package.json`, no `netlify.toml`, and no traditional build step.
- Public files: root HTML, `assets/`, `guias/`, `oauth/consent/`, `manifest.webmanifest`, `OneSignalSDKWorker.js`, `academia-enhancements.js`, `enhancements.css`, `robots.txt`, and `sitemap.xml`.
- The three original Netlify Functions are:
  - `netlify/functions/admin-api.js`
  - `netlify/functions/giphy-config.js`
  - `netlify/functions/posthog-analytics.js`
- Frontend calls retain their original paths:
  - `/.netlify/functions/admin-api`
  - `/.netlify/functions/giphy-config`
  - `/.netlify/functions/posthog-analytics`
- Cloudflare source modules are in `src/worker.js`, `src/admin-api.js`, `src/giphy-config.js`, and `src/posthog-analytics.js`.

## Cloudflare production deployment — current verified state

The Worker named `odontoudec-staging` is now the active Cloudflare production candidate. It is tagged `odontoudec`, `production`, and `kv-static-assets`. Its workers.dev endpoint is enabled and previews are disabled.

- Worker URL: `https://odontoudec-staging.andressimonyepezarrieta23.workers.dev`
- Health endpoint: `/_cloudflare/health`
- Latest deployment ID: `b185d11b-cde7-462f-bf86-7489a6bf9dbb`
- Latest version ID: `5519f354-72f8-4b0d-b43f-93c536419c6c`
- Traffic allocation: 100% of this Worker.
- Worker source compiled and deployed successfully through the Cloudflare API.
- A new Worker named `odontoudec-production` was briefly created without all secrets due tool security restrictions, then deleted. Do not use it.
- The older Worker named `odontoudec` from 2026-11-08 was not overwritten.

### Static files

The static site uses a dedicated Workers KV namespace because the direct Workers Static Assets upload flow required a short-lived upload JWT that was not accepted by the connected API session. The KV approach uses Cloudflare's supported KV bulk API and Worker KV binding.

- Namespace: `ODONTOUDEC_STATIC_ASSETS`
- Namespace ID: `65c7a40b759a473891bb8c9fbba9b91c`
- Worker binding: `ODO_ASSETS`
- Verified uploaded key count: 85.
- Includes all public HTML, SEO guides, CSS, JS, SVG, PNG, PWA manifest, OneSignal service worker, robots.txt and sitemap.xml.
- Internal docs, scripts, Supabase migrations, and Netlify function source are not published as static assets.
- Worker serves static files from KV, caches responses with Cloudflare Cache API, supports GET/HEAD, preserves multi-page URLs, and redirects `/guias` to `/guias/`.
- Health endpoint checks the root page, guides page, and presence of all seven secrets without exposing secret values.

### Server functions

The Worker preserves the existing frontend routes and runs the three server functions:

1. `admin-api`: validates the Supabase user session and `is_admin` RPC before using the privileged Supabase key for admin actions.
2. `giphy-config`: validates authenticated Supabase sessions before returning the GIPHY key for the requested scope. Key mapping:
   - community: `GIPHY_API_KEY`
   - private: `GIPHY_API_KEY_2`
   - groups: `GIPHY_API_KEY_3`
3. `posthog-analytics`: checks `is_admin` before running HogQL queries for project `714898` at `https://us.posthog.com`.

### Worker secrets

Cloudflare confirmed all seven bindings on the deployed Worker, each stored as `secret_text`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GIPHY_API_KEY`
- `GIPHY_API_KEY_2`
- `GIPHY_API_KEY_3`
- `POSTHOG_PERSONAL_API_KEY`

No secret values are stored in Git. The user plans to rotate the two privileged API keys later; update the Worker secrets after rotation.

## Domain and DNS

- Cloudflare account connection is active.
- Account Workers subdomain: `andressimonyepezarrieta23`.
- Zone: `odontoudec.online`.
- Zone status: `pending`; registrar delegation has not yet been changed.
- Cloudflare nameservers:
  - `keira.ns.cloudflare.com`
  - `pranab.ns.cloudflare.com`
- Registrar is identified by Cloudflare as INWX GmbH. Cowabi appears to be the user-facing reseller/panel; the user must make the nameserver change in the domain management panel.
- Do not claim the custom domain is already served by Cloudflare. It is not attached yet.
- The pending zone currently keeps the temporary Netlify fallback:
  - Apex A: `odontoudec.online -> 75.2.60.5`
  - WWW CNAME: `www.odontoudec.online -> odontoudec.netlify.app`
- After the user changes nameservers and Cloudflare marks the zone active, attach `odontoudec.online` and `www.odontoudec.online` to the production Worker using Cloudflare Worker custom domains. Confirm HTTPS before switching any remaining traffic.
- Keep the old `odontoudec` Worker untouched unless a later explicit migration plan needs it.

## Resend DNS

Resend domain `auth.odontoudec.online` remains verified, sending enabled, receiving disabled.

The pending Cloudflare zone contains these DNS-only records:
- TXT `resend._domainkey.auth.odontoudec.online` — DKIM.
- CNAME `rsend.auth.odontoudec.online -> rsend-sae1.forge.rmta.net`.
- CNAME `send.auth.odontoudec.online -> send.forge.rmta.net`.
- TXT `_dmarc.odontoudec.online` — `v=DMARC1; p=none;`.

Keep all mail/authentication records DNS-only. Before nameserver cutover, audit Cowabi's complete DNS zone, especially any MX/SPF records or other subdomains, and copy only verified current records.

## Remaining validation and cutover

1. Ask the user to open `https://odontoudec-staging.andressimonyepezarrieta23.workers.dev/_cloudflare/health` and verify the response reports `status: ok`, both pages ready, and seven configured secrets.
2. Test root page, all sitemap URLs, SEO guides, PWA manifest, OneSignal service worker, chat, GIPHY scopes, admin actions, PostHog admin metrics, Supabase login/registration/recovery/OAuth, forms, and mobile layout.
3. The current web/tool environment cannot directly fetch workers.dev URLs, so do not claim browser end-to-end validation until the user or an accessible browser test confirms it.
4. Audit the full live DNS zone at Cowabi and verify mail records before the user changes nameservers to the Cloudflare pair.
5. Once Cloudflare zone status is `active`, attach the apex and www custom domains to the production Worker and verify HTTPS.
6. Keep Netlify available for rollback until the custom domain and full functional matrix pass. Do not delete Netlify until explicit final confirmation.

## Important implementation constraints

- This is a multi-page site, not an SPA. Do not configure an SPA fallback.
- Preserve the existing HTML paths, query strings, SEO URLs, PWA routes, and function paths.
- Do not migrate Supabase data or change auth configuration as part of the hosting cutover.


## Production deployment verification — 2026-11-16

- Cloudflare Worker `odontoudec-staging` is deployed at 100% on version `5519f354-72f8-4b0d-b43f-93c536419c6c` (deployment `b185d11b-cde7-462f-bf86-7489a6bf9dbb`).
- The Worker source includes the router and all three modules: `admin-api.js`, `giphy-config.js`, and `posthog-analytics.js`.
- Routes preserved: `/.netlify/functions/admin-api`, `/.netlify/functions/giphy-config`, `/.netlify/functions/posthog-analytics`.
- Static website is stored in KV namespace `ODO_ASSETS`; 85 keys confirmed, including index, chat, academic pages, PWA files, sitemap, robots, and all guide pages.
- Health route: `/_cloudflare/health` (reports presence of all seven secrets and key assets).
- Custom domains `odontoudec.online` and `www.odontoudec.online` are attached and enabled on the Worker. `cf-test.odontoudec.online` is also attached for testing.
- Cloudflare zone is `active`; nameservers are `keira.ns.cloudflare.com` and `pranab.ns.cloudflare.com`.
- Resend DKIM TXT, DMARC TXT, and two sending CNAMEs are DNS-only.
- A live HTTP smoke test from the execution environment was blocked by outbound-domain restrictions. Cloudflare API confirms deployment, routing source, assets, secrets, custom domains, and active zone; user should still test critical browser flows.
- Netlify remains intact as rollback until end-to-end verification is complete.
