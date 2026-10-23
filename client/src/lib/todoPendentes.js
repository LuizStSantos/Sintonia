import { useEffect, useState } from "react";

// Guarda quantas tarefas não concluídas a pessoa tem, para o menu lateral
// mostrar o número sem precisar abrir o TO-DO. Quem muda a lista (App ao
// entrar, TodoTab ao marcar/excluir/criar) apenas chama `atualizarPendentes`.
let lista = [];
let userId = null;
const ouvintes = new Set();

function contar() {
  return lista.filter((t) => !t.concluida && t.userId === userId).length;
}

export function atualizarPendentes(todos, uid) {
  lista = Array.isArray(todos) ? todos : [];
  userId = uid;
  ouvintes.forEach((fn) => fn(contar()));
}

export function adicionarPendente(todo, uid) {
  if (lista.some((t) => t.id === todo.id)) return;
  atualizarPendentes([todo, ...lista], uid);
}

export function usePendentes() {
  const [n, setN] = useState(contar());
  useEffect(() => {
    ouvintes.add(setN);
    setN(contar());
    return () => ouvintes.delete(setN);
  }, []);
  return n;
}

// Tarefas que outra pessoa atribuiu e que esta pessoa ainda não foi avisada
// (por exemplo, atribuídas enquanto ela estava desconectada).
export function tarefasNaoAvisadas(todos, uid) {
  const chave = `sintonia_todos_avisados_${uid}`;
  let vistos = null;
  try { vistos = JSON.parse(localStorage.getItem(chave)); } catch { /* sem storage */ }
  const minhas = todos.filter((t) => t.userId === uid && t.assignedByUserId && t.assignedByUserId !== uid && !t.concluida);
  const ids = todos.map((t) => t.id);
  const novas = vistos ? minhas.filter((t) => !vistos.includes(t.id)) : [];
  try { localStorage.setItem(chave, JSON.stringify(ids)); } catch { /* sem storage */ }
  return novas;
}

export function marcarAvisada(id, uid) {
  const chave = `sintonia_todos_avisados_${uid}`;
  try {
    const v = JSON.parse(localStorage.getItem(chave)) || [];
    if (!v.includes(id)) localStorage.setItem(chave, JSON.stringify([...v, id]));
  } catch { /* sem storage */ }
}
