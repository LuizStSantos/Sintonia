import { API_BASE, apiFetch, safeJson } from "./client.js";

async function req(path, opts, msg) {
  const res = await apiFetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error((await safeJson(res))?.error || msg);
  return res.json();
}
export const apiGetInicioLayout = () => req("/inicio/layout", undefined, "Falha ao carregar o seu Início").then((r) => r.layout);
export const apiSetInicioLayout = (cartoes) => req("/inicio/layout", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cartoes }) }, "Falha ao salvar o seu Início").then((r) => r.layout);
export const apiResetInicioLayout = () => req("/inicio/layout", { method: "DELETE" }, "Falha ao restaurar o Início");
export function apiEnviarArquivoInicio(arquivo) {
  const form = new FormData();
  form.append("arquivo", arquivo);
  return req("/inicio/arquivos", { method: "POST", body: form }, "Falha ao enviar o arquivo");
}
export const apiGetInicioEspaco = () => req("/inicio/espaco", undefined, "Falha ao carregar o espaço");
