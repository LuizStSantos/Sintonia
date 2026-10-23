import { API_BASE, apiFetch, safeJson } from "./client.js";

async function req(path, opts, msg) {
  const res = await apiFetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error((await safeJson(res))?.error || msg);
  return res.json();
}
export const apiGetEspelhoVistos = () => req("/espelho/vistos", undefined, "Falha ao carregar os espelhos vistos");
export const apiMarcarEspelhoVisto = (id) => req(`/espelho/vistos/${encodeURIComponent(id)}`, { method: "POST" }, "Falha ao marcar o espelho como visto");
export const apiMarcarTodosEspelhosVistos = () => req("/espelho/vistos", { method: "POST" }, "Falha ao marcar os espelhos como vistos");
