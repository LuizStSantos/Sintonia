import { useState } from "react";
import { X } from "lucide-react";

export function HorariosPicker({ value = [], onChange }) {
  const [pending, setPending] = useState("");
  const add = () => {
    if (!pending) return;
    if (!value.includes(pending)) {
      onChange([...value, pending].sort());
    }
    setPending("");
  };
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));
  return (
    <div onClick={(e) => e.preventDefault()}>
      <div className="date-add-row">
        <input type="time" value={pending} onChange={(e) => setPending(e.target.value)} />
        <button type="button" className="btn-ghost" onClick={add}>Adicionar</button>
      </div>
      {value.length > 0 && (
        <div className="date-chip-list">
          {value.map((h, idx) => (
            <span key={idx} className="date-chip">
              {h}
              <button type="button" onClick={() => remove(idx)} aria-label="Remover horário">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

