const TONE = {
  green: { bg: "#173125", text: "#5FD394", border: "#25502F" },
  amber: { bg: "#33260F", text: "#E8A93A", border: "#5A4419" },
  red: { bg: "#341715", text: "#F2685F", border: "#5C2320" },
  blue: { bg: "#132A3E", text: "#5FA8E8", border: "#1E4463" },
  gray: { bg: "#22262E", text: "#9096A1", border: "#2E333D" },
};

// Sinalizadores da aba Matérias — uma matéria pode ter mais de um ao mesmo tempo
const FLAG_META = [
  { key: "urgente", label: "Urgente", tone: "red" },
  { key: "gaveta", label: "Gaveta", tone: "green" },
  { key: "prioridade", label: "Prioridade", tone: "amber" },
];

const VIDEO_STATUS = {
  "Redação": "amber",
  "Edição": "blue",
  "Pronto": "green",
};
const CLIENTE_STATUS = {
  "Pendente": "amber",
  "Pago": "green",
  "Atrasado": "red",
};

const MODALIDADE_TONE = {
  "Presencial": "green",
  "Online": "blue",
  "Gravado": "amber",
};

const DIAS_SEMANA_BACKUP = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];


// Valor especial do filtro de status: mostra Atrasado e Pendente juntos (tudo que ainda não foi pago).
const STATUS_EM_ABERTO = "__em_aberto";

export { STATUS_EM_ABERTO, TONE, FLAG_META, VIDEO_STATUS, CLIENTE_STATUS, MODALIDADE_TONE, DIAS_SEMANA_BACKUP };
