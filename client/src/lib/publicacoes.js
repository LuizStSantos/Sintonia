import { formatDateBR } from "./dates.js";

// Publicações nas redes: lista de { rede, data } guardada em `publicacoes`
// nas matérias e nos entrevistados. Uma publicação por rede.
export const REDES_INICIAIS = ["YouTube", "Instagram", "Facebook", "TikTok", "Site", "WhatsApp"];

export const publicacaoDe = (arr, rede) => (arr || []).find((p) => p.rede === rede);

// Liga/desliga uma rede (ao ligar, usa a data de hoje).
export function alternarPublicacao(arr, rede, hoje) {
  const lista = arr || [];
  return publicacaoDe(lista, rede) ? lista.filter((p) => p.rede !== rede) : [...lista, { rede, data: hoje }];
}
export const mudarDataPublicacao = (arr, rede, data) => (arr || []).map((p) => (p.rede === rede ? { ...p, data } : p));

export const resumoPublicacoes = (arr) =>
  (arr || []).map((p) => `${p.rede}${p.data ? ` ${formatDateBR(p.data).slice(0, 5)}` : ""}`).join(", ") || "—";
export const textoPublicacoes = (arr) =>
  (arr || []).map((p) => `${p.rede}${p.data ? ` (${formatDateBR(p.data)})` : ""}`).join(", ") || "—";
