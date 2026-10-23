const NOTIFICATION_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiNFNDM3MkIiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxNSwxNSkgc2NhbGUoMS40MTcpIiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICAgIDxwYXRoIGQ9Ik00LjkgMTYuMUMxIDEyLjIgMSA1LjggNC45IDEuOSIvPgogICAgPHBhdGggZD0iTTcuOCA0LjdhNi4xNCA2LjE0IDAgMCAwLS44IDcuNSIvPgogICAgPGNpcmNsZSBjeD0iMTIiIGN5PSI5IiByPSIyIi8+CiAgICA8cGF0aCBkPSJNMTYuMiA0LjhjMiAyIDIuMjYgNS4xMS44IDcuNDciLz4KICAgIDxwYXRoIGQ9Ik0xOS4xIDEuOWE5Ljk2IDkuOTYgMCAwIDEgMCAxNC4xIi8+CiAgICA8cGF0aCBkPSJNOS41IDE4aDUiLz4KICAgIDxwYXRoIGQ9Im04IDIyIDQtMTEgNCAxMSIvPgogIDwvZz4KPC9zdmc+Cg==";

function showBrowserNotification(title, body) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: NOTIFICATION_ICON, tag: title + body });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) {
    /* alguns navegadores (ex: em iframe) recusam — ignora silenciosamente */
  }
}

// Sinal sonoro de mensagem nova do Chat. Um único <audio> reaproveitado (em
// vez de `new Audio()` a cada toque) pra não acumular elemento solto na
// memória quando várias mensagens chegam em sequência rápida — só rebobina
// (`currentTime = 0`) e toca de novo. Como esse evento só chega pelo
// WebSocket pra quem NÃO foi o autor da mensagem (o servidor exclui quem
// mandou — ver `notifyUsers` em `server/index.js`), é seguro tocar sempre
// que o evento chegar, sem precisar checar "é minha própria mensagem?".
let notificationAudio = null;
function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio("/sounds/notificacao.wav");
      notificationAudio.volume = 0.5;
    }
    notificationAudio.currentTime = 0;
    const p = notificationAudio.play();
    if (p && typeof p.catch === "function") {
      // Autoplay bloqueado (raro aqui, já que a pessoa precisou clicar pra
      // logar) — ignora silenciosamente, não é um erro que importe.
      p.catch(() => {});
    }
  } catch (e) {
    /* ignora — som é só um "plus", nunca pode travar o resto do Chat */
  }
}

function applyRealtimeEvent(prevData, msg) {
  if (!prevData || !msg || !msg.collection || !(msg.collection in prevData)) return prevData;
  const { type, collection, payload } = msg;
  const list = prevData[collection];

  if (type === "created") {
    if (!payload?.id || list.some((i) => i.id === payload.id)) return prevData;
    const nextList = collection === "opec" ? [...list, payload] : [payload, ...list];
    return { ...prevData, [collection]: nextList };
  }
  if (type === "updated") {
    if (!payload?.id) return prevData;
    return { ...prevData, [collection]: list.map((i) => (i.id === payload.id ? payload : i)) };
  }
  if (type === "deleted") {
    if (!payload?.id) return prevData;
    return { ...prevData, [collection]: list.filter((i) => i.id !== payload.id) };
  }
  return prevData;
}

// Barramento simples de eventos: a conexão WebSocket fica só no componente
// App, mas outras partes da árvore (ex: a tela Usuários, em Configurações) também precisam
// reagir a mensagens em tempo real. Cada mensagem recebida é repassada pra
// todo mundo que se inscreveu.
const realtimeListeners = new Set();
function onRealtimeMessage(fn) {
  realtimeListeners.add(fn);
  return () => realtimeListeners.delete(fn);
}

// Sentido contrário: deixa outras partes da árvore (ex: o Chat, pro
// indicador de "digitando...") mandarem uma mensagem PRO servidor pela
// mesma conexão WebSocket que o App mantém. O App registra a função real
// (`setSocketSend`) assim que conecta; se ninguém registrou ainda (ou a
// conexão caiu), a chamada é simplesmente ignorada.
let socketSendFn = null;
function setSocketSend(fn) {
  socketSendFn = fn;
}
function sendRealtimeMessage(msg) {
  if (socketSendFn) socketSendFn(msg);
}
function emitRealtimeMessage(msg) {
  realtimeListeners.forEach((fn) => fn(msg));
}

// Guarda qual versão do servidor o cliente já viu. Se o servidor reiniciar
// com código novo (ex: depois de um deploy), o buildId muda — é assim que
// detectamos isso e recarregamos a página sozinhos, sem precisar avisar
// cada usuário manualmente.
let knownBuildId = null;
function getKnownBuildId() {
  return knownBuildId;
}
function setKnownBuildId(v) {
  knownBuildId = v;
}

export { NOTIFICATION_ICON, showBrowserNotification, playNotificationSound, applyRealtimeEvent, realtimeListeners, onRealtimeMessage, emitRealtimeMessage, setSocketSend, sendRealtimeMessage, getKnownBuildId, setKnownBuildId };
