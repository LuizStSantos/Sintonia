// Regras do painel de Início — funções puras (sem React), pra serem fáceis de testar.
import { noArNoDia } from "./opec.js";
import { addDaysISO, formatDateBR } from "./dates.js";
import { clientDisplayName } from "./financeiro.js";
import { formatBRL } from "./validators.js";
import { diasParaExpirar } from "./espelho.js";
import { PRIORIDADE_ORDEM, PRIORIDADE_LABEL } from "./todoPriority.js";

const DIA_MS = 24 * 60 * 60 * 1000;
export const DIAS_OPEC_VENCENDO = 3;   // VT da OPEC que vence em até 3 dias
export const DIAS_CONTAS_A_VENCER = 7; // conta pendente que vence em até 7 dias

const diasEntre = (deISO, ateISO) => Math.round((new Date(ateISO + "T00:00:00") - new Date(deISO + "T00:00:00")) / DIA_MS);

export function textoPrazoRelativo(dias) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `${dias} dias`;
}

// Matérias que ainda estão sendo feitas (Redação ou Edição).
export function materiasEmAndamento(materias) {
  return (materias || [])
    .filter((m) => m.status === "Redação" || m.status === "Edição")
    .sort((a, b) => (b.entrada || "").localeCompare(a.entrada || ""));
}

// VTs que vão ao ar hoje + total de inserções (cada VT conta `quantidade` vezes).
export function insercoesNoArHoje(opec, hoje) {
  const vts = (opec || [])
    .filter((i) => noArNoDia(i, hoje))
    .sort((a, b) => (a.programa || "").localeCompare(b.programa || "") || (a.nomeVT || "").localeCompare(b.nomeVT || ""));
  return { vts, insercoes: vts.reduce((s, i) => s + (Number(i.quantidade) || 1), 0) };
}

// "Vencem em breve": VTs da OPEC que acabam em até 3 dias + contas pendentes que
// vencem em até 7 dias + contas já atrasadas. Primeiro o que AINDA vai vencer (por
// data); as atrasadas vêm depois (a quantidade delas já aparece no cartão "Contas em
// atraso", e senão elas encheriam a lista e esconderiam o que vence amanhã).
// Só entra o que a pessoa pode ver (as listas das abas sem acesso vêm vazias/undefined).
export function vencemEmBreve({ opec, contasReceber, contasPagar }, hoje) {
  const itens = [];
  for (const i of opec || []) {
    if (i.naoVence || !i.vencimento || i.vencimento < hoje) continue;
    const dias = diasEntre(hoje, i.vencimento);
    if (dias > DIAS_OPEC_VENCENDO) continue;
    itens.push({ id: `o-${i.id}`, aba: "opec", titulo: i.nomeVT || i.cliente || "VT", sub: `OPEC · vence ${formatDateBR(i.vencimento)}`, data: i.vencimento, atrasada: false, dias, tom: dias <= 1 ? "amber" : "gray", rotulo: textoPrazoRelativo(dias) });
  }
  const contas = (lista, aba, origem) => {
    for (const i of lista || []) {
      if (!i.vencimento) continue;
      const valor = Number(i.valor) || 0;
      if (i.status === "Atrasado") {
        itens.push({ id: `${aba}-${i.id}`, aba, titulo: clientDisplayName(i), sub: `${origem} · ${formatBRL(valor)} · venceu ${formatDateBR(i.vencimento)}`, data: i.vencimento, atrasada: true, tom: "red", rotulo: "atrasada" });
      } else if (i.status === "Pendente" && i.vencimento >= hoje) {
        const dias = diasEntre(hoje, i.vencimento);
        if (dias > DIAS_CONTAS_A_VENCER) continue;
        itens.push({ id: `${aba}-${i.id}`, aba, titulo: clientDisplayName(i), sub: `${origem} · ${formatBRL(valor)} · vence ${formatDateBR(i.vencimento)}`, data: i.vencimento, atrasada: false, dias, tom: dias <= 2 ? "amber" : "gray", rotulo: textoPrazoRelativo(dias) });
      }
    }
  };
  contas(contasReceber, "contasReceber", "A receber");
  contas(contasPagar, "contasPagar", "A pagar");
  return itens.sort((a, b) => (a.atrasada === b.atrasada ? a.data.localeCompare(b.data) : a.atrasada ? -1 : 1));
}

export function contasEmAtraso({ contasReceber, contasPagar }) {
  const n = (l) => (l || []).filter((i) => i.status === "Atrasado").length;
  return n(contasReceber) + n(contasPagar);
}

// Minhas tarefas não concluídas: atrasadas primeiro, depois por prazo (sem prazo no fim) e prioridade.
export function minhasTarefas(todos, userId, hoje) {
  return (todos || [])
    .filter((t) => !t.concluida && t.userId === userId)
    .map((t) => {
      const atrasada = !!t.prazo && t.prazo < hoje;
      let sub = "sem prazo";
      if (t.prazo) sub = atrasada ? `atrasada desde ${formatDateBR(t.prazo)}` : t.prazo === hoje ? "prazo hoje" : `prazo ${formatDateBR(t.prazo)}`;
      const prio = t.prioridade || "normal";
      return { id: t.id, titulo: t.texto, sub, atrasada, prazo: t.prazo || "", prio, tom: prio === "alta" ? "red" : prio === "baixa" ? "gray" : "blue", rotulo: PRIORIDADE_LABEL[prio] || "Normal" };
    })
    .sort((a, b) => (b.atrasada - a.atrasada) || ((a.prazo || "9999").localeCompare(b.prazo || "9999")) || ((PRIORIDADE_ORDEM[a.prio] ?? 1) - (PRIORIDADE_ORDEM[b.prio] ?? 1)));
}

// Espelhos que vão sumir primeiro.
export function espelhosExpirando(espelhos, retencaoDias, agora = Date.now()) {
  return (espelhos || [])
    .map((e) => {
      const dias = diasParaExpirar(e, retencaoDias);
      if (dias === null) return null;
      const criado = Date.parse(e.criadoEm);
      const hCriado = Math.floor((agora - criado) / DIA_MS);
      return { id: e.id, titulo: e.titulo || "Espelho", dias, sub: [e.data ? `Veiculação ${formatDateBR(e.data)}` : "", hCriado <= 0 ? "criado hoje" : `criado há ${hCriado} ${hCriado === 1 ? "dia" : "dias"}`].filter(Boolean).join(" · "), tom: dias <= 1 ? "red" : dias <= 3 ? "amber" : "gray", rotulo: dias <= 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}` };
    })
    .filter(Boolean)
    .sort((a, b) => a.dias - b.dias);
}

export function saudacao(hora) {
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

export { addDaysISO };
