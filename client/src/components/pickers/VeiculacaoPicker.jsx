import { useState } from "react";
import { X } from "lucide-react";
import { formatDateBR } from "../../lib/dates.js";
import { VEICULACAO_LOCAIS, normalizeVeiculacao } from "../../lib/veiculacao.js";
import { DateInput } from "../common/DateInput.jsx";
import { Select } from "../common/Select.jsx";

export function VeiculacaoPicker({ value = [], onChange, programasItems }) {
  const opcoesLocal = (programasItems && programasItems.length > 0)
    ? programasItems.map((p) => p.sigla || p.nome)
    : VEICULACAO_LOCAIS; // sem programas cadastrados ainda, usa a lista antiga como respaldo
  const [pendingData, setPendingData] = useState("");
  const [pendingLocal, setPendingLocal] = useState(opcoesLocal[0] || "");
  const add = () => {
    if (!pendingData) return;
    const exists = value.some((v) => {
      const n = normalizeVeiculacao(v);
      return n.data === pendingData && n.local === pendingLocal;
    });
    if (!exists) {
      const next = [...value, { data: pendingData, local: pendingLocal }].sort(
        (a, b) => normalizeVeiculacao(a).data.localeCompare(normalizeVeiculacao(b).data)
      );
      onChange(next);
    }
    setPendingData("");
  };
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));
  return (
    <div onClick={(e) => e.preventDefault()}>
      <div className="date-add-row">
        <DateInput value={pendingData} onChange={(e) => setPendingData(e.target.value)} />
        <Select value={pendingLocal} onChange={(e) => setPendingLocal(e.target.value)}>
          {opcoesLocal.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <button type="button" className="btn-ghost" onClick={add}>Adicionar</button>
      </div>
      {value.length > 0 && (
        <div className="date-chip-list">
          {value.map((raw, idx) => {
            const v = normalizeVeiculacao(raw);
            return (
              <span key={idx} className="date-chip">
                {v.data ? formatDateBR(v.data) : "—"}{v.local ? ` ${v.local}` : ""}
                <button type="button" onClick={() => remove(idx)} aria-label="Remover veiculação">
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Permite adicionar mais de um entrevistado (nome + função) no mesmo bloco/formulário
// Permite cadastrar mais de um horário pro mesmo programa (ex: reprise à noite)
