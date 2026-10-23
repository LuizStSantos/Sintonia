import { X } from "lucide-react";
import { CopyButton } from "./CopyButton.jsx";

export function ViewDialog({ open, title, fields, extraButtons, onClose }) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="view-panel" onClick={(e) => e.stopPropagation()}>
        <div className="view-panel-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="view-panel-body">
          {fields.map((f) => (
            <div key={f.label} className="view-field-row">
              <span className="view-field-label">{f.label}</span>
              <span className="view-field-value">{f.value || "—"}</span>
            </div>
          ))}
        </div>
        {extraButtons && extraButtons.length > 0 && (
          <div className="view-copy-actions">
            {extraButtons.map((b, idx) => (
              <CopyButton key={idx} label={b.label} getValue={b.getValue} />
            ))}
          </div>
        )}
        <div className="drawer-actions">
          <button className="btn-ghost view-close-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// Aviso simples (sem ação de excluir), com um link opcional
