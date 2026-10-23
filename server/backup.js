import nodemailer from "nodemailer";
import crypto from "crypto";
import { getAppSecret } from "./auth.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, COLLECTIONS, getFuso, hojeISO } from "./db.js";
import { montarEmailBackup, ROTULOS_CONTAGEM, formatarTamanho, textoFrequencia, textoProximo } from "./backupEmail.js";

/* ---------------------------------------------------------
   Exportação e restauração de todos os dados do sistema
--------------------------------------------------------- */

// Junta todas as coleções + usuários (com o hash da senha, não a senha em
// texto puro) + tarefas de TO-DO de todo mundo, num único objeto — é isso
// que vira o arquivo de backup.
export function exportAllData() {
  const data = {};
  for (const col of COLLECTIONS) {
    const rows = db.prepare(`SELECT data FROM ${col} ORDER BY rowid ASC`).all();
    data[col] = rows.map((r) => JSON.parse(r.data));
  }
  const userRows = db
    .prepare(`SELECT id, username, password_hash, role, permissions, created_at FROM users ORDER BY created_at ASC`)
    .all();
  const users = userRows.map((u) => ({
    id: u.id,
    username: u.username,
    passwordHash: u.password_hash,
    role: u.role,
    permissions: u.permissions,
    createdAt: u.created_at,
  }));
  const todoRows = db.prepare(`SELECT data FROM todos ORDER BY rowid ASC`).all();
  const todos = todoRows.map((r) => JSON.parse(r.data));
  return {
    app: "Sintonia",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    users,
    todos,
  };
}

// Substitui TODOS os dados atuais pelos do backup, numa transação (ou tudo
// funciona, ou nada é alterado). Sempre restaura os usuários também, pra
// que o login bata com o momento exato do backup.
// Backups feitos antes da renomeação "espelhos" → "espelho" ainda trazem o
// nome antigo (tanto na lista de dados quanto nas permissões dos usuários).
// Traduz pro nome novo antes de restaurar, senão os espelhos sumiriam e
// quem tinha acesso ao Espelho perderia a permissão.
function normalizarBackupLegado(backup) {
  const data = { ...backup.data };
  if (data.espelho === undefined && Array.isArray(data.espelhos)) data.espelho = data.espelhos;
  delete data.espelhos;
  // Backups anteriores à aba "Clientes / Fornecedores" guardam o cadastro em
  // "clientes". Só traduz quando o backup já tem "contasPagar" (formato
  // recente); num backup muito antigo "clientes" eram as contas a pagar.
  const traduzirClientes = data.contasPagar !== undefined && data.clientesFornecedores === undefined && Array.isArray(data.clientes);
  if (traduzirClientes) { data.clientesFornecedores = data.clientes; delete data.clientes; }
  const users = Array.isArray(backup.users)
    ? backup.users.map((u) => {
        if (!u) return u;
        let perms;
        try { perms = typeof u.permissions === "string" ? JSON.parse(u.permissions || "{}") : { ...(u.permissions || {}) }; }
        catch { return u; }
        if (perms.espelhos !== undefined && perms.espelho === undefined) perms.espelho = perms.espelhos;
        delete perms.espelhos;
        if (traduzirClientes && perms.clientes !== undefined && perms.clientesFornecedores === undefined) perms.clientesFornecedores = perms.clientes;
        if (traduzirClientes) delete perms.clientes;
        return { ...u, permissions: JSON.stringify(perms) };
      })
    : backup.users;
  return { ...backup, data, users };
}

export function restoreAllData(backupOriginal) {
  if (!backupOriginal || typeof backupOriginal !== "object" || !backupOriginal.data || typeof backupOriginal.data !== "object") {
    throw new Error("Arquivo de backup inválido ou corrompido.");
  }
  const backup = normalizarBackupLegado(backupOriginal);
  const tx = db.transaction(() => {
    for (const col of COLLECTIONS) {
      db.prepare(`DELETE FROM ${col}`).run();
      const rows = Array.isArray(backup.data[col]) ? backup.data[col] : [];
      const stmt = db.prepare(`INSERT INTO ${col} (id, data) VALUES (?, ?)`);
      for (const item of rows) {
        if (!item || !item.id) continue;
        stmt.run(item.id, JSON.stringify(item));
      }
    }
    if (Array.isArray(backup.users) && backup.users.length > 0) {
      db.prepare(`DELETE FROM users`).run();
      const stmt = db.prepare(
        `INSERT INTO users (id, username, password_hash, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const u of backup.users) {
        if (!u || !u.id || !u.username || !u.passwordHash) continue;
        stmt.run(
          u.id,
          u.username,
          u.passwordHash,
          u.role === "admin" ? "admin" : "user",
          typeof u.permissions === "string" ? u.permissions : JSON.stringify(u.permissions || {}),
          u.createdAt || new Date().toISOString()
        );
      }
    }
    db.prepare(`DELETE FROM todos`).run();
    if (Array.isArray(backup.todos) && backup.todos.length > 0) {
      const stmt = db.prepare(`INSERT INTO todos (id, data) VALUES (?, ?)`);
      for (const t of backup.todos) {
        if (!t || !t.id) continue;
        stmt.run(t.id, JSON.stringify(t));
      }
    }
  });
  tx();
}

/* ---------------------------------------------------------
   Configuração do backup automático por e-mail
--------------------------------------------------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS backup_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    frequencia TEXT NOT NULL DEFAULT 'semanal',
    dia_semana INTEGER NOT NULL DEFAULT 0,
    horario TEXT NOT NULL DEFAULT '03:00',
    email_destino TEXT NOT NULL DEFAULT '',
    ultimo_envio TEXT
  )
`);
db.prepare(`INSERT OR IGNORE INTO backup_config (id) VALUES (1)`).run();
db.exec(`
  CREATE TABLE IF NOT EXISTS backup_envios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    em TEXT NOT NULL,
    ok INTEGER NOT NULL,
    origem TEXT NOT NULL DEFAULT 'auto',
    destino TEXT NOT NULL DEFAULT '',
    tamanho TEXT,
    erro TEXT
  )
`);

export function listarEnvios(limite = 10) {
  return db
    .prepare(`SELECT em, ok, origem, destino, tamanho, erro FROM backup_envios ORDER BY id DESC LIMIT ?`)
    .all(limite)
    .map((r) => ({ em: r.em, ok: !!r.ok, origem: r.origem, destino: r.destino, tamanho: r.tamanho, erro: r.erro }));
}

function registrarEnvio({ ok, origem, destino, tamanho, erro }) {
  // Tentativas automáticas repetidas no mesmo dia (a cada 15 min) atualizam a
  // mesma linha de falha em vez de encher o histórico.
  if (!ok && origem === "auto") {
    const ultimo = db.prepare(`SELECT id, em, ok, origem FROM backup_envios ORDER BY id DESC LIMIT 1`).get();
    if (ultimo && !ultimo.ok && ultimo.origem === "auto" && new Date(ultimo.em).toDateString() === new Date().toDateString()) {
      db.prepare(`UPDATE backup_envios SET em = ?, erro = ?, destino = ? WHERE id = ?`).run(new Date().toISOString(), String(erro || "").slice(0, 500), destino || "", ultimo.id);
      return;
    }
  }
  db.prepare(`INSERT INTO backup_envios (em, ok, origem, destino, tamanho, erro) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(new Date().toISOString(), ok ? 1 : 0, origem, destino || "", tamanho || null, erro ? String(erro).slice(0, 500) : null);
  // guarda só os 50 mais recentes
  db.prepare(`DELETE FROM backup_envios WHERE id NOT IN (SELECT id FROM backup_envios ORDER BY id DESC LIMIT 50)`).run();
}

export function contarBackup(backup) {
  return [
    ...ROTULOS_CONTAGEM.map(([col, rotulo]) => ({ rotulo, n: (backup?.data?.[col] || []).length })),
    { rotulo: "Usuários", n: (backup?.users || []).length },
    { rotulo: "Tarefas (TO-DO)", n: (backup?.todos || []).length },
  ];
}

// Colunas novas (bancos antigos não têm): guardam a última falha do envio automático
for (const col of ["ultimo_erro TEXT", "ultimo_erro_em TEXT"]) {
  try { db.exec(`ALTER TABLE backup_config ADD COLUMN ${col}`); } catch { /* já existe */ }
}

// Data do último envio AUTOMÁTICO que deu certo. Vem do histórico de envios
// (e não de um campo solto) porque o "Enviar teste agora" também manda e-mail:
// se ele contasse, um teste feito de manhã faria o sistema achar que o backup
// do dia já foi e pularia o envio das 18h.
function ultimoEnvioAutomatico() {
  const r = db.prepare(`SELECT em FROM backup_envios WHERE ok = 1 AND origem = 'auto' ORDER BY id DESC LIMIT 1`).get();
  return r ? r.em : null;
}

export function getBackupConfig() {
  const row = db.prepare(`SELECT * FROM backup_config WHERE id = 1`).get();
  return {
    enabled: !!row.enabled,
    frequencia: row.frequencia === "diario" ? "diario" : "semanal",
    diaSemana: row.dia_semana,
    horario: row.horario,
    emailDestino: row.email_destino,
    ultimoEnvio: ultimoEnvioAutomatico(),
    ultimoErro: row.ultimo_erro || null,
    ultimoErroEm: row.ultimo_erro_em || null,
  };
}

export function setBackupConfig({ enabled, frequencia, diaSemana, horario, emailDestino }) {
  const horarioValido = /^\d{2}:\d{2}$/.test(horario || "") ? horario : "03:00";
  db.prepare(
    `UPDATE backup_config SET enabled = ?, frequencia = ?, dia_semana = ?, horario = ?, email_destino = ? WHERE id = 1`
  ).run(
    enabled ? 1 : 0,
    frequencia === "diario" ? "diario" : "semanal",
    Math.min(6, Math.max(0, Number(diaSemana) || 0)),
    horarioValido,
    (emailDestino || "").trim()
  );
  return getBackupConfig();
}

// Envio bem-sucedido (automático ou teste): limpa o aviso de erro do painel.
// A data do "último envio automático" não é gravada aqui — ver ultimoEnvioAutomatico().
function limparErroEnvio() {
  db.prepare(`UPDATE backup_config SET ultimo_erro = NULL, ultimo_erro_em = NULL WHERE id = 1`).run();
}

const ICONE_EMAIL = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets", "sintonia-icone.png");

/* ---------------------------------------------------------
   Envio de e-mail — usa SMTP configurado por variáveis de
   ambiente (ver docker-compose.yml). Sem isso configurado, o
   backup automático fica indisponível (mas o download/upload
   manual continuam funcionando normalmente).
--------------------------------------------------------- */
/* ---------------------------------------------------------
   Dados do e-mail de envio (SMTP): podem vir da tela
   Configurações > Backup (guardados no banco, com a senha
   cifrada) ou, como alternativa, das variáveis do
   docker-compose.yml. O que estiver salvo na tela tem
   prioridade. A senha nunca é devolvida ao navegador e não
   entra no arquivo de backup.
--------------------------------------------------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS smtp_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    host TEXT NOT NULL DEFAULT '',
    port INTEGER NOT NULL DEFAULT 587,
    usuario TEXT NOT NULL DEFAULT '',
    senha_cifrada TEXT NOT NULL DEFAULT '',
    remetente TEXT NOT NULL DEFAULT ''
  )
`);
db.prepare(`INSERT OR IGNORE INTO smtp_config (id) VALUES (1)`).run();

function chaveSmtp() {
  return crypto.createHash("sha256").update(`smtp:${getAppSecret()}`).digest();
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", chaveSmtp(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

function decifrar(valor) {
  try {
    const [iv, tag, enc] = valor.split(".").map((p) => Buffer.from(p, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", chaveSmtp(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return ""; // segredo mudou ou dado corrompido: trata como não configurado
  }
}

function smtpEfetivo() {
  const row = db.prepare(`SELECT * FROM smtp_config WHERE id = 1`).get();
  const senha = row.senha_cifrada ? decifrar(row.senha_cifrada) : "";
  if (row.host && row.usuario && senha) {
    return { origem: "painel", host: row.host, port: row.port || 587, user: row.usuario, pass: senha, from: row.remetente || row.usuario };
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return { origem: "servidor", host: SMTP_HOST, port: Number(SMTP_PORT) || 587, user: SMTP_USER, pass: SMTP_PASS, from: SMTP_FROM || SMTP_USER };
  }
  return null;
}

export function getSmtpPublico() {
  const row = db.prepare(`SELECT * FROM smtp_config WHERE id = 1`).get();
  const ef = smtpEfetivo();
  return {
    host: row.host,
    port: row.port || 587,
    usuario: row.usuario,
    remetente: row.remetente,
    senhaDefinida: !!(row.senha_cifrada && decifrar(row.senha_cifrada)),
    origemAtiva: ef ? ef.origem : null,
  };
}

export function setSmtp({ host, port, usuario, senha, remetente }) {
  const atual = db.prepare(`SELECT * FROM smtp_config WHERE id = 1`).get();
  const novaSenha = (senha || "").trim();
  db.prepare(`UPDATE smtp_config SET host = ?, port = ?, usuario = ?, senha_cifrada = ?, remetente = ? WHERE id = 1`).run(
    (host || "").trim(),
    Number(port) || 587,
    (usuario || "").trim(),
    novaSenha ? cifrar(novaSenha) : atual.senha_cifrada,
    (remetente || "").trim()
  );
  return getSmtpPublico();
}

export function limparSmtp() {
  db.prepare(`UPDATE smtp_config SET host = '', port = 587, usuario = '', senha_cifrada = '', remetente = '' WHERE id = 1`).run();
  return getSmtpPublico();
}

function getTransport() {
  const ef = smtpEfetivo();
  if (!ef) return null;
  return nodemailer.createTransport({
    host: ef.host,
    port: ef.port,
    secure: ef.port === 465,
    auth: { user: ef.user, pass: ef.pass },
  });
}

export function isSmtpConfigured() {
  return !!getTransport();
}

export async function sendBackupEmail(toEmail, origem = "auto") {
  let tamanhoEnviado = null;
  try {
    tamanhoEnviado = await enviarBackupEmail(toEmail);
    registrarEnvio({ ok: true, origem, destino: toEmail, tamanho: tamanhoEnviado });
  } catch (err) {
    registrarEnvio({ ok: false, origem, destino: toEmail, erro: err.message });
    throw err;
  }
}

async function enviarBackupEmail(toEmail) {
  const transport = getTransport();
  if (!transport) {
    throw new Error(
      "SMTP não configurado no servidor. Preencha os dados do e-mail em Configurações > Backup > Servidor de e-mail."
    );
  }
  if (!toEmail || !toEmail.includes("@")) {
    throw new Error("E-mail de destino inválido.");
  }
  const backup = exportAllData();
  const json = JSON.stringify(backup, null, 2);
  const agora = new Date();
  const dataHoje = hojeISO(agora);
  const arquivo = `backup-sintonia-${dataHoje}.json`;
  const tamanho = formatarTamanho(Buffer.byteLength(json));
  const config = getBackupConfig();
  const contagens = contarBackup(backup);
  const { html, texto } = montarEmailBackup({
    geradoEm: agora,
    arquivo,
    tamanho,
    contagens,
    frequencia: textoFrequencia(config),
    proximo: textoProximo(config, agora),
  });
  const dataBR = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: getFuso() });
  await transport.sendMail({
    from: smtpEfetivo().from,
    to: toEmail,
    subject: `✅ Backup Sintonia — ${dataBR} — ${tamanho}`,
    text: texto,
    html,
    attachments: [
      { filename: arquivo, content: json, contentType: "application/json" },
      // Ícone do Sintonia embutido no corpo do e-mail (cid:sintonia-logo) — não aparece como anexo
      ...(fs.existsSync(ICONE_EMAIL)
        ? [{ filename: "sintonia-icone.png", path: ICONE_EMAIL, cid: "sintonia-logo", contentDisposition: "inline" }]
        : []),
    ],
  });
  limparErroEnvio();
  return tamanho;
}

/* ---------------------------------------------------------
   Agendador — roda a cada minuto, e dispara o envio quando o
   horário (e, se semanal, o dia da semana) configurado bate
   com o momento atual. No máximo um envio por dia.
--------------------------------------------------------- */
function dataLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Não tenta de novo antes de passar esse tempo (evita disparar um e-mail
// por minuto se o SMTP estiver com problema).
const INTERVALO_RETENTATIVA_MS = 15 * 60 * 1000;
// Se o servidor estava desligado/reiniciando na hora marcada, ainda envia
// ao voltar — mas só dentro dessa janela, pra não mandar um e-mail
// inesperado horas depois (ex: ao ativar o backup no meio da tarde).
const JANELA_RECUPERACAO_MIN = 6 * 60;
let ultimaTentativa = 0;

function checkAndRunScheduled() {
  const config = getBackupConfig();
  if (!config.enabled || !config.emailDestino) return;
  const now = new Date();
  if (config.frequencia === "semanal" && now.getDay() !== config.diaSemana) return;
  // Compara por "minutos desde a meia-noite" em vez de exigir o minuto exato:
  // o relógio de 60s pode pular um minuto, e o servidor pode ter reiniciado.
  const [h, m] = config.horario.split(":").map(Number);
  const minutosAgora = now.getHours() * 60 + now.getMinutes();
  const atraso = minutosAgora - (h * 60 + m);
  if (atraso < 0 || atraso > JANELA_RECUPERACAO_MIN) return;
  if (config.ultimoEnvio && dataLocalISO(new Date(config.ultimoEnvio)) === dataLocalISO(now)) return;
  if (Date.now() - ultimaTentativa < INTERVALO_RETENTATIVA_MS) return;
  ultimaTentativa = Date.now();
  sendBackupEmail(config.emailDestino)
    .then(() => console.log(`[controle-tv] Backup automático enviado para ${config.emailDestino}.`))
    .catch((err) => {
      console.error(`[controle-tv] Falha ao enviar backup automático: ${err.message}`);
      db.prepare(`UPDATE backup_config SET ultimo_erro = ?, ultimo_erro_em = ? WHERE id = 1`).run(String(err.message).slice(0, 500), new Date().toISOString());
    });
}

export function startBackupScheduler() {
  checkAndRunScheduled();
  setInterval(checkAndRunScheduled, 60 * 1000);
}
