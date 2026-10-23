// "Já vi esse espelho?" — registra, por usuário, quais espelhos já foram abertos.
// Só conta como "novo" o espelho criado DEPOIS da primeira vez que a pessoa usou o
// recurso (senão todos os espelhos antigos apareceriam como novos de uma vez) e que
// foi criado por outra pessoa (quem cria já o considera visto).
import { db } from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS espelho_vistos (
    user_id TEXT NOT NULL,
    espelho_id TEXT NOT NULL,
    visto_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, espelho_id)
  );
  CREATE TABLE IF NOT EXISTS espelho_vistos_base (
    user_id TEXT PRIMARY KEY,
    desde TEXT NOT NULL
  );
`);

export function getVistos(userId) {
  let base = db.prepare(`SELECT desde FROM espelho_vistos_base WHERE user_id = ?`).get(userId);
  if (!base) {
    base = { desde: new Date().toISOString() };
    db.prepare(`INSERT INTO espelho_vistos_base (user_id, desde) VALUES (?, ?)`).run(userId, base.desde);
  }
  // Limpa marcas de espelhos que já foram apagados/expiraram.
  db.prepare(`DELETE FROM espelho_vistos WHERE user_id = ? AND espelho_id NOT IN (SELECT id FROM espelho)`).run(userId);
  const linhas = db.prepare(`SELECT espelho_id, visto_em FROM espelho_vistos WHERE user_id = ?`).all(userId);
  const ids = linhas.map((r) => r.espelho_id);
  // visto_em do SQLite é "AAAA-MM-DD HH:MM:SS" em UTC; devolve em ISO pra comparar com alteradoEm.
  const vistoEm = {};
  for (const r of linhas) vistoEm[r.espelho_id] = new Date(`${String(r.visto_em).replace(" ", "T")}Z`).toISOString();
  return { desde: base.desde, ids, vistoEm };
}

// Abrir o espelho de novo renova a marca (visto_em), pra que uma alteração
// feita por outra pessoa DEPOIS dessa abertura volte a aparecer como "Atualizado".
export function marcarVisto(userId, espelhoId) {
  db.prepare(`
    INSERT INTO espelho_vistos (user_id, espelho_id) VALUES (?, ?)
    ON CONFLICT(user_id, espelho_id) DO UPDATE SET visto_em = datetime('now')
  `).run(userId, String(espelhoId));
}

export function marcarTodosVistos(userId) {
  db.prepare(`
    INSERT INTO espelho_vistos (user_id, espelho_id) SELECT ?, id FROM espelho WHERE true
    ON CONFLICT(user_id, espelho_id) DO UPDATE SET visto_em = datetime('now')
  `).run(userId);
}

// ---------------------------------------------------------------------
// Aviso de alteração. Ao salvar um espelho que já existia, compara com a
// versão anterior e, se algo mudou, guarda quando, quem e o que mudou
// (alteradoEm / alteradoPorId / alteradoPorNome / alteracao). Só roda no
// salvamento feito por uma pessoa — a expiração automática do espelho
// apaga o registro e nunca passa por aqui.
// ---------------------------------------------------------------------
const rotuloItem = (i) => (i.tipo === "passagem" ? "Passagem de bloco" : (i.retranca || "Item sem título"));

export function descreverAlteracao(antes, depois) {
  const a = antes?.itens || [];
  const d = depois?.itens || [];
  const idsA = new Set(a.map((i) => i.id));
  const idsD = new Set(d.map((i) => i.id));
  const entrou = d.filter((i) => !idsA.has(i.id));
  const saiu = a.filter((i) => !idsD.has(i.id));
  const partes = [];
  // Um item que saiu e outro que entrou, no mesmo lugar, é uma troca.
  const trocas = [];
  for (const nov of entrou.slice()) {
    const posNova = d.indexOf(nov);
    const velho = saiu.find((s) => a.indexOf(s) === posNova);
    if (velho && nov.tipo !== "passagem" && velho.tipo !== "passagem") {
      trocas.push([velho, nov]);
      entrou.splice(entrou.indexOf(nov), 1);
      saiu.splice(saiu.indexOf(velho), 1);
    }
  }
  for (const [v, n] of trocas) partes.push(`trocou "${rotuloItem(v)}" por "${rotuloItem(n)}"`);
  for (const i of entrou) partes.push(`colocou "${rotuloItem(i)}"`);
  for (const i of saiu) partes.push(`tirou "${rotuloItem(i)}"`);
  const comuns = d.filter((i) => idsA.has(i.id));
  const ordemA = a.filter((i) => idsD.has(i.id)).map((i) => i.id).join(",");
  if (ordemA !== comuns.map((i) => i.id).join(",")) partes.push("mudou a ordem");
  const editados = comuns.filter((i) => {
    const o = a.find((x) => x.id === i.id);
    return (o.texto || "") !== (i.texto || "") || (o.duracao || "") !== (i.duracao || "") || (o.retranca || "") !== (i.retranca || "");
  });
  if (editados.length) partes.push(editados.length === 1 ? `editou "${rotuloItem(editados[0])}"` : `editou ${editados.length} itens`);
  if ((antes?.data || "") !== (depois?.data || "")) partes.push("mudou a data");
  if ((antes?.programaId || "") !== (depois?.programaId || "")) partes.push("mudou o programa");
  if ((antes?.titulo || "") !== (depois?.titulo || "")) partes.push("mudou o título");
  const txt = partes.join("; ");
  return txt.length > 300 ? `${txt.slice(0, 297)}...` : txt;
}

// Devolve o corpo a gravar: com os campos de alteração atualizados se houve
// mudança, ou mantendo os anteriores se não houve. Ignora o que o cliente mandar nesses campos.
export function aplicarAlteracao(antes, corpo, user) {
  const out = { ...corpo };
  for (const k of ["alteradoEm", "alteradoPorId", "alteradoPorNome", "alteracao"]) delete out[k];
  if (!antes) return out;
  const resumo = descreverAlteracao(antes, corpo);
  if (resumo) {
    out.alteradoEm = new Date().toISOString();
    out.alteradoPorId = user.id;
    out.alteradoPorNome = user.nomeCompleto || user.username || "";
    out.alteracao = resumo;
  } else {
    for (const k of ["alteradoEm", "alteradoPorId", "alteradoPorNome", "alteracao"]) if (antes[k] !== undefined) out[k] = antes[k];
  }
  return out;
}

export function apagarVistosDoUsuario(userId) {
  db.prepare(`DELETE FROM espelho_vistos WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM espelho_vistos_base WHERE user_id = ?`).run(userId);
}
