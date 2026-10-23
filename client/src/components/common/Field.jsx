export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

// Textarea que cresce sozinha conforme o texto digitado (sem precisar
// arrastar a alça de redimensionar manualmente) — usada no texto dos itens
// do roteiro do espelho, que pode ser curto (uma linha) ou longo (cotações,
// previsão do tempo etc.) e ficava escondido dentro de uma caixinha fixa.
