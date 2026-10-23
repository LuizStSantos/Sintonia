import { hojeISO } from "./fuso.js";
const formatDateBR = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const todayISO = () => hojeISO();

const isOverdue = (iso) => {
  if (!iso) return false;
  return iso < todayISO();
};

// Nome de exibição do cliente/empresa, com fallback para dados salvos no formato antigo
const addDaysISO = (iso, days) => {
  if (!iso) return iso;
  const [y, m, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dia + days)).toISOString().slice(0, 10);
};

// Soma meses a uma data ISO, mantendo sempre o MESMO dia do mês (ex: todo
// dia 1, todo dia 15) — diferente de "somar 30 dias", que vai derivando aos
// poucos porque nem todo mês tem 30 dias (abril tem 30, maio tem 31...).
// Se o mês de destino não tem esse dia (ex: dia 31 caindo em fevereiro),
// usa o último dia daquele mês em vez de estourar pro mês seguinte.
// IMPORTANTE: sempre chamar com a data ORIGINAL/âncora (ex: a primeira
// parcela) e o índice do mês (0, 1, 2...), nunca acumulando a partir do
// resultado anterior — senão um mês curto no meio da série "puxa" todas as
// datas seguintes pro dia errado.
const addMonthsISO = (iso, months) => {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const totalMonths = (m - 1) + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth0 = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth0 + 1, 0).getDate();
  const targetDay = Math.min(d, lastDayOfTargetMonth);
  const mm = String(targetMonth0 + 1).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
};

// Nome do dia da semana por extenso (ex: "SEGUNDA-FEIRA"), usado no Espelho.
const diaSemanaExtenso = (dataISO) => {
  if (!dataISO) return "";
  const [y, m, d] = dataISO.split("-").map(Number);
  return DIA_SEMANA_EXTENSO[new Date(y, m - 1, d).getDay()];
};
const DIA_SEMANA_EXTENSO = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
const WEEKDAYS = [
  { key: "dom", label: "Dom", full: "Domingo" },
  { key: "seg", label: "Seg", full: "Segunda-feira" },
  { key: "ter", label: "Ter", full: "Terça-feira" },
  { key: "qua", label: "Qua", full: "Quarta-feira" },
  { key: "qui", label: "Qui", full: "Quinta-feira" },
  { key: "sex", label: "Sex", full: "Sexta-feira" },
  { key: "sab", label: "Sáb", full: "Sábado" },
];

// Pega só os 2 primeiros nomes de um nome completo (ex: "Luiz Stormorwski
// Santos" -> "Luiz Stormorwski") — mesma lógica usada no servidor, aqui só
// pra mostrar uma prévia ao admin enquanto ele digita.
const WEEKDAY_KEYS_BY_INDEX = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const formatWeekdays = (arr) => {
  if (!arr || arr.length === 0) return "—";
  if (arr.length === 7) return "Todos os dias";
  return WEEKDAYS.filter((d) => arr.includes(d.key)).map((d) => d.label).join(", ");
};

// Programas agora suportam mais de um horário (ex: reprise à noite). Itens
// antigos, salvos antes dessa mudança, têm só um "horario" (string) em vez
// de "horarios" (lista) — isso lê os dois formatos sem quebrar nada.
const countOcorrenciasNoPeriodo = (diasSemana, dataInicio, dataFim) => {
  if (!diasSemana || diasSemana.length === 0 || !dataInicio || !dataFim) return 0;
  if (dataInicio > dataFim) return 0;
  const diasSet = new Set(diasSemana);
  let count = 0;
  const cursor = new Date(dataInicio + "T00:00:00");
  const fim = new Date(dataFim + "T00:00:00");
  while (cursor <= fim) {
    if (diasSet.has(WEEKDAY_KEYS_BY_INDEX[cursor.getDay()])) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};


export { formatDateBR, todayISO, isOverdue, addDaysISO, addMonthsISO, diaSemanaExtenso, DIA_SEMANA_EXTENSO, WEEKDAYS, WEEKDAY_KEYS_BY_INDEX, MONTHS, formatWeekdays, countOcorrenciasNoPeriodo };
