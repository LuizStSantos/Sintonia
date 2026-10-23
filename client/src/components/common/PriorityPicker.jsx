import { PRIORIDADE_LABEL, PRIORIDADES } from "../../lib/todoPriority.js";

export function PriorityPicker({ value, onChange }) {
  return (
    <div className="priority-picker">
      {PRIORIDADES.map((p) => (
        <button
          key={p}
          type="button"
          className={`priority-chip priority-chip-${p}${value === p ? " active" : ""}`}
          onClick={() => onChange(p)}
        >
          <span className="priority-chip-dot" />
          {PRIORIDADE_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

