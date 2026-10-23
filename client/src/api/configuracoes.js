import { API_BASE, apiFetch, safeJson } from "./client.js";

async function req(path, opts, msg) {
  const res = await apiFetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error((await safeJson(res))?.error || msg);
  return res.json();
}
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const apiGetSmtp = () => req("/backup/smtp", undefined, "Falha ao carregar os dados do e-mail");
export const apiSetSmtp = (b) => req("/backup/smtp", json("PUT", b), "Falha ao salvar os dados do e-mail");
export const apiClearSmtp = () => req("/backup/smtp", { method: "DELETE" }, "Falha ao remover os dados do e-mail");
export const apiGetChatArmazenamento = () => req("/chat/armazenamento", undefined, "Falha ao carregar o armazenamento do chat");
export const apiSetChatLimites = (b) => req("/chat/limites", json("PUT", b), "Falha ao salvar as regras do chat");
export const apiResetChatLimites = () => req("/chat/limites", { method: "DELETE" }, "Falha ao restaurar as regras do chat");
export const apiGetEspelhoConfig = () => req("/espelho/config", undefined, "Falha ao carregar a validade do espelho");
export const apiSimularEspelhoConfig = (dias) => req(`/espelho/config/simular?dias=${encodeURIComponent(dias)}`, undefined, "Falha ao calcular quantos espelhos seriam apagados");
export const apiSetEspelhoConfig = (retencaoDias) => req("/espelho/config", json("PUT", { retencaoDias }), "Falha ao salvar a validade do espelho");
export const apiResetEspelhoConfig = () => req("/espelho/config", { method: "DELETE" }, "Falha ao restaurar a validade do espelho");
export const apiGetFuso = () => req("/config/fuso", undefined, "Falha ao carregar o fuso horário");
export const apiSetFuso = (fuso) => req("/config/fuso", json("PUT", { fuso }), "Falha ao salvar o fuso horário");
export const apiResetFuso = () => req("/config/fuso", { method: "DELETE" }, "Falha ao restaurar o fuso horário");
export const apiGetRedes = () => req("/config/redes", undefined, "Falha ao carregar as redes sociais");
export const apiSetRedes = (redes) => req("/config/redes", json("PUT", { redes }), "Falha ao salvar as redes sociais");
export const apiResetRedes = () => req("/config/redes", { method: "DELETE" }, "Falha ao restaurar as redes sociais");
export const apiGetInicioEspaco = () => req("/config/inicio-espaco", undefined, "Falha ao carregar o espaço do Início");
export const apiSetInicioEspaco = (quotaGB) => req("/config/inicio-espaco", json("PUT", { quotaGB }), "Falha ao salvar o espaço do Início");
export const apiResetInicioEspaco = () => req("/config/inicio-espaco", { method: "DELETE" }, "Falha ao restaurar o espaço do Início");
