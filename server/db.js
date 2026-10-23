import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dbPath = process.env.DB_PATH || path.join(__dirname, "data.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Migração: alguns ids de coleção foram renomeados pra não confundir mais
// no código (ex: a coleção "clientes" antigamente era a aba "Contas a
// pagar" — nome fácil de confundir com a aba "Clientes", que é outra
// coleção inteira; hoje "clientes" é a coleção da aba "Clientes" de
// verdade). Cada coleção é uma tabela cujo nome É o próprio id,
// então renomear no código sem migrar quebraria qualquer banco já em uso.
// Roda uma vez (por isso o `tableExists(novo)` — se já rodou antes, a
// tabela antiga não existe mais e isso vira no-op) sempre ANTES do bloco
// que cria as tabelas das coleções logo abaixo, senão esse bloco criaria a
// tabela nova vazia primeiro e a renomeação não encontraria mais espaço
// (a tabela de destino já existiria). Numa instalação nova, nenhuma tabela
// antiga existe, então isso não faz nada e as tabelas já nascem com o
// nome novo direto.
// É uma LISTA de pares [nomeAntigo, nomeNovo], na ordem em que rodam — e não
// um objeto — porque "clientes" aparece dos dois lados em gerações diferentes:
// foi o nome antigo de "contasPagar", depois o nome novo do cadastro de
// clientes, e agora é o nome antigo de "clientesFornecedores".
const RENAME_DE_COLECAO = [
  ["clientes", "contasPagar"], ["breaks", "opec"], ["links", "atalhos"],
  ["videos", "materias"], ["clientesCadastro", "clientes"], ["recebiveis", "contasReceber"],
  ["espelhos", "espelho"],
  ["clientes", "clientesFornecedores"],
];

function tableExists(name) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}

// Guarda só os pares que DE FATO foram renomeados nesta execução (não o
// mapa inteiro) — importante pra quando duas migrações de gerações
// diferentes se encadeiam (ex: "clientes" já foi o id antigo de uma
// migração passada — virou "contasPagar" — e agora é o id NOVO de outra
// migração — "clientesCadastro" virou "clientes"). Se a etapa de baixo
// (histórico/permissões) reaplicasse o mapa inteiro a cada boot, um
// usuário com permissão em "clientes" (a coleção nova, de verdade) seria
// "migrado" de novo pra "contasPagar" no boot seguinte, por engano — sem
// essa lista, o nome reaproveitado vira uma migração-fantasma que roda
// pra sempre. Só o que mudou NESTA execução entra aqui.
const migradosNestaExecucao = [];
for (const [nomeAntigo, nomeNovo] of RENAME_DE_COLECAO) {
  if (tableExists(nomeAntigo) && !tableExists(nomeNovo)) {
    db.exec(`ALTER TABLE ${nomeAntigo} RENAME TO ${nomeNovo}`);
    console.log(`[controle-tv] Migração: coleção "${nomeAntigo}" renomeada para "${nomeNovo}".`);
    migradosNestaExecucao.push([nomeAntigo, nomeNovo]);
  }
}

export const COLLECTIONS = ["materias", "contasPagar", "contasReceber", "colaboradores", "contatos", "clientesFornecedores", "entrevistados", "opec", "programas", "espelho", "atalhos"];

for (const col of COLLECTIONS) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${col} (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS historico (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    collection TEXT NOT NULL,
    entity_id TEXT,
    label TEXT,
    description TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON historico(timestamp DESC)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    permissions TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migração: adiciona a coluna de nome completo pra quem já tinha o banco
// criado antes dessa mudança (instalação nova já nasce sem precisar disso,
// mas o ALTER TABLE falha se a coluna já existir — por isso o try/catch).
try {
  db.exec(`ALTER TABLE users ADD COLUMN nome_completo TEXT NOT NULL DEFAULT ''`);
} catch (e) {
  /* coluna já existe — banco de uma instalação mais recente, ignora */
}

// Migração: coluna da foto de perfil (nome do arquivo em UPLOADS_DIR/avatars,
// não a imagem em si — mesmo padrão do anexo do Chat). NULL = sem foto,
// usa o círculo colorido com a inicial do nome.
try {
  db.exec(`ALTER TABLE users ADD COLUMN foto TEXT`);
} catch (e) {
  /* coluna já existe — banco de uma instalação mais recente, ignora */
}

// Continuação da migração de RENAME_DE_COLECAO (acima): renomear a tabela
// não é suficiente — o id antigo também fica gravado DENTRO de dados já
// salvos, em dois lugares: a permissão de cada usuário (um JSON guardado
// na coluna users.permissions, ex: {"clientes":"view"}) e a coluna
// "collection" de cada linha do Histórico (auditoria). Sem isso, quem já
// tinha permissão pra ver "Contas a pagar" perderia o acesso depois da
// migração (a permissão ficaria salva com a chave antiga, que não existe
// mais em nenhuma aba), e o Histórico antigo não apareceria mais ao
// filtrar por essa coleção. Usa `migradosNestaExecucao` (só os pares que
// realmente foram renomeados agora), não o mapa `RENAME_DE_COLECAO`
// inteiro — se usasse o mapa inteiro, isso rodaria de novo em todo boot
// pra sempre, e um id novo que coincidisse com um id antigo de outra
// geração de migração (como aconteceu aqui com "clientes") acabaria sendo
// "re-migrado" por engano a cada reinício.
for (const [nomeAntigo, nomeNovo] of migradosNestaExecucao) {
  db.prepare(`UPDATE historico SET collection = ? WHERE collection = ?`).run(nomeNovo, nomeAntigo);
}
for (const row of db.prepare(`SELECT id, permissions FROM users`).all()) {
  let perms;
  try {
    perms = JSON.parse(row.permissions || "{}");
  } catch (e) {
    continue;
  }
  let mudou = false;
  for (const [nomeAntigo, nomeNovo] of migradosNestaExecucao) {
    if (nomeAntigo in perms) {
      perms[nomeNovo] = perms[nomeAntigo];
      delete perms[nomeAntigo];
      mudou = true;
    }
  }
  if (mudou) {
    db.prepare(`UPDATE users SET permissions = ? WHERE id = ?`).run(JSON.stringify(perms), row.id);
  }
}

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

// ---------------------------------------------------------------------
// Fuso horário do sistema
// Definido em Configurações > Geral. Fica na tabela app_config (chave/valor).
// Sem escolha, vale a variável de ambiente TZ (se válida) ou São Paulo.
// Ao iniciar e a cada mudança, o fuso é aplicado ao processo (process.env.TZ),
// então "hoje", vencimentos, backup automático e e-mails passam a segui-lo.
// ---------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS app_config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  )
`);

export function fusoValido(z) {
  if (typeof z !== "string" || !z.trim() || z.length > 64) return false;
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: z }); return true; } catch { return false; }
}

export const FUSO_PADRAO = fusoValido(process.env.TZ) ? process.env.TZ : "America/Sao_Paulo";

export function getFuso() {
  const r = db.prepare(`SELECT valor FROM app_config WHERE chave = 'fuso'`).get();
  return r && fusoValido(r.valor) ? r.valor : FUSO_PADRAO;
}

export function aplicarFuso() {
  process.env.TZ = getFuso();
}

export function setFuso(valor) {
  const z = String(valor ?? "").trim();
  if (!fusoValido(z)) return { error: "Fuso horário inválido." };
  db.prepare(`INSERT INTO app_config (chave, valor) VALUES ('fuso', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`).run(z);
  aplicarFuso();
  return { fuso: z };
}

export function restaurarFuso() {
  db.prepare(`DELETE FROM app_config WHERE chave = 'fuso'`).run();
  aplicarFuso();
  return { fuso: FUSO_PADRAO };
}

// Data de hoje (AAAA-MM-DD) no fuso do sistema — e não em UTC, que a partir
// das 21h (Brasília) já "virava o dia".
export function hojeISO(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: getFuso(), year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}

aplicarFuso();

// ---------------------------------------------------------------------
// Redes sociais (onde matérias e entrevistados podem ser publicados)
// Lista editável em Configurações > Geral; fica em app_config (chave 'redes').
// ---------------------------------------------------------------------
export const REDES_PADRAO = ["YouTube", "Instagram", "Facebook", "TikTok", "Site", "WhatsApp"];
export const REDES_MAX = 20;

export function getRedes() {
  const r = db.prepare(`SELECT valor FROM app_config WHERE chave = 'redes'`).get();
  if (!r) return [...REDES_PADRAO];
  try { const l = JSON.parse(r.valor); return Array.isArray(l) && l.length ? l : [...REDES_PADRAO]; } catch { return [...REDES_PADRAO]; }
}

export function setRedes(lista) {
  if (!Array.isArray(lista)) return { error: "Envie a lista de redes." };
  const vistos = new Set();
  const limpa = [];
  for (const x of lista) {
    const n = String(x ?? "").trim().replace(/\s+/g, " ");
    if (!n) continue;
    if (n.length > 30) return { error: "Cada nome pode ter até 30 letras." };
    const k = n.toLocaleLowerCase("pt-BR");
    if (vistos.has(k)) continue;
    vistos.add(k); limpa.push(n);
  }
  if (limpa.length === 0) return { error: "Deixe pelo menos uma rede na lista." };
  if (limpa.length > REDES_MAX) return { error: `No máximo ${REDES_MAX} redes.` };
  db.prepare(`INSERT INTO app_config (chave, valor) VALUES ('redes', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`).run(JSON.stringify(limpa));
  return { redes: limpa };
}

export function restaurarRedes() {
  db.prepare(`DELETE FROM app_config WHERE chave = 'redes'`).run();
  return { redes: [...REDES_PADRAO] };
}

const todayISO = () => hojeISO();

function seedIfEmpty() {
  // Só semeia dados de exemplo numa instalação genuinamente nova (banco
  // recém-criado, sem nenhum usuário ainda). Depois da primeira vez que o
  // admin é criado, nunca mais volta a semear — mesmo que o usuário apague
  // tudo de uma coleção (ex: todos os contatos ou todo o OPEC), ela
  // fica vazia de verdade, sem os exemplos reaparecerem a cada reinício.
  const userCount = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
  if (userCount > 0) return;

  const seed = {
    materias: [
      { titulo: "VT — Campanha outubro rosa", cabeca: "A prefeitura lançou nesta semana uma campanha de conscientização.", reporter: "Ana Beatriz", tipo: "VT Completo", duracao: "0:30", status: "Pronto", entrada: todayISO(), datasVeiculacao: [], sinalizadores: ["prioridade"] },
      { titulo: "Stand up — Trânsito na avenida central", cabeca: "", reporter: "Rodrigo Lima", tipo: "Stand Up", duracao: "0:45", status: "Redação", entrada: todayISO(), datasVeiculacao: [], sinalizadores: ["urgente"] },
      { titulo: "Sonora — Secretário de saúde", cabeca: "Amanhã, no jornal, uma entrevista sobre a campanha de vacinação.", reporter: "Carla Mendes", tipo: "Sonora", duracao: "0:20", status: "Edição", entrada: todayISO(), datasVeiculacao: [], sinalizadores: [] },
    ],
    contasPagar: [
      { razaoSocial: "Supermercado Bom Preço Ltda", nomeFantasia: "Supermercado Bom Preço", cnpj: "12.345.678/0001-90", inscricaoEstadual: "123.456.789.112", inscricaoMunicipal: "", endereco: "Av. Central, 1200 — Centro", telefone: "(64) 3611-2233", email: "financeiro@bompreco.com.br", descricaoProduto: "Pacote de ofertas de setembro — 30s no jornal do meio-dia", tipoFornecedor: "Fornecedor", valor: 3200, parcela: "1/1", vencimento: todayISO(), status: "Pendente" },
      { razaoSocial: "Auto Peças Silva Comércio Ltda", nomeFantasia: "Auto Peças Silva", cnpj: "23.456.789/0001-01", inscricaoEstadual: "234.567.891.223", inscricaoMunicipal: "", endereco: "Rua das Oficinas, 45", telefone: "(64) 3622-4455", email: "contato@autopecassilva.com.br", descricaoProduto: "VT institucional 30s", tipoFornecedor: "Fornecedor", valor: 1450, parcela: "1/1", vencimento: "2026-08-20", status: "Atrasado" },
      { razaoSocial: "Farmácia Vida Ltda", nomeFantasia: "Farmácia Vida", cnpj: "34.567.891/0001-12", inscricaoEstadual: "", inscricaoMunicipal: "", endereco: "Praça da Matriz, 80", telefone: "(64) 3633-5566", email: "", descricaoProduto: "Campanha de vacinação", tipoFornecedor: "Prestador", valor: 980, parcela: "1/1", vencimento: "2026-07-10", status: "Pago" },
    ],
    contasReceber: [
      { razaoSocial: "Loja de Móveis Conforto Ltda", nomeFantasia: "Móveis Conforto", cnpj: "45.678.912/0001-23", inscricaoEstadual: "", inscricaoMunicipal: "", endereco: "Av. Brasil, 500", telefone: "(64) 3644-6677", email: "financeiro@moveisconforto.com.br", descricaoProduto: "Patrocínio jornal do meio-dia — parcela 1 de 2", valor: 1500, parcela: "1/2", vencimento: "2026-09-25", status: "Pendente" },
      { razaoSocial: "Loja de Móveis Conforto Ltda", nomeFantasia: "Móveis Conforto", cnpj: "45.678.912/0001-23", inscricaoEstadual: "", inscricaoMunicipal: "", endereco: "Av. Brasil, 500", telefone: "(64) 3644-6677", email: "financeiro@moveisconforto.com.br", descricaoProduto: "Patrocínio jornal do meio-dia — parcela 2 de 2", valor: 1500, parcela: "2/2", vencimento: "2026-10-25", status: "Pendente" },
      { razaoSocial: "Concessionária Veloz Veículos Ltda", nomeFantasia: "Concessionária Veloz", cnpj: "56.789.123/0001-34", inscricaoEstadual: "", inscricaoMunicipal: "", endereco: "Rodovia GO-174, km 3", telefone: "(64) 3655-7788", email: "marketing@veloz.com.br", descricaoProduto: "Cota de patrocínio anual", temAgencia: true, nomeAgencia: "Agência Plural Comunicação", valor: 8600, parcela: "1/1", vencimento: "2026-10-05", status: "Pendente" },
    ],
    colaboradores: [
      { nomeCompleto: "Ana Beatriz Souza", dataNascimento: "1994-03-12", cpf: "123.456.789-01", cnpj: "", funcao: "Repórter", celular: "(64) 99911-2233", email: "ana.souza@emissora.com.br", endereco: "Rua das Palmeiras, 220", observacoes: "" },
      { nomeCompleto: "Rodrigo Lima Ferreira", dataNascimento: "1989-09-05", cpf: "234.567.890-12", cnpj: "12.345.678/0001-55", funcao: "Cinegrafista (PJ)", celular: "(64) 99922-3344", email: "rodrigo.lima@gmail.com", endereco: "Av. dos Ipês, 88", observacoes: "Atende também finais de semana" },
      { nomeCompleto: "Carla Mendes Oliveira", dataNascimento: "1997-01-28", cpf: "345.678.901-23", cnpj: "", funcao: "Editora de imagens", celular: "(64) 99933-4455", email: "carla.mendes@emissora.com.br", endereco: "Rua Sete de Setembro, 410", observacoes: "" },
    ],
    contatos: [
      { nomeCompleto: "Eng. Agr. Paulo Ricardo Nunes", funcao: "Agrônomo", celular: "(64) 99944-5566", email: "paulo.nunes@agro.com.br", endereco: "Zona Rural, Fazenda Boa Vista", observacoes: "Fonte de pautas sobre safra e clima" },
      { nomeCompleto: "Dra. Fernanda Costa Lima", funcao: "Veterinária", celular: "(64) 99955-6677", email: "fernanda.vet@gmail.com", endereco: "Av. Goiás, 300", observacoes: "Atende emergências, prefere contato por WhatsApp" },
      { nomeCompleto: "Marcos Antônio Ribeiro", funcao: "Gerente de fazenda", celular: "(64) 99966-7788", email: "", endereco: "Fazenda Santa Luzia, GO-070 km 12", observacoes: "" },
    ],
    clientesFornecedores: [
      { razaoSocial: "Comigo Agro S.A.", nomeFantasia: "Comigo", cnpj: "12.345.678/0009-01", inscricaoEstadual: "123.456.789.001", inscricaoMunicipal: "", endereco: "Av. Comigo, 1000 — Distrito Industrial", telefone: "(64) 3611-9900", email: "comercial@comigo.com.br", observacoes: "Cliente frequente, prefere contato pela manhã" },
      { razaoSocial: "Supermercado Bom Preço Ltda", nomeFantasia: "Supermercado Bom Preço", cnpj: "12.345.678/0001-90", inscricaoEstadual: "123.456.789.112", inscricaoMunicipal: "", endereco: "Av. Central, 1200 — Centro", telefone: "(64) 3611-2233", email: "financeiro@bompreco.com.br", observacoes: "" },
      { razaoSocial: "Auto Peças Silva Comércio Ltda", nomeFantasia: "Auto Peças Silva", cnpj: "23.456.789/0001-01", inscricaoEstadual: "234.567.891.223", inscricaoMunicipal: "", endereco: "Rua das Oficinas, 45", telefone: "(64) 3622-4455", email: "contato@autopecassilva.com.br", observacoes: "" },
    ],
    entrevistados: [
      { nomeCompleto: "João Pereira Silva", funcao: "Presidente do Sindicato Rural", celular: "(64) 99877-1122", linhaFina: "Fala sobre a situação da safra 2026", data: todayISO(), horario: "12:30", modalidade: "Presencial", cabeca: "", observacoes: "", extras: [] },
      { nomeCompleto: "Maria José Santos", funcao: "Secretária de Saúde", celular: "(64) 99877-3344", linhaFina: "Balanço da campanha de vacinação", data: todayISO(), horario: "13:00", modalidade: "Online", cabeca: "", observacoes: "", extras: [] },
    ],
    opec: [
      { nomeVT: "Bom Preço — Ofertas de setembro 30s", programa: "Jornal do Meio-Dia", diasSemana: ["seg", "ter", "qua", "qui", "sex"], cliente: "Supermercado Bom Preço", duracao: "30", vencimento: "2026-09-30", naoVence: false },
      { nomeVT: "Auto Peças Silva — Institucional 15s", programa: "Jornal do Meio-Dia", diasSemana: ["seg", "qua", "sex"], cliente: "Auto Peças Silva", duracao: "15", vencimento: "", naoVence: true },
      { nomeVT: "Farmácia Vida — Campanha vacinação 30s", programa: "Jornal da Noite", diasSemana: ["sab", "dom"], cliente: "Farmácia Vida", duracao: "30", vencimento: "2026-09-20", naoVence: false },
    ],
  };

  for (const col of COLLECTIONS) {
    const stmt = db.prepare(`INSERT INTO ${col} (id, data) VALUES (?, ?)`);
    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const id = uid();
        stmt.run(id, JSON.stringify({ ...row, id }));
      }
    });
    tx(seed[col] || []);
  }
}

seedIfEmpty();

const DEFAULT_ADMIN_PASSWORD = "admin123";

function seedAdminIfEmpty() {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
  if (count > 0) return;
  const passwordHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?)`
  ).run(uid(), "admin", passwordHash, "admin", "{}");
  console.log(
    `\n[controle-tv] Usuário admin padrão criado: usuário "admin", senha "${DEFAULT_ADMIN_PASSWORD}".\n[controle-tv] Troque essa senha assim que possível (crie outro admin e apague este, ou edite a senha).\n`
  );
}

seedAdminIfEmpty();

// Mesma lógica de `addMonthsISO` do client (client/src/lib/dates.js) —
// soma meses mantendo o MESMO dia do mês (ex: todo dia 1), em vez de somar
// dias fixos (que ia derivando aos poucos, já que nem todo mês tem o mesmo
// tamanho). Se o mês de destino não tem esse dia (dia 31 em fevereiro, por
// exemplo), cai no último dia daquele mês. Sempre chamar com a data
// ÂNCORA (a primeira parcela da série) e o índice do mês, nunca
// acumulando a partir do resultado anterior.
const addMonthsISO = (iso, months) => {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const totalMonths = (m - 1) + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth0 = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth0 + 1, 0).getDate();
  const targetDay = Math.min(d, lastDayOfTargetMonth);
  const mm = String(targetMonth0 + 1).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
};

// Quantos meses de diferença existem entre duas datas ISO, olhando só
// ano/mês (ignora o dia) — usado pra descobrir "quantos meses já se
// passaram desde a âncora da série" sem depender de contar quantas linhas
// existem no banco (o que quebraria se algum lançamento tivesse sido
// apagado manualmente no meio da série).
const monthsBetweenISO = (fromISO, toISO) => {
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

// Conta fixa não tem data de fim — em vez de gerar um lote gigante de uma
// vez (o que teria um limite escondido), gera só 6 meses por vez e vai
// completando automaticamente: sempre que sobrarem menos de 6 lançamentos
// futuros numa série, gera mais um pra manter a "folga" de 6 meses à frente.
// Roda no início do servidor e uma vez por dia, então funciona mesmo que o
// servidor fique ligado por anos sem reiniciar.
const CONTA_FIXA_BUFFER_MESES = 6;

function replenishContaFixa() {
  const hoje = todayISO();
  const rows = db.prepare(`SELECT id, data FROM contasPagar`).all();
  const items = rows.map((r) => JSON.parse(r.data));

  const grupos = new Map();
  items.forEach((i) => {
    if (!i.contaFixa || !i.grupoId) return;
    if (!grupos.has(i.grupoId)) grupos.set(i.grupoId, []);
    grupos.get(i.grupoId).push(i);
  });

  const novos = [];
  grupos.forEach((lista) => {
    // Série cancelada pelo usuário (via "Cancelar conta fixa") nunca é reposta
    if (lista.some((i) => i.contaFixaCancelada)) return;
    let futurosCount = lista.filter((i) => i.vencimento >= hoje).length;
    if (futurosCount >= CONTA_FIXA_BUFFER_MESES) return;
    const ultimo = lista.reduce((a, b) => (a.vencimento > b.vencimento ? a : b));
    // A âncora é a PRIMEIRA parcela da série (menor vencimento) — todo
    // vencimento novo é calculado a partir dela (mesmo dia do mês), nunca
    // acumulando a partir do último gerado. Isso garante que a série
    // sempre volte pro dia certo depois de passar por um mês mais curto
    // (ex: dia 31 caindo em fevereiro não "contamina" os meses seguintes).
    const primeiro = lista.reduce((a, b) => (a.vencimento < b.vencimento ? a : b));
    let index = monthsBetweenISO(primeiro.vencimento, ultimo.vencimento) + 1;
    let cursor = ultimo.vencimento;
    let safety = 0;
    // Continua gerando mês a mês até realmente ter 6 meses futuros — se a
    // série ficou muito tempo sem ser checada (servidor ficou dias/meses
    // parado), um único "pulo" de 6 meses a partir do último vencimento
    // pode não ser suficiente pra alcançar o futuro.
    while (futurosCount < CONTA_FIXA_BUFFER_MESES && safety < 240) {
      cursor = addMonthsISO(primeiro.vencimento, index);
      novos.push({
        ...ultimo,
        id: uid(),
        vencimento: cursor,
        parcela: "",
        status: "Pendente",
      });
      if (cursor >= hoje) futurosCount += 1;
      index += 1;
      safety += 1;
    }
  });

  if (novos.length === 0) return;
  const stmt = db.prepare(`INSERT INTO contasPagar (id, data) VALUES (?, ?)`);
  const tx = db.transaction((rows) => {
    for (const item of rows) stmt.run(item.id, JSON.stringify(item));
  });
  tx(novos);
  console.log(`[controle-tv] Conta fixa: repostos ${novos.length} lançamento(s) futuro(s) automaticamente.`);
}

replenishContaFixa();
setInterval(replenishContaFixa, 24 * 60 * 60 * 1000);

function parseUserRow(row) {
  if (!row) return null;
  let permissions = {};
  try {
    permissions = JSON.parse(row.permissions || "{}");
  } catch (e) {
    permissions = {};
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    permissions,
    nomeCompleto: row.nome_completo || "",
    foto: row.foto || null,
    createdAt: row.created_at,
  };
}

// Pega só os 2 primeiros nomes de um nome completo (ex: "Luiz Stormorwski
// Santos" -> "Luiz Stormorwski") — usado pra exibir um nome mais curto e
// legível no lugar do login (ex: "luizstsantos") em lugares como o TO-DO.
export function primeirosDoisNomes(nomeCompleto) {
  if (!nomeCompleto || !nomeCompleto.trim()) return "";
  return nomeCompleto.trim().split(/\s+/).slice(0, 2).join(" ");
}

// Nome pra exibir: os 2 primeiros nomes, se a pessoa tiver cadastrado nome
// completo — senão cai pro login mesmo (compatibilidade com quem já
// existia antes dessa mudança).
export function nomeExibicao(user) {
  return primeirosDoisNomes(user?.nomeCompleto) || user?.username || "";
}

export function listUsers() {
  const rows = db.prepare(`SELECT * FROM users ORDER BY created_at ASC`).all();
  return rows.map(parseUserRow);
}

// Retorna a linha crua (com password_hash) — usado só no login, nunca enviado ao cliente.
export function getUserRowByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

export function getUserById(id) {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  return parseUserRow(row);
}

export function countAdmins() {
  return db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get().c;
}

export function createUser({ username, passwordHash, role, permissions, nomeCompleto }) {
  const id = uid();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, permissions, nome_completo) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, username, passwordHash, role === "admin" ? "admin" : "user", JSON.stringify(permissions || {}), (nomeCompleto || "").trim());
  return getUserById(id);
}

export function updateUser(id, { role, permissions, passwordHash, nomeCompleto }) {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  if (!existing) return null;
  const newRole = role === "admin" || role === "user" ? role : existing.role;
  const newPermissions = permissions !== undefined ? JSON.stringify(permissions) : existing.permissions;
  const newHash = passwordHash || existing.password_hash;
  const newNome = nomeCompleto !== undefined ? nomeCompleto.trim() : existing.nome_completo;
  db.prepare(`UPDATE users SET role = ?, permissions = ?, password_hash = ?, nome_completo = ? WHERE id = ?`).run(
    newRole,
    newPermissions,
    newHash,
    newNome,
    id
  );
  return getUserById(id);
}

export function deleteUser(id) {
  const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  return result.changes > 0;
}

// `foto` é o nome do arquivo já salvo em disco (ver AVATARS_DIR em chat.js),
// ou null pra remover a foto e voltar ao círculo com a inicial do nome.
export function updateUserFoto(id, foto) {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  if (!existing) return null;
  db.prepare(`UPDATE users SET foto = ? WHERE id = ?`).run(foto, id);
  return getUserById(id);
}

export function listItems(col) {
  const rows = db.prepare(`SELECT data FROM ${col} ORDER BY rowid ASC`).all();
  return rows.map((r) => JSON.parse(r.data));
}

// Pega um item específico de uma coleção — usado antes de um update/delete
// para saber como o registro estava ANTES da mudança (comparação campo a
// campo pro histórico/auditoria, ver ENTITY_META/buildHistoricoDescription).
export function getItem(col, id) {
  const row = db.prepare(`SELECT data FROM ${col} WHERE id = ?`).get(id);
  return row ? JSON.parse(row.data) : null;
}

export function createItem(col, item) {
  const id = item.id || uid();
  const record = { ...item, id };
  // Espelho: a validade conta a partir de quando ele foi CRIADO (não da data
  // de veiculação). Quem manda é sempre o servidor — o cliente não escolhe.
  if (col === "espelho") record.criadoEm = new Date().toISOString();
  db.prepare(`INSERT INTO ${col} (id, data) VALUES (?, ?)`).run(
    id,
    JSON.stringify(record)
  );
  return record;
}

export function updateItem(col, id, item) {
  const record = { ...item, id };
  // Editar um espelho NÃO renova a validade: o criadoEm original é mantido
  // (e, se for um espelho antigo sem ele, nasce da última gravação).
  if (col === "espelho") {
    const atual = db.prepare(`SELECT data, updated_at FROM espelho WHERE id = ?`).get(id);
    if (atual) {
      let antigo = {};
      try { antigo = JSON.parse(atual.data); } catch (e) { /* segue com vazio */ }
      record.criadoEm = antigo.criadoEm || criadoEmDeUpdatedAt(atual.updated_at);
    }
  }
  const result = db
    .prepare(`UPDATE ${col} SET data = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(record), id);
  if (result.changes === 0) return null;
  return record;
}

export function deleteItem(col, id) {
  const result = db.prepare(`DELETE FROM ${col} WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ---------------------------------------------------------------------
// Validade do Espelho
// Cada espelho some sozinho N dias depois de ter sido CRIADO (não da data de
// veiculação). N é definido em Configurações > Espelho (padrão 30, de 1 a
// 365) e fica na tabela espelho_config.
// ---------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS espelho_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    retencao_dias INTEGER
  )
`);
db.prepare(`INSERT OR IGNORE INTO espelho_config (id) VALUES (1)`).run();

export const ESPELHO_RETENCAO_PADRAO = 30;
export const ESPELHO_RETENCAO_FAIXA = [1, 365];
const DIA_MS = 24 * 60 * 60 * 1000;

export function getEspelhoRetencaoDias() {
  const r = db.prepare(`SELECT retencao_dias FROM espelho_config WHERE id = 1`).get();
  return r?.retencao_dias ?? ESPELHO_RETENCAO_PADRAO;
}

export function setEspelhoRetencaoDias(valor) {
  const [min, max] = ESPELHO_RETENCAO_FAIXA;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `Informe um número inteiro de dias entre ${min} e ${max}.` };
  }
  db.prepare(`UPDATE espelho_config SET retencao_dias = ? WHERE id = 1`).run(n);
  return { retencaoDias: n };
}

export function restaurarEspelhoRetencaoDias() {
  db.prepare(`UPDATE espelho_config SET retencao_dias = NULL WHERE id = 1`).run();
  return { retencaoDias: ESPELHO_RETENCAO_PADRAO };
}

// updated_at do SQLite vem como "AAAA-MM-DD HH:MM:SS" em UTC.
function criadoEmDeUpdatedAt(updatedAt) {
  const t = Date.parse(`${String(updatedAt || "").replace(" ", "T")}Z`);
  return new Date(Number.isFinite(t) ? t : Date.now()).toISOString();
}

// Lista {id, criadoMs} de todos os espelhos. Espelhos antigos (salvos antes
// de existir o criadoEm) ganham um agora, tirado da última gravação — assim
// ninguém é apagado de repente por causa dessa mudança.
function espelhosComCriacao() {
  const rows = db.prepare(`SELECT id, data, updated_at FROM espelho`).all();
  const out = [];
  for (const row of rows) {
    let item;
    try { item = JSON.parse(row.data); } catch (e) { continue; }
    if (!item.criadoEm) {
      item.criadoEm = criadoEmDeUpdatedAt(row.updated_at);
      db.prepare(`UPDATE espelho SET data = ? WHERE id = ?`).run(JSON.stringify(item), row.id);
    }
    const t = Date.parse(item.criadoEm);
    if (Number.isFinite(t)) out.push({ id: row.id, criadoMs: t });
  }
  return out;
}

// Quantos espelhos seriam apagados se o prazo fosse `dias` (pra avisar antes
// de salvar um prazo menor).
export function contarEspelhosQueVenceriam(dias) {
  const limite = Date.now() - Number(dias) * DIA_MS;
  return espelhosComCriacao().filter((e) => e.criadoMs < limite).length;
}

// Apaga espelhos criados há mais de N dias — evita a lista crescer pra
// sempre. Roda a cada leitura da coleção "espelho" e periodicamente no
// servidor (ver index.js). Devolve os ids apagados.
export function pruneEspelhosVencidos() {
  const limite = Date.now() - getEspelhoRetencaoDias() * DIA_MS;
  const ids = espelhosComCriacao().filter((e) => e.criadoMs < limite).map((e) => e.id);
  const stmt = db.prepare(`DELETE FROM espelho WHERE id = ?`);
  for (const id of ids) stmt.run(id);
  return ids;
}

// Inativa (nunca apaga) entrevistados cuja data já passou — mesma regra do
// arquivamento manual. Roda a cada leitura da coleção "entrevistados" e
// periodicamente no servidor (ver index.js), mesmo padrão de
// pruneEspelhosVencidos. Retorna os pares {before, after} de cada registro
// alterado, para quem chamar poder registrar no Histórico como ação do
// sistema (e não de quem por acaso disparou a checagem).
export function pruneEntrevistadosVencidos() {
  const rows = db.prepare(`SELECT id FROM entrevistados`).all();
  const hoje = hojeISO();
  const resultados = [];
  for (const row of rows) {
    const item = getItem("entrevistados", row.id);
    if (item && item.data && item.data < hoje && !item.inativo) {
      const atualizado = updateItem("entrevistados", row.id, { ...item, inativo: true });
      resultados.push({ before: item, after: atualizado });
    }
  }
  return resultados;
}

// Marca como "Atrasado" toda conta a receber com status "Pendente" cujo
// vencimento já passou — mesmo padrão de pruneEntrevistadosVencidos. Só
// mexe em quem está "Pendente" (nunca em "Pago", e não repete em quem já
// está "Atrasado"), então cada item retornado aqui é uma transição NOVA
// pra atraso — é o gancho certo pra disparar notificação sem repetir aviso
// a cada checagem periódica.
export function pruneContasReceberAtrasadas() {
  const rows = db.prepare(`SELECT id FROM contasReceber`).all();
  const hoje = hojeISO();
  const resultados = [];
  for (const row of rows) {
    const item = getItem("contasReceber", row.id);
    if (item && item.vencimento && item.vencimento < hoje && item.status === "Pendente") {
      const atualizado = updateItem("contasReceber", row.id, { ...item, status: "Atrasado" });
      resultados.push({ before: item, after: atualizado });
    }
  }
  return resultados;
}

// Mesma regra de pruneContasReceberAtrasadas, só que para Contas a pagar
// (coleção "contasPagar"). Fica em função separada (em vez de generalizar
// as duas numa só) porque são coleções diferentes com o mesmo "formato" só
// por coincidência — se um dia divergirem (campo de vencimento diferente
// etc.) já fica cada uma no seu canto.
export function pruneContasPagarAtrasadas() {
  const rows = db.prepare(`SELECT id FROM contasPagar`).all();
  const hoje = hojeISO();
  const resultados = [];
  for (const row of rows) {
    const item = getItem("contasPagar", row.id);
    if (item && item.vencimento && item.vencimento < hoje && item.status === "Pendente") {
      const atualizado = updateItem("contasPagar", row.id, { ...item, status: "Atrasado" });
      resultados.push({ before: item, after: atualizado });
    }
  }
  return resultados;
}

/* ---------------------------------------------------------
   Histórico / auditoria — grava automaticamente cada
   criação/edição/exclusão feita nas coleções (e em usuários) e gera uma
   descrição amigável em português. Nunca guarda o registro inteiro (antes
   ou depois), só o rótulo e a frase pronta — assim não corre risco de
   vazar dado sensível (ex: hash de senha de usuário) mesmo sem ter que
   ficar filtrando campo por campo em cada chamada.
--------------------------------------------------------- */

// article: usado na frase ("criou A matéria" / "criou O contato").
// noun: como o registro é chamado na frase.
// labelFields: campos tentados em ordem pra identificar o registro (o
// primeiro não-vazio vence) — ver os cadastros de cada aba/formulário.
export const ENTITY_META = {
  materias: { article: "a", noun: "matéria", labelFields: ["titulo"] },
  contasPagar: { article: "a", noun: "conta a pagar", labelFields: ["nomeFantasia", "razaoSocial"] },
  contasReceber: { article: "a", noun: "conta a receber", labelFields: ["nomeFantasia", "razaoSocial"] },
  colaboradores: { article: "o", noun: "colaborador", labelFields: ["nomeCompleto"] },
  contatos: { article: "o", noun: "contato", labelFields: ["nomeCompleto"] },
  clientesFornecedores: { article: "o", noun: "cliente/fornecedor", labelFields: ["nomeFantasia", "razaoSocial"] },
  entrevistados: { article: "o", noun: "entrevistado", labelFields: ["nomeCompleto"] },
  opec: { article: "o", noun: "comercial de OPEC", labelFields: ["nomeVT"] },
  programas: { article: "o", noun: "programa", labelFields: ["nome"] },
  espelho: { article: "o", noun: "espelho", labelFields: ["programa"] },
  usuarios: { article: "o", noun: "usuário", labelFields: ["username"] },
  atalhos: { article: "o", noun: "atalho", labelFields: ["nome"] },
};

// Nomes mais legíveis pros campos citados na descrição de uma edição
// genérica (ex: "editou o cliente \"X\" (telefone, e-mail)"). Cobre os
// campos de todos os formulários do sistema — ver os "setForm({...})" de
// cada aba em client/src/features/**/*.jsx se precisar conferir algum novo.
const FIELD_LABELS = {
  // comuns a vários cadastros
  status: "status", valor: "valor", vencimento: "vencimento", funcao: "função",
  celular: "celular", telefone: "telefone", email: "e-mail", endereco: "endereço",
  cnpj: "CNPJ", cpf: "CPF", tipo: "tipo", duracao: "duração", programa: "programa",
  horario: "horário", horarios: "horários", modalidade: "modalidade", cliente: "cliente",
  nomeCompleto: "nome completo", nome: "nome", role: "papel", permissions: "permissões",
  username: "usuário", reporter: "repórter", cabeca: "cabeça", parcela: "parcela",
  descricaoProduto: "descrição do produto", observacoes: "observações",
  razaoSocial: "razão social", nomeFantasia: "nome fantasia",
  inscricaoEstadual: "inscrição estadual", inscricaoMunicipal: "inscrição municipal",
  data: "data", sigla: "sigla", descricao: "descrição", quantidade: "quantidade",
  passwordHash: "senha", password: "senha", titulo: "título", url: "link",
  // matérias
  entrada: "data de entrada", datasVeiculacao: "datas de veiculação",
  sinalizadores: "sinalizadores", publicacoes: "publicações nas redes",
  // financeiro (contas a pagar/receber)
  categoriaLancamento: "categoria do lançamento", tipoFornecedor: "tipo de fornecedor",
  colaboradorId: "colaborador vinculado", vinculaColaborador: "vínculo com colaborador",
  parcelas: "número de parcelas", usaParcelamento: "parcelamento",
  usaContratoMinimo: "contrato mínimo", mesesContrato: "duração do contrato",
  temAgencia: "vínculo com agência", agenciaClienteId: "agência vinculada",
  contaFixa: "conta fixa",
  // colaboradores/contatos
  dataNascimento: "data de nascimento",
  // entrevistados
  linhaFina: "linha fina", extras: "informações extras", inativo: "situação (ativa/inativa)",
  // espelho
  programaId: "programa", programaNome: "nome do programa", programaSigla: "sigla do programa",
  horarioPrograma: "horário do programa", itens: "itens do roteiro",
  // OPEC
  nomeVT: "nome do VT", diasSemana: "dias da semana", inicio: "início da veiculação",
  naoVence: "vencimento (não vence)",
};

function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

function labelForRecord(collection, record) {
  if (!record) return "";
  if (collection === "espelho") {
    const dataFmt = record.data ? String(record.data).split("-").reverse().join("/") : "";
    return [record.programa, dataFmt].filter(Boolean).join(" — ") || "Espelho";
  }
  const meta = ENTITY_META[collection];
  const fields = meta?.labelFields || ["nome", "titulo", "nomeCompleto"];
  for (const f of fields) {
    const v = record[f];
    if (v && String(v).trim()) return String(v).trim();
  }
  return record.id || "";
}

// Compara dois objetos campo a campo (raso, com JSON.stringify pros valores
// que são array/objeto) e devolve os nomes dos campos que mudaram.
function diffChangedFields(oldItem, newItem, ignore = []) {
  const keys = new Set([...Object.keys(oldItem || {}), ...Object.keys(newItem || {})]);
  const changed = [];
  for (const k of keys) {
    if (ignore.includes(k)) continue;
    const a = oldItem ? oldItem[k] : undefined;
    const b = newItem ? newItem[k] : undefined;
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return changed;
}

// Monta { label, description } prontos pra gravar no histórico. Nunca
// recebe/usa senha ou hash — a coleção "usuarios" é sempre montada pelo
// chamador (server/index.js) a partir do usuário já "limpo" (sem
// password_hash), então não há como vazar isso por aqui.
export function buildHistoricoDescription({ collection, action, oldItem, newItem }) {
  const meta = ENTITY_META[collection] || { article: "o", noun: collection, labelFields: [] };
  const label = labelForRecord(collection, newItem || oldItem);

  if (action === "create") {
    return { label, description: `criou ${meta.article} ${meta.noun} "${label}"` };
  }
  if (action === "delete") {
    return { label, description: `apagou ${meta.article} ${meta.noun} "${label}"` };
  }

  // update
  const ignore = ["id", "updated_at"];
  const changed = diffChangedFields(oldItem, newItem, ignore);
  if (changed.includes("status")) {
    const de = oldItem?.status ?? "—";
    const para = newItem?.status ?? "—";
    return { label, description: `mudou "${label}" de ${de} → ${para}` };
  }
  if (changed.length === 0) {
    return { label, description: `editou ${meta.article} ${meta.noun} "${label}"` };
  }
  const campos = changed.slice(0, 3).map(fieldLabel).join(", ");
  return { label, description: `editou ${meta.article} ${meta.noun} "${label}" (${campos})` };
}

export function addHistoricoEntry({ userId, userName, action, collection, entityId, label, description }) {
  const id = uid();
  const timestamp = new Date().toISOString();
  db.prepare(
    `INSERT INTO historico (id, timestamp, user_id, user_name, action, collection, entity_id, label, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, timestamp, userId || null, userName || "", action, collection, entityId || null, label || "", description);
  return { id, timestamp, userId: userId || null, userName: userName || "", action, collection, entityId: entityId || null, label: label || "", description };
}

function parseHistoricoRow(r) {
  return {
    id: r.id,
    timestamp: r.timestamp,
    userId: r.user_id,
    userName: r.user_name,
    action: r.action,
    collection: r.collection,
    entityId: r.entity_id,
    label: r.label,
    description: r.description,
  };
}

export function listHistorico({ limit = 200, collection, userId, search, dataInicio, dataFim } = {}) {
  const clauses = [];
  const params = [];
  if (collection) {
    clauses.push("collection = ?");
    params.push(collection);
  }
  if (userId) {
    clauses.push("user_id = ?");
    params.push(userId);
  }
  if (search && String(search).trim()) {
    clauses.push("(description LIKE ? OR label LIKE ? OR user_name LIKE ?)");
    const like = `%${String(search).trim()}%`;
    params.push(like, like, like);
  }
  if (dataInicio) {
    clauses.push("timestamp >= ?");
    params.push(`${dataInicio}T00:00:00.000Z`);
  }
  if (dataFim) {
    clauses.push("timestamp <= ?");
    params.push(`${dataFim}T23:59:59.999Z`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const rows = db.prepare(`SELECT * FROM historico ${where} ORDER BY timestamp DESC LIMIT ?`).all(...params, lim);
  return rows.map(parseHistoricoRow);
}

// Apaga entradas de histórico com mais de 180 dias — evita a tabela crescer
// pra sempre. Roda no início do servidor e periodicamente (ver index.js),
// mesmo padrão de pruneEspelhosVencidos.
const HISTORICO_RETENCAO_DIAS = 180;

export function pruneHistoricoAntigo() {
  const limite = new Date();
  limite.setDate(limite.getDate() - HISTORICO_RETENCAO_DIAS);
  const result = db.prepare(`DELETE FROM historico WHERE timestamp < ?`).run(limite.toISOString());
  return result.changes;
}
