import { formatDuracaoDigitada, normalizarDuracao, formatInteiro, moedaParaValor, valorParaMoeda } from "../../lib/masks.js";

// Campos que só aceitam números (qualquer outra tecla é descartada, inclusive
// ao colar). Usam <input type="text" inputMode="numeric"> em vez de
// type="number" porque este último deixa digitar letras no Firefox e aceita
// "e", "+", "-" e "." em todos os navegadores.

// Duração "m:ss" (ex: 0:30, 1:30, 10:30) — usada em Matérias e no Espelho.
export function DurationInput({ value, onChange, onBlur, placeholder = "0:30", ...rest }) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(formatDuracaoDigitada(e.target.value))}
      onBlur={(e) => {
        const n = normalizarDuracao(e.target.value);
        if (n !== e.target.value) onChange(n);
        onBlur?.(e);
      }}
    />
  );
}

// Número inteiro (duração do OPEC em segundos, quantidade de inserções).
export function IntegerInput({ value, onChange, max = 6, ...rest }) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(formatInteiro(e.target.value, max))}
    />
  );
}

// Valor em reais com vírgula e milhar automáticos. `value`/`onChange` usam
// string decimal ("1234.56"), como o type="number" antigo.
export function MoneyInput({ value, onChange, placeholder = "0,00", ...rest }) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      value={valorParaMoeda(value)}
      placeholder={placeholder}
      onChange={(e) => onChange(moedaParaValor(e.target.value))}
    />
  );
}
