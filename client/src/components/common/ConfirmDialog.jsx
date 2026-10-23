export function ConfirmDialog({
  open, itemLabel, onCancel, onConfirm, children,
  title = "Excluir item",
  message,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  extraAction, // opcional: { label, onClick } — um terceiro botão, entre o de cancelar e o de confirmar
}) {
  if (!open) return null;
  // `message` normalmente é um texto simples (ou nada, usando o padrão de
  // exclusão) — nesse caso envolve num único <p> com o estilo certo. Mas
  // quando quem chama precisa de mais estrutura (uma lista, mais de um
  // parágrafo), pode passar um bloco JSX já pronto em `message`, que entra
  // direto sem embrulhar — `<p>` dentro de `<p>` é HTML inválido.
  const mensagemSimples = !message || typeof message === "string";
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-panel" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {mensagemSimples
          ? <p>{message || <>Tem certeza de que deseja apagar <strong>"{itemLabel}"</strong>? Essa ação não pode ser desfeita.</>}</p>
          : message}
        {children}
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          {extraAction && <button className="btn-ghost" onClick={extraAction.onClick}>{extraAction.label}</button>}
          <button className="btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Popup de cancelamento em duas etapas: primeiro escolhe QUAL conta fixa
// cancelar (ex: "Fulano de Tal Fixo"), depois confirma — sempre cancela os
// lançamentos daquela conta que vencem a partir de hoje em diante, mantendo
// intactos os que já venceram ou já foram pagos. Só afeta contas fixas —
// parcelamento e contrato mínimo têm prazo definido e não aparecem aqui.
