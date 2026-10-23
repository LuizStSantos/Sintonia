import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { formatBRL } from "../../lib/validators.js";
import { formatDateBR, todayISO } from "../../lib/dates.js";

export function CancelPickerDialog({ open, series, onClose, onConfirm }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [incluirVencidas, setIncluirVencidas] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      setConfirmed(false);
      setIncluirVencidas(false);
    }
  }, [open]);

  if (!open) return null;

  const matches = series.filter((s) => s.nome.toLowerCase().includes(query.trim().toLowerCase()));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const ehFixa = selected?.tipo === "fixa";
  const qtdCancelar = selected ? selected.count + (incluirVencidas ? selected.vencidas : 0) : 0;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-panel cancel-panel" onClick={(e) => e.stopPropagation()}>
        {!selected ? (
          <>
            <h3>Cancelar contas</h3>
            <p>Escolha a conta que você quer cancelar daqui pra frente: uma conta fixa ou um parcelamento/contrato em andamento. O que já foi pago nunca é apagado.</p>
            <div className="search-wrap cancel-search-wrap">
              <Search size={15} className="search-icon" />
              <input
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome..."
                autoFocus
              />
            </div>
            <div className="cancel-picker-list">
              {matches.length === 0 && (
                <div className="cancel-picker-empty">Nenhuma conta com lançamentos futuros a cancelar.</div>
              )}
              {matches.map((s) => (
                <button key={s.key} type="button" className="cancel-picker-item" onClick={() => setSelected(s)}>
                  <span className="cancel-picker-info">
                    <span className="cancel-picker-nome">{s.nome}</span>
                    <span className="cancel-picker-sub">
                      {s.tipo === "fixa"
                        ? `Conta fixa · ${plural(s.count, "mês futuro", "meses futuros")}`
                        : `Parcelas · ${s.pagas} paga${s.pagas === 1 ? "" : "s"} de ${s.total} · faltam ${s.count}`}
                    </span>
                  </span>
                  <span className="cancel-picker-meta">{formatBRL(s.valorMensal)}{s.tipo === "fixa" ? "/mês" : ""}</span>
                </button>
              ))}
            </div>
            <div className="drawer-actions">
              <button className="btn-ghost" onClick={onClose}>Fechar</button>
            </div>
          </>
        ) : (
          <>
            <h3>{ehFixa ? "Cancelar conta fixa" : "Cancelar parcelas restantes"}</h3>
            <p>
              Isso vai <strong>cancelar "{selected.nome}"</strong>, excluindo {plural(selected.count, "lançamento futuro", "lançamentos futuros")} a partir de hoje ({formatDateBR(todayISO())}) em diante.
              {!ehFixa && <> As {plural(selected.pagas, "parcela já paga", "parcelas já pagas")} continuam no histórico.</>}
            </p>
            {selected.vencidas > 0 && (
              <label className="checkbox-field">
                <input type="checkbox" className="app-checkbox" checked={incluirVencidas} onChange={(e) => setIncluirVencidas(e.target.checked)} />
                <span>Excluir também {plural(selected.vencidas, "parcela vencida e não paga", "parcelas vencidas e não pagas")}.</span>
              </label>
            )}
            <p>Lançamentos já pagos não são afetados. Essa ação não pode ser desfeita.</p>
            <label className="checkbox-field">
              <input type="checkbox" className="app-checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>Sim, tenho certeza que quero cancelar ({plural(qtdCancelar, "lançamento", "lançamentos")}).</span>
            </label>
            <div className="drawer-actions">
              <button className="btn-ghost" onClick={() => setSelected(null)}>Voltar</button>
              <button className="btn-primary" disabled={!confirmed} onClick={() => onConfirm(selected.key, incluirVencidas)}>Confirmar cancelamento</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Popup central com os detalhes de um item, somente leitura (não edita nada)
