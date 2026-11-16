# OdontoUdeC — Cloudflare migration handoff

Date: 2026-11-16

## Goal and safety rules

Migrate the OdontoUdeC website from Netlify to Cloudflare Workers with Static Assets. Keep production on Netlify until the Cloudflare staging Worker passes the full test matrix. Do not change registrar nameservers or delete the Netlify site during staging.

Do not move Supabase, Resend, PostHog, or OneSignal as part of the hosting migration. Keep their existing services and data.

## Git state

- Repository: AndresYepez23/odontoudec
- Baseline: latest successful production commit `ddc1822157570d9a48e68416a2b78de11397223a` (SEO Cartagena guide cluster).
- Migration branch: `migration/cloudflare-workers`.
- The migration branch has been reset onto the exact commit currently served by Netlify production, preserving the SEO pages.
- Backup branch: `backup/pre-seo-rollback-20261116`.
- Last successful production deployment: `6af4d7718906c2b57d1e72d9` (`https://6af4d7718906c2b57d1e72d9--odontoudec.netlify.app/`).
- The later attempt to deploy the pre-SEO rollback (`6afb4758dafbcffa87d7d53f`) was skipped because the Netlify account exceeded its credit usage limit; it did not replace the live SEO deployment.

## Application architecture discovered

- Multi-page static site: HTML, CSS and JavaScript at the repository root.
- No root `package.json`, no `netlify.toml`, and no traditional build step.
- Public static files include root HTML, `assets/`, `oauth/consent/`, `manifest.webmanifest`, `OneSignalSDKWorker.js`, `academia-enhancements.js` and `enhancements.css`.
- Netlify Functions that must be migrated:
  - `netlify/functions/admin-api.js`
  - `netlify/functions/giphy-config.js`
  - `netlify/functions/posthog-analytics.js`
- Existing frontend calls use:
  - `/.netlify/functions/admin-api`
  - `/.netlify/functions/giphy-config`
  - `/.netlify/functions/posthog-analytics`
- Prefer preserving those exact paths in the Worker initially to avoid unnecessary frontend changes.

## Recommended Worker design

Use Workers Static Assets, not a new Pages project.

Staging Worker created: `odontoudec-staging` (currently a placeholder health response only; no application assets or migrated functions deployed yet).

Proposed configuration:
- `main: src/worker.js`
- `assets.directory: ./`
- `assets.binding: ASSETS`
- `assets.run_worker_first: ["/.netlify/functions/*"]`
- `assets.html_handling: "none"` to preserve the existing multi-page URL structure.
- `workers_dev: true` for staging tests.
- No SPA fallback: this is a multi-page site, not a client-side SPA.

Because the repository root contains server-side and internal files, add a root `.assetsignore` before deploying. Exclude at minimum:
- `src/`
- `netlify/`
- `supabase/`
- `docs/`
- `scripts/`
- `wrangler.jsonc`
- `.assetsignore`
- `README.md`
- `CONFIGURACION_MENSAJES.md`

The static asset directory must not publish Netlify Functions, Supabase migrations/configuration, internal docs, test scripts, or Worker source.

## Worker secrets required

Map existing Netlify environment values to Cloudflare Worker secrets without printing them in code or committing them:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (the provided `sb_publishable_` key is supported)
- One of `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS` (server-side `sb_secret_` keys are supported by the existing admin function)
- `GIPHY_API_KEY`
- `GIPHY_API_KEY_2`
- `GIPHY_API_KEY_3`
- `POSTHOG_PERSONAL_API_KEY`

The current Netlify `giphy-config.js` still maps private to `_1` and groups to `_2`. The Cloudflare port must map the supplied keys as community=`GIPHY_API_KEY`, private=`GIPHY_API_KEY_2`, groups=`GIPHY_API_KEY_3`.

Preserve the current authorization checks. The admin API must continue validating the Supabase session and the `is_admin` RPC before using the service key. GIPHY keys must only be returned to authenticated users. PostHog queries must remain admin-only.

## Cloudflare account and domain setup

- Cloudflare account connection is active.
- Existing Workers subdomain: `andressimonyepezarrieta23`.
- New staging Worker: `odontoudec-staging`; created 2026-11-16 with a temporary placeholder response. Do not treat it as the migrated application yet.
- The five user-provided bindings are stored on `odontoudec-staging` as `secret_text`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GIPHY_API_KEY`, `GIPHY_API_KEY_2`, and `GIPHY_API_KEY_3`.
- The two private bindings `SUPABASE_SERVICE_ROLE_KEY` and `POSTHOG_PERSONAL_API_KEY` remain pending. Netlify's environment-variable listing confirms they exist for production but masks their values, so they cannot be copied from the connector. The user must supply them or create replacement keys in Supabase/PostHog and then add them to Cloudflare. Never commit any of these values to Git.
- An older Worker named `odontoudec` exists from 2026-11-08. It has assets but no custom domain. Do not overwrite it until its purpose is confirmed.
- Zone `odontoudec.online` has been created and is currently `pending`.
- Cloudflare assigned nameservers:
  - `keira.ns.cloudflare.com`
  - `pranab.ns.cloudflare.com`
- Do not update registrar nameservers yet. Cowabi public help confirms the account route `Dominios → Mis dominios → Gestionar dominio`; its DNS-record article then uses the blue `Gestionar DNS & Cloudflare` button and `DNS` tab. The actual nameserver edit control has not been confirmed in the account UI and must be checked before saving.
- Cloudflare reports registrar `INWX GmbH`. The original nameservers returned by the zone API were `please-verify-email.domrobot.com` and `unverified-email.domrobot.com`; verify the registrar/domain status before cutover.
- Cloudflare's DNS scan suggested A/AAAA records for apex, www and wildcard pointing to `185.181.104.140` and `2a0a:c980:4:8c::`. These scan suggestions were not accepted because they do not match Netlify's documented standard apex target and the AAAA records should not be carried over blindly.

## DNS records already prepared in the pending Cloudflare zone

Temporary DNS-only Netlify fallback:
- Apex A: `odontoudec.online -> 75.2.60.5`
- WWW CNAME: `www.odontoudec.online -> odontoudec.netlify.app`

Resend verified sender domain:
- Domain: `auth.odontoudec.online`
- Sending is enabled; receiving is disabled.
- DNS-only records were added to the pending Cloudflare zone:
  - TXT `resend._domainkey.auth.odontoudec.online`
  - CNAME `rsend.auth.odontoudec.online -> rsend-sae1.forge.rmta.net`
  - CNAME `send.auth.odontoudec.online -> send.forge.rmta.net`
- Do not proxy these mail/authentication records.

These Cloudflare zone records do not affect live traffic until the registrar delegates the domain to Cloudflare.

Resend verification was checked again on 2026-11-16: `auth.odontoudec.online` remains `verified`, sending enabled, receiving disabled. Its DKIM TXT and two SPF CNAME records are present in the pending Cloudflare zone and must remain DNS-only.

## Deployment sequence

1. Start from the live production baseline now present on `migration/cloudflare-workers`.
2. Implement Worker code and Static Assets config on that branch.
3. Connect `odontoudec-staging` to the repository through Workers Builds or deploy it from the branch. Keep the older `odontoudec` Worker untouched.
4. Finish adding the Worker secrets in Cloudflare. Netlify returns the private service-role and PostHog values masked, so do not assume they can be copied from the Netlify connector. Never place secrets in Git.
4. Deploy and test on `odontoudec-staging.andressimonyepezarrieta23.workers.dev`.
5. Verify public pages, exact HTML routes, PWA manifest/service worker, Supabase login/registration/recovery/OAuth, chat, GIPHY, admin actions, PostHog admin metrics, OneSignal, and all forms.
6. Keep Netlify live while testing. Only after staging passes, verify registrar/domain status and DNS records, then update nameservers to the Cloudflare pair.
7. Once the zone is active, attach `odontoudec.online` and `www.odontoudec.online` to the production Worker. Confirm HTTPS and end-to-end flows.
8. Keep Netlify available for rollback until Cloudflare production is confirmed stable. Delete/disable Netlify only after explicit final verification.

## Important implementation note

Do not use `not_found_handling: "single-page-application"`; this site has many independent HTML pages. Preserve existing paths and query strings. Avoid changing application behavior while moving the hosting/runtime layer.


## Verified follow-up state — 2026-11-16

- Live Netlify deployment remains the SEO-enabled build from commit `ddc1822157570d9a48e68416a2b78de11397223a`; the attempted revert to `891afcb97e2fc75a715c8a677352cebf9620fd43` was skipped.
- The migration branch is now based on the live deployment commit, not the skipped rollback.
- The Cloudflare staging Worker `odontoudec-staging` exists but is only a placeholder; it does not yet host the website.
- The staging Worker currently has five confirmed secret bindings: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GIPHY_API_KEY`, `GIPHY_API_KEY_2`, and `GIPHY_API_KEY_3`. `SUPABASE_SERVICE_ROLE_KEY` and `POSTHOG_PERSONAL_API_KEY` remain pending.
- Netlify's environment-variable response masks `SUPABASE_SERVICE_ROLE_KEY` and `POSTHOG_PERSONAL_API_KEY`; create new credentials in Supabase/PostHog if their original values are not available locally.
- PostHog HogQL endpoint requires a personal API key with the Query Read permission. Existing code targets US Cloud project `714898` at `https://us.posthog.com`.
- Cowabi has no connected app/API in this workspace. The user must perform the registrar nameserver change in Cowabi's customer panel; do not claim that it has been linked.
- Before cutover, audit the full current DNS zone in Cowabi, especially any MX/TXT records and other subdomains. Cloudflare's scan suggested wildcard and AAAA records, but these were not imported because their necessity and target were not confirmed.
