import { API_BASE, apiFetch, safeJson } from "./client.js";

async function apiListEspelhoModelos() {
  const res = await apiFetch(`${API_BASE}/espelho-modelos`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar os modelos");
  return res.json();
}

async function apiCreateEspelhoModelo(payload) {
  const res = await apiFetch(`${API_BASE}/espelho-modelos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao salvar o modelo");
  return res.json();
}

async function apiUpdateEspelhoModelo(id, payload) {
  const res = await apiFetch(`${API_BASE}/espelho-modelos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao atualizar o modelo");
  return res.json();
}

async function apiDeleteEspelhoModelo(id) {
  const res = await apiFetch(`${API_BASE}/espelho-modelos/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error((await safeJson(res))?.error || "Falha ao excluir o modelo");
  }
}


export { apiListEspelhoModelos, apiCreateEspelhoModelo, apiUpdateEspelhoModelo, apiDeleteEspelhoModelo };
