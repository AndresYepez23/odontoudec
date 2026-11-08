// OdontoUdeC · Cloudflare Pages
// Habilita el runtime de Pages Functions para variables y secretos del servidor.
// No modifica las respuestas: deja que Pages continúe sirviendo cada recurso.
export async function onRequest(context) {
  return context.next();
}
