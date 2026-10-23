const uid = () =>
  (crypto?.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatBRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---- Validação e máscara de CPF, CNPJ, telefone e email ----
const formatCPF = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const isValidCPF = (value) => {
  const d = (value || "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(d[10])) return false;
  return true;
};

const formatCNPJ = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const isValidCNPJ = (value) => {
  const d = (value || "").replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  if (calc(d.slice(0, 12)) !== parseInt(d[12])) return false;
  if (calc(d.slice(0, 13)) !== parseInt(d[13])) return false;
  return true;
};

const formatPhone = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const isValidPhone = (value) => {
  const d = (value || "").replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());

const VALIDATOR_CONFIG = {
  cpf: { format: formatCPF, validate: isValidCPF, message: "CPF inválido" },
  cnpj: { format: formatCNPJ, validate: isValidCNPJ, message: "CNPJ inválido" },
  phone: { format: formatPhone, validate: isValidPhone, message: "Telefone inválido (informe DDD + número)" },
  email: { format: null, validate: isValidEmail, message: "Email inválido" },
};

// Input com máscara automática (CPF/CNPJ/telefone) e aviso de erro quando o
// valor perde o foco e está preenchido, mas inválido.

export { uid, formatBRL, formatCPF, isValidCPF, formatCNPJ, isValidCNPJ, formatPhone, isValidPhone, isValidEmail, VALIDATOR_CONFIG };
