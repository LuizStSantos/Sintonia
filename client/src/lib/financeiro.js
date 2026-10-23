import { todayISO, addMonthsISO } from "./dates.js";
import { uid } from "./validators.js";

// Gera as parcelas de um lançamento: divide o valor total igualmente
// (ajustando a última parcela pra fechar o total certinho) e repete o
// MESMO dia do mês em cada vencimento seguinte (ex: 1ª parcela dia 1 de
// março, 2ª dia 1 de abril, 3ª dia 1 de maio...) — usa `addMonthsISO`, não
// "+30 dias", porque meses têm tamanhos diferentes e "+30 dias" ia
// derivando aos poucos pro dia errado.
const generateInstallments = (form) => {
  const n = Math.max(1, Number(form.parcelas) || 1);
  const total = Number(form.valor) || 0;
  const grupoId = uid();
  if (n <= 1) {
    return [{ ...form, valor: total, parcela: "1/1", grupoId }];
  }
  const base = Math.floor((total / n) * 100) / 100;
  const installments = [];
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const valorParcela = isLast ? Math.round((total - acumulado) * 100) / 100 : base;
    acumulado += base;
    installments.push({
      ...form,
      valor: valorParcela,
      vencimento: addMonthsISO(form.vencimento, i),
      parcela: `${i + 1}/${n}`,
      grupoId,
    });
  }
  return installments;
};

// Contrato mínimo: diferente do parcelamento, NÃO divide o valor — repete o
// valor cheio a cada mês, pelo número de meses escolhido (1 a 24).
const generateContratoMinimo = (form) => {
  const n = Math.max(1, Math.min(24, Number(form.mesesContrato) || 1));
  const total = Number(form.valor) || 0;
  const grupoId = uid();
  const lancamentos = [];
  for (let i = 0; i < n; i++) {
    lancamentos.push({
      ...form,
      valor: total,
      vencimento: addMonthsISO(form.vencimento, i),
      parcela: `${i + 1}/${n}`,
      grupoId,
    });
  }
  return lancamentos;
};

// Conta fixa: uma conta recorrente sem data de fim definida (ex: salário,
// água, luz, internet) — repete o mesmo valor todo mês, indefinidamente, até
// ser cancelada manualmente. Em vez de gerar um lote gigante de uma vez (que
// teria um limite escondido), gera só 6 meses por vez — o servidor completa
// automaticamente sempre que a folga cair abaixo disso (ver server/db.js).
const CONTA_FIXA_BUFFER_MESES = 6;
const generateContaFixa = (form) => {
  const total = Number(form.valor) || 0;
  const grupoId = uid();
  const lancamentos = [];
  for (let i = 0; i < CONTA_FIXA_BUFFER_MESES; i++) {
    lancamentos.push({
      ...form,
      valor: total,
      vencimento: addMonthsISO(form.vencimento, i),
      parcela: "",
      contaFixa: true,
      grupoId,
    });
  }
  return lancamentos;
};

// Um break "vencido" (exceto os marcados como "não vence") deve ser excluído automaticamente
const clientDisplayName = (i) => i.nomeFantasia || i.razaoSocial || i.cliente || "—";



// Lista o que dá pra cancelar em Contas a pagar / a receber: contas fixas e
// parcelamentos/contratos com mais de um lançamento, agrupados por grupoId.
// `ids` = lançamentos NÃO pagos de hoje em diante (serão apagados);
// `vencidasIds` = vencidos e não pagos (só entram se a pessoa marcar a opção);
// lançamentos "Pago" nunca entram.
const buildCancelableSeries = (items) => {
  const hoje = todayISO();
  const map = new Map();
  items.forEach((i) => {
    const total = Number(String(i.parcela || "1/1").split("/")[1]) || 1;
    if (!i.contaFixa && total <= 1) return;
    const key = i.grupoId || i.id;
    if (!map.has(key)) {
      map.set(key, {
        key, tipo: i.contaFixa ? "fixa" : "parcelas", nome: clientDisplayName(i), total,
        valorMensal: Number(i.valor) || 0, pagas: 0, ids: [], vencidasIds: [],
      });
    }
    const g = map.get(key);
    if (i.status === "Pago") g.pagas += 1;
    else if (i.vencimento && i.vencimento < hoje) g.vencidasIds.push(i.id);
    else g.ids.push(i.id);
  });
  return Array.from(map.values())
    .map((g) => ({ ...g, count: g.ids.length, vencidas: g.vencidasIds.length }))
    .filter((g) => g.count > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

// Apaga o que a pessoa escolheu cancelar; em conta fixa marca o que sobrou
// (`contaFixaCancelada`) pro sistema não repor meses sozinho.
const cancelSeries = async (items, series, key, incluirVencidas, { onDelete, onUpdate }) => {
  const g = series.find((x) => x.key === key);
  if (!g) return;
  const apagar = new Set([...g.ids, ...(incluirVencidas ? g.vencidasIds : [])]);
  for (const id of apagar) await onDelete(id);
  if (g.tipo === "fixa") {
    for (const item of items.filter((i) => (i.grupoId || i.id) === key && !apagar.has(i.id))) {
      await onUpdate({ ...item, contaFixaCancelada: true });
    }
  }
};

export { buildCancelableSeries, cancelSeries, generateInstallments, generateContratoMinimo, CONTA_FIXA_BUFFER_MESES, generateContaFixa, clientDisplayName };
