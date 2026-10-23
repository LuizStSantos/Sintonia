import { usePendentes } from "../../lib/todoPendentes.js";

export function TodoNavBadge() {
  const n = usePendentes();
  if (!n) return null;
  return <span className="nav-badge" title="Tarefas não concluídas">{n > 99 ? "99+" : n}</span>;
}
