// Builds a reviewable release artifact only. Never uploads assets or deploys.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const output = new URL('../.cloudflare-build/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [name, factory] of [['admin-api','createAdminHandler'],['giphy-config','createGiphyHandler'],['posthog-analytics','createPosthogHandler']]) {
  let source = await readFile(new URL(`netlify/functions/${name}.js`, root), 'utf8');
  if ((source.match(/exports\.handler = async function/g) || []).length !== 1) throw new Error(`Unexpected handler contract: ${name}`);
  source = source.replaceAll('process.env', 'env').replace('exports.handler = async function', 'return async function');
  await writeFile(new URL(`${name}.mjs`, output), `export function ${factory}(env) {\n${source}\n}\n`);
}
await writeFile(new URL('worker.mjs', output), await readFile(new URL('cloudflare/worker.mjs', root)));
console.log('Cloudflare artifact built; no deployment performed.');
