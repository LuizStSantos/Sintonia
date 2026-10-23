// Crédito discreto do autor, no rodapé da barra lateral — pedido
// explícito do dono do sistema (não é dado de negócio, é só uma assinatura
// pessoal). Fica bem pequeno e apagado de propósito, abaixo do relógio.
// Pra trocar o nome/contato no futuro, é só editar aqui. A versão não aparece
// mais aqui: ficou embaixo do nome do sistema, no topo do menu (App.jsx).
const AUTOR = "Luiz Stormorwski dos Santos";
const CONTATO = "(64) 99291-5066 · luiz.st.santos@gmail.com";

export function AppCredit() {
  return (
    <div className="app-credit" title={`${AUTOR} — ${CONTATO}`}>
      <span>{AUTOR}</span>
      <span>{CONTATO}</span>
    </div>
  );
}
