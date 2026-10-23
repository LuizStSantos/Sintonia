import { useEffect } from "react";

// Em telas pequenas (≤640px) as tabelas viram "cartões" — uma linha da tabela
// = um cartão, com "Coluna: valor" empilhado (ver bloco "Tabelas como
// cartões" no fim do index.css). Pra isso o CSS precisa saber o nome da coluna
// de cada célula; em vez de mexer em todas as tabelas, este componente
// (montado uma vez em main.jsx) copia o texto de cada <th> pro atributo
// `data-label` da <td> da mesma coluna, sempre que a tela muda.
function rotular(tabela) {
  const ths = tabela.querySelectorAll("thead tr:last-child th");
  if (!ths.length) return;
  const nomes = Array.from(ths).map((th) => (th.textContent || "").trim());
  tabela.querySelectorAll("tbody tr").forEach((tr) => {
    let col = 0;
    Array.from(tr.children).forEach((td) => {
      if (td.tagName !== "TD") return;
      const span = td.colSpan || 1;
      const nome = span > 1 ? "" : nomes[col] || "";
      if (td.getAttribute("data-label") !== nome) td.setAttribute("data-label", nome);
      col += span;
    });
  });
}

export function MobileTables() {
  useEffect(() => {
    let agendado = false;
    const rodar = () => {
      agendado = false;
      document.querySelectorAll(".table-wrap table").forEach(rotular);
    };
    const agendar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(rodar);
    };
    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { childList: true, subtree: true });
    rodar();
    return () => obs.disconnect();
  }, []);
  return null;
}
