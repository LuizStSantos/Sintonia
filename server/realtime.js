import { WebSocketServer } from "ws";
import crypto from "node:crypto";
import { verifyToken, COOKIE_NAME } from "./auth.js";
import { getUserById } from "./db.js";

// Muda toda vez que o processo do servidor reinicia (ex: depois de um
// `docker compose up -d --build`). É assim que os clientes conectados
// percebem que o servidor foi atualizado e devem recarregar a página.
const BUILD_ID = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

// id de conexão -> { ws, userId }
const clients = new Map();
let nextId = 1;

function canView(user, collection) {
  if (user.role === "admin") return true;
  const perm = user.permissions?.[collection] || "none";
  return perm === "view" || perm === "edit";
}

export function setupRealtime(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;
    const user = payload ? getUserById(payload.sub) : null;

    if (!user) {
      ws.close(4001, "unauthorized");
      return;
    }

    // Precisa checar ANTES de registrar essa conexão em `clients` — senão
    // estaOnline() sempre ia encontrar essa própria conexão recém-aberta e
    // achar que a pessoa "já estava online", nunca disparando o aviso de
    // primeira conexão.
    const jaEstavaOnline = estaOnline(user.id);

    const id = nextId++;
    clients.set(id, { ws, userId: user.id });
    ws.isAlive = true;

    // Avisa o cliente qual versão do servidor ele está falando com — o
    // cliente compara com a versão anterior (se houver) pra saber se o
    // servidor foi reiniciado com código novo e precisa recarregar a página.
    ws.send(JSON.stringify({ type: "hello", buildId: BUILD_ID }));

    // Presença (online/offline) do Chat: avisa todo mundo conectado que
    // essa pessoa ficou online — sem filtro de permissão, porque no Chat
    // qualquer usuário pode falar com qualquer outro, então saber quem tá
    // online vale pra todo mundo igual. Só avisa na primeira conexão dessa
    // pessoa (pode ter várias abas abertas ao mesmo tempo — só fica
    // "offline" quando a ÚLTIMA fechar, ver wasLastConnection() abaixo).
    if (!jaEstavaOnline) {
      broadcastPresence(user.id, true);
    }

    // Mensagens que o PRÓPRIO cliente manda pro servidor pelo WebSocket —
    // hoje só "typing" (indicador de "fulano está digitando..." no Chat),
    // que não precisa virar registro no banco, só repassar pra quem
    // participa da mesma conversa. Qualquer outro tipo é ignorado.
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return;
      }
      if (msg.type === "typing" && msg.conversaId && Array.isArray(msg.participantes)) {
        const payload = JSON.stringify({ type: "chat-typing", conversaId: msg.conversaId, userId: user.id });
        for (const { ws: otherWs, userId: uid } of clients.values()) {
          if (uid === user.id || otherWs.readyState !== otherWs.OPEN) continue;
          if (!msg.participantes.includes(uid)) continue;
          otherWs.send(payload);
        }
      }
    });

    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("close", () => {
      clients.delete(id);
      if (!estaOnline(user.id)) broadcastPresence(user.id, false);
    });
    ws.on("error", () => {
      clients.delete(id);
      if (!estaOnline(user.id)) broadcastPresence(user.id, false);
    });
  });

  // Ping periódico: detecta conexões mortas (útil atrás de proxies) e mantém
  // a conexão viva em infraestruturas que fecham conexões ociosas.
  const heartbeat = setInterval(() => {
    for (const [id, { ws }] of clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        clients.delete(id);
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

// Avisa todo mundo com permissão de ver aquela coleção que algo mudou.
// Busca o usuário fresco do banco a cada chamada (não usa um valor
// guardado da hora da conexão), pra respeitar mudanças de permissão em
// tempo real sem precisar a pessoa reconectar. "actorId" (opcional) é
// quem fez a mudança — vai junto na mensagem pra quem recebeu saber que
// foi ela mesma (e não precisar de truque de tempo/race condition pra
// decidir se mostra uma notificação sobre a própria ação).
export function broadcastChange(collection, type, payload, actorId) {
  const message = JSON.stringify({ type, collection, payload, actorId: actorId || null });
  for (const { ws, userId } of clients.values()) {
    if (ws.readyState !== ws.OPEN) continue;
    const user = getUserById(userId);
    if (!user || !canView(user, collection)) continue;
    ws.send(message);
  }
}

// Avisa um usuário específico (ex: quando o admin muda as permissões dele
// ou exclui a conta)
export function notifyUser(userId, message) {
  const payload = JSON.stringify(message);
  for (const { ws, userId: uid } of clients.values()) {
    if (uid === userId && ws.readyState === ws.OPEN) ws.send(payload);
  }
}

// Avisa TODO MUNDO que está conectado (ex: o admin mudou as regras dos anexos
// do Chat e os campos de envio já abertos precisam mostrar o valor novo).
export function broadcastAll(message) {
  const payload = JSON.stringify(message);
  for (const { ws } of clients.values()) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

// Avisa uma LISTA de usuários específicos (ex: todo mundo que participa de
// uma conversa do Chat, menos quem acabou de mandar a mensagem).
export function notifyUsers(userIds, message, excludeUserId) {
  const payload = JSON.stringify(message);
  const alvo = new Set((userIds || []).filter((id) => id !== excludeUserId));
  if (alvo.size === 0) return;
  for (const { ws, userId } of clients.values()) {
    if (ws.readyState === ws.OPEN && alvo.has(userId)) ws.send(payload);
  }
}

// true se a pessoa tem pelo menos uma conexão aberta agora (pode ter mais
// de uma aba/dispositivo — "online" é true se qualquer uma estiver viva).
function estaOnline(userId) {
  for (const { ws, userId: uid } of clients.values()) {
    if (uid === userId && ws.readyState === ws.OPEN) return true;
  }
  return false;
}

// ids de todos os usuários com pelo menos uma conexão aberta agora — usado
// pro Chat pintar a "bolinha verde" de quem está online ao abrir a tela
// (os eventos de presença em tempo real só cobrem o que muda DEPOIS que a
// pessoa já está com a tela aberta).
export function getOnlineUserIds() {
  const ids = new Set();
  for (const { ws, userId } of clients.values()) {
    if (ws.readyState === ws.OPEN) ids.add(userId);
  }
  return [...ids];
}

// Avisa TODO MUNDO conectado (sem filtro de permissão) que alguém ficou
// online ou offline — ver comentário em wss.on("connection") sobre por
// que presença do Chat não é filtrada por permissão de coleção.
function broadcastPresence(userId, online) {
  const payload = JSON.stringify({ type: "chat-presence", userId, online });
  for (const { ws } of clients.values()) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

// Avisa todos os administradores conectados, exceto (opcionalmente) um —
// usado pra notificar o resto dos admins quando ALGUÉM cria uma tarefa de
// TO-DO, sem notificar quem acabou de criar.
export function notifyAdmins(message, excludeUserId) {
  const payload = JSON.stringify(message);
  for (const { ws, userId } of clients.values()) {
    if (ws.readyState !== ws.OPEN) continue;
    if (excludeUserId && userId === excludeUserId) continue;
    const user = getUserById(userId);
    if (!user || user.role !== "admin") continue;
    ws.send(payload);
  }
}
