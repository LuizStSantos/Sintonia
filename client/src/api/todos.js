import { API_BASE, apiFetch, safeJson } from "./client.js";

async function apiListTodos() {
  const res = await apiFetch(`${API_BASE}/todos`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar as tarefas");
  return res.json();
}

async function apiCreateTodo(payload) {
  const res = await apiFetch(`${API_BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao criar a tarefa");
  return res.json();
}

async function apiUpdateTodo(id, payload) {
  const res = await apiFetch(`${API_BASE}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao atualizar a tarefa");
  return res.json();
}

async function apiDeleteTodo(id) {
  const res = await apiFetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error((await safeJson(res))?.error || "Falha ao excluir a tarefa");
  }
}


export { apiListTodos, apiCreateTodo, apiUpdateTodo, apiDeleteTodo };
