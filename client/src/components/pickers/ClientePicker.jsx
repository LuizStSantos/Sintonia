import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { clientDisplayName } from "../../lib/financeiro.js";

export function ClientePicker({ clientesCadastro, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [filledFrom, setFilledFrom] = useState("");

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return (clientesCadastro || [])
      .filter((c) => clientDisplayName(c).toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientesCadastro, query]);

  const handleSelect = (c) => {
    onSelect(c);
    setFilledFrom(clientDisplayName(c));
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="agencia-picker" onClick={(e) => e.preventDefault()}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setFilledFrom(""); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar cliente cadastrado... (ex: com)"
      />
      {open && query.trim() && (
        <div className="agencia-picker-list">
          {matches.length > 0 ? (
            matches.map((c) => (
              <button
                type="button"
                key={c.id}
                className="agencia-picker-item"
                onMouseDown={() => handleSelect(c)}
              >
                {clientDisplayName(c)}
              </button>
            ))
          ) : (
            <div className="agencia-picker-empty">Nenhum cliente cadastrado encontrado</div>
          )}
        </div>
      )}
      {filledFrom && (
        <p className="picker-confirm">
          <Check size={13} /> Dados preenchidos a partir de "{filledFrom}"
        </p>
      )}
    </div>
  );
}

