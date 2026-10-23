import { API_BASE, apiFetch, safeJson } from "./client.js";

async function apiError(res, fallbackMsg) {
  const err = new Error((await safeJson(res))?.error || fallbackMsg);
  err.status = res.status;
  return err;
}

async function apiListUsuariosChat() {
  const res = await apiFetch(`${API_BASE}/chat/usuarios`);
  if (!res.ok) throw await apiError(res, "Falha ao carregar os usuários");
  return res.json();
}

async function apiListOnline() {
  const res = await apiFetch(`${API_BASE}/chat/online`);
  if (!res.ok) throw await apiError(res, "Falha ao carregar quem está online");
  return res.json();
}

async function apiNaoLidas() {
  const res = await apiFetch(`${API_BASE}/chat/nao-lidas`);
  if (!res.ok) throw await apiError(res, "Falha ao carregar não lidas");
  return res.json();
}

async function apiListConversas() {
  const res = await apiFetch(`${API_BASE}/chat/conversas`);
  if (!res.ok) throw await apiError(res, "Falha ao carregar as conversas");
  return res.json();
}

async function apiCriarConversaPrivada(userId) {
  const res = await apiFetch(`${API_BASE}/chat/conversas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw await apiError(res, "Falha ao iniciar a conversa");
  return res.json();
}

async function apiCriarGrupo(nome, participantes) {
  const res = await apiFetch(`${API_BASE}/chat/conversas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "grupo", nome, participantes }),
  });
  if (!res.ok) throw await apiError(res, "Falha ao criar o grupo");
  return res.json();
}

async function apiRenomearGrupo(conversaId, nome) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
  if (!res.ok) throw await apiError(res, "Falha ao renomear o grupo");
  return res.json();
}

async function apiApagarGrupo(conversaId) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw await apiError(res, "Falha ao apagar o grupo");
}

async function apiAdicionarParticipantes(conversaId, participantes) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/participantes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: participantes }),
  });
  if (!res.ok) throw await apiError(res, "Falha ao adicionar participantes");
  return res.json();
}

async function apiRemoverParticipante(conversaId, userId) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/participantes/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await apiError(res, "Falha ao remover participante");
  return res.json();
}

async function apiDefinirFotoGrupo(conversaId, arquivo) {
  const body = new FormData();
  body.append("foto", arquivo);
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/foto`, { method: "POST", body });
  if (!res.ok) throw await apiError(res, "Falha ao enviar a foto do grupo");
  return res.json();
}

async function apiRemoverFotoGrupo(conversaId) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/foto`, { method: "DELETE" });
  if (!res.ok) throw await apiError(res, "Falha ao remover a foto do grupo");
  return res.json();
}

async function apiListMensagens(conversaId, { before, limit } = {}) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  if (limit) params.set("limit", limit);
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/mensagens${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw await apiError(res, "Falha ao carregar as mensagens");
  return res.json();
}

// Se tiver arquivo, manda como multipart/form-data (precisa do multer no
// servidor pra processar o upload); senão manda JSON puro, mais simples.
async function apiEnviarMensagem(conversaId, { texto, arquivo, respostaA, duracao } = {}) {
  let res;
  if (arquivo) {
    const form = new FormData();
    if (texto) form.append("texto", texto);
    if (respostaA) form.append("respostaA", respostaA);
    if (duracao) form.append("anexoDuracao", String(duracao));
    form.append("arquivo", arquivo);
    res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/mensagens`, {
      method: "POST",
      body: form,
    });
  } else {
    res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, respostaA }),
    });
  }
  if (!res.ok) throw await apiError(res, "Falha ao enviar a mensagem");
  return res.json();
}

async function apiLimitesChat() {
  const res = await apiFetch(`${API_BASE}/chat/limites`);
  if (!res.ok) throw await apiError(res, "Falha ao carregar os limites do chat");
  return res.json();
}

async function apiApagarMensagem(conversaId, mensagemId) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/mensagens/${mensagemId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw await apiError(res, "Falha ao apagar a mensagem");
}

// Reage a uma mensagem com um emoji (mesmo emoji de novo, ou vazio, tira a reação).
async function apiReagirMensagem(conversaId, mensagemId, emoji) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/mensagens/${mensagemId}/reacao`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw await apiError(res, "Falha ao reagir à mensagem");
  return res.json();
}

async function apiMarcarComoLida(conversaId) {
  const res = await apiFetch(`${API_BASE}/chat/conversas/${conversaId}/lida`, { method: "PUT" });
  if (!res.ok && res.status !== 204) throw await apiError(res, "Falha ao marcar como lida");
}

function anexoUrl(nomeArquivo) {
  return `${API_BASE}/chat/anexos/${encodeURIComponent(nomeArquivo)}`;
}

export {
  apiListUsuariosChat,
  apiListOnline,
  apiNaoLidas,
  apiListConversas,
  apiCriarConversaPrivada,
  apiCriarGrupo,
  apiRenomearGrupo,
  apiApagarGrupo,
  apiAdicionarParticipantes,
  apiRemoverParticipante,
  apiDefinirFotoGrupo,
  apiRemoverFotoGrupo,
  apiListMensagens,
  apiEnviarMensagem,
  apiApagarMensagem,
  apiReagirMensagem,
  apiLimitesChat,
  apiMarcarComoLida,
  anexoUrl,
};
