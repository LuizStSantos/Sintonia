import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { clientDisplayName } from "../../lib/financeiro.js";

export function AgenciaPicker({ clientes, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = (clientes || []).find((c) => c.id === value);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return (clientes || [])
      .filter((c) => clientDisplayName(c).toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientes, query]);

  if (selected) {
    return (
      <div className="agencia-picker-selected" onClick={(e) => e.preventDefault()}>
        <span>{clientDisplayName(selected)}</span>
        <button type="button" className="icon-btn" onClick={() => onChange(null)} aria-label="Remover vínculo">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="agencia-picker" onClick={(e) => e.preventDefault()}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Digite pra buscar em Contas a pagar... (ex: gus)"
      />
      {open && query.trim() && (
        <div className="agencia-picker-list">
          {matches.length > 0 ? (
            matches.map((c) => (
              <button
                type="button"
                key={c.id}
                className="agencia-picker-item"
                onMouseDown={() => { onChange(c.id); setQuery(""); setOpen(false); }}
              >
                {clientDisplayName(c)}
              </button>
            ))
          ) : (
            <div className="agencia-picker-empty">Nenhum resultado em Contas a pagar</div>
          )}
        </div>
      )}
    </div>
  );
}

// Resolve o nome de exibição da agência: prioriza o vínculo com Contas a
// Pagar (sempre atualizado); cai pro texto livre antigo se não houver vínculo.


export function resolveAgenciaNome(item, clientesList) {
  if (item?.agenciaClienteId) {
    const found = (clientesList || []).find((c) => c.id === item.agenciaClienteId);
    if (found) return clientDisplayName(found);
    return "Agência vinculada (removida de Contas a pagar)";
  }
  return item?.nomeAgencia || "—";
}

// Vincula o lançamento a um colaborador (aba Colaboradores) — útil pra
// salários e outros pagamentos recorrentes a uma pessoa. Guarda o id, então
// se o colaborador for renomeado depois, o nome exibido acompanha.
