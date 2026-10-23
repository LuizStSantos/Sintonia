import { API_BASE, apiFetch, safeJson } from "./client.js";

// Histórico/auditoria — somente admin (a rota no servidor já bloqueia quem
// não é admin com 403; aqui só monta a chamada com os filtros opcionais).
async function apiListHistorico(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  const qs = params.toString();
  const res = await apiFetch(`${API_BASE}/historico${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar histórico");
  return res.json();
}

export { apiListHistorico };
