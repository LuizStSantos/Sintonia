import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

// Cabeçalho de coluna clicável (ver lib/sort.js). Mostra a setinha da coluna
// ativa (↑ crescente, ↓ decrescente) e, nas outras, um indicador discreto que
// aparece ao passar o mouse. Também funciona pelo teclado (Enter/Espaço).
export function SortTh({ sort, k, children, className = "" }) {
  const ativa = sort.key === k;
  const Icone = !ativa ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`th-sortable ${ativa ? "ativa" : ""} ${className}`}
      aria-sort={ativa ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      tabIndex={0}
      role="columnheader"
      onClick={() => sort.toggle(k)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort.toggle(k); } }}
    >
      <span className="th-sort-inner">
        {children}
        <Icone size={13} className="th-sort-seta" />
      </span>
    </th>
  );
}
