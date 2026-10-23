// Fuso horário do sistema (escolhido em Configurações > Geral). Todas as
// telas usam ele — e não o fuso do aparelho de quem está olhando — para que
// "hoje", relógio, horários do chat e relatórios sejam iguais para todos e
// batam com o servidor. O valor é carregado no início do App (antes de
// mostrar os dados); enquanto isso, vale São Paulo.
export const FUSO_INICIAL = "America/Sao_Paulo";
let fuso = FUSO_INICIAL;

export function setFuso(z) {
  if (typeof z !== "string" || !z) return;
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: z }); fuso = z; } catch { /* mantém o anterior */ }
}
export const getFuso = () => fuso;

const dt = (data, opts) => new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: fuso }).format(data);

// "AAAA-MM-DD" de hoje (ou da data dada) no fuso do sistema.
export function hojeISO(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}

const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
// Hora, minuto, dia da semana (0 = domingo) e data ISO agora/na data dada.
export function partesAgora(data = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", hour: "2-digit", minute: "2-digit", weekday: "short" })
      .formatToParts(data).map((x) => [x.type, x.value])
  );
  return { hora: Number(p.hour) % 24, minuto: Number(p.minute), diaSemana: DIAS[p.weekday] ?? 0, ymd: hojeISO(data) };
}

export const formatHora = (data, opts = { hour: "2-digit", minute: "2-digit" }) => dt(data, opts);
export const formatData = (data, opts = { day: "2-digit", month: "2-digit", year: "numeric" }) => dt(data, opts);
export const formatDataHora = (data, opts = { dateStyle: "short", timeStyle: "medium" }) => dt(data, opts);

// "GMT-3", "GMT-4"... do fuso dado agora.
export function deslocamento(z, data = new Date()) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: z, timeZoneName: "shortOffset" }).formatToParts(data).find((p) => p.type === "timeZoneName")?.value || "";
  } catch { return ""; }
}
