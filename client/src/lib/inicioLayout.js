// Início personalizável — regras puras (sem React) do layout de cartões.
// A grade tem 12 colunas; cada cartão tem posição (x, y) e tamanho (w, h).

export const COLUNAS = 12;
export const CORES_POSTIT = ["amarelo", "rosa", "verde", "azul", "roxo", "laranja"];

// A grade tem 12 colunas e as células são QUADRADAS (altura = largura da coluna).
// Qualquer cartão pode ser reduzido até 1x1. O conteúdo se reorganiza conforme o tamanho.
export const MARGEM = 12;
export const versaoLayout = 2;

// Cartões do sistema (os que já existiam).
export const SISTEMA = {
  "stat-materias": { tipo: "stat" },
  "stat-opec": { tipo: "stat" },
  "stat-tarefas": { tipo: "stat" },
  "stat-atraso": { tipo: "stat" },
  "painel-opec": { tipo: "painel" },
  "painel-breve": { tipo: "painel" },
  "painel-tarefas": { tipo: "painel" },
  "painel-materias": { tipo: "painel" },
  "painel-espelho": { tipo: "painel" },
};
export const NOMES_SISTEMA = {
  "stat-materias": "Número: matérias em andamento",
  "stat-opec": "Número: inserções no ar hoje",
  "stat-tarefas": "Número: minhas tarefas",
  "stat-atraso": "Número: contas em atraso",
  "painel-opec": "No ar hoje (OPEC)",
  "painel-breve": "Vencem em breve",
  "painel-tarefas": "Minhas tarefas",
  "painel-materias": "Matérias em andamento",
  "painel-espelho": "Espelhos prestes a expirar",
};
const ORDEM_PADRAO = ["stat-materias", "stat-opec", "stat-tarefas", "stat-atraso", "painel-opec", "painel-breve", "painel-tarefas", "painel-materias", "painel-espelho"];

export const uid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const tamanhoMinimo = () => [1, 1];

// Layouts salvos na versão antiga (linhas de 40px) → células quadradas (~100px).
export function migrarLayout(layout) {
  if (!layout || layout.v === versaoLayout) return layout;
  const k = 52 / 112;
  return { ...layout, v: versaoLayout, cartoes: (layout.cartoes || []).map((c) => ({ ...c, y: Math.round(c.y * k), h: Math.max(1, Math.round(c.h * k)) })) };
}

// Altura inicial (em células) de um painel de lista conforme quantas linhas ele tem.
export const alturaDaLista = (linhas) => Math.min(5, Math.max(2, Math.ceil((90 + Math.min(linhas, 6) * 52) / 100)));

// Arranjo inicial: números em uma linha (dividindo a largura), painéis em duas colunas.
// `alturas` (opcional) = { ref: altura } para os painéis; dois lado a lado usam a maior.
export function layoutPadrao(refsVisiveis, alturas = {}) {
  const lista = ORDEM_PADRAO.filter((r) => refsVisiveis.includes(r));
  const stats = lista.filter((r) => SISTEMA[r].tipo === "stat");
  const paineis = lista.filter((r) => SISTEMA[r].tipo === "painel");
  const cartoes = [];
  const wStat = stats.length ? Math.floor(COLUNAS / stats.length) : 0;
  stats.forEach((ref, i) => cartoes.push({ id: `sis-${ref}`, tipo: "sistema", ref, x: i * wStat, y: 0, w: i === stats.length - 1 ? COLUNAS - i * wStat : wStat, h: 1 }));
  let y = stats.length ? 1 : 0;
  // Painéis uniformes: linhas de 3 (ou 2) com a mesma altura; nunca sobra um sozinho esticado.
  const n = paineis.length;
  const linhas = [];
  let resto = n;
  while (resto > 0) {
    const k = resto >= 5 || resto === 3 ? 3 : resto === 4 ? 2 : resto;
    linhas.push(paineis.slice(n - resto, n - resto + k));
    resto -= k;
  }
  linhas.forEach((par) => {
    const w = COLUNAS / par.length;
    par.forEach((ref, k) => cartoes.push({ id: `sis-${ref}`, tipo: "sistema", ref, x: k * w, y, w, h: 3 }));
    y += 3;
  });
  return cartoes;
}

const BASE = {
  postit: { w: 3, h: 3, extra: { texto: "", cor: "amarelo" } },
  links: { w: 3, h: 3, extra: { titulo: "Meus links", itens: [] } },
  imagem: { w: 4, h: 3, extra: { src: "", legenda: "", ajuste: "cobrir" } },
  video: { w: 4, h: 3, extra: { src: "", legenda: "" } },
  tempo: { w: 3, h: 3, extra: { cidade: "", lat: null, lon: null } },
  site: { w: 6, h: 4, extra: { titulo: "", url: "" } },
};
// Primeira vaga livre (de cima para baixo, da esquerda para a direita) onde
// cabe um cartão w×h; assim o novo cartão aparece ao lado dos outros em vez de
// sempre embaixo de tudo.
export function acharVaga(existentes, w, h) {
  const fundo = existentes.reduce((m, c) => Math.max(m, c.y + c.h), 0);
  const bate = (x, y) => existentes.some((c) => x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y);
  for (let y = 0; y <= fundo; y++) for (let x = 0; x + w <= COLUNAS; x++) if (!bate(x, y)) return { x, y };
  return { x: 0, y: fundo };
}

export function novoCartao(tipo, existentes) {
  const b = BASE[tipo];
  return { id: uid(), tipo, ...acharVaga(existentes, b.w, b.h), w: b.w, h: b.h, ...b.extra };
}

// Cartão do sistema que foi removido pode voltar pelo menu "Adicionar".
export function novoSistema(ref, existentes) {
  const stat = SISTEMA[ref].tipo === "stat";
  const w = stat ? 3 : 4, h = stat ? 1 : 3;
  return { id: `sis-${ref}`, tipo: "sistema", ref, ...acharVaga(existentes, w, h), w, h };
}

export const ordemDePilha = (cartoes) => cartoes.slice().sort((a, b) => a.y - b.y || a.x - b.x);

// Link do YouTube → endereço de "embed"; qualquer outro devolve null.
export function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let id = "";
    if (h === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (h === "youtube.com" || h === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else { const m = /^\/(shorts|embed|live)\/([^/?]+)/.exec(u.pathname); if (m) id = m[2]; }
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

// Aceita "www.site.com" digitado sem https://.
export function normalizarUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
export const urlValida = (v) => { try { const u = new URL(normalizarUrl(v)); return u.hostname.includes("."); } catch { return false; } };
export const ehArquivoProprio = (src) => /^\/api\/inicio\/arquivos\//.test(src || "");
