import { useMemo, useState } from "react";
import { X } from "lucide-react";

export function ColaboradorPicker({ colaboradores, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = (colaboradores || []).find((c) => c.id === value);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return (colaboradores || [])
      .filter((c) => (c.nomeCompleto || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [colaboradores, query]);

  if (selected) {
    return (
      <div className="agencia-picker-selected" onClick={(e) => e.preventDefault()}>
        <span>{selected.nomeCompleto}{selected.funcao ? ` — ${selected.funcao}` : ""}</span>
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
        placeholder="Buscar colaborador... (ex: nome)"
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
                {c.nomeCompleto}{c.funcao ? ` — ${c.funcao}` : ""}
              </button>
            ))
          ) : (
            <div className="agencia-picker-empty">Nenhum colaborador encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}



export function resolveColaboradorNome(item, colaboradoresList) {
  if (!item?.colaboradorId) return null;
  const found = (colaboradoresList || []).find((c) => c.id === item.colaboradorId);
  if (found) return found.nomeCompleto;
  return "Colaborador vinculado (removido de Colaboradores)";
}

// Busca um cliente cadastrado (aba Clientes) e preenche automaticamente os
// dados da empresa no formulário — não guarda vínculo, é só um atalho de
// preenchimento; o lançamento continua sendo um registro independente.
