// "Guarda de saída": uma tela com trabalho não salvo (ex.: o Espelho sendo
// montado) registra aqui uma função que diz se há alterações pendentes. Quem
// navega entre abas (App.jsx) pergunta antes de sair — assim ninguém perde o
// que digitou sem querer.
let verificador = null;

export function registrarGuardaDeSaida(fn) {
  verificador = fn;
  return () => { if (verificador === fn) verificador = null; };
}

export function haAlteracoesNaoSalvas() {
  try { return !!(verificador && verificador()); } catch { return false; }
}
