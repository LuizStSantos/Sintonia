import { db } from "./db.js";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

db.exec(`
  CREATE TABLE IF NOT EXISTS espelho_modelos (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export function listEspelhoModelos() {
  const rows = db.prepare(`SELECT data FROM espelho_modelos ORDER BY rowid ASC`).all();
  return rows.map((r) => JSON.parse(r.data));
}

export function createEspelhoModelo(payload) {
  const item = {
    id: uid(),
    nome: (payload?.nome || "").trim(),
    texto: (payload?.texto || "").trim(),
  };
  db.prepare(`INSERT INTO espelho_modelos (id, data) VALUES (?, ?)`).run(item.id, JSON.stringify(item));
  return item;
}

export function updateEspelhoModelo(id, payload) {
  const row = db.prepare(`SELECT data FROM espelho_modelos WHERE id = ?`).get(id);
  if (!row) return null;
  const existing = JSON.parse(row.data);
  const updated = {
    ...existing,
    nome: payload?.nome !== undefined ? payload.nome.trim() : existing.nome,
    texto: payload?.texto !== undefined ? payload.texto.trim() : existing.texto,
  };
  db.prepare(`UPDATE espelho_modelos SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(updated), id);
  return updated;
}

export function deleteEspelhoModelo(id) {
  const result = db.prepare(`DELETE FROM espelho_modelos WHERE id = ?`).run(id);
  return result.changes > 0;
}
