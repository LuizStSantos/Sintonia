import { useEffect, useRef } from "react";

export function AutoGrowTextarea({ value, onChange, className, disabled, minRows = 2, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight não inclui a borda, mas a altura (box-sizing:border-box)
    // inclui — sem somar a borda sobrava ~2px de conteúdo escondido, e a
    // caixa ficava com rolagem mesmo "crescendo sozinha".
    const borda = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borda}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      rows={minRows}
      disabled={disabled}
      spellCheck
      lang="pt-BR"
      {...rest}
    />
  );
}

// Interruptor deslizante padrão — usado no lugar de checkbox comum em toda
// configuração do tipo sim/não dentro de um formulário (ex: "Não vence",
// "Tem agência?", "Parcelamento"), pra manter a mesma aparência em todo o
// sistema.
