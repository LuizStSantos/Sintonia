const getHorarios = (item) => {
  if (Array.isArray(item?.horarios) && item.horarios.length > 0) return item.horarios;
  if (item?.horario) return [item.horario];
  return [];
};
const formatHorarios = (item) => {
  const h = getHorarios(item);
  return h.length > 0 ? h.join(", ") : "—";
};

// Conta quantas vezes um break realmente vai ao ar entre duas datas, com
// base nos dias da semana marcados (ex: seg/qua/sex). Usado no relatório —
// já que OPEC não tem "vencimento" fixo por mês, mas sim uma
// recorrência semanal que pode ou não ter data de fim.

export { getHorarios, formatHorarios };
