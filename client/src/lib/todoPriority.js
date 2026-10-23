import { todayISO } from "./dates.js";

const PRIORIDADE_LABEL = { baixa: "Baixa", normal: "Normal", alta: "Alta" };
const PRIORIDADE_ORDEM = { alta: 0, normal: 1, baixa: 2 };
const PRIORIDADES = ["baixa", "normal", "alta"];
const isPrazoAtrasado = (t) => !t.concluida && t.prazo && t.prazo < todayISO();

// Seletor de prioridade em chips coloridos, em vez de um <select> comum

export { PRIORIDADE_LABEL, PRIORIDADE_ORDEM, PRIORIDADES, isPrazoAtrasado };
