// Máscaras numéricas dos campos de formulário (duração, quantidade, valor).
// CPF/CNPJ/telefone continuam em `validators.js` (ValidatedInput).

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// Duração digitada só com números, preenchida da DIREITA pra esquerda (igual
// timer de celular/maquininha): "3" -> "0:03", "30" -> "0:30", "130" -> "1:30",
// "1030" -> "10:30". Aceita até 4 dígitos (99:59). Não limita os segundos em
// 59 durante a digitação (senão "9","0","0" viraria 0:59 antes de chegar em
// 9:00) — quem corrige isso é `normalizarDuracao`, ao sair do campo.
// Também é idempotente com valores já salvos ("0:30" -> "030" -> "0:30").
const formatDuracaoDigitada = (v) => {
  const d = soDigitos(v).replace(/^0+/, "").slice(-4);
  if (!d) return "";
  const p = d.padStart(3, "0");
  return `${p.slice(0, -2)}:${p.slice(-2)}`;
};

// Ao sair do campo: segundos acima de 59 viram minutos ("0:90" -> "1:30").
const normalizarDuracao = (v) => {
  const m = String(v ?? "").match(/^(\d+):(\d{2})$/);
  if (!m) return v;
  const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if (total <= 0) return "";
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

// Inteiro só com números (ex: duração do OPEC em segundos, quantidade).
const formatInteiro = (v, max = 6) => soDigitos(v).replace(/^0+(?=\d)/, "").slice(0, max);

// Valor em reais: os dígitos entram como centavos, da direita pra esquerda
// ("1" -> 0,01 | "150" -> 1,50 | "123456" -> 1.234,56). O valor guardado no
// formulário continua sendo uma string decimal ("1234.56"), igual ao que o
// <input type="number"> devolvia — então o resto do sistema não muda.
const formatMoedaDigitada = (v) => {
  const cents = parseInt(soDigitos(v).slice(0, 12) || "0", 10);
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const moedaParaValor = (v) => {
  const cents = parseInt(soDigitos(v).slice(0, 12) || "0", 10);
  return cents ? (cents / 100).toFixed(2) : "";
};
const valorParaMoeda = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return "";
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatMoedaDigitada(String(Math.round(n * 100)));
};

export { soDigitos, formatDuracaoDigitada, normalizarDuracao, formatInteiro, formatMoedaDigitada, moedaParaValor, valorParaMoeda };
