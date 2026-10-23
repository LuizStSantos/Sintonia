import { db, getUserById, nomeExibicao } from "./db.js";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function allTodos() {
  const rows = db.prepare(`SELECT data FROM todos ORDER BY rowid DESC`).all();
  return rows.map((r) => JSON.parse(r.data));
}

// Usuário comum só vê as próprias tarefas, mais as que ele mesmo atribuiu
// a outras pessoas (senão a tarefa "sumiria" da vista de quem criou assim
// que fosse atribuída). Admin vê de todo mundo.
export function listTodos(currentUser) {
  const todos = allTodos();
  if (currentUser.role === "admin") return todos;
  return todos.filter((t) => t.userId === currentUser.id || t.assignedByUserId === currentUser.id);
}

// Por padrão a tarefa é de quem está criando. Admin, ou usuário com a
// permissão "atribuirTarefas" liberada, pode passar assignToUserId pra
// atribuir a tarefa a outra pessoa — quem não tem essa permissão e tentar
// isso é ignorado silenciosamente (a tarefa fica com ele mesmo). Quem tem
// a permissão mas não é admin não pode atribuir pra um admin (checado aqui
// também, não só escondido na lista do formulário — pra não dar pra
// contornar mandando o id direto pela API).
export function createTodo(currentUser, payload) {
  let ownerId = currentUser.id;
  let ownerName = nomeExibicao(currentUser);
  const isAdmin = currentUser.role === "admin";
  const podeAtribuir = isAdmin || currentUser.permissions?.atribuirTarefas === true;
  if (podeAtribuir && payload?.assignToUserId && payload.assignToUserId !== currentUser.id) {
    const target = getUserById(payload.assignToUserId);
    if (target && (isAdmin || target.role !== "admin")) {
      ownerId = target.id;
      ownerName = nomeExibicao(target);
    }
  }
  const item = {
    id: uid(),
    texto: (payload?.texto || "").trim(),
    descricao: (payload?.descricao || "").trim(),
    concluida: false,
    prioridade: payload?.prioridade || "normal",
    prazo: payload?.prazo || "",
    userId: ownerId,
    userName: ownerName,
    atribuidaPor: ownerId !== currentUser.id ? nomeExibicao(currentUser) : null,
    assignedByUserId: ownerId !== currentUser.id ? currentUser.id : null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO todos (id, data) VALUES (?, ?)`).run(item.id, JSON.stringify(item));
  return item;
}

// Retorna o item atualizado, null se não existir, ou "forbidden" se a
// pessoa não puder mexer nessa tarefa — só pode quem é admin, é dono da
// tarefa, ou foi quem atribuiu ela a outra pessoa.
function podeMexer(currentUser, existing) {
  return currentUser.role === "admin" || existing.userId === currentUser.id || existing.assignedByUserId === currentUser.id;
}

export function updateTodo(currentUser, id, payload) {
  const row = db.prepare(`SELECT data FROM todos WHERE id = ?`).get(id);
  if (!row) return null;
  const existing = JSON.parse(row.data);
  if (!podeMexer(currentUser, existing)) return "forbidden";
  const updated = {
    ...existing,
    texto: payload?.texto !== undefined ? payload.texto : existing.texto,
    descricao: payload?.descricao !== undefined ? payload.descricao : existing.descricao,
    concluida: payload?.concluida !== undefined ? !!payload.concluida : existing.concluida,
    prioridade: payload?.prioridade !== undefined ? payload.prioridade : existing.prioridade,
    prazo: payload?.prazo !== undefined ? payload.prazo : existing.prazo,
    id: existing.id,
    userId: existing.userId,
    userName: existing.userName,
  };
  db.prepare(`UPDATE todos SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(updated), id);
  return updated;
}

export function deleteTodo(currentUser, id) {
  const row = db.prepare(`SELECT data FROM todos WHERE id = ?`).get(id);
  if (!row) return false;
  const existing = JSON.parse(row.data);
  if (!podeMexer(currentUser, existing)) return "forbidden";
  db.prepare(`DELETE FROM todos WHERE id = ?`).run(id);
  return true;
}
