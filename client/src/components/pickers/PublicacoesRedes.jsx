import { Check } from "lucide-react";
import { DateInput } from "../common/DateInput.jsx";
import { todayISO } from "../../lib/dates.js";
import { IconeRede } from "../common/IconeRede.jsx";
import { alternarPublicacao, mudarDataPublicacao, publicacaoDe } from "../../lib/publicacoes.js";
import { useRedes } from "../../features/configuracoes/useRedes.js";

// Botões rápidos: um clique marca "publicado hoje" naquela rede; clicar de novo desmarca.
// Cada rede marcada mostra a data, que pode ser corrigida.
export function PublicacoesRedes({ value = [], onChange }) {
  const redes = useRedes();
  // Rede marcada que depois foi removida da lista continua aparecendo, para não sumir sem aviso.
  const todas = [...redes, ...value.map((p) => p.rede).filter((r) => !redes.includes(r))];
  const marcadas = todas.filter((r) => publicacaoDe(value, r));
  return (
    <div onClick={(e) => e.preventDefault()}>
      <div className="redes-botoes">
        {todas.map((r) => {
          const on = !!publicacaoDe(value, r);
          return (
            <button key={r} type="button" className={`rede-btn${on ? " on" : ""}`} aria-pressed={on}
              onClick={() => onChange(alternarPublicacao(value, r, todayISO()))}>
              <IconeRede rede={r} size={15} /> {r}{on && <Check size={13} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      {marcadas.length > 0 && (
        <div className="redes-datas">
          {marcadas.map((r) => (
            <label key={r} className="redes-data">
              <span>{r} em</span>
              <DateInput value={publicacaoDe(value, r).data || ""} onChange={(e) => onChange(mudarDataPublicacao(value, r, e.target.value))} aria-label={`Data em ${r}`} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Na lista: só os ícones (o nome aparece ao passar o mouse). As datas ficam no formulário e no detalhe.
export function ChipsRedes({ value = [] }) {
  if (!value.length) return "—";
  return (
    <span className="redes-icones">
      {value.map((p) => <IconeRede key={p.rede} rede={p.rede} size={17} />)}
    </span>
  );
}
