# Survey loading incident — 2026-11-23

Confirmed cause: the active `odontoudec-staging` Worker serves KV assets using
`metadata.contentType`, falling back to `application/octet-stream`, with
`X-Content-Type-Options: nosniff`. The published key
`assets/encuesta-estudiantil-data.js` had null metadata. Chromium refused to
execute it; `renderQuestions()` then threw because `ODONTOUDEC_SURVEY` was
undefined. The page remained at “Comprobando tu acceso…”. This was reproduced
with copies of the actual published assets and their response headers.

Production repair: preserved the exact category file contents and restored its
KV metadata to `application/javascript; charset=utf-8`; purged only its URLs.
A public mobile Chromium visit then returned HTTP 200, correct JS MIME, no
script errors, and the sign-in links. No database records, survey answers,
Supabase configuration or authentication requirements were changed.

The HTML additionally catches missing dependencies and session/status failures,
limits each access check to 12 seconds, and provides a reload button and sign-in
links. Failure never reveals the answer form. The versioned category URL avoids
previously cached incorrect response headers in browsers. The same HTML patch
was applied to the published page, preserving its existing robots metadata.

Regression: nine isolated mobile-browser cases cover guest, student, completed
survey, incorrect MIME, missing SDK, session/status errors and session/status
timeouts. Requests are mocked; no submission is made. Run with Playwright
installed: `node tests/survey-loading.cjs`. Optionally set `CHROMIUM_PATH` to a
system Chromium. GitHub Actions installs Playwright 1.62.1 and Chromium.

Deployment requirement: every KV upload/replacement must include the proper
`contentType` metadata. Replacing a value without metadata removes the previous
metadata. Do not weaken `nosniff` to work around a broken publication.

Separate known issue: the existing frontend/backend faculty-option contract
mismatch is not changed by this loading fix. Authenticated tests here use mock
sessions; this incident repair does not certify real submission acceptance.
