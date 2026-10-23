import { useEspelhoVistos } from "./useEspelhoVistos.js";

// Contador ao lado de "Espelho" no menu: espelhos novos (que outra pessoa criou e eu ainda
// não abri) + espelhos que outra pessoa alterou depois da última vez que abri.
export function EspelhoNavBadge({ items, userId }) {
  const { novos, atualizados } = useEspelhoVistos(items, userId);
  const total = new Set([...novos, ...atualizados]).size;
  if (total === 0) return null;
  return <span className="nav-badge" title="Espelhos novos ou alterados desde a última vez que você abriu">{total > 99 ? "99+" : total}</span>;
}
