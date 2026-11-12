/* Bloque «Lo último que subí» del perfil: se arma con tus repositorios públicos reales (GitHub API, sin dependencias).
   - Como módulo: `bloque()` devuelve el Markdown (lo usa perfil/build.mjs para la vista previa).
   - Como script: `node vivo.mjs` reescribe lo que haya entre los marcadores del README.md de la carpeta actual
     (lo corre la GitHub Action cada semana). Solo lee datos públicos: lo privado nunca aparece. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USER = 'jmrojas06';
const EXCLUIR = new Set(['jmrojas06', 'jmrojas06.github.io']); // el propio perfil y el sitio
const DIAS = 150; // solo se muestra lo que se tocó en los últimos 150 días
// Descripciones en español para repositorios cuya descripción en GitHub está en otro idioma (si no hay, se usa la de GitHub)
const DESCRIPCIONES = { AgentSprint: 'Tablero de sprints en Git que le da memoria a los agentes de código: servidor MCP, 10 agentes y filtro de revisión.' };
export const INICIO = '<!-- VIVO:INICIO -->';
export const FIN = '<!-- VIVO:FIN -->';

async function api(ruta, token) {
  const r = await fetch(`https://api.github.com${ruta}`, { headers: { 'User-Agent': `${USER}-perfil`, Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!r.ok) throw new Error(`GitHub API ${r.status} en ${ruta}`);
  return r.json();
}
const fecha = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month.replace(/\./g, '')} ${p.year}`;
};
const limpio = (s) => (s || 'Sin descripción').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const corto = (s, n = 105) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function bloque(token = process.env.GITHUB_TOKEN) {
  const todos = [];
  for (let pagina = 1; pagina <= 3; pagina++) {
    const parte = await api(`/users/${USER}/repos?type=owner&sort=pushed&per_page=100&page=${pagina}`, token);
    todos.push(...parte);
    if (parte.length < 100) break;
  }
  const propios = todos.filter((r) => !r.fork && !r.archived && !r.private && !EXCLUIR.has(r.name) && !r.name.startsWith('skills-'));
  const limite = Date.now() - DIAS * 864e5;
  const recientes = propios.filter((r) => new Date(r.pushed_at).getTime() >= limite).slice(0, 5);

  const filas = recientes.map((r) => `| [${r.name}](${r.html_url}) | ${corto(limpio(DESCRIPCIONES[r.name] || r.description))} | ${r.language || '-'} | ${fecha(r.pushed_at)} |`);
  const tabla = filas.length
    ? `| Repositorio | Qué es | Lenguaje | Último cambio |\n|---|---|---|---|\n${filas.join('\n')}`
    : `Nada nuevo en los últimos ${DIAS} días.`;

  const cuenta = {};
  for (const r of propios) if (r.language) cuenta[r.language] = (cuenta[r.language] || 0) + 1;
  const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0]?.[1] || 1;
  const ancho = Math.max(0, ...top.map(([l]) => l.length));
  const barras = top.map(([l, n]) => `${l.padEnd(ancho)}  ${'█'.repeat(Math.max(1, Math.round((n / max) * 12))).padEnd(12, '░')}  ${n}`).join('\n');

  return `${INICIO}
## Lo último que subí

Se actualiza solo cada semana con mis repositorios públicos.

${tabla}

${barras ? `**Lenguajes de mis repositorios públicos**\n\n\`\`\`text\n${barras}\n\`\`\`\n\n` : ''}<sub>Actualizado el ${fecha(new Date())} por una GitHub Action. Aquí solo aparece lo público.</sub>
${FIN}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archivo = path.resolve('README.md');
  const md = fs.readFileSync(archivo, 'utf8');
  const i = md.indexOf(INICIO), j = md.indexOf(FIN);
  if (i < 0 || j < 0) throw new Error('Faltan los marcadores VIVO en README.md');
  fs.writeFileSync(archivo, md.slice(0, i) + (await bloque()) + md.slice(j + FIN.length));
  console.log('Bloque «Lo último que subí» actualizado.');
}
