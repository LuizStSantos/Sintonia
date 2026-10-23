const caixaAlta = (str) => String(str || "").toLocaleUpperCase("pt-BR");

// Converte "5:55" em 5'55" (formato usado na régua/decupagem de VT)
const primeirosDoisNomes = (nomeCompleto) => {
  if (!nomeCompleto || !nomeCompleto.trim()) return "";
  return nomeCompleto.trim().split(/\s+/).slice(0, 2).join(" ");
};

export { caixaAlta, primeirosDoisNomes };
