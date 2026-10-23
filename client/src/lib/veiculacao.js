import { formatDateBR } from "./dates.js";

const VEICULACAO_LOCAIS = ["SC", "SUCA", "DOM"];

// Compatibilidade: matérias antigas guardavam a veiculação como uma string de
// data pura (sem local). Normaliza pra sempre virar { data, local }.
const normalizeVeiculacao = (v) =>
  typeof v === "string" ? { data: v, local: "" } : { data: v?.data || "", local: v?.local || "" };

const formatVeiculacaoItem = (v) => {
  const n = normalizeVeiculacao(v);
  const dataCurta = n.data ? formatDateBR(n.data).slice(0, 5) : ""; // dd/mm
  return `${dataCurta} ${n.local}`.trim() || "—";
};

const formatVeiculacaoSummary = (arr) => {
  if (!arr || arr.length === 0) return "—";
  const items = arr.map(formatVeiculacaoItem);
  return items.length > 2 ? `${items.slice(0, 2).join(", ")} +${items.length - 2}` : items.join(", ");
};

// Igual ao resumo, mas sem truncar — usado no popup de visualização, onde
// tem espaço pra mostrar todas as datas de veiculação de uma vez.
const formatVeiculacaoFull = (arr) => {
  if (!arr || arr.length === 0) return "—";
  return arr.map(formatVeiculacaoItem).join(", ");
};

// Caixa alta com acentuação em português preservada (ç, ã, é...) — usado no
// PDF e no .txt do espelho, que devem sair tudo em maiúscula pro teleprompter.

export { VEICULACAO_LOCAIS, normalizeVeiculacao, formatVeiculacaoItem, formatVeiculacaoSummary, formatVeiculacaoFull };
