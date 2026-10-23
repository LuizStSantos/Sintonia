
const ESPELHO_LABELS_PRESET = ["MERCHAN", "TEMPO", "COTAÇÕES", "CHAMADA NEUTRA", "AGENDA DE EVENTOS", "ABERTURA", "ENCERRAMENTO", "AB. E ENC.", "NOTA PÉ"];

const numeroBlocoNoIndice = (itens, indice) => {
  let bloco = 1;
  for (let i = 0; i < indice; i++) {
    if (itens[i]?.tipo === "passagem") bloco++;
  }
  return bloco;
};

// Quantos dias faltam pra esse espelho expirar: o prazo (Configurações >
// Espelho, padrão 30) conta a partir de quando o espelho foi CRIADO, não da
// data de veiculação. null se ele ainda não tem data de criação.
const diasParaExpirar = (espelho, retencaoDias = 30) => {
  const criado = Date.parse(espelho?.criadoEm || "");
  if (!Number.isFinite(criado)) return null;
  const restanteMs = criado + retencaoDias * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(restanteMs / (24 * 60 * 60 * 1000)));
};

// Popup de escolha de matérias — filtro por status, ano, mês e busca por
// texto, com seleção múltipla (marca várias e adiciona todas de uma vez,
// sem precisar abrir e fechar um a um).

// Cor fixa de cada programa (sempre a mesma para a mesma sigla), para distinguir
// os programas de relance na lista de espelhos.
const TONS_PROGRAMA = ["blue", "green", "amber", "purple", "teal"];
const tomDoPrograma = (sigla) => {
  let h = 0;
  for (const c of String(sigla || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONS_PROGRAMA[h % TONS_PROGRAMA.length];
};

export { tomDoPrograma, ESPELHO_LABELS_PRESET, numeroBlocoNoIndice, diasParaExpirar };
