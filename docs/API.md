# API e modelo de dados (back-end)

O back-end é um servidor Express (`server/index.js`) com banco SQLite via
`better-sqlite3` (`server/db.js`) e um WebSocket para sincronização em tempo
real (`server/realtime.js`). Tudo roda num processo Node só — não há
microsserviços nem banco separado.

Ver também: [ARQUITETURA.md](./ARQUITETURA.md) (organização do front-end) e
[FUNCIONALIDADES.md](./FUNCIONALIDADES.md) (o que cada aba faz).

## Autenticação

- Login por usuário/senha (`bcryptjs` para o hash da senha).
- Sessão via **JWT assinado**, guardado num **cookie httpOnly** chamado
  `controle_tv_token` (não é acessível por JavaScript no navegador, só
  enviado automaticamente pelo navegador em cada requisição).
- O segredo usado para assinar o JWT é gerado sozinho na primeira execução e
  salvo num arquivo `.jwt-secret` ao lado do banco (mesma pasta de
  `DB_PATH`) — assim sobrevive a reinícios do container, mas fixo por
  instalação. Pode ser definido manualmente com a variável de ambiente
  `JWT_SECRET`.
- Sessão dura **12 horas** (`TOKEN_TTL` / `COOKIE_MAX_AGE_MS` em
  `server/auth.js`), depois disso pede login de novo.
- Em produção atrás de HTTPS, a variável `COOKIE_SECURE=true` marca o cookie
  como `secure` (só trafega criptografado).
- Se a sessão expirar ou for inválida, qualquer chamada à API volta `401` —
  o front-end (`api/client.js`) detecta isso e derruba o usuário de volta
  para a tela de login automaticamente.

### Rotas de autenticação
| Rota | Descrição |
|---|---|
| `POST /api/auth/login` | `{ username, password }` → seta o cookie e devolve o usuário. Erro `401` traz `{ error, restantes }` (`restantes` = tentativas até o bloqueio; o texto só avisa a partir da 3ª). Erro **`429`** = bloqueado por 15 min após 5 senhas erradas do mesmo usuário+IP (ou 50 do mesmo IP): `{ error, bloqueadoAte (ISO), segundos }` e cabeçalho `Retry-After`. Ver `server/loginGuard.js` |
| `POST /api/auth/logout` | Limpa o cookie |
| `GET /api/auth/me` | Devolve o usuário logado atual (usado para checar se já existe sessão válida ao abrir o app) |

### Segurança

- Todo acesso ao banco usa consultas parametrizadas do `better-sqlite3`
  (`db.prepare(sql).get/all/run(...params)`) — valores vindos do usuário
  nunca são concatenados na string do SQL, então não há injeção de SQL
  possível pelos campos normais (login, busca, criação de registros, chat
  etc). Testado manualmente com os payloads clássicos (`' OR '1'='1`,
  `'; DROP TABLE ...`, `UNION SELECT`, etc) em várias rotas — todos
  bloqueados corretamente.
- A única exceção onde o SQL precisa de interpolação de texto é o **nome da
  coleção/tabela** (não dá pra parametrizar nome de coluna/tabela em SQL).
  Isso é protegido por uma whitelist fixa de coleções válidas, checada pelo
  middleware `checkCollection` antes de qualquer rota dinâmica
  (`/api/:collection/...`) rodar — um nome de coleção malicioso ou
  inexistente é barrado com `404` antes de chegar perto do banco.
- `POST /api/auth/login` e `POST /api/users` validam que `username` e
  `password` são realmente strings (não array, objeto, número, etc) antes de
  processar — evita um erro de tipo que derrubava a requisição com `500`.
- Existe um middleware global de tratamento de erros (`app.use((err, req,
  res, next) => ...)`, registrado por último em `server/index.js`), que
  captura qualquer exceção não tratada em qualquer rota e responde com um
  `500` genérico (`{"error":"Erro interno do servidor"}`) em vez de deixar o
  Express expor o stack trace completo (caminhos de arquivo internos do
  servidor) pro cliente. O erro real ainda é logado no console do servidor
  para depuração.

## Usuários e permissões (somente admin)

Cada usuário tem `role` (`"admin"` ou `"user"`) e um objeto `permissions`
com uma entrada por coleção: `"none"` (sem acesso), `"view"` (só leitura) ou
`"edit"` (acesso completo). Administrador ignora `permissions` — sempre tem
acesso total. Existe também `permissions.atribuirTarefas` (booleano), que
não é uma coleção, mas controla se o usuário pode atribuir tarefas de TO-DO
a outras pessoas.

| Rota | Descrição |
|---|---|
| `GET /api/users` | Lista todos os usuários (admin only) |
| `GET /api/users/assignable` | Lista enxuta (id + nome) de quem pode receber uma tarefa atribuída — liberado a qualquer usuário com a permissão `atribuirTarefas`, não só admin |
| `POST /api/users` | Cria usuário — `{ username, password, role, permissions, nomeCompleto }` |
| `PUT /api/users/:id` | Atualiza — não deixa rebaixar o último admin restante |
| `DELETE /api/users/:id` | Exclui — não deixa excluir a si mesmo nem o último admin |
| `POST /api/users/:id/foto` | Define a foto de perfil do usuário — `multipart/form-data`, campo `foto` (imagem JPEG/PNG/GIF/WEBP, até 5MB). Apaga a foto anterior do disco, se houver |
| `DELETE /api/users/:id/foto` | Remove a foto de perfil do usuário (volta a mostrar o círculo com a inicial) |

Proteções aplicadas no servidor (não só escondidas na tela): não dá para
rebaixar ou excluir o único administrador restante, e quem não é admin não
consegue atribuir uma tarefa a um administrador mesmo chamando a API
diretamente.

## Coleções genéricas

A maior parte dos dados do sistema segue o mesmo padrão de rotas. A lista de
coleções válidas é `COLLECTIONS` em `server/db.js`:

```
materias, contasPagar, contasReceber, colaboradores, contatos,
clientesFornecedores, entrevistados, opec, programas, espelho, atalhos
```

(hoje o nome de cada coleção bate com o rótulo do menu — ver a tabela de
correspondência em [ARQUITETURA.md](./ARQUITETURA.md) pra detalhes e
histórico.)

| Rota | Nível de permissão exigido | Descrição |
|---|---|---|
| `GET /api/:collection` | `view` ou `edit` | Lista todos os itens da coleção |
| `POST /api/:collection` | `edit` | Cria um item |
| `PUT /api/:collection/:id` | `edit` | Atualiza um item |
| `DELETE /api/:collection/:id` | `edit` | Exclui um item |

Toda leitura da coleção `espelho` primeiro roda uma limpeza (apaga espelhos
criados há mais dias do que o prazo configurado, padrão 30 — `pruneEspelhosVencidos()`;
a contagem é a partir da CRIAÇÃO, não da veiculação). O servidor grava sozinho o
campo `criadoEm` (ISO) ao criar e o preserva nas edições; qualquer `criadoEm` enviado
pelo cliente é ignorado. Espelhos antigos sem `criadoEm` ganham um, tirado da última gravação.

Toda leitura da coleção `entrevistados` primeiro roda `pruneEntrevistadosVencidos()`
(inativa, sem apagar, entrevistas cuja data já passou) e registra cada
inativação no Histórico atribuída a um usuário sintético `Sistema`
(`userId: null`), não ao usuário que disparou a requisição — ver seção
Histórico abaixo.

## Rotas específicas (não são "coleções" genéricas)

Essas não usam o sistema de permissão por coleção — têm regra própria:

| Rota | Regra de acesso | Descrição |
|---|---|---|
| `GET/POST/PUT/DELETE /api/todos` e `/api/todos/:id` | Qualquer usuário autenticado, mas só mexe nas próprias tarefas (ou nas que atribuiu); admin vê/mexe em tudo | To-do pessoal |
| `GET/POST/PUT/DELETE /api/espelho-modelos` e `/:id` | Mesma permissão da coleção `espelho` (`view` para ler, `edit` para escrever) | Modelos reutilizáveis do Espelho (MERCHAN, TEMPO...) |
| `GET /api/backup/export` | Admin | Baixa um `.json` com tudo (coleções + usuários com hash de senha + todos) |
| `POST /api/backup/restore` | Admin | Substitui todos os dados pelos do `.json` enviado (transação — ou tudo aplica, ou nada muda) |
| `GET/PUT /api/backup/config` | Admin | Configuração do backup automático por e-mail |
| `POST /api/backup/send-test` | Admin | Dispara um envio de teste imediato |
| `GET /api/historico` | Admin | Lista eventos de auditoria (ver seção própria abaixo) |

## Chat

Não usa o sistema de permissão por coleção — qualquer usuário autenticado
fala com qualquer outro (ver `server/chat.js`). A única regra de acesso é
"participa dessa conversa?", checada em cada rota que mexe numa conversa
específica.

| Rota | Descrição |
|---|---|
| `GET /api/chat/usuarios` | Lista todo mundo, exceto quem está pedindo (`{id, username, displayName}`) — usado pra escolher com quem iniciar uma conversa |
| `GET /api/chat/online` | Lista de ids de quem está com o sistema aberto agora (pra pintar a "bolinha verde" ao abrir a tela) |
| `GET /api/chat/nao-lidas` | `{ total }` — soma de mensagens não lidas em todas as conversas de quem está pedindo |
| `GET /api/chat/conversas` | Lista as conversas de quem está pedindo, com `ultimaMensagem` e `naoLidas` já calculados, ordenadas pela mais recente |
| `POST /api/chat/conversas` | Cria (ou reabre, se já existir) uma conversa. Corpo `{ userId }` para privada, ou `{ tipo: "grupo", nome, participantes: [...] }` para grupo (precisa de pelo menos 1 participante além de quem cria) |
| `PUT /api/chat/conversas/:id` | Renomeia um grupo. Corpo `{ nome }`. Só funciona em grupo, e só quem participa pode |
| `DELETE /api/chat/conversas/:id` | Apaga o grupo inteiro (conversa + mensagens + anexos). Só funciona em grupo, e só **quem criou** o grupo pode — diferente das outras ações de grupo, liberadas a qualquer participante |
| `POST /api/chat/conversas/:id/foto` | Define a foto de um grupo — `multipart/form-data`, campo `foto` (imagem JPEG/PNG/GIF/WEBP, até 5MB). Só funciona em grupo; qualquer participante pode (mesma regra de renomear). Apaga a foto anterior do disco, se houver |
| `DELETE /api/chat/conversas/:id/foto` | Remove a foto de um grupo |
| `POST /api/chat/conversas/:id/participantes` | Adiciona gente a um grupo. Corpo `{ userIds: [...] }` |
| `DELETE /api/chat/conversas/:id/participantes/:userId` | Remove alguém do grupo (ou a própria pessoa, pra "sair"). Recusa se sobrar menos de 2 participantes |
| `GET /api/chat/conversas/:id/mensagens` | Lista mensagens da conversa, mais antigas primeiro. Query params: `limit` (padrão 50, máx. 200), `before` (ISO — pagina pra trás, pega mensagens antes dessa data) |
| `POST /api/chat/conversas/:id/mensagens` | Manda uma mensagem. `Content-Type: application/json` com `{ texto, respostaA }`, ou `multipart/form-data` com campos `texto` (opcional), `arquivo` (opcional), `respostaA` (opcional) e `anexoDuracao` (opcional, segundos — só vale pra áudio; vira `anexo.duracaoSeg`, que o player usa porque gravações do navegador não trazem a duração no arquivo) — precisa de pelo menos um entre texto e arquivo. `respostaA` é o `id` de uma mensagem **da mesma conversa** que esta responde; o servidor grava na mensagem um resumo dela em `respostaA: { id, autorId, autorNome, texto (até 140 caracteres), anexoNome, anexoTipo }` (cópia — continua valendo se a original for apagada); id de outra conversa é ignorado. Toda mensagem também tem `reacoes: { [userId]: emoji }` |
| `PUT /api/chat/conversas/:id/mensagens/:mensagemId/reacao` | Reage a uma mensagem. Corpo `{ emoji }`. Cada pessoa tem no máximo 1 reação por mensagem: outro emoji troca, o mesmo emoji (ou vazio) tira. Responde `{ conversaId, mensagemId, reacoes }`; só participantes; emoji com mais de 16 caracteres → 400 |
| `DELETE /api/chat/conversas/:id/mensagens/:mensagemId` | Apaga uma mensagem — só quem escreveu pode |
| `PUT /api/chat/conversas/:id/lida` | Marca a conversa como lida até agora, pra quem está pedindo |
| `GET /api/chat/limites` | Limites vigentes dos anexos: `{ anexoMaxMb, retencaoDias, quotaGb }` (a tela usa pra mostrar o aviso certo) |
| `GET /api/chat/anexos/:arquivo` | Baixa um anexo pelo nome salvo no servidor — só libera se quem está pedindo participa de alguma conversa onde aquele arquivo foi anexado |
| `GET /api/avatars/:arquivo` | Serve uma foto de perfil (usuário) ou de grupo pelo nome salvo no servidor — ao contrário do anexo acima, não checa participação em conversa nenhuma: basta estar logado (`requireAuth`), igual já vale pra ver o nome de qualquer pessoa do sistema |

Anexos aceitos: imagens (jpeg/png/gif/webp), PDF, Word (`.doc`/`.docx`),
Excel (`.xls`/`.xlsx`), CSV, texto puro, vídeo (mp4, webm, mov, mkv, avi,
mpeg, 3gp) e áudio (webm, ogg, mp4/m4a, mp3, aac, wav, 3gp, opus, flac) — até **200MB** por arquivo (acima disso a API responde `413` com a
orientação de mandar por link). Ficam salvos fora da pasta da aplicação (ver
`UPLOADS_DIR` em `server/chat.js`), pra sobreviver a um
`docker compose up -d --build`.

**Retenção**: todo anexo é apagado do disco **14 dias** depois de enviado, e
a pasta de anexos tem um **teto de 20GB** (passou, os anexos mais antigos são
apagados primeiro, até voltar a 90% do teto). A mensagem continua na conversa,
com `anexo.expirado: true` (e `expiradoMotivo`: `"prazo"` ou `"teto"`) no lugar
do arquivo — `anexo.arquivo` vira `null`, e o download desse nome responde
`404`. Os três valores mudam pela tela Configurações → Chat (`PUT /api/chat/limites`, ver mais abaixo); as variáveis `ANEXO_MAX_MB`, `ANEXO_RETENCAO_DIAS` e `ANEXOS_QUOTA_GB` só definem o padrão. Apagar a
mensagem também apaga o arquivo do disco.

Tempo real: `chat-mensagem`, `chat-mensagem-apagada`, `chat-mensagem-reacao` (`{conversaId, mensagemId, reacoes}`, vai pra todos os participantes, inclusive quem reagiu), `chat-conversa-criada`
e `chat-conversa-atualizada` avisam só os participantes da conversa em
questão (via `notifyUsers`, nunca quem fez a própria ação). `chat-presence`
(`{userId, online}`) avisa todo mundo conectado sempre que alguém fica
online/offline. `chat-typing` (`{conversaId, userId}`) é retransmitido pro
servidor quando o cliente manda `{type:"typing", conversaId,
participantes}` pelo próprio WebSocket — não é uma rota HTTP, não fica
salvo no banco. Não há limpeza automática de mensagens antigas — o
histórico do Chat é permanente.

## Histórico / auditoria (somente admin)

Toda operação de criar/editar/excluir feita pelas rotas de coleção genéricas
acima e pelas rotas de usuário (`POST/PUT/DELETE /api/users...`) grava
automaticamente um evento na tabela `historico` (`server/db.js`) — não existe
gravação manual por feature, é um único ponto (`registrarHistorico()` em
`server/index.js`) chamado depois de cada operação bem-sucedida. Leitura
(`GET`) nunca gera evento, só create/update/delete.

Cada evento guarda: `timestamp` (ISO), `userId`/`userName` (de quem fez a
ação), `action` (`"create" | "update" | "delete"`), `collection`, `entityId`,
`label` (nome amigável do registro, ex: título da matéria ou razão social do
cliente — ver `ENTITY_META` em `server/db.js`) e `description` (frase pronta
em português). Para `update`, a descrição é gerada comparando campo a campo
o registro antes/depois: se o campo `status` mudou, usa o formato
`mudou "X" de A → B`; senão, um genérico `editou o/a <tipo> "X"` (citando os
campos alterados quando dá). **O histórico nunca persiste o registro
inteiro** (antes ou depois) — só o rótulo e a descrição já prontos —,
propositalmente para nunca correr risco de gravar senha/hash de usuário.

Nem todo evento vem de uma ação manual de um usuário: rotinas automáticas do
servidor (hoje, só a inativação de entrevistados vencidos —
`pruneEntrevistadosELog()`) também gravam no Histórico, mas com
`userId: null` e `userName: "Sistema"` em vez do usuário real, exatamente
pra deixar claro na auditoria que ninguém "clicou" naquilo — foi automático.
`user_id`/`user_name` na tabela `historico` são colunas de texto livres, sem
chave estrangeira, então aceitam esse valor sintético sem problema. Só não
dá pra filtrar esses eventos pelo dropdown de usuário na tela (que lista só
usuários reais); dá pra achar pela busca por texto ("Sistema") ou olhando a
coluna direto.

| Rota | Descrição |
|---|---|
| `GET /api/historico` | Lista eventos, mais recentes primeiro. Aceita query params: `limit` (padrão 200, máx. 1000), `collection`, `userId`, `search` (procura em descrição/rótulo/usuário), `dataInicio`, `dataFim` (`YYYY-MM-DD`) |

Limpeza automática: eventos com mais de 180 dias são apagados por
`pruneHistoricoAntigo()` (`server/db.js`), chamada no início do servidor e
depois a cada 24h (mesmo padrão de `pruneEspelhosVencidos`, ver
`server/index.js`).

Tempo real: cada gravação nova dispara `notifyAdmins({ type:
"historico-created", payload: entry })`, para os admins conectados
atualizarem a tela sozinhos sem precisar recarregar.

## Modelo de dados

Cada coleção é uma tabela SQLite bem simples — **um blob JSON por linha**, não
colunas separadas por campo:

```sql
CREATE TABLE <colecao> (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,              -- o registro inteiro, serializado em JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

Isso quer dizer que **adicionar um campo novo em um formulário não exige
nenhuma migração de banco** — o novo campo simplesmente passa a existir
dentro do JSON dos registros criados depois (registros antigos não têm o
campo até serem salvos de novo; o front-end trata isso com valores padrão,
ex: `item.campo || ""`).

A tabela `users` é a exceção — tem colunas de verdade
(`id, username, password_hash, role, permissions, nome_completo, foto,
created_at`), porque precisa de índice único em `username` e de comparação
de senha no login. `permissions` também é guardado como texto JSON dentro
dessa tabela. `foto` guarda só o nome do arquivo salvo em `AVATARS_DIR`
(ou `NULL`), igual o campo `foto` de um grupo guarda dentro do JSON da
tabela `conversas` (essa, sim, segue o padrão de blob JSON — ver seção
"Chat" acima).

Tabelas auxiliares fora de `COLLECTIONS` (criadas por outros módulos, não por
`db.js`): `todos` (`server/todos.js`), `espelho_modelos`
(`server/espelhoModelos.js`) e `backup_config` (`server/backup.js`) — mesmo
padrão de blob JSON, exceto `backup_config`, que tem colunas próprias (inclui `ultimo_erro`/`ultimo_erro_em`, devolvidos como `ultimoErro`/`ultimoErroEm` em `GET /api/backup/config`, que também devolve `proximo` e `historico` — os últimos envios da tabela `backup_envios`, guardados até 50). `GET /api/backup/resumo` (admin) devolve `{contagens:[{rotulo,n}]}` do que existe hoje, usado pela tela de restauração para comparar com o arquivo
(frequência, dia da semana, horário, e-mail de destino, último envio).

A tabela `historico` (criada em `server/db.js`, junto com `users`) também
foge do padrão de blob JSON — tem colunas próprias (`timestamp`, `user_id`,
`user_name`, `action`, `collection`, `entity_id`, `label`, `description`),
porque só guarda o resumo do evento, nunca o registro inteiro. Ver seção
própria acima.

### Geração de id e rotinas automáticas do servidor
- Ids são strings tipo `"<timestamp em base36>-<sufixo aleatório>"` (função
  `uid()`, repetida em `server/db.js`, `server/todos.js` e
  `server/espelhoModelos.js` — cada arquivo tem sua própria cópia).
- Ao subir pela primeira vez com o banco vazio, o servidor semeia (uma única
  vez) alguns registros de exemplo em cada coleção (`seedIfEmpty()`) e cria o
  usuário admin padrão (`seedAdminIfEmpty()`, usuário `admin`, senha
  `admin123`). Depois disso nunca mais volta a semear, mesmo que o usuário
  apague tudo de uma coleção.
- A cada início do servidor, e depois a cada 24h, roda `replenishContaFixa()`
  — mantém sempre ~6 meses de lançamentos futuros gerados para cada série de
  "conta fixa" ativa em Contas a pagar.
- A cada início do servidor, e depois a cada 30min, roda
  `pruneEspelhosELog()` (usa `pruneEspelhosVencidos()`) — apaga espelhos criados
  há mais dias do que o prazo de Configurações → Espelho (padrão 30) e avisa
  as telas abertas pra sumirem da lista.
- A cada início do servidor, e depois a cada 30min, roda
  `pruneEntrevistadosELog()` — chama `pruneEntrevistadosVencidos()` (inativa
  entrevistados vencidos, sem apagar) e registra cada inativação no
  Histórico como ação do usuário sintético `Sistema`, além de avisar os
  clientes conectados via WebSocket (`broadcastChange`).

## WebSocket (tempo real)

Endpoint: `ws(s)://<host>/ws` (protocolo escolhido pelo front-end conforme a
página estar em `http` ou `https`). Autenticado pelo mesmo cookie de sessão
usado pela API (lido diretamente do header `Cookie` da conexão) — uma
conexão sem cookie válido é recusada (`ws.close(4001, "unauthorized")`).

**Mensagem `hello`**: toda conexão nova recebe `{ type: "hello", buildId }`.
O `buildId` é um valor aleatório gerado uma vez quando o processo do
servidor sobe. O front-end guarda o `buildId` que já viu; se receber um
`hello` com um `buildId` diferente do anterior, entende que o servidor
reiniciou com código novo (ex: depois de `docker compose up -d --build`) e
recarrega a página sozinho — é assim que a "atualização automática após
deploy" funciona, sem precisar avisar cada usuário manualmente.

**Eventos de mudança em uma coleção**, enviados só para quem tem permissão
de ver aquela coleção (`canView`, verificado a cada envio, não só na hora da
conexão — então uma mudança de permissão feita pelo admin já se aplica na
próxima mensagem, sem precisar reconectar):

```json
{ "type": "created" | "updated" | "deleted", "collection": "materias", "payload": {...}, "actorId": "<id de quem fez a mudança, ou null>" }
```

`actorId` existe para quem recebeu o evento saber se foi ele mesmo quem fez
a mudança (evita duplicar no estado local e evita notificar a própria pessoa
sobre a própria ação).

**Outros tipos de mensagem, enviados a alvos específicos** (não por
coleção):
- `{ type: "todo-created", payload }` — enviado a quem a tarefa foi
  atribuída (se não foi para si mesmo) e a todos os outros administradores
  conectados (exceto quem criou). Front-end mostra uma notificação do
  navegador com esse aviso.
- `{ type: "todo-completed", payload }` — enviado só a quem atribuiu a
  tarefa a outra pessoa, quando ela é marcada como concluída (nunca a quem
  concluiu). `payload` é a tarefa com o campo extra `concluidaPor` (nome de
  quem concluiu). Front-end mostra a notificação "Tarefa concluída" e marca
  a tarefa como concluída na lista aberta.
- `{ type: "account-updated" }` — enviado a um usuário específico quando o
  admin edita a conta dele (permissões, senha etc.); front-end recarrega
  `/api/auth/me` para refletir a mudança na hora, sem precisar deslogar.
- `{ type: "account-deleted" }` — enviado a um usuário cuja conta foi
  excluída; front-end faz logout automático.
- `{ type: "chat-mensagem", payload }` / `{ type: "chat-mensagem-apagada", payload: {conversaId, mensagemId} }` /
  `{ type: "chat-conversa-criada", payload }` / `{ type: "chat-conversa-atualizada", payload }` —
  só para os participantes da conversa em questão (nunca para quem fez a
  própria ação). Ver seção "Chat" acima. `chat-mensagem` é o único desses
  que exclui o autor — é por causa dessa exclusão que o front-end usa esse
  mesmo evento pra decidir quando tocar o sinal sonoro de mensagem nova
  (ver "Sinal sonoro de mensagem nova" em `docs/ARQUITETURA.md`).
- `{ type: "chat-grupo-apagado", payload: {conversaId} }` — para todos os
  participantes de um grupo (**inclusive** quem apagou, ao contrário de
  `chat-mensagem`), quando quem criou o grupo o apaga de vez.
- `{ type: "chat-presence", userId, online }` — para **todos** os
  conectados, sem filtro de permissão, sempre que alguém fica online ou
  offline (só na primeira conexão/última desconexão da pessoa, não em cada
  aba aberta).
- `{ type: "chat-typing", conversaId, userId }` — retransmitido só para os
  outros participantes de `conversaId`, quando algum deles manda `{ type:
  "typing", conversaId, participantes }` para o servidor pelo mesmo
  WebSocket (único caso hoje em que o cliente manda mensagem para o
  servidor por essa conexão, não só recebe).

**Ping/pong**: o servidor manda `ping` a cada 30s e derruba conexões que não
responderem (`ws.isAlive`) — detecta conexões mortas e mantém vivas as que
estão atrás de proxies que fecham conexões ociosas. O front-end reconecta
sozinho (com 3s de espera) se a conexão cair por qualquer motivo.

## Front-end: onde cada coisa é chamada (`client/src/api/`)

| Arquivo | Cobre |
|---|---|
| `client.js` | Base (`apiFetch`, tratamento de 401) + CRUD genérico das coleções + `loadAllData` + `avatarUrl()` (monta a URL de `GET /api/avatars/:arquivo`) |
| `auth.js` | Login, logout, `/auth/me` |
| `users.js` | CRUD de usuários + lista "assignable" + upload/remoção da foto de perfil |
| `todos.js` | CRUD do TO-DO |
| `chat.js` | Usuários, conversas (inclusive foto de grupo), mensagens, anexos e marcação de lida do Chat |
| `espelhoModelos.js` | CRUD dos modelos do Espelho |
| `backup.js` | Config, teste e restauração de backup (o download em si é um link direto para `GET /api/backup/export`, não passa por `fetch`) |

## Configurações (admin)
- `GET /api/backup/smtp` → `{host, port, usuario, remetente, senhaDefinida, origemAtiva}` (`origemAtiva`: `"painel"`, `"servidor"` ou `null`); **a senha nunca é devolvida**.
- `PUT /api/backup/smtp` `{host, port, usuario, senha?, remetente?}` — `senha` vazia mantém a atual (obrigatória na primeira vez).
- `DELETE /api/backup/smtp` — apaga os dados salvos na tela (volta a valer o `docker-compose.yml`, se houver).
- `GET /api/chat/armazenamento` → `{conversas, mensagens, anexosArquivos, anexosBytes, bancoBytes, quotaGB, retencaoDias, maxMB}`.
- `PUT /api/chat/limites` (admin) `{maxMB, retencaoDias, quotaGB}` — salva as regras dos anexos (faixas: 1–1000 MB, 1–365 dias, 1–2000 GB), roda a limpeza e devolve o mesmo corpo de `GET /api/chat/armazenamento` (que agora inclui `padroes`).
- `DELETE /api/chat/limites` (admin) — volta aos padrões (variáveis `ANEXO_MAX_MB`, `ANEXO_RETENCAO_DIAS`, `ANEXOS_QUOTA_GB`).
- `GET /api/espelho/vistos` (quem vê o Espelho) — `{desde, ids, vistoEm}`: espelhos que EU já abri (`vistoEm` = quando, ISO) e a data a partir da qual valem como "novos". Comparado com `alteradoEm` do espelho dá o "Atualizado". Cria a data de partida na primeira chamada.
- `POST /api/espelho/vistos/:id` — marca um espelho como visto por mim (renova `vistoEm`). `PUT /api/espelho/:id` preenche sozinho `alteradoEm`, `alteradoPorId`, `alteradoPorNome` e `alteracao` quando algo mudou (valores enviados pelo cliente são ignorados). `POST /api/espelho/vistos` — marca todos.
- `GET /api/espelho/config` (qualquer usuário logado) — `{retencaoDias, padrao, faixa}`: por quantos dias um espelho fica salvo, contados da criação (padrão 30, faixa 1–365).
- `GET /api/espelho/config/simular?dias=N` (admin) — `{dias, apagariam}`: quantos espelhos salvos seriam apagados com um prazo de N dias (a tela usa pra avisar antes de diminuir).
- `PUT /api/espelho/config` (admin) `{retencaoDias}` — inteiro de 1 a 365; salva, apaga já os que passaram do novo prazo e devolve `{retencaoDias, padrao, faixa, apagados}`. Avisa todos por WebSocket (`espelho-config`).
- `DELETE /api/espelho/config` (admin) — volta ao padrão (30 dias).
- `GET /api/config/fuso` (qualquer usuário logado) — `{fuso, padrao, agora}`: fuso horário do sistema (nome IANA, ex.: `America/Sao_Paulo`), o padrão e a hora do servidor (ISO).
- `PUT /api/config/fuso` (admin) `{fuso}` — valida o nome, grava e aplica na hora (`process.env.TZ`); 400 se inválido. Avisa todos por WebSocket (`fuso-config`, `{fuso}`) e os clientes recarregam.
- `DELETE /api/config/fuso` (admin) — volta ao padrão (`TZ` do servidor se válido, senão `America/Sao_Paulo`).
- `GET /api/config/redes` (qualquer usuário logado) — `{redes, padrao}`: nomes das redes sociais dos botões de publicação.
- `PUT /api/config/redes` (admin) `{redes:[...]}` — troca a lista (nomes únicos, até 30 letras, 1 a 20 itens). Avisa todos por WebSocket (`redes-config`).
- `DELETE /api/config/redes` (admin) — volta à lista padrão (YouTube, Instagram, Facebook, TikTok, Site, WhatsApp).
- `GET /api/inicio/layout` (usuário logado) — `{layout}`: o Início personalizado de quem pede (`{v:1, cartoes:[...]}`) ou `null` (arranjo padrão).
- `PUT /api/inicio/layout` `{cartoes:[...]}` — salva o layout da própria pessoa. O servidor valida e limpa (até 60 cartões; tipos `sistema`, `postit`, `links`, `imagem`, `video`; posição/tamanho em grade de 12 colunas; só links http/https; fontes de mídia só do próprio usuário) e apaga arquivos enviados que nenhum cartão usa mais (poupa os com menos de 15 min).
- `DELETE /api/inicio/layout` — volta ao padrão e apaga os arquivos enviados pela pessoa.
- `POST /api/inicio/arquivos` (multipart, campo `arquivo`) — envia foto/vídeo do Início; devolve `{url, tipo}`. Imagem até 15 MB, vídeo até 150 MB.
- `GET /api/inicio/arquivos/:nome` — baixa/streama o arquivo (só o dono; aceita `Range` para vídeo).
- `GET /api/chat/limites` (qualquer usuário) — `{anexoMaxMb, retencaoDias, quotaGb}` com os valores em vigor.
- WebSocket: `{type:"chat-limites", payload:{anexoMaxMb, retencaoDias, quotaGb}}` é enviado a todos os conectados quando o admin salva ou restaura as regras dos anexos (`broadcastAll` em `realtime.js`).

### Bloqueio de login
`POST /api/auth/login` passa por `server/loginGuard.js` (contagem em memória, zera
ao reiniciar). Regras e números em `LIMITE` no topo do arquivo. Ao começar um
bloqueio grava no Histórico uma entrada `action: "seguranca"`, `collection: "usuarios"`
e avisa os admins por WebSocket (`historico-created`). O IP vem de `req.ip`; atrás de
proxy defina `TRUST_PROXY` (número de proxies, `true` ou faixa de IPs).

### Espaço do Início
- `GET /api/inicio/espaco` — `{ quotaBytes, usadoBytes }` do usuário logado.
- `GET /api/config/inicio-espaco` (admin) — `{ quotaGB, padrao, faixa, totalBytes, usuarios:[{usuario,bytes}] }`.
- `PUT /api/config/inicio-espaco` (admin) — corpo `{ quotaGB }` (0,1 a 500). `DELETE` volta ao padrão (1 GB).
- `POST /api/inicio/arquivos` responde **413** quando o envio passaria do espaço do usuário.
