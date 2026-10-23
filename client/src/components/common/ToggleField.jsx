export function ToggleField({ checked, onChange, title, desc, disabled }) {
  return (
    <label className={`toggle-setting${disabled ? " toggle-setting-disabled" : ""}`}>
      <input type="checkbox" className="toggle-switch-input" checked={!!checked} onChange={onChange} disabled={disabled} />
      <span className="toggle-switch-track"><span className="toggle-switch-thumb" /></span>
      <span className="toggle-setting-text">
        <span className="toggle-setting-title">{title}</span>
        {desc && <span className="toggle-setting-desc">{desc}</span>}
      </span>
    </label>
  );
}

// Separa visualmente um formulário longo em blocos (ex: "Dados da empresa",
// "Contato", "Financeiro"), deixando mais fácil de escanear
