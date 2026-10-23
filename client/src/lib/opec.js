import { WEEKDAY_KEYS_BY_INDEX } from "./dates.js";

// O VT vai ao ar nesse dia (AAAA-MM-DD)? Vale o dia da semana, o início e o
// vencimento — a mesma regra da aba OPEC, do Espelho e do painel de Início.
export const noArNoDia = (i, dia) => {
  const chave = WEEKDAY_KEYS_BY_INDEX[new Date(dia + "T00:00:00").getDay()];
  if (!(i.diasSemana || []).includes(chave)) return false;
  if (i.inicio && i.inicio > dia) return false;
  if (!i.naoVence && i.vencimento && i.vencimento < dia) return false;
  return true;
};
