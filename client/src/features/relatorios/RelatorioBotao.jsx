import { useState } from "react";
import { FileBarChart } from "lucide-react";
import { RelatorioDialog } from "./RelatorioDialog.jsx";

// Botão "Relatório" das páginas Contas a receber, Contas a pagar e OPEC:
// abre o pop-up com os filtros e o botão de baixar o PDF.
export function RelatorioBotao({ tipo, items }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn-relatorio" onClick={() => setAberto(true)}>
        <FileBarChart size={15} /> Relatório
      </button>
      {aberto && <RelatorioDialog tipo={tipo} items={items} onClose={() => setAberto(false)} />}
    </>
  );
}
