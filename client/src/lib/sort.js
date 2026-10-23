import { useMemo, useState } from "react";
import { todayISO } from "./dates.js";

// Ordenação por clique no cabeçalho das tabelas. Uso:
//   const { rows, sort } = useSortable(filtered, ACESSORES, { key: "vencimento", dir: "asc" });
//   <SortTh sort={sort} k="vencimento">Vencimento</SortTh>   ... rows.map(...)
// Clicar numa coluna ordena do menor pro maior (A→Z, mais antigo → mais novo,
// menor valor → maior); clicar de novo inverte. Vazios ("—") ficam sempre no
// fim, nos dois sentidos. Cada acessor é uma função (linha → valor) ou
// { get, cmp } quando a coluna precisa de uma regra própria (ex: vencimento).
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

const vazio = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

function comparaPadrao(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

// Vencimento: "mais perto primeiro". Quem ainda vai vencer (hoje em diante)
// vem antes de quem já passou; dentro de cada grupo, "asc" mostra o mais
// perto de hoje primeiro e "desc" o mais distante primeiro.
export function comparaVencimento(a, b, dir) {
  const hoje = todayISO();
  const futuroA = a >= hoje;
  const futuroB = b >= hoje;
  if (futuroA !== futuroB) return futuroA ? -1 : 1;
  if (a === b) return 0;
  const crescente = a < b ? -1 : 1;
  return futuroA ? (dir === "asc" ? crescente : -crescente) : (dir === "asc" ? -crescente : crescente);
}

export function useSortable(rows, acessores, inicial = null) {
  const [ordem, setOrdem] = useState(inicial);

  const alternar = (key) =>
    setOrdem((o) => (o && o.key === key ? { key, dir: o.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const ordenadas = useMemo(() => {
    const def = ordem && acessores[ordem.key];
    if (!def) return rows;
    const get = typeof def === "function" ? def : def.get;
    const cmp = typeof def === "function" ? null : def.cmp;
    const sinal = ordem.dir === "asc" ? 1 : -1;
    return rows
      .map((r, i) => ({ r, i, v: get(r) }))
      .sort((x, y) => {
        const vx = vazio(x.v), vy = vazio(y.v);
        if (vx || vy) return vx && vy ? x.i - y.i : vx ? 1 : -1;
        const c = cmp ? cmp(x.v, y.v, ordem.dir) : sinal * comparaPadrao(x.v, y.v);
        return c || x.i - y.i;
      })
      .map((x) => x.r);
  }, [rows, ordem, acessores]);

  return { rows: ordenadas, sort: { key: ordem?.key, dir: ordem?.dir, toggle: alternar } };
}
