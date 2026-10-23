import path from "node:path";
import fs from "node:fs";
import { db, dbPath, getUserById, listUsers, nomeExibicao } from "./db.js";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

// Anexos do Chat ficam ao lado do banco (mesmo volume do Docker, ver
// docker-compose.yml) — não dentro da pasta da aplicação, que é
// substituída inteira a cada `docker compose up -d --build`. Assim os
// arquivos sobrevivem a atualizações do sistema, igual o banco de dados.
export const UPLOADS_DIR = path.join(path.dirname(dbPath), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Fotos de perfil (de usuário ou de grupo de conversa) — pasta separada dos
// anexos de mensagem porque a regra de acesso é diferente: um anexo de
// mensagem só pode ser baixado por quem participa daquela conversa
// específica (ver arquivoPertenceAUsuario), enquanto uma foto de perfil é
// visível pra qualquer pessoa logada no sistema (aparece na lista de
// conversas, no "escolher pra quem mandar mensagem" etc. — a mesma visão
// que já existe hoje do nome de todo mundo).
export const AVATARS_DIR = path.join(path.dirname(dbPath), "avatars");
fs.mkdirSync(AVATARS_DIR, { recursive: true });

// ---- Limites dos anexos do Chat ----
// Tamanho máximo por arquivo, quanto tempo o arquivo fica guardado e o teto
// de espaço de toda a pasta de anexos. Ajustáveis por variável de ambiente
// (docker-compose.yml) sem mexer no código; os padrões são os combinados:
// 200 MB por arquivo, 14 dias, 20 GB no total.
const numeroEnv = (nome, padrao) => {
  const n = Number(process.env[nome]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};
const PADROES_LIMITES = {
  maxMB: numeroEnv("ANEXO_MAX_MB", 200),
  retencaoDias: numeroEnv("ANEXO_RETENCAO_DIAS", 14),
  quotaGB: numeroEnv("ANEXOS_QUOTA_GB", 20),
};

// Os mesmos valores podem ser trocados pela tela (Configurações > Chat); o
// que for salvo lá fica no banco e vale no lugar das variáveis de ambiente.
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    max_mb REAL,
    retencao_dias REAL,
    quota_gb REAL
  )
`);
db.prepare(`INSERT OR IGNORE INTO chat_config (id) VALUES (1)`).run();

export const LIMITES_FAIXA = { maxMB: [1, 1000], retencaoDias: [1, 365], quotaGB: [1, 2000] };

export function getLimitesChat() {
  const r = db.prepare(`SELECT * FROM chat_config WHERE id = 1`).get();
  return {
    maxMB: r.max_mb ?? PADROES_LIMITES.maxMB,
    retencaoDias: r.retencao_dias ?? PADROES_LIMITES.retencaoDias,
    quotaGB: r.quota_gb ?? PADROES_LIMITES.quotaGB,
  };
}

export function setLimitesChat({ maxMB, retencaoDias, quotaGB }) {
  const valores = { maxMB, retencaoDias, quotaGB };
  const nomes = { maxMB: "Tamanho máximo do anexo", retencaoDias: "Dias de guarda", quotaGB: "Limite total" };
  for (const [k, [min, max]] of Object.entries(LIMITES_FAIXA)) {
    const n = Number(valores[k]);
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${nomes[k]}: informe um número entre ${min} e ${max}.` };
  }
  db.prepare(`UPDATE chat_config SET max_mb = ?, retencao_dias = ?, quota_gb = ? WHERE id = 1`).run(Number(maxMB), Number(retencaoDias), Number(quotaGB));
  return getLimitesChat();
}

export function restaurarLimitesChat() {
  db.prepare(`UPDATE chat_config SET max_mb = NULL, retencao_dias = NULL, quota_gb = NULL WHERE id = 1`).run();
  return getLimitesChat();
}

// "conversas": uma linha por conversa (privada entre 2 pessoas, ou grupo
// com várias). "mensagens" tem uma coluna própria `conversa_id` (em vez de
// guardar tudo dentro do JSON de `data`, como as coleções genéricas fazem)
// porque aqui a consulta mais comum é "me dê as últimas N mensagens DESSA
// conversa" — com um índice em conversa_id isso é rápido mesmo com muito
// histórico acumulado; filtrar por um campo dentro de um JSON gigante não
// seria. "conversas_lidas" guarda, por pessoa e por conversa, até quando
// ela já viu as mensagens — é o que permite calcular "não lidas".
db.exec(`
  CREATE TABLE IF NOT EXISTS conversas (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mensagens (
    id TEXT PRIMARY KEY,
    conversa_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id, created_at);
  CREATE TABLE IF NOT EXISTS conversas_lidas (
    conversa_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_read_at TEXT NOT NULL,
    PRIMARY KEY (conversa_id, user_id)
  );
`);

function parseConversa(row) {
  if (!row) return null;
  return { ...JSON.parse(row.data), id: row.id, updatedAt: row.updated_at };
}

function parseMensagem(row) {
  if (!row) return null;
  return { ...JSON.parse(row.data), id: row.id, conversaId: row.conversa_id, createdAt: row.created_at };
}

function getConversaRaw(id) {
  const row = db.prepare(`SELECT * FROM conversas WHERE id = ?`).get(id);
  return parseConversa(row);
}

function souParticipante(conversa, userId) {
  return !!conversa && (conversa.participantes || []).includes(userId);
}

function ultimaMensagem(conversaId) {
  const row = db.prepare(`SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(conversaId);
  return parseMensagem(row);
}

function marcarComoLidaInterno(conversaId, userId, quando) {
  db.prepare(
    `INSERT INTO conversas_lidas (conversa_id, user_id, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT(conversa_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(conversaId, userId, quando);
}

function contarNaoLidas(conversaId, userId) {
  const lida = db.prepare(`SELECT last_read_at FROM conversas_lidas WHERE conversa_id = ? AND user_id = ?`).get(conversaId, userId);
  const desde = lida?.last_read_at || "0000-01-01T00:00:00.000Z";
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM mensagens WHERE conversa_id = ? AND created_at > ? AND json_extract(data, '$.autorId') != ?`)
    .get(conversaId, desde, userId);
  return row.c;
}

// Lista as conversas de que o usuário participa, mais recentes primeiro
// (pela última mensagem, ou pela criação se ainda não tem mensagem
// nenhuma), já com a última mensagem e a contagem de não lidas embutidas —
// evita a tela precisar de uma chamada por conversa só pra montar a lista.
export function listConversas(userId) {
  const rows = db.prepare(`SELECT * FROM conversas`).all();
  const conversas = rows.map(parseConversa).filter((c) => souParticipante(c, userId));
  return conversas
    .map((c) => {
      const ultima = ultimaMensagem(c.id);
      return {
        ...c,
        ultimaMensagem: ultima,
        naoLidas: contarNaoLidas(c.id, userId),
        ordenarPor: ultima?.createdAt || c.createdAt,
      };
    })
    .sort((a, b) => (b.ordenarPor || "").localeCompare(a.ordenarPor || ""));
}

export function totalNaoLidas(userId) {
  return listConversas(userId).reduce((s, c) => s + c.naoLidas, 0);
}

export function getConversa(id, userId) {
  const c = getConversaRaw(id);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  return c;
}

// Conversa privada é identificada pelos 2 participantes (em qualquer
// ordem) — reaproveita se já existir uma entre essas 2 pessoas, em vez de
// criar uma nova toda vez que alguém clica em "conversar" com quem já
// tinha conversado antes.
export function criarOuAbrirPrivada(userId, outroUserId) {
  if (userId === outroUserId) return "self";
  const outro = getUserById(outroUserId);
  if (!outro) return null;
  const rows = db.prepare(`SELECT * FROM conversas`).all();
  const existente = rows
    .map(parseConversa)
    .find((c) => c.tipo === "privada" && c.participantes.length === 2 && c.participantes.includes(userId) && c.participantes.includes(outroUserId));
  if (existente) return existente;
  const id = uid();
  const item = {
    tipo: "privada",
    participantes: [userId, outroUserId],
    criadoPor: userId,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO conversas (id, data) VALUES (?, ?)`).run(id, JSON.stringify(item));
  return { ...item, id };
}

export function criarGrupo(userId, nome, participanteIds) {
  const nomeOk = (nome || "").trim();
  if (!nomeOk) return "sem-nome";
  const idsValidos = [...new Set([userId, ...(participanteIds || [])])].filter((id) => getUserById(id));
  if (idsValidos.length < 2) return "poucos-participantes";
  const id = uid();
  const item = {
    tipo: "grupo",
    nome: nomeOk,
    participantes: idsValidos,
    criadoPor: userId,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO conversas (id, data) VALUES (?, ?)`).run(id, JSON.stringify(item));
  return { ...item, id };
}

// Qualquer participante pode renomear, adicionar ou remover alguém do
// grupo — não existe um papel de "dono"/admin do grupo separado (time
// pequeno, não precisa dessa complexidade); só não pode mexer em conversa
// privada (não tem o que renomear ou adicionar ali) nem ficar com menos
// de 2 participantes.
export function renomearGrupo(id, userId, nome) {
  const c = getConversaRaw(id);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  if (c.tipo !== "grupo") return "nao-e-grupo";
  const nomeOk = (nome || "").trim();
  if (!nomeOk) return "sem-nome";
  const updated = { ...c, nome: nomeOk };
  db.prepare(`UPDATE conversas SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(updated), id);
  return updated;
}

// `foto` é o nome do arquivo já salvo em AVATARS_DIR, ou null pra remover
// (volta a mostrar o ícone de grupo genérico). Mesma regra de permissão
// de renomearGrupo: qualquer participante pode trocar a foto do grupo. Quem
// chama e precisar apagar o arquivo antigo do disco deve ler `c.foto` com
// getConversa() ANTES de chamar esta função (ela não devolve o valor
// anterior, pra não vazar esse detalhe interno no JSON de resposta).
export function definirFotoGrupo(id, userId, foto) {
  const c = getConversaRaw(id);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  if (c.tipo !== "grupo") return "nao-e-grupo";
  const updated = { ...c, foto: foto || null };
  db.prepare(`UPDATE conversas SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(updated), id);
  return updated;
}

// Apaga o grupo inteiro (conversa + todas as mensagens + marcações de
// lida) — ao contrário de renomear/adicionar/remover participante, isso
// SÓ quem criou o grupo pode fazer (não é "qualquer participante", porque
// apagar é uma ação destrutiva e sem volta pra todo mundo do grupo, bem
// diferente de só sair dele). Devolve os nomes dos arquivos (foto do
// grupo + anexos das mensagens apagadas) pra quem chamou remover do disco
// — esta função só mexe no banco, igual o resto do módulo.
export function apagarGrupo(id, userId) {
  const c = getConversaRaw(id);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  if (c.tipo !== "grupo") return "nao-e-grupo";
  if (c.criadoPor !== userId) return "nao-e-criador";
  const anexos = db
    .prepare(`SELECT data FROM mensagens WHERE conversa_id = ?`)
    .all(id)
    .map((row) => JSON.parse(row.data)?.anexo?.arquivo)
    .filter(Boolean);
  db.prepare(`DELETE FROM mensagens WHERE conversa_id = ?`).run(id);
  db.prepare(`DELETE FROM conversas_lidas WHERE conversa_id = ?`).run(id);
  db.prepare(`DELETE FROM conversas WHERE id = ?`).run(id);
  return { participantes: c.participantes, foto: c.foto || null, anexos };
}

export function adicionarParticipantes(id, userId, novosIds) {
  const c = getConversaRaw(id);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  if (c.tipo !== "grupo") return "nao-e-grupo";
  const validos = (novosIds || []).filter((nid) => getUserById(nid) && !c.participantes.includes(nid));
  if (validos.length === 0) return c;
  const updated = { ...c, participantes: [...c.participantes, ...validos] };
  db.prepare(`UPDATE conversas SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(updated), id);
  return updated;
}

// Tanto "remover outra pessoa" quanto "sair do grupo" (quando alvoId ===
// userId) passam por aqui. Não deixa esvaziar o grupo — com só 1 sobrando
// ele viraria uma conversa "privada" disfarçada, e mais confuso que isso é
// simplesmente barrar (quem quiser encerrar o grupo de vez usa apagarGrupo,
// abaixo — essa sim é uma ação só de quem criou).
export function removerParticipante(id, userId, alvoId) {
  const c = getConversaRaw(id);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  if (c.tipo !== "grupo") return "nao-e-grupo";
  if (!c.participantes.includes(alvoId)) return c;
  if (c.participantes.length <= 2) return "minimo-participantes";
  const updated = { ...c, participantes: c.participantes.filter((p) => p !== alvoId) };
  db.prepare(`UPDATE conversas SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(updated), id);
  return updated;
}

export function listMensagens(conversaId, userId, { before, limit } = {}) {
  const c = getConversaRaw(conversaId);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  let rows;
  if (before) {
    rows = db
      .prepare(`SELECT * FROM mensagens WHERE conversa_id = ? AND created_at < ? ORDER BY created_at DESC, rowid DESC LIMIT ?`)
      .all(conversaId, before, lim);
  } else {
    rows = db.prepare(`SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`).all(conversaId, lim);
  }
  return rows.map(parseMensagem).reverse();
}

// Resumo da mensagem original que fica gravado junto da resposta ("citação").
// É uma cópia de propósito: se a original for apagada depois, a resposta
// continua mostrando a que ela se refere.
function resumoParaCitacao(msg) {
  const texto = (msg.texto || "").replace(/\s+/g, " ").trim();
  return {
    id: msg.id,
    autorId: msg.autorId,
    autorNome: msg.autorNome,
    texto: texto.length > 140 ? `${texto.slice(0, 140)}…` : texto,
    anexoNome: msg.anexo?.nomeOriginal || null,
    anexoTipo: msg.anexo?.tipo || null,
  };
}

export function criarMensagem(conversaId, userId, { texto, anexo, respostaA }) {
  const c = getConversaRaw(conversaId);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  const textoOk = (texto || "").trim();
  if (!textoOk && !anexo) return "vazia";
  const autor = getUserById(userId);
  const id = uid();
  // Resposta a uma mensagem específica: a original precisa ser da MESMA
  // conversa (senão ignora — nunca vaza texto de outra conversa).
  let citacao = null;
  if (respostaA) {
    const orig = db.prepare(`SELECT * FROM mensagens WHERE id = ? AND conversa_id = ?`).get(String(respostaA), conversaId);
    if (orig) citacao = resumoParaCitacao(parseMensagem(orig));
  }
  const item = {
    conversaId,
    autorId: userId,
    autorNome: nomeExibicao(autor),
    texto: textoOk,
    anexo: anexo || null,
    respostaA: citacao,
    reacoes: {},
  };
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO mensagens (id, conversa_id, data, created_at) VALUES (?, ?, ?, ?)`).run(id, conversaId, JSON.stringify(item), createdAt);
  // Quem manda a mensagem já "leu" ela — evita a própria mensagem virar
  // "não lida" pra quem acabou de escrever.
  marcarComoLidaInterno(conversaId, userId, createdAt);
  return { ...item, id, createdAt };
}

// Reação (emoji) a uma mensagem — cada pessoa tem no máximo UMA reação por
// mensagem: escolher outro emoji troca, escolher o mesmo (ou mandar vazio)
// tira. Fica guardada dentro dos dados da mensagem: { userId: emoji }.
export function reagirMensagem(conversaId, userId, mensagemId, emoji) {
  const c = getConversaRaw(conversaId);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  const row = db.prepare(`SELECT * FROM mensagens WHERE id = ? AND conversa_id = ?`).get(mensagemId, conversaId);
  if (!row) return "sem-mensagem";
  const limpo = typeof emoji === "string" ? emoji.trim() : "";
  if (limpo.length > 16) return "emoji-invalido";
  const data = JSON.parse(row.data);
  const reacoes = { ...(data.reacoes || {}) };
  if (!limpo || reacoes[userId] === limpo) delete reacoes[userId];
  else reacoes[userId] = limpo;
  data.reacoes = reacoes;
  db.prepare(`UPDATE mensagens SET data = ? WHERE id = ?`).run(JSON.stringify(data), mensagemId);
  return reacoes;
}

export function apagarMensagem(conversaId, userId, mensagemId) {
  const row = db.prepare(`SELECT * FROM mensagens WHERE id = ? AND conversa_id = ?`).get(mensagemId, conversaId);
  if (!row) return false;
  const msg = parseMensagem(row);
  if (msg.autorId !== userId) return "forbidden";
  db.prepare(`DELETE FROM mensagens WHERE id = ?`).run(mensagemId);
  // Apagar a mensagem também apaga o arquivo anexado do disco (antes ele
  // ficava órfão ocupando espaço pra sempre).
  removerArquivoDeAnexo(msg.anexo?.arquivo);
  return true;
}

export function marcarComoLida(conversaId, userId) {
  const c = getConversaRaw(conversaId);
  if (!c) return null;
  if (!souParticipante(c, userId)) return "forbidden";
  marcarComoLidaInterno(conversaId, userId, new Date().toISOString());
  return true;
}

function removerArquivoDeAnexo(nomeArquivo) {
  if (!nomeArquivo || nomeArquivo.includes("/") || nomeArquivo.includes("..")) return 0;
  const caminho = path.join(UPLOADS_DIR, nomeArquivo);
  try {
    const tamanho = fs.statSync(caminho).size;
    fs.unlinkSync(caminho);
    return tamanho;
  } catch {
    return 0;
  }
}

// Troca o anexo de uma mensagem por um aviso de "expirado": o arquivo some do
// disco, mas a mensagem continua na conversa (com nome/tipo/tamanho originais)
// pra ninguém achar que o arquivo sumiu por erro.
function expirarAnexo(row, motivo) {
  const data = JSON.parse(row.data);
  if (!data.anexo?.arquivo) return 0;
  const liberado = removerArquivoDeAnexo(data.anexo.arquivo);
  data.anexo = {
    nomeOriginal: data.anexo.nomeOriginal,
    tipo: data.anexo.tipo,
    tamanho: data.anexo.tamanho,
    arquivo: null,
    expirado: true,
    expiradoMotivo: motivo,
  };
  db.prepare(`UPDATE mensagens SET data = ? WHERE id = ?`).run(JSON.stringify(data), row.id);
  return liberado;
}

function tamanhoDaPastaDeAnexos() {
  let total = 0;
  for (const nome of fs.readdirSync(UPLOADS_DIR)) {
    try {
      total += fs.statSync(path.join(UPLOADS_DIR, nome)).size;
    } catch {}
  }
  return total;
}

// Números para a tela Configurações > Chat (só admin): quanto o chat ocupa.
export function resumoArmazenamentoChat() {
  const anexos = fs.readdirSync(UPLOADS_DIR).filter((n) => {
    try { return fs.statSync(path.join(UPLOADS_DIR, n)).isFile(); } catch { return false; }
  }).length;
  let bancoBytes = 0;
  try { bancoBytes = fs.statSync(dbPath).size; } catch {}
  return {
    conversas: db.prepare(`SELECT COUNT(*) c FROM conversas`).get().c,
    mensagens: db.prepare(`SELECT COUNT(*) c FROM mensagens`).get().c,
    anexosArquivos: anexos,
    anexosBytes: tamanhoDaPastaDeAnexos(),
    bancoBytes,
    ...getLimitesChat(),
    padroes: PADROES_LIMITES,
  };
}

// Teto de espaço: se a pasta de anexos passou de ANEXOS_QUOTA_GB, expira os
// anexos mais antigos primeiro até voltar pra 90% do teto (a folga evita
// rodar a limpeza a cada upload quando está colado no limite).
export function aplicarTetoDeAnexos() {
  const teto = getLimitesChat().quotaGB * 1024 ** 3;
  let usado = tamanhoDaPastaDeAnexos();
  if (usado <= teto) return 0;
  const alvo = teto * 0.9;
  const rows = db
    .prepare(`SELECT id, data FROM mensagens WHERE json_extract(data, '$.anexo.arquivo') IS NOT NULL ORDER BY created_at ASC, rowid ASC`)
    .all();
  let expirados = 0;
  for (const row of rows) {
    if (usado <= alvo) break;
    usado -= expirarAnexo(row, "teto");
    expirados++;
  }
  return expirados;
}

// Limpeza geral (roda ao ligar o servidor e a cada hora): (1) expira anexos
// com mais de ANEXO_RETENCAO_DIAS dias, (2) apaga arquivos órfãos (sem
// mensagem apontando pra eles, com mais de 1 dia), (3) aplica o teto de espaço.
export function limparAnexos() {
  const limite = new Date(Date.now() - getLimitesChat().retencaoDias * 24 * 60 * 60 * 1000).toISOString();
  const velhos = db
    .prepare(`SELECT id, data FROM mensagens WHERE json_extract(data, '$.anexo.arquivo') IS NOT NULL AND created_at < ?`)
    .all(limite);
  let porIdade = 0;
  for (const row of velhos) {
    expirarAnexo(row, "prazo");
    porIdade++;
  }

  const referenciados = new Set(
    db
      .prepare(`SELECT json_extract(data, '$.anexo.arquivo') AS arquivo FROM mensagens WHERE json_extract(data, '$.anexo.arquivo') IS NOT NULL`)
      .all()
      .map((r) => r.arquivo)
  );
  const umDiaAtras = Date.now() - 24 * 60 * 60 * 1000;
  let orfaos = 0;
  for (const nome of fs.readdirSync(UPLOADS_DIR)) {
    if (referenciados.has(nome)) continue;
    try {
      if (fs.statSync(path.join(UPLOADS_DIR, nome)).mtimeMs < umDiaAtras) {
        fs.unlinkSync(path.join(UPLOADS_DIR, nome));
        orfaos++;
      }
    } catch {}
  }

  const porTeto = aplicarTetoDeAnexos();
  if (porIdade || orfaos || porTeto) {
    console.log(`[chat] limpeza de anexos: ${porIdade} por prazo (${getLimitesChat().retencaoDias} dias), ${orfaos} órfãos, ${porTeto} por teto de espaço.`);
  }
  return { porIdade, orfaos, porTeto };
}

// Usado pela rota que serve os arquivos anexados — confirma que o usuário
// pedindo o arquivo participa de alguma conversa onde ele foi enviado,
// antes de liberar o download (sem isso, qualquer pessoa logada poderia
// adivinhar o nome de um arquivo de outra conversa e baixar).
export function arquivoPertenceAUsuario(nomeArquivo, userId) {
  const row = db
    .prepare(`SELECT conversa_id FROM mensagens WHERE json_extract(data, '$.anexo.arquivo') = ? LIMIT 1`)
    .get(nomeArquivo);
  if (!row) return false;
  const c = getConversaRaw(row.conversa_id);
  return souParticipante(c, userId);
}

// Lista de usuários pra escolher em "nova conversa" / "novo grupo" — não
// inclui a própria pessoa, e usa o mesmo nome de exibição do resto do
// sistema (2 primeiros nomes, se cadastrado).
export function listUsuariosParaChat(userId) {
  return listUsers()
    .filter((u) => u.id !== userId)
    .map((u) => ({ id: u.id, username: u.username, displayName: nomeExibicao(u), foto: u.foto || null }));
}
