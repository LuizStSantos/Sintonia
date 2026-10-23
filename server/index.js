import express from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  COLLECTIONS,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  listUsers,
  getUserRowByUsername,
  getUserById,
  createUser,
  updateUser,
  updateUserFoto,
  deleteUser,
  countAdmins,
  nomeExibicao,
  pruneEspelhosVencidos,
  getEspelhoRetencaoDias,
  setEspelhoRetencaoDias,
  restaurarEspelhoRetencaoDias,
  contarEspelhosQueVenceriam,
  ESPELHO_RETENCAO_PADRAO,
  ESPELHO_RETENCAO_FAIXA,
  getRedes,
  setRedes,
  restaurarRedes,
  REDES_PADRAO,
  getFuso,
  db,
  setFuso,
  restaurarFuso,
  hojeISO,
  FUSO_PADRAO,
  pruneEntrevistadosVencidos,
  pruneContasReceberAtrasadas,
  pruneContasPagarAtrasadas,
  buildHistoricoDescription,
  addHistoricoEntry,
  listHistorico,
  pruneHistoricoAntigo,
} from "./db.js";
import { signToken, verifyToken, COOKIE_NAME, COOKIE_MAX_AGE_MS } from "./auth.js";
import { verificarBloqueio, registrarFalha, registrarSucesso, mensagemBloqueio, mensagemFalha, LIMITE as LIMITE_LOGIN } from "./loginGuard.js";
import { setupRealtime, broadcastChange, broadcastAll, notifyUser, notifyUsers, notifyAdmins, getOnlineUserIds } from "./realtime.js";
import { listTodos, createTodo, updateTodo, deleteTodo } from "./todos.js";
import { listEspelhoModelos, createEspelhoModelo, updateEspelhoModelo, deleteEspelhoModelo } from "./espelhoModelos.js";
import {
  UPLOADS_DIR,
  AVATARS_DIR,
  listConversas,
  totalNaoLidas,
  getConversa,
  criarOuAbrirPrivada,
  criarGrupo,
  renomearGrupo,
  definirFotoGrupo,
  apagarGrupo,
  adicionarParticipantes,
  removerParticipante,
  listMensagens,
  criarMensagem,
  apagarMensagem,
  reagirMensagem,
  marcarComoLida,
  arquivoPertenceAUsuario,
  listUsuariosParaChat,
  getLimitesChat,
  setLimitesChat,
  restaurarLimitesChat,
  limparAnexos,
  aplicarTetoDeAnexos,
  resumoArmazenamentoChat,
} from "./chat.js";
import {
  exportAllData,
  restoreAllData,
  getBackupConfig,
  setBackupConfig,
  sendBackupEmail,
  isSmtpConfigured,
  startBackupScheduler,
  contarBackup,
  listarEnvios,
  getSmtpPublico,
  setSmtp,
  limparSmtp,
} from "./backup.js";
import { textoProximo } from "./backupEmail.js";
import { getVistos, marcarVisto, marcarTodosVistos, apagarVistosDoUsuario, aplicarAlteracao } from "./espelhoVistos.js";
import {
  INICIO_DIR, INICIO_TIPOS_ARQUIVO, INICIO_IMAGEM_MAX_MB, INICIO_VIDEO_MAX_MB,
  getQuotaGB, setQuotaGB, restaurarQuotaGB, usoPorUsuario, usoDoUsuario, INICIO_QUOTA_PADRAO_GB, INICIO_QUOTA_FAIXA_GB,
  sanitizarLayout, getLayout, salvarLayout, restaurarLayout, apagarDadosDoUsuario, caminhoArquivo,
} from "./inicio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const app = express();
// Atrás de proxy (Nginx, Cloudflare...) o IP real vem no cabeçalho X-Forwarded-For.
// TRUST_PROXY = quantos proxies confiar (ex.: 1), "true" ou uma faixa de IPs.
// Sem definir, usa o IP direto da conexão (o certo quando não há proxy).
if (process.env.TRUST_PROXY) {
  const t = process.env.TRUST_PROXY.trim();
  app.set("trust proxy", /^\d+$/.test(t) ? Number(t) : t === "true" ? true : t);
}
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json());
app.use(cookieParser());

/* ---------------------------------------------------------
   Upload de foto de perfil (usuário ou grupo de conversa). Pasta e regra
   de acesso diferentes do anexo de mensagem do Chat (ver comentário em
   AVATARS_DIR, chat.js) — só aceita imagem, e com um limite bem menor
   (5MB é mais que suficiente pra uma foto de perfil).
--------------------------------------------------------- */
const TIPOS_FOTO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const fotoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const uploadFoto = multer({
  storage: fotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!TIPOS_FOTO_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error("Envie uma imagem (JPEG, PNG, GIF ou WEBP)."));
    }
    cb(null, true);
  },
});
// Apaga do disco a foto anterior (usuário ou grupo), se houver — evita
// acumular arquivo órfão toda vez que alguém troca de foto. Silencioso se
// o arquivo já não existir por algum motivo (não é um erro que importe).
function apagarFotoAntiga(nomeArquivo) {
  if (!nomeArquivo) return;
  const filePath = path.join(AVATARS_DIR, nomeArquivo);
  fs.unlink(filePath, () => {});
}

/* ---------------------------------------------------------
   Autenticação e autorização
--------------------------------------------------------- */
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Sessão inválida ou expirada" });
  const user = getUserById(payload.sub);
  if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito ao administrador" });
  }
  next();
}

// level: "view" para leitura, "edit" para criar/editar/excluir
function requireCollectionAccess(level) {
  return (req, res, next) => {
    if (req.user.role === "admin") return next();
    const col = req.params.collection;
    const perm = req.user.permissions?.[col] || "none";
    const allowed = level === "view" ? perm === "view" || perm === "edit" : perm === "edit";
    if (!allowed) return res.status(403).json({ error: "Você não tem permissão para isso" });
    next();
  };
}

function checkCollection(req, res, next) {
  if (!COLLECTIONS.includes(req.params.collection)) {
    return res.status(404).json({ error: "Coleção não encontrada" });
  }
  next();
}

/* ---------------------------------------------------------
   Histórico / auditoria — grava um evento sempre que uma requisição
   autenticada cria/edita/exclui um registro (nunca em GET, pra não virar
   ruído). Nunca lança erro pra cima: se a gravação do histórico falhar por
   algum motivo, a operação original (que já aconteceu) não é desfeita —
   só loga no console do servidor.
--------------------------------------------------------- */
function registrarHistorico({ user, action, collection, entityId, oldItem, newItem }) {
  try {
    const { label, description } = buildHistoricoDescription({ collection, action, oldItem, newItem });
    const entry = addHistoricoEntry({
      userId: user?.id,
      userName: user?.username,
      action,
      collection,
      entityId,
      label,
      description,
    });
    notifyAdmins({ type: "historico-created", payload: entry });
  } catch (e) {
    console.error("[controle-tv] Falha ao registrar histórico:", e.message);
  }
}

// Usuário sintético usado no Histórico para ações automáticas do servidor
// (ex: inativação de entrevistados vencidos), pra não confundir a auditoria
// atribuindo a ação a quem por acaso estava logado quando ela rodou.
const USUARIO_SISTEMA = { id: null, username: "Sistema" };

// Roda pruneEntrevistadosVencidos() e registra cada inativação no Histórico
// como ação do Sistema, além de avisar os clientes conectados via WebSocket.
function pruneEntrevistadosELog() {
  const resultados = pruneEntrevistadosVencidos();
  for (const { before, after } of resultados) {
    broadcastChange("entrevistados", "updated", after, null);
    registrarHistorico({
      user: USUARIO_SISTEMA,
      action: "update",
      collection: "entrevistados",
      entityId: after.id,
      oldItem: before,
      newItem: after,
    });
  }
  return resultados.length;
}

// Roda pruneContasReceberAtrasadas() e registra cada mudança no Histórico
// como ação do Sistema. Além de sincronizar o dado (broadcastChange
// "updated", igual todo mundo já recebe), manda um aviso de notificação
// dedicado — "conta-atrasada" — só pra quem tem permissão de ver a coleção
// "contasReceber" (broadcastChange já filtra isso sozinho, ver
// realtime.js: canView), pra quem não tem acesso ao financeiro nunca ver
// esse aviso.
function pruneContasReceberELog() {
  const resultados = pruneContasReceberAtrasadas();
  for (const { before, after } of resultados) {
    broadcastChange("contasReceber", "updated", after, null);
    broadcastChange("contasReceber", "conta-atrasada", {
      id: after.id,
      cliente: after.nomeFantasia || after.razaoSocial || "Cliente",
      valor: after.valor,
      vencimento: after.vencimento,
    }, null);
    registrarHistorico({
      user: USUARIO_SISTEMA,
      action: "update",
      collection: "contasReceber",
      entityId: after.id,
      oldItem: before,
      newItem: after,
    });
  }
  return resultados.length;
}

// Mesma ideia de pruneContasReceberELog, para Contas a pagar (coleção
// "contasPagar"). broadcastChange já filtra sozinho quem tem permissão de
// ver essa coleção — quem não tem acesso a Contas a pagar não recebe esse
// aviso.
function pruneContasPagarELog() {
  const resultados = pruneContasPagarAtrasadas();
  for (const { before, after } of resultados) {
    broadcastChange("contasPagar", "updated", after, null);
    broadcastChange("contasPagar", "conta-atrasada", {
      id: after.id,
      cliente: after.nomeFantasia || after.razaoSocial || "Fornecedor",
      valor: after.valor,
      vencimento: after.vencimento,
    }, null);
    registrarHistorico({
      user: USUARIO_SISTEMA,
      action: "update",
      collection: "contasPagar",
      entityId: after.id,
      oldItem: before,
      newItem: after,
    });
  }
  return resultados.length;
}

/* ---------------------------------------------------------
   Rotas de autenticação
--------------------------------------------------------- */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }
  const nome = username.trim();
  const ip = req.ip || req.socket?.remoteAddress || "desconhecido";
  const bloqueio = verificarBloqueio(nome, ip);
  if (bloqueio.bloqueado) {
    const segundos = Math.ceil((bloqueio.ate - Date.now()) / 1000);
    res.set("Retry-After", String(segundos));
    return res.status(429).json({ error: mensagemBloqueio(bloqueio.ate), bloqueadoAte: new Date(bloqueio.ate).toISOString(), segundos });
  }
  const row = getUserRowByUsername(nome);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    const f = registrarFalha(nome, ip);
    if (f.bloqueou) {
      // Só no momento em que o bloqueio começa: avisa os administradores pelo Histórico.
      try {
        const entry = addHistoricoEntry({
          userId: row?.id || null,
          userName: nome,
          action: "seguranca",
          collection: "usuarios",
          label: nome,
          description: f.motivo === "ip"
            ? `acesso bloqueado por ${LIMITE_LOGIN.bloqueioMs / 60000} minutos: muitas senhas erradas vindas do mesmo lugar (${ip})`
            : `acesso bloqueado por ${LIMITE_LOGIN.bloqueioMs / 60000} minutos após ${LIMITE_LOGIN.maxFalhas} senhas erradas para "${nome}" (origem ${ip})`,
        });
        notifyAdmins({ type: "historico-created", payload: entry });
      } catch (e) { console.error("[login] não consegui registrar o bloqueio no histórico:", e.message); }
      const segundos = Math.ceil((f.ate - Date.now()) / 1000);
      res.set("Retry-After", String(segundos));
      return res.status(429).json({ error: mensagemBloqueio(f.ate), bloqueadoAte: new Date(f.ate).toISOString(), segundos });
    }
    // Mesma resposta exista o usuário ou não (não revela quais usuários existem).
    return res.status(401).json({ error: mensagemFalha(f.restantes), restantes: f.restantes });
  }
  registrarSucesso(nome, ip);
  const user = getUserById(row.id);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json(user);
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json(req.user);
});

/* ---------------------------------------------------------
   Gestão de usuários (somente admin)
--------------------------------------------------------- */
app.get("/api/users", requireAuth, requireAdmin, (req, res) => {
  res.json(listUsers().map((u) => ({ ...u, displayName: nomeExibicao(u) })));
});

// Lista mínima (só id + nome) pra quem tem permissão de atribuir tarefas
// de TO-DO a outras pessoas, mas não é admin — não expõe permissões,
// datas de criação etc. como a rota /api/users (essa é admin-only).
app.get("/api/users/assignable", requireAuth, (req, res) => {
  const isAdmin = req.user.role === "admin";
  const podeAtribuir = isAdmin || req.user.permissions?.atribuirTarefas === true;
  if (!podeAtribuir) return res.status(403).json({ error: "Sem permissão pra atribuir tarefas a outras pessoas." });
  const users = listUsers()
    .filter((u) => u.id !== req.user.id)
    // Quem tem a permissão mas não é admin só pode atribuir pra outros
    // usuários comuns — admin fica de fora da lista (só o próprio admin
    // pode se auto-atribuir ou atribuir pra outro admin).
    .filter((u) => isAdmin || u.role !== "admin")
    .map((u) => ({ id: u.id, username: u.username, displayName: nomeExibicao(u) }));
  res.json(users);
});

app.post("/api/users", requireAuth, requireAdmin, (req, res) => {
  const { username, password, role, permissions, nomeCompleto } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 4 caracteres" });
  }
  if (getUserRowByUsername(username.trim())) {
    return res.status(409).json({ error: "Já existe um usuário com esse nome" });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser({
    username: username.trim(),
    passwordHash,
    role: role === "admin" ? "admin" : "user",
    permissions: permissions || {},
    nomeCompleto: nomeCompleto || "",
  });
  broadcastChange("users", "created", user);
  registrarHistorico({ user: req.user, action: "create", collection: "usuarios", entityId: user.id, newItem: user });
  res.status(201).json(user);
});

app.put("/api/users/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = getUserById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });

  const { role, permissions, password, nomeCompleto } = req.body || {};

  if (existing.role === "admin" && role && role !== "admin" && countAdmins() <= 1) {
    return res.status(400).json({ error: "Não é possível rebaixar o único administrador" });
  }
  if (password && password.length > 0 && password.length < 4) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 4 caracteres" });
  }

  const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined;
  const updated = updateUser(req.params.id, { role, permissions, passwordHash, nomeCompleto });
  broadcastChange("users", "updated", updated);
  registrarHistorico({ user: req.user, action: "update", collection: "usuarios", entityId: req.params.id, oldItem: existing, newItem: updated });
  notifyUser(req.params.id, { type: "account-updated" });
  res.json(updated);
});

// Foto de perfil do usuário — só admin troca (mesma regra de acesso do
// resto do cadastro de usuários nesta versão; ver nota em AVATARS_DIR).
app.post("/api/users/:id/foto", requireAuth, requireAdmin, (req, res, next) => {
  uploadFoto.single("foto")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const existing = getUserById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });
  if (!req.file) return res.status(400).json({ error: "Envie uma imagem." });
  const updated = updateUserFoto(req.params.id, req.file.filename);
  apagarFotoAntiga(existing.foto);
  broadcastChange("users", "updated", updated);
  notifyUser(req.params.id, { type: "account-updated" });
  res.json(updated);
});

app.delete("/api/users/:id/foto", requireAuth, requireAdmin, (req, res) => {
  const existing = getUserById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });
  const updated = updateUserFoto(req.params.id, null);
  apagarFotoAntiga(existing.foto);
  broadcastChange("users", "updated", updated);
  notifyUser(req.params.id, { type: "account-updated" });
  res.json(updated);
});

app.delete("/api/users/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = getUserById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado" });
  if (existing.id === req.user.id) {
    return res.status(400).json({ error: "Você não pode excluir seu próprio usuário" });
  }
  if (existing.role === "admin" && countAdmins() <= 1) {
    return res.status(400).json({ error: "Não é possível excluir o único administrador" });
  }
  deleteUser(req.params.id);
  try { apagarDadosDoUsuario(req.params.id); apagarVistosDoUsuario(req.params.id); } catch { /* sem layout/arquivos */ }
  broadcastChange("users", "deleted", { id: req.params.id });
  registrarHistorico({ user: req.user, action: "delete", collection: "usuarios", entityId: req.params.id, oldItem: existing });
  notifyUser(req.params.id, { type: "account-deleted" });
  res.status(204).end();
});

/* ---------------------------------------------------------
   Backup (somente admin) — exportar/restaurar tudo, e
   configurar/testar o envio automático por e-mail. Precisa vir ANTES das
   rotas genéricas /api/:collection abaixo, senão "backup" seria
   interpretado como um nome de coleção.
--------------------------------------------------------- */
app.get("/api/backup/export", requireAuth, requireAdmin, (req, res) => {
  const backup = exportAllData();
  const dataHoje = hojeISO();
  res.setHeader("Content-Disposition", `attachment; filename="backup-sintonia-${dataHoje}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(backup, null, 2));
});

app.post("/api/backup/restore", requireAuth, requireAdmin, (req, res) => {
  try {
    restoreAllData(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Não foi possível restaurar o backup." });
  }
});

function configComExtras() {
  const config = getBackupConfig();
  return { ...config, smtpConfigured: isSmtpConfigured(), proximo: textoProximo(config), historico: listarEnvios(10) };
}

app.get("/api/backup/config", requireAuth, requireAdmin, (req, res) => {
  res.json(configComExtras());
});

// Resumo do que existe hoje no sistema — a tela Configurações → Backup compara com o arquivo
// escolhido antes de restaurar.
app.get("/api/backup/resumo", requireAuth, requireAdmin, (req, res) => {
  res.json({ contagens: contarBackup(exportAllData()) });
});

app.put("/api/backup/config", requireAuth, requireAdmin, (req, res) => {
  setBackupConfig(req.body || {});
  res.json(configComExtras());
});

app.get("/api/backup/smtp", requireAuth, requireAdmin, (req, res) => {
  res.json(getSmtpPublico());
});

app.put("/api/backup/smtp", requireAuth, requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.host?.trim() || !b.usuario?.trim()) return res.status(400).json({ error: "Informe o servidor e o e-mail/usuário." });
  const atual = getSmtpPublico();
  if (!b.senha?.trim() && !atual.senhaDefinida) return res.status(400).json({ error: "Informe a senha do e-mail." });
  res.json(setSmtp(b));
});

app.delete("/api/backup/smtp", requireAuth, requireAdmin, (req, res) => {
  res.json(limparSmtp());
});

app.get("/api/chat/armazenamento", requireAuth, requireAdmin, (req, res) => {
  res.json(resumoArmazenamentoChat());
});

// Quem está com o Chat aberto atualiza o aviso "Até X MB · fica salvo Y dias" na hora.
function avisarLimitesMudaram() {
  const l = getLimitesChat();
  broadcastAll({ type: "chat-limites", payload: { anexoMaxMb: l.maxMB, retencaoDias: l.retencaoDias, quotaGb: l.quotaGB } });
}

app.put("/api/chat/limites", requireAuth, requireAdmin, (req, res) => {
  const r = setLimitesChat(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  // aplica na hora (apaga o que já passou do novo prazo/limite)
  try { limparAnexos(); } catch (e) { console.error("[chat] limpeza após mudar regras:", e.message); }
  avisarLimitesMudaram();
  res.json(resumoArmazenamentoChat());
});

app.delete("/api/chat/limites", requireAuth, requireAdmin, (req, res) => {
  restaurarLimitesChat();
  avisarLimitesMudaram();
  res.json(resumoArmazenamentoChat());
});

/* ---------------------------------------------------------
   Validade do Espelho (Configurações > Espelho). Fica antes das rotas
   genéricas /api/:collection, senão "config" seria lido como um id.
--------------------------------------------------------- */
function configEspelho() {
  return { retencaoDias: getEspelhoRetencaoDias(), padrao: ESPELHO_RETENCAO_PADRAO, faixa: ESPELHO_RETENCAO_FAIXA };
}

// Apaga os espelhos vencidos e avisa quem está com a aba aberta pra sumirem da lista na hora.
function pruneEspelhosELog() {
  const ids = pruneEspelhosVencidos();
  for (const id of ids) broadcastChange("espelho", "deleted", { id });
  return ids.length;
}

function avisarEspelhoConfig() {
  broadcastAll({ type: "espelho-config", payload: { retencaoDias: getEspelhoRetencaoDias() } });
}

// "Já vi esse espelho?" — marcas por usuário (ver server/espelhoVistos.js).
const espelhoVer = (req, res, next) => { req.params.collection = "espelho"; requireCollectionAccess("view")(req, res, next); };
app.get("/api/espelho/vistos", requireAuth, espelhoVer, (req, res) => res.json(getVistos(req.user.id)));
app.post("/api/espelho/vistos", requireAuth, espelhoVer, (req, res) => { marcarTodosVistos(req.user.id); res.json(getVistos(req.user.id)); });
app.post("/api/espelho/vistos/:id", requireAuth, espelhoVer, (req, res) => { marcarVisto(req.user.id, req.params.id); res.json({ ok: true }); });

app.get("/api/espelho/config", requireAuth, (req, res) => {
  res.json(configEspelho());
});

// Quantos espelhos seriam apagados com um prazo de `dias` (só admin).
app.get("/api/espelho/config/simular", requireAuth, requireAdmin, (req, res) => {
  const [min, max] = ESPELHO_RETENCAO_FAIXA;
  const n = Number(req.query.dias);
  if (!Number.isInteger(n) || n < min || n > max) return res.status(400).json({ error: `Informe um número inteiro de dias entre ${min} e ${max}.` });
  res.json({ dias: n, apagariam: contarEspelhosQueVenceriam(n) });
});

app.put("/api/espelho/config", requireAuth, requireAdmin, (req, res) => {
  const r = setEspelhoRetencaoDias(req.body?.retencaoDias);
  if (r.error) return res.status(400).json({ error: r.error });
  const apagados = pruneEspelhosELog();
  avisarEspelhoConfig();
  res.json({ ...configEspelho(), apagados });
});

app.delete("/api/espelho/config", requireAuth, requireAdmin, (req, res) => {
  restaurarEspelhoRetencaoDias();
  const apagados = pruneEspelhosELog();
  avisarEspelhoConfig();
  res.json({ ...configEspelho(), apagados });
});

// Fuso horário do sistema (Configurações > Geral). Vale para "hoje",
// vencimentos, backup automático e e-mails.
function configFuso() {
  return { fuso: getFuso(), padrao: FUSO_PADRAO, agora: new Date().toISOString() };
}
function avisarFuso() {
  broadcastAll({ type: "fuso-config", payload: { fuso: getFuso() } });
}
app.get("/api/config/fuso", requireAuth, (req, res) => {
  res.json(configFuso());
});
app.put("/api/config/fuso", requireAuth, requireAdmin, (req, res) => {
  const r = setFuso(req.body?.fuso);
  if (r.error) return res.status(400).json({ error: r.error });
  avisarFuso();
  res.json(configFuso());
});
app.delete("/api/config/fuso", requireAuth, requireAdmin, (req, res) => {
  restaurarFuso();
  avisarFuso();
  res.json(configFuso());
});

// Redes sociais disponíveis nos botões de publicação (Configurações > Geral).
function configRedes() { return { redes: getRedes(), padrao: REDES_PADRAO }; }
function avisarRedes() { broadcastAll({ type: "redes-config", payload: { redes: getRedes() } }); }
app.get("/api/config/redes", requireAuth, (req, res) => res.json(configRedes()));
app.put("/api/config/redes", requireAuth, requireAdmin, (req, res) => {
  const r = setRedes(req.body?.redes);
  if (r.error) return res.status(400).json({ error: r.error });
  avisarRedes();
  res.json(configRedes());
});
app.delete("/api/config/redes", requireAuth, requireAdmin, (req, res) => {
  restaurarRedes();
  avisarRedes();
  res.json(configRedes());
});

// Espaço de cada usuário para fotos/vídeos do Início (Configurações > Geral).
function configInicioEspaco() {
  const uso = usoPorUsuario();
  const nomes = new Map(db.prepare(`SELECT id, username FROM users`).all().map((u) => [u.id, u.username]));
  const usuarios = [...uso.entries()].map(([id, bytes]) => ({ usuario: nomes.get(id) || "(usuário removido)", bytes })).sort((a, b) => b.bytes - a.bytes);
  return { quotaGB: getQuotaGB(), padrao: INICIO_QUOTA_PADRAO_GB, faixa: INICIO_QUOTA_FAIXA_GB, totalBytes: usuarios.reduce((t, u) => t + u.bytes, 0), usuarios };
}
app.get("/api/config/inicio-espaco", requireAuth, requireAdmin, (req, res) => res.json(configInicioEspaco()));
app.put("/api/config/inicio-espaco", requireAuth, requireAdmin, (req, res) => {
  const r = setQuotaGB(req.body?.quotaGB);
  if (r.error) return res.status(400).json({ error: r.error });
  res.json(configInicioEspaco());
});
app.delete("/api/config/inicio-espaco", requireAuth, requireAdmin, (req, res) => {
  restaurarQuotaGB();
  res.json(configInicioEspaco());
});
app.get("/api/inicio/espaco", requireAuth, (req, res) => {
  res.json({ quotaBytes: Math.round(getQuotaGB() * 1024 ** 3), usadoBytes: usoDoUsuario(req.user.id) });
});

// Início personalizável (cada usuário monta o seu). Ver server/inicio.js.
const EXT_POR_TIPO = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const uploadInicio = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, INICIO_DIR),
    filename: (req, file, cb) => cb(null, `${req.user.id}-${crypto.randomUUID()}.${EXT_POR_TIPO[file.mimetype] || "bin"}`),
  }),
  limits: { fileSize: INICIO_VIDEO_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!INICIO_TIPOS_ARQUIVO.has(file.mimetype)) return cb(new Error("Envie uma imagem (JPG, PNG, GIF, WEBP) ou um vídeo (MP4, WEBM, MOV)."));
    cb(null, true);
  },
});
app.get("/api/inicio/layout", requireAuth, (req, res) => {
  res.json({ layout: getLayout(req.user.id) });
});
app.put("/api/inicio/layout", requireAuth, (req, res) => {
  const r = sanitizarLayout(req.body, req.user.id);
  if (r.error) return res.status(400).json({ error: r.error });
  salvarLayout(req.user.id, r.layout);
  res.json({ layout: r.layout });
});
app.delete("/api/inicio/layout", requireAuth, (req, res) => {
  restaurarLayout(req.user.id);
  res.json({ layout: null });
});
app.post("/api/inicio/arquivos", requireAuth, (req, res) => {
  uploadInicio.single("arquivo")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `Arquivo acima de ${INICIO_VIDEO_MAX_MB} MB. Cole um link no lugar.` });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: "Escolha um arquivo." });
    if (req.file.mimetype.startsWith("image/") && req.file.size > INICIO_IMAGEM_MAX_MB * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({ error: `Imagem acima de ${INICIO_IMAGEM_MAX_MB} MB.` });
    }
    const quota = Math.round(getQuotaGB() * 1024 ** 3);
    const antes = usoDoUsuario(req.user.id, req.file.filename);
    if (antes + req.file.size > quota) {
      fs.unlink(req.file.path, () => {});
      const gb = (b) => (b / 1024 ** 3).toFixed(2).replace(".", ",");
      return res.status(413).json({ error: `Seu espaço acabou: você usa ${gb(antes)} GB de ${gb(quota)} GB. Apague um cartão com foto ou vídeo e salve o Início, ou cole um link no lugar.` });
    }
    res.status(201).json({ url: `/api/inicio/arquivos/${req.file.filename}`, tipo: req.file.mimetype.startsWith("video/") ? "video" : "imagem" });
  });
});
app.get("/api/inicio/arquivos/:nome", requireAuth, (req, res) => {
  const caminho = caminhoArquivo(req.user.id, req.params.nome);
  if (!caminho) return res.status(404).json({ error: "Arquivo não encontrado." });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(caminho);
});

app.post("/api/backup/send-test", requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body || {};
  try {
    await sendBackupEmail(email, "teste");
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Não foi possível enviar o e-mail de teste." });
  }
});

/* ---------------------------------------------------------
   TO-DO — cada usuário só vê e mexe nas próprias tarefas;
   admin vê e pode mexer nas de todo mundo. Não é uma "coleção"
   genérica (não tem permissão configurável por aba), é liberado
   pra qualquer usuário autenticado ver a própria lista.
--------------------------------------------------------- */
app.get("/api/todos", requireAuth, (req, res) => {
  res.json(listTodos(req.user));
});

app.post("/api/todos", requireAuth, (req, res) => {
  if (!req.body?.texto?.trim()) {
    return res.status(400).json({ error: "Descreva a tarefa." });
  }
  const created = createTodo(req.user, req.body);

  // Notifica em tempo real quem precisa saber dessa tarefa nova — mas nunca
  // quem acabou de criar ela.
  const msg = { type: "todo-created", payload: created };
  if (created.userId !== req.user.id) {
    // Foi atribuída a outra pessoa — avisa ela.
    notifyUser(created.userId, msg);
  }
  // Admin acompanha TUDO — avisa os outros admins também (exceto quem criou).
  notifyAdmins(msg, req.user.id);

  res.status(201).json(created);
});

app.put("/api/todos/:id", requireAuth, (req, res) => {
  const antes = listTodos({ role: "admin" }).find((t) => t.id === req.params.id);
  const updated = updateTodo(req.user, req.params.id, req.body);
  if (updated === null) return res.status(404).json({ error: "Tarefa não encontrada" });
  if (updated === "forbidden") return res.status(403).json({ error: "Essa tarefa não é sua." });
  // Tarefa atribuída por outra pessoa acabou de ser concluída — avisa quem
  // atribuiu (nunca avisa a própria pessoa que concluiu).
  if (antes && !antes.concluida && updated.concluida && updated.assignedByUserId && updated.assignedByUserId !== req.user.id) {
    notifyUser(updated.assignedByUserId, {
      type: "todo-completed",
      payload: { ...updated, concluidaPor: nomeExibicao(req.user) },
    });
  }
  res.json(updated);
});

app.delete("/api/todos/:id", requireAuth, (req, res) => {
  const ok = deleteTodo(req.user, req.params.id);
  if (ok === false) return res.status(404).json({ error: "Tarefa não encontrada" });
  if (ok === "forbidden") return res.status(403).json({ error: "Essa tarefa não é sua." });
  res.status(204).end();
});

/* ---------------------------------------------------------
   Modelos reutilizáveis do Espelho (ex: um "COTAÇÕES" com o
   texto padrão já pronto) — não é uma "coleção" genérica com
   permissão própria, usa a mesma permissão da aba Espelho:
   quem pode ver/editar espelhos pode ver/editar os modelos.
--------------------------------------------------------- */
function podeVerEspelho(user) {
  return user.role === "admin" || ["view", "edit"].includes(user.permissions?.espelho);
}
function podeEditarEspelho(user) {
  return user.role === "admin" || user.permissions?.espelho === "edit";
}

app.get("/api/espelho-modelos", requireAuth, (req, res) => {
  if (!podeVerEspelho(req.user)) return res.status(403).json({ error: "Sem permissão." });
  res.json(listEspelhoModelos());
});

app.post("/api/espelho-modelos", requireAuth, (req, res) => {
  if (!podeEditarEspelho(req.user)) return res.status(403).json({ error: "Sem permissão." });
  if (!req.body?.nome?.trim()) return res.status(400).json({ error: "Dê um nome pro modelo." });
  res.status(201).json(createEspelhoModelo(req.body));
});

app.put("/api/espelho-modelos/:id", requireAuth, (req, res) => {
  if (!podeEditarEspelho(req.user)) return res.status(403).json({ error: "Sem permissão." });
  const updated = updateEspelhoModelo(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Modelo não encontrado" });
  res.json(updated);
});

app.delete("/api/espelho-modelos/:id", requireAuth, (req, res) => {
  if (!podeEditarEspelho(req.user)) return res.status(403).json({ error: "Sem permissão." });
  const ok = deleteEspelhoModelo(req.params.id);
  if (!ok) return res.status(404).json({ error: "Modelo não encontrado" });
  res.status(204).end();
});

/* ---------------------------------------------------------
   Histórico / auditoria (somente admin) — precisa vir ANTES das rotas
   genéricas /api/:collection abaixo, senão "historico" seria interpretado
   como nome de coleção (mesmo motivo do comentário em /api/backup).
--------------------------------------------------------- */
app.get("/api/historico", requireAuth, requireAdmin, (req, res) => {
  const { limit, collection, userId, search, dataInicio, dataFim } = req.query;
  res.json(listHistorico({ limit, collection, userId, search, dataInicio, dataFim }));
});

/* ---------------------------------------------------------
   Chat — conversas privadas e em grupo entre usuários. Não é uma
   "coleção" com permissão própria (ver requireCollectionAccess): aqui
   qualquer usuário autenticado pode falar com qualquer outro, então a
   única checagem de acesso é "participa dessa conversa?" (ver chat.js),
   não uma permissão de aba. Precisa vir ANTES das rotas genéricas
   /api/:collection abaixo, pelo mesmo motivo do Histórico/Backup/TO-DO.
--------------------------------------------------------- */
const anexoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
// Tipos permitidos como anexo do Chat: imagens comuns + documentos de
// escritório + PDF/texto. De propósito SEM extensões executáveis (.exe,
// .sh, .bat etc.) nem HTML/SVG (podem rodar script no navegador de quem
// abrir) — o Chat é pra trocar imagem e documento entre a equipe, não um
// lugar genérico de transferência de arquivo.
const TIPOS_ANEXO_PERMITIDOS = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  // Vídeo (até o mesmo limite de ANEXO_MAX_MB; acima disso o aviso orienta a
  // mandar por link). Continua SEM tipos executáveis/HTML/SVG.
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
  "video/x-msvideo", "video/mpeg", "video/3gpp",
  // Áudio (gravado no próprio Chat ou anexado): webm/ogg/mp4 vêm do gravador
  // de cada navegador; os demais são arquivos de áudio comuns.
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/x-m4a",
  "audio/m4a", "audio/wav", "audio/x-wav", "audio/wave", "audio/3gpp", "audio/opus", "audio/flac",
]);
const uploadAnexo = () => multer({
  storage: anexoStorage,
  limits: { fileSize: Math.floor(getLimitesChat().maxMB * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ANEXO_PERMITIDOS.has(file.mimetype)) {
      return cb(new Error("Tipo de arquivo não permitido. Envie imagem, vídeo, áudio, PDF, Word, Excel, CSV ou texto."));
    }
    cb(null, true);
  },
});

app.get("/api/chat/usuarios", requireAuth, (req, res) => {
  res.json(listUsuariosParaChat(req.user.id));
});

app.get("/api/chat/online", requireAuth, (req, res) => {
  res.json(getOnlineUserIds());
});

app.get("/api/chat/nao-lidas", requireAuth, (req, res) => {
  res.json({ total: totalNaoLidas(req.user.id) });
});

app.get("/api/chat/conversas", requireAuth, (req, res) => {
  res.json(listConversas(req.user.id));
});

app.post("/api/chat/conversas", requireAuth, (req, res) => {
  const body = req.body || {};
  if (body.tipo === "grupo") {
    const criado = criarGrupo(req.user.id, body.nome, body.participantes);
    if (criado === "sem-nome") return res.status(400).json({ error: "Dê um nome ao grupo." });
    if (criado === "poucos-participantes") return res.status(400).json({ error: "Escolha pelo menos mais 1 pessoa pro grupo." });
    notifyUsers(criado.participantes, { type: "chat-conversa-criada", payload: criado }, req.user.id);
    return res.status(201).json(criado);
  }
  const outroUserId = body.userId;
  if (!outroUserId) return res.status(400).json({ error: "Escolha com quem conversar." });
  const criado = criarOuAbrirPrivada(req.user.id, outroUserId);
  if (criado === "self") return res.status(400).json({ error: "Não dá pra conversar consigo mesmo." });
  if (!criado) return res.status(404).json({ error: "Usuário não encontrado." });
  notifyUsers(criado.participantes, { type: "chat-conversa-criada", payload: criado }, req.user.id);
  res.status(201).json(criado);
});

app.put("/api/chat/conversas/:id", requireAuth, (req, res) => {
  const updated = renomearGrupo(req.params.id, req.user.id, req.body?.nome);
  if (!updated) return res.status(404).json({ error: "Conversa não encontrada." });
  if (updated === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  if (updated === "nao-e-grupo") return res.status(400).json({ error: "Só dá pra renomear grupo." });
  if (updated === "sem-nome") return res.status(400).json({ error: "Dê um nome ao grupo." });
  notifyUsers(updated.participantes, { type: "chat-conversa-atualizada", payload: updated }, null);
  res.json(updated);
});

// Apaga o grupo inteiro (conversa + mensagens + anexos) — diferente de
// renomear/adicionar/remover, só quem CRIOU o grupo pode fazer isso (ver
// comentário em apagarGrupo, chat.js).
app.delete("/api/chat/conversas/:id", requireAuth, (req, res) => {
  const resultado = apagarGrupo(req.params.id, req.user.id);
  if (!resultado) return res.status(404).json({ error: "Conversa não encontrada." });
  if (resultado === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  if (resultado === "nao-e-grupo") return res.status(400).json({ error: "Só dá pra apagar um grupo." });
  if (resultado === "nao-e-criador") return res.status(403).json({ error: "Só quem criou o grupo pode apagá-lo." });
  apagarFotoAntiga(resultado.foto);
  resultado.anexos.forEach((nomeArquivo) => {
    fs.unlink(path.join(UPLOADS_DIR, nomeArquivo), () => {});
  });
  notifyUsers(resultado.participantes, { type: "chat-grupo-apagado", payload: { conversaId: req.params.id } }, null);
  res.status(204).end();
});

// Foto do grupo — mesma regra de permissão de renomear: qualquer
// participante pode trocar ou remover.
app.post("/api/chat/conversas/:id/foto", requireAuth, (req, res, next) => {
  uploadFoto.single("foto")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const antes = getConversa(req.params.id, req.user.id);
  if (!req.file) return res.status(400).json({ error: "Envie uma imagem." });
  const updated = definirFotoGrupo(req.params.id, req.user.id, req.file.filename);
  if (!updated) return res.status(404).json({ error: "Conversa não encontrada." });
  if (updated === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  if (updated === "nao-e-grupo") return res.status(400).json({ error: "Só dá pra pôr foto em grupo." });
  if (antes && antes !== "forbidden") apagarFotoAntiga(antes.foto);
  notifyUsers(updated.participantes, { type: "chat-conversa-atualizada", payload: updated }, null);
  res.json(updated);
});

app.delete("/api/chat/conversas/:id/foto", requireAuth, (req, res) => {
  const antes = getConversa(req.params.id, req.user.id);
  const updated = definirFotoGrupo(req.params.id, req.user.id, null);
  if (!updated) return res.status(404).json({ error: "Conversa não encontrada." });
  if (updated === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  if (updated === "nao-e-grupo") return res.status(400).json({ error: "Só dá pra pôr foto em grupo." });
  if (antes && antes !== "forbidden") apagarFotoAntiga(antes.foto);
  notifyUsers(updated.participantes, { type: "chat-conversa-atualizada", payload: updated }, null);
  res.json(updated);
});

app.post("/api/chat/conversas/:id/participantes", requireAuth, (req, res) => {
  const updated = adicionarParticipantes(req.params.id, req.user.id, req.body?.userIds);
  if (!updated) return res.status(404).json({ error: "Conversa não encontrada." });
  if (updated === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  if (updated === "nao-e-grupo") return res.status(400).json({ error: "Só dá pra adicionar gente num grupo." });
  notifyUsers(updated.participantes, { type: "chat-conversa-atualizada", payload: updated }, null);
  res.json(updated);
});

app.delete("/api/chat/conversas/:id/participantes/:userId", requireAuth, (req, res) => {
  const updated = removerParticipante(req.params.id, req.user.id, req.params.userId);
  if (!updated) return res.status(404).json({ error: "Conversa não encontrada." });
  if (updated === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  if (updated === "nao-e-grupo") return res.status(400).json({ error: "Só dá pra remover gente de um grupo." });
  if (updated === "minimo-participantes") return res.status(400).json({ error: "Um grupo precisa de pelo menos 2 participantes." });
  // Quem foi removido (ou saiu) também precisa saber, mesmo não sendo mais
  // participante depois dessa mudança — senão a conversa fica "fantasma"
  // na tela dele.
  notifyUsers([...updated.participantes, req.params.userId], { type: "chat-conversa-atualizada", payload: updated }, null);
  res.json(updated);
});

app.get("/api/chat/conversas/:id/mensagens", requireAuth, (req, res) => {
  const mensagens = listMensagens(req.params.id, req.user.id, { before: req.query.before, limit: req.query.limit });
  if (mensagens === null) return res.status(404).json({ error: "Conversa não encontrada." });
  if (mensagens === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  res.json(mensagens);
});

app.post("/api/chat/conversas/:id/mensagens", requireAuth, (req, res, next) => {
  uploadAnexo().single("arquivo")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `Arquivo acima de ${getLimitesChat().maxMB} MB. Envie por link (Google Drive, WeTransfer ou a pasta da rede da redação) e cole o link na mensagem.`,
        });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, (req, res) => {
  // Se a mensagem for recusada, o arquivo que já chegou ao disco é apagado.
  const descartarArquivo = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  const conversa = getConversa(req.params.id, req.user.id);
  if (!conversa) { descartarArquivo(); return res.status(404).json({ error: "Conversa não encontrada." }); }
  if (conversa === "forbidden") { descartarArquivo(); return res.status(403).json({ error: "Você não participa dessa conversa." }); }
  const anexo = req.file
    ? { arquivo: req.file.filename, nomeOriginal: req.file.originalname, tipo: req.file.mimetype, tamanho: req.file.size }
    : null;
  // Duração (segundos) de um áudio gravado no Chat — o navegador não grava a
  // duração dentro do arquivo, então o player usa este valor.
  if (anexo && anexo.tipo.startsWith("audio/")) {
    const d = Math.round(Number(req.body?.anexoDuracao));
    if (Number.isFinite(d) && d > 0 && d <= 6 * 3600) anexo.duracaoSeg = d;
  }
  const criada = criarMensagem(req.params.id, req.user.id, { texto: req.body?.texto, anexo, respostaA: req.body?.respostaA });
  if (criada === "vazia") { descartarArquivo(); return res.status(400).json({ error: "Escreva algo ou anexe um arquivo." }); }
  // Depois de salvar um anexo, confere o teto de espaço da pasta (apaga os
  // anexos mais antigos se passou). Nunca atrapalha o envio se falhar.
  if (anexo) {
    try { aplicarTetoDeAnexos(); } catch (e) { console.error("[chat] falha ao aplicar teto de anexos:", e.message); }
  }
  notifyUsers(conversa.participantes, { type: "chat-mensagem", payload: criada }, req.user.id);
  res.status(201).json(criada);
});

app.delete("/api/chat/conversas/:id/mensagens/:mensagemId", requireAuth, (req, res) => {
  const conversa = getConversa(req.params.id, req.user.id);
  if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });
  if (conversa === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  const ok = apagarMensagem(req.params.id, req.user.id, req.params.mensagemId);
  if (ok === false) return res.status(404).json({ error: "Mensagem não encontrada." });
  if (ok === "forbidden") return res.status(403).json({ error: "Só quem escreveu pode apagar." });
  notifyUsers(conversa.participantes, { type: "chat-mensagem-apagada", payload: { conversaId: req.params.id, mensagemId: req.params.mensagemId } }, null);
  res.status(204).end();
});

// Reagir a uma mensagem com um emoji (ou tirar a reação: mesmo emoji de novo,
// ou emoji vazio). Avisa todo mundo da conversa em tempo real.
app.put("/api/chat/conversas/:id/mensagens/:mensagemId/reacao", requireAuth, (req, res) => {
  const conversa = getConversa(req.params.id, req.user.id);
  if (!conversa) return res.status(404).json({ error: "Conversa não encontrada." });
  if (conversa === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  const reacoes = reagirMensagem(req.params.id, req.user.id, req.params.mensagemId, req.body?.emoji);
  if (reacoes === "sem-mensagem") return res.status(404).json({ error: "Mensagem não encontrada." });
  if (reacoes === "emoji-invalido") return res.status(400).json({ error: "Emoji inválido." });
  const payload = { conversaId: req.params.id, mensagemId: req.params.mensagemId, reacoes };
  notifyUsers(conversa.participantes, { type: "chat-mensagem-reacao", payload }, null);
  res.json(payload);
});

// Limites dos anexos (pra tela mostrar o aviso certo mesmo se o admin mudou
// os valores no docker-compose.yml).
app.get("/api/chat/limites", requireAuth, (req, res) => {
  const l = getLimitesChat();
  res.json({ anexoMaxMb: l.maxMB, retencaoDias: l.retencaoDias, quotaGb: l.quotaGB });
});

app.put("/api/chat/conversas/:id/lida", requireAuth, (req, res) => {
  const ok = marcarComoLida(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: "Conversa não encontrada." });
  if (ok === "forbidden") return res.status(403).json({ error: "Você não participa dessa conversa." });
  res.status(204).end();
});

// Serve o arquivo de um anexo — confirma que quem está pedindo participa
// de alguma conversa onde esse arquivo foi mandado, antes de liberar (ver
// arquivoPertenceAUsuario em chat.js), pra um anexo de uma conversa não
// vazar pra quem não tem nada a ver com ela mesmo estando logado.
app.get("/api/chat/anexos/:arquivo", requireAuth, (req, res) => {
  if (req.params.arquivo.includes("/") || req.params.arquivo.includes("..")) {
    return res.status(400).json({ error: "Nome de arquivo inválido." });
  }
  if (!arquivoPertenceAUsuario(req.params.arquivo, req.user.id)) {
    return res.status(404).json({ error: "Arquivo não encontrado." });
  }
  const filePath = path.join(UPLOADS_DIR, req.params.arquivo);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo não encontrado." });
  res.sendFile(filePath);
});

// Serve uma foto de perfil (de usuário ou de grupo) — ao contrário do anexo
// acima, aqui não tem checagem de "participa da conversa": basta estar
// logado, igual já vale pra ver o nome de qualquer pessoa do sistema.
app.get("/api/avatars/:arquivo", requireAuth, (req, res) => {
  if (req.params.arquivo.includes("/") || req.params.arquivo.includes("..")) {
    return res.status(400).json({ error: "Nome de arquivo inválido." });
  }
  const filePath = path.join(AVATARS_DIR, req.params.arquivo);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo não encontrado." });
  res.sendFile(filePath);
});

/* ---------------------------------------------------------
   Coleções (matérias, contas a pagar, contas a receber, colaboradores, contatos, entrevistados, OPEC)
--------------------------------------------------------- */
app.get(
  "/api/:collection",
  requireAuth,
  checkCollection,
  requireCollectionAccess("view"),
  (req, res) => {
    if (req.params.collection === "espelho") pruneEspelhosELog();
    if (req.params.collection === "entrevistados") pruneEntrevistadosELog();
    if (req.params.collection === "contasReceber") pruneContasReceberELog();
    if (req.params.collection === "contasPagar") pruneContasPagarELog();
    res.json(listItems(req.params.collection));
  }
);

app.post(
  "/api/:collection",
  requireAuth,
  checkCollection,
  requireCollectionAccess("edit"),
  (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Corpo inválido" });
    }
    const created = createItem(req.params.collection, req.body);
    // Quem cria o espelho já o considera visto.
    if (req.params.collection === "espelho") marcarVisto(req.user.id, created.id);
    broadcastChange(req.params.collection, "created", created, req.user.id);
    registrarHistorico({ user: req.user, action: "create", collection: req.params.collection, entityId: created.id, newItem: created });
    res.status(201).json(created);
  }
);

app.put(
  "/api/:collection/:id",
  requireAuth,
  checkCollection,
  requireCollectionAccess("edit"),
  (req, res) => {
    const before = getItem(req.params.collection, req.params.id);
    const corpo = req.params.collection === "espelho" && req.body && typeof req.body === "object"
      ? aplicarAlteracao(before, req.body, req.user)
      : req.body;
    const updated = updateItem(req.params.collection, req.params.id, corpo);
    if (!updated) return res.status(404).json({ error: "Item não encontrado" });
    broadcastChange(req.params.collection, "updated", updated, req.user.id);
    registrarHistorico({ user: req.user, action: "update", collection: req.params.collection, entityId: req.params.id, oldItem: before, newItem: updated });
    res.json(updated);
  }
);

app.delete(
  "/api/:collection/:id",
  requireAuth,
  checkCollection,
  requireCollectionAccess("edit"),
  (req, res) => {
    const before = getItem(req.params.collection, req.params.id);
    const ok = deleteItem(req.params.collection, req.params.id);
    if (!ok) return res.status(404).json({ error: "Item não encontrado" });
    broadcastChange(req.params.collection, "deleted", { id: req.params.id }, req.user.id);
    registrarHistorico({ user: req.user, action: "delete", collection: req.params.collection, entityId: req.params.id, oldItem: before });
    res.status(204).end();
  }
);

// Middleware global de tratamento de erros. Precisa ficar depois de TODAS as
// rotas (e antes do catch-all do front-end). Sem isso, qualquer exceção não
// tratada em qualquer rota (ex: tipo inesperado vindo do body) derrubava a
// requisição com a página de erro padrão do Express, que expõe o stack trace
// completo (caminhos de arquivo internos do servidor) pro cliente.
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// Serve o front-end já compilado (client/dist), se existir
const distPath = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          // index.html nunca deve ficar em cache — é ele que aponta pro
          // arquivo JS mais recente (que tem hash no nome)
          res.setHeader("Cache-Control", "no-cache");
        } else {
          // arquivos com hash no nome (ex: index-abc123.js) mudam de nome
          // a cada build, então podem ficar em cache por muito tempo
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(distPath, "index.html"));
  });
}

function limparAnexosComLog() {
  try { limparAnexos(); } catch (e) { console.error("[chat] falha na limpeza de anexos:", e.message); }
}

const server = http.createServer(app);
// O padrão do Node derruba qualquer requisição que demore mais de 5 minutos —
// um vídeo de 200 MB numa internet lenta passa disso e o envio falhava no
// meio. 30 minutos dá folga.
server.requestTimeout = 30 * 60 * 1000;
setupRealtime(server);

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  startBackupScheduler();
  pruneEspelhosELog();
  // A cada 30 min também, pra sumir sozinho mesmo se ninguém abrir a aba.
  setInterval(pruneEspelhosELog, 30 * 60 * 1000);
  pruneEntrevistadosELog();
  // Mesma ideia para entrevistados vencidos (inativação automática).
  setInterval(pruneEntrevistadosELog, 30 * 60 * 1000);
  pruneContasReceberELog();
  // Mesma ideia para contas a receber vencidas (marca "Atrasado" sozinho e
  // avisa quem tem acesso ao financeiro).
  setInterval(pruneContasReceberELog, 30 * 60 * 1000);
  pruneContasPagarELog();
  // Mesma ideia para contas a pagar vencidas.
  setInterval(pruneContasPagarELog, 30 * 60 * 1000);
  limparAnexosComLog();
  // Anexos do Chat: expira por prazo/teto de espaço — checar de hora em hora
  // mantém o prazo exato (14 dias) com até 1h de diferença.
  setInterval(limparAnexosComLog, 60 * 60 * 1000);
  pruneHistoricoAntigo();
  // Histórico tem retenção bem maior (180 dias) — checar uma vez por dia já basta.
  setInterval(pruneHistoricoAntigo, 24 * 60 * 60 * 1000);
});
