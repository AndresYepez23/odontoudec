import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const frontend = readFileSync(new URL("../assets/encuesta-estudiantil-data.js", import.meta.url), "utf8");
const backend = readFileSync(new URL("../supabase/functions/survey-submissions/index.ts", import.meta.url), "utf8");

function frontendCategories(source) {
  const categories = [];
  const re = /\{ id: "([^"]+)", title: "([^"]+)", required: true,([^]*?)\}/g;
  for (const match of source.matchAll(re)) {
    const optionsBlock = match[3].match(/options: \[([^]*?)\]/);
    categories.push({
      id: match[1],
      title: match[2],
      type: /type: "free_text"/.test(match[3]) ? "text" : "choice",
      options: optionsBlock ? [...optionsBlock[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : []
    });
  }
  return categories;
}

function backendOptions(source) {
  const start = source.indexOf("const OPTIONS:");
  const end = source.indexOf("const TEXT_FIELDS", start);
  assert(start >= 0 && end > start, "No se encontró el catálogo OPTIONS del backend.");
  const block = source.slice(start, end);
  const result = new Map();
  const re = /\s{2}([a-z_]+): \[([^]*?)\](?:,|\n)/g;
  for (const match of block.matchAll(re)) {
    result.set(match[1], [...match[2].matchAll(/"([^"]+)"/g)].map(x => x[1]));
  }
  return result;
}

const categories = frontendCategories(frontend);
const options = backendOptions(backend);
const textFieldsMatch = backend.match(/const TEXT_FIELDS = \[([^]*?)\];/);
assert(textFieldsMatch, "No se encontró TEXT_FIELDS en el backend.");
const backendText = [...textFieldsMatch[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);

assert.equal(categories.length, 15, "La encuesta debe tener exactamente 15 categorías.");
const frontendChoice = categories.filter(x => x.type === "choice");
const frontendText = categories.filter(x => x.type === "text");
assert.equal(frontendChoice.length, 8, "Deben existir 8 categorías de selección.");
assert.equal(frontendText.length, 7, "Deben existir 7 categorías abiertas.");
assert.deepEqual([...options.keys()], frontendChoice.map(x => x.id), "Las categorías de selección del backend no coinciden con el frontend.");
for (const category of frontendChoice) {
  assert.deepEqual(options.get(category.id), category.options, `Opciones distintas en ${category.id}`);
}
assert.deepEqual(backendText, frontendText.map(x => x.id), "Los campos abiertos del backend no coinciden con el frontend.");
assert.match(backend, /auth\.getUser\(token\)/, "Falta validar el JWT en servidor.");
assert.match(backend, /role\?\.role !== "admin"/, "Falta autorización administrativa en servidor.");
assert.match(backend, /23505/, "Falta manejo de duplicados.");
console.log("OK: 15 categorías, 8 catálogos exactos, 7 campos abiertos y controles de autenticación/autorización/duplicados.");
