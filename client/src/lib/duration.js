const formatDuracaoAspas = (duracao) => {
  if (!duracao) return "";
  const partes = String(duracao).split(":");
  if (partes.length !== 2) return duracao;
  const min = parseInt(partes[0], 10);
  const seg = parseInt(partes[1], 10);
  if (Number.isNaN(min) || Number.isNaN(seg)) return duracao;
  return `${min}'${String(seg).padStart(2, "0")}"`;
};

// Converte uma duração em segundos totais. Aceita tanto "mm:ss" (formato
// usado nas matérias/espelho) quanto um número puro de segundos (formato
// usado no cadastro de OPEC, ex: "30"). Retorna 0 se não conseguir parsear.
const parseDuracaoParaSegundos = (duracao) => {
  if (duracao === null || duracao === undefined || duracao === "") return 0;
  const str = String(duracao).trim();
  if (str.includes(":")) {
    const partes = str.split(":");
    if (partes.length === 2) {
      const min = parseInt(partes[0], 10);
      const seg = parseInt(partes[1], 10);
      if (Number.isNaN(min) || Number.isNaN(seg)) return 0;
      return min * 60 + seg;
    }
    if (partes.length === 3) {
      const h = parseInt(partes[0], 10);
      const min = parseInt(partes[1], 10);
      const seg = parseInt(partes[2], 10);
      if (Number.isNaN(h) || Number.isNaN(min) || Number.isNaN(seg)) return 0;
      return h * 3600 + min * 60 + seg;
    }
    return 0;
  }
  const n = parseFloat(str.replace(",", "."));
  return Number.isNaN(n) ? 0 : Math.round(n);
};

// Converte segundos totais de volta pro formato "m:ss" usado no espelho.
const formatSegundosParaDuracao = (totalSegundos) => {
  const seg = Math.round(Number(totalSegundos) || 0);
  if (seg <= 0) return "";
  const min = Math.floor(seg / 60);
  const s = seg % 60;
  return `${min}:${String(s).padStart(2, "0")}`;
};

// Distribui uma lista de "spots" (durações individuais e indivisíveis, em
// segundos) entre N passagens de bloco, tentando equilibrar o total de cada
// uma — mas sem nunca quebrar/fatiar um spot em duas passagens diferentes.
// Usa o algoritmo guloso "Longest Processing Time first" (LPT): ordena os
// spots do maior pro menor e, um a um, encaixa cada spot inteiro na
// passagem que estiver com o menor total até agora. Isso naturalmente
// produz resultados desiguais quando a divisão exata não é possível (ex:
// um VT de 1 min não pode virar 30s/30s em duas passagens).
const distribuirSpotsEmPassagens = (spots, n) => {
  if (!n || n <= 0) return [];
  const bins = Array.from({ length: n }, () => 0);
  const ordenados = [...(spots || [])].sort((a, b) => b - a);
  for (const spot of ordenados) {
    let menorIdx = 0;
    for (let i = 1; i < n; i++) {
      if (bins[i] < bins[menorIdx]) menorIdx = i;
    }
    bins[menorIdx] += spot;
  }
  return bins;
};

// Botão que copia um texto pra área de transferência, com fallback pra
// navegadores/contextos onde a Clipboard API não funciona (ex: sem HTTPS)

export { formatDuracaoAspas, parseDuracaoParaSegundos, formatSegundosParaDuracao, distribuirSpotsEmPassagens };
