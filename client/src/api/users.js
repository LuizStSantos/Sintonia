import { API_BASE, apiFetch, safeJson } from "./client.js";

async function apiListUsers() {
  const res = await apiFetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar usuários");
  return res.json();
}

// Versão enxuta (só id + nome) pra quem pode atribuir tarefas de TO-DO
// mas não é admin — a rota /api/users normal é restrita a admin.
async function apiListAssignableUsers() {
  const res = await apiFetch(`${API_BASE}/users/assignable`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar usuários");
  return res.json();
}

async function apiCreateUser(payload) {
  const res = await apiFetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao criar usuário");
  return res.json();
}

async function apiUpdateUser(id, payload) {
  const res = await apiFetch(`${API_BASE}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao atualizar usuário");
  return res.json();
}

async function apiDeleteUser(id) {
  const res = await apiFetch(`${API_BASE}/users/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error((await safeJson(res))?.error || "Falha ao excluir usuário");
  }
}

async function apiUploadFotoUsuario(id, arquivo) {
  const body = new FormData();
  body.append("foto", arquivo);
  const res = await apiFetch(`${API_BASE}/users/${id}/foto`, { method: "POST", body });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao enviar a foto");
  return res.json();
}

async function apiRemoverFotoUsuario(id) {
  const res = await apiFetch(`${API_BASE}/users/${id}/foto`, { method: "DELETE" });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao remover a foto");
  return res.json();
}

// Abas que podem ter permissão configurada por usuário (a de "Usuários" é sempre admin-only)

export { apiListUsers, apiListAssignableUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiUploadFotoUsuario, apiRemoverFotoUsuario };
