import { useEffect, useMemo, useSyncExternalStore } from "react";
import { apiGetEspelhoVistos, apiMarcarEspelhoVisto, apiMarcarTodosEspelhosVistos } from "../../api/espelhoVistos.js";

// "Já vi esse espelho?" — estado compartilhado entre o menu (contador) e a aba Espelho.
// Um espelho é "novo" para mim se foi criado depois da minha primeira visita ao recurso
// (`desde`), por outra pessoa, e eu ainda não o abri.
let estado = { userId: null, pronto: false, desde: null, ids: new Set(), vistoEm: {} };
const ouvintes = new Set();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };

function aplicar(userId, r) {
  estado = { userId, pronto: true, desde: r.desde, ids: new Set(r.ids), vistoEm: r.vistoEm || {} };
  emitir();
}
async function carregar(userId) {
  try { aplicar(userId, await apiGetEspelhoVistos()); } catch { /* sem permissão ou sem rede: sem marcas */ }
}

export const ehNovo = (e, s) => s.pronto && !!e.criadoEm && Date.parse(e.criadoEm) > Date.parse(s.desde) && !s.ids.has(e.id);

// "Atualizado": outra pessoa alterou o espelho depois da última vez que eu o abri
// (ou, se nunca abri, depois da minha primeira visita ao recurso).
export const ehAtualizado = (e, s, userId) => {
  if (!s.pronto || !e.alteradoEm || e.alteradoPorId === userId) return false;
  const ref = Date.parse(s.vistoEm[e.id] || s.desde);
  return Date.parse(e.alteradoEm) > ref;
};

export function useEspelhoVistos(items, userId) {
  const s = useSyncExternalStore(assinar, () => estado);
  useEffect(() => {
    if (!userId) return;
    if (estado.userId !== userId) { estado = { userId, pronto: false, desde: null, ids: new Set(), vistoEm: {} }; emitir(); }
    if (!estado.pronto) carregar(userId);
  }, [userId]);
  const novos = useMemo(() => new Set((items || []).filter((e) => ehNovo(e, s)).map((e) => e.id)), [items, s]);
  const atualizados = useMemo(() => new Set((items || []).filter((e) => ehAtualizado(e, s, userId)).map((e) => e.id)), [items, s, userId]);
  const marcar = (id) => {
    const eraAtualizado = atualizados.has(id);
    if (estado.ids.has(id) && !eraAtualizado) return;
    estado = { ...estado, ids: new Set([...estado.ids, id]), vistoEm: { ...estado.vistoEm, [id]: new Date().toISOString() } };
    emitir();
    // Ao abrir um espelho atualizado, recarrega do servidor pra acertar o relógio da marca.
    apiMarcarEspelhoVisto(id).then(() => (eraAtualizado ? carregar(userId) : null)).catch(() => {});
  };
  const marcarTodos = async () => {
    estado = { ...estado, ids: new Set([...estado.ids, ...(items || []).map((e) => e.id)]) };
    emitir();
    try { aplicar(userId, await apiMarcarTodosEspelhosVistos()); } catch { /* mantém o local */ }
  };
  return { novos, atualizados, marcar, marcarTodos };
}
