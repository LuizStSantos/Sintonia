import { useState } from "react";
import { X } from "lucide-react";

export function ExtrasEntrevistadoPicker({ value = [], onChange }) {
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");
  const add = () => {
    if (!nome.trim()) return;
    onChange([...value, { nomeCompleto: nome.trim(), funcao: funcao.trim() }]);
    setNome("");
    setFuncao("");
  };
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));
  return (
    <div onClick={(e) => e.preventDefault()}>
      <div className="date-add-row">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        <input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Função" />
        <button type="button" className="btn-ghost" onClick={add}>Adicionar</button>
      </div>
      {value.length > 0 && (
        <div className="date-chip-list">
          {value.map((p, idx) => (
            <span key={idx} className="date-chip">
              {p.nomeCompleto}{p.funcao ? ` — ${p.funcao}` : ""}
              <button type="button" onClick={() => remove(idx)} aria-label="Remover entrevistado">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Busca e vincula uma agência a partir dos registros de Contas a Pagar
// (em vez de digitar o nome à mão). Guarda o id do registro vinculado.
