// Início personalizável: cada usuário monta o seu painel (cartões do sistema,
// post-its, links, fotos e vídeos), com posição e tamanho. O layout fica no
// banco (por usuário, então acompanha a pessoa em qualquer aparelho) e os
// arquivos enviados ficam numa pasta ao lado do banco (mesmo volume do Docker).
import path from "node:path";
import fs from "node:fs";
import { db, dbPath } from "./db.js";

export const INICIO_DIR = path.join(path.dirname(dbPath), "inicio-arquivos");
fs.mkdirSync(INICIO_DIR, { recursive: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS inicio_layout (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export const INICIO_IMAGEM_MAX_MB = 15;
export const INICIO_VIDEO_MAX_MB = 150;
export const INICIO_TIPOS_ARQUIVO = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);

const SISTEMA = new Set([
  "stat-materias", "stat-opec", "stat-tarefas", "stat-atraso",
  "painel-opec", "painel-breve", "painel-tarefas", "painel-materias", "painel-espelho",
]);
const CORES = new Set(["amarelo", "rosa", "verde", "azul", "roxo", "laranja"]);
const MAX_CARTOES = 60;
const NOME_ARQUIVO = /^[A-Za-z0-9_-]+-[0-9a-f-]{36}\.[A-Za-z0-9]{1,6}$/;
const URL_ARQUIVO = /^\/api\/inicio\/arquivos\/([A-Za-z0-9_.-]+)$/;

const txt = (v, max) => String(v ?? "").slice(0, max);
const inteiro = (v, min, max, pad) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad;
};
// Só http(s) — nada de javascript: ou data: em links/fontes de mídia.
function urlSegura(v) {
  const s = String(v ?? "").trim().slice(0, 1000);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : "";
}
function fonteMidia(v, userId) {
  const s = String(v ?? "").trim();
  const m = URL_ARQUIVO.exec(s);
  if (m) return m[1].startsWith(`${userId}-`) && NOME_ARQUIVO.test(m[1]) ? s : "";
  return urlSegura(s);
}

export function sanitizarLayout(body, userId) {
  const lista = Array.isArray(body?.cartoes) ? body.cartoes.slice(0, MAX_CARTOES) : null;
  if (!lista) return { error: "Layout inválido." };
  const vistos = new Set();
  const cartoes = [];
  for (const c of lista) {
    const id = txt(c?.id, 60).replace(/[^A-Za-z0-9_-]/g, "");
    if (!id || vistos.has(id)) continue;
    const base = { id, x: inteiro(c.x, 0, 11, 0), y: inteiro(c.y, 0, 2000, 0), w: inteiro(c.w, 1, 12, 4), h: inteiro(c.h, 1, 40, 4) };
    base.x = Math.min(base.x, 12 - base.w);
    const tipo = c.tipo;
    let extra;
    if (tipo === "sistema") {
      if (!SISTEMA.has(c.ref)) continue;
      if (cartoes.some((k) => k.tipo === "sistema" && k.ref === c.ref)) continue;
      extra = { tipo, ref: c.ref };
    } else if (tipo === "postit") {
      extra = { tipo, texto: txt(c.texto, 3000), cor: CORES.has(c.cor) ? c.cor : "amarelo" };
    } else if (tipo === "links") {
      const itens = (Array.isArray(c.itens) ? c.itens : []).slice(0, 40)
        .map((i) => ({ nome: txt(i?.nome, 80).trim(), url: urlSegura(i?.url) }))
        .filter((i) => i.url);
      extra = { tipo, titulo: txt(c.titulo, 60), itens };
    } else if (tipo === "imagem") {
      extra = { tipo, src: fonteMidia(c.src, userId), legenda: txt(c.legenda, 120), ajuste: c.ajuste === "conter" ? "conter" : "cobrir" };
    } else if (tipo === "video") {
      extra = { tipo, src: fonteMidia(c.src, userId), legenda: txt(c.legenda, 120) };
    } else if (tipo === "tempo") {
      const lat = Number(c.lat), lon = Number(c.lon);
      const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
      extra = { tipo, cidade: txt(c.cidade, 120).trim(), lat: ok ? Math.round(lat * 1e4) / 1e4 : null, lon: ok ? Math.round(lon * 1e4) / 1e4 : null };
    } else if (tipo === "site") {
      extra = { tipo, titulo: txt(c.titulo, 60).trim(), url: urlSegura(c.url) };
    } else continue;
    vistos.add(id);
    cartoes.push({ ...base, ...extra });
  }
  return { layout: { v: 2, cartoes } };
}

export function getLayout(userId) {
  const r = db.prepare(`SELECT data FROM inicio_layout WHERE user_id = ?`).get(userId);
  if (!r) return null;
  try { return JSON.parse(r.data); } catch { return null; }
}

function arquivosReferenciados(layout) {
  const nomes = new Set();
  for (const c of layout?.cartoes || []) {
    const m = URL_ARQUIVO.exec(c.src || "");
    if (m) nomes.add(m[1]);
  }
  return nomes;
}

// Apaga da pasta os arquivos do usuário que nenhum cartão usa mais. Arquivos
// recém-enviados (menos de 15 min) são poupados: a pessoa pode ter enviado e
// ainda não ter salvado o layout.
export function limparArquivosDoUsuario(userId, layout, todos = false) {
  const em_uso = arquivosReferenciados(layout);
  for (const nome of fs.readdirSync(INICIO_DIR)) {
    if (!nome.startsWith(`${userId}-`) || em_uso.has(nome)) continue;
    const caminho = path.join(INICIO_DIR, nome);
    try {
      if (todos || Date.now() - fs.statSync(caminho).mtimeMs > 15 * 60 * 1000) fs.unlinkSync(caminho);
    } catch { /* já sumiu */ }
  }
}

export function salvarLayout(userId, layout) {
  db.prepare(`INSERT INTO inicio_layout (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(userId, JSON.stringify(layout));
  limparArquivosDoUsuario(userId, layout);
}

export function restaurarLayout(userId) {
  db.prepare(`DELETE FROM inicio_layout WHERE user_id = ?`).run(userId);
  limparArquivosDoUsuario(userId, null);
}

export function apagarDadosDoUsuario(userId) {
  db.prepare(`DELETE FROM inicio_layout WHERE user_id = ?`).run(userId);
  limparArquivosDoUsuario(userId, null, true);
}

export function caminhoArquivo(userId, nome) {
  if (!nome.startsWith(`${userId}-`) || !NOME_ARQUIVO.test(nome)) return null;
  const c = path.join(INICIO_DIR, nome);
  return fs.existsSync(c) ? c : null;
}

// ---- Espaço por usuário (Configurações > Geral) ----
// Limite, em GB, do que cada pessoa pode guardar de fotos e vídeos enviados.
export const INICIO_QUOTA_PADRAO_GB = 1;
export const INICIO_QUOTA_FAIXA_GB = [0.1, 500];

export function getQuotaGB() {
  const r = db.prepare(`SELECT valor FROM app_config WHERE chave = 'inicio_quota_gb'`).get();
  const n = r ? Number(r.valor) : NaN;
  return Number.isFinite(n) && n >= INICIO_QUOTA_FAIXA_GB[0] ? n : INICIO_QUOTA_PADRAO_GB;
}
export function setQuotaGB(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  const [min, max] = INICIO_QUOTA_FAIXA_GB;
  if (!Number.isFinite(n) || n < min || n > max) return { error: `Informe um valor entre ${String(min).replace(".", ",")} e ${max} GB.` };
  const v = Math.round(n * 100) / 100;
  db.prepare(`INSERT INTO app_config (chave, valor) VALUES ('inicio_quota_gb', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`).run(String(v));
  return { quotaGB: v };
}
export function restaurarQuotaGB() {
  db.prepare(`DELETE FROM app_config WHERE chave = 'inicio_quota_gb'`).run();
}

// Bytes usados por cada usuário (arquivos "<idDoUsuario>-<uuid>.<ext>").
export function usoPorUsuario() {
  const uso = new Map();
  for (const nome of fs.readdirSync(INICIO_DIR)) {
    const m = nome.match(/^(.+)-[0-9a-f-]{36}\.[A-Za-z0-9]{1,6}$/);
    if (!m) continue;
    try { uso.set(m[1], (uso.get(m[1]) || 0) + fs.statSync(path.join(INICIO_DIR, nome)).size); } catch { /* sumiu */ }
  }
  return uso;
}
export function usoDoUsuario(userId, ignorar) {
  let total = 0;
  for (const nome of fs.readdirSync(INICIO_DIR)) {
    if (!nome.startsWith(`${userId}-`) || nome === ignorar) continue;
    try { total += fs.statSync(path.join(INICIO_DIR, nome)).size; } catch { /* sumiu */ }
  }
  return total;
}
