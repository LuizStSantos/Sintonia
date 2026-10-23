# Arquitetura do front-end (client/src)

Este documento explica como o código do front-end (`client/src/`) está organizado
depois da reorganização de um único `App.jsx` gigante (7671 linhas) em vários
arquivos menores, cada um com uma responsabilidade clara.

Ver também: [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) (o que cada aba faz, do
ponto de vista de quem usa) e [API.md](./API.md) (o back-end).

## Visão geral das pastas

```
client/src/
  App.jsx              → componente raiz: login, menu lateral, roteamento entre abas,
                          WebSocket (tempo real), carregamento inicial dos dados
  main.jsx             → ponto de entrada do React (só monta <App /> na página)

  lib/                 → funções puras (sem interface, sem chamada de rede):
                          cálculo, formatação, validação, regras de negócio
  api/                 → funções que conversam com o back-end (fetch), uma por área
  config/               → configuração estática (lista de abas do menu)
  styles/               → CSS único do app inteiro (client/src/styles/index.css)

  components/
    common/             → peças de interface reutilizadas em várias abas
                          (Drawer, Field, tabela, badges, diálogos de confirmação...)
    pickers/             → campos de busca/seleção mais elaborados, ligados a
                          dados de outra coleção (ex: escolher um cliente cadastrado)
    auth/                → tela de login

  features/<área>/       → uma pasta por aba do sistema, com o componente principal
                          daquela aba (ex: features/materias/MateriasTab.jsx) e,
                          quando precisa, componentes auxiliares só dela
                          (ex: os popups do Espelho ficam dentro de features/espelho/)
```

Regra geral: **se um arquivo só é usado dentro de uma aba, ele mora dentro da
pasta daquela aba em `features/`. Se é usado por duas ou mais abas, ele sobe
para `lib/`, `components/common/` ou `components/pickers/`.**

## O que vai em cada pasta

### `lib/` — regras e cálculos, sem tela nenhuma
Arquivos pequenos, cada um focado num assunto. Não importam React nem sabem
desenhar nada na tela — só recebem dados e devolvem outro dado calculado,
formatado ou validado. São os arquivos mais seguros de editar quando a
mudança é "a regra tal está errada" (e não "o campo tal devia ficar em outro
lugar na tela").

| Arquivo | Conteúdo |
|---|---|
| `constants.js` | Cores dos badges (`TONE`), sinalizadores de Matérias (`FLAG_META`), status coloridos de Matérias/Financeiro, tom da modalidade de Entrevistados, nomes dos dias da semana usados no Backup |
| `dates.js` | Formatação de data (ISO → `dd/mm/aaaa`), `todayISO()`, `isOverdue()`, soma de dias, `addMonthsISO()` (soma meses mantendo o dia fixo — usado nos vencimentos de parcelamento/contrato mínimo/conta fixa; se o dia não existir no mês de destino, cai no último dia daquele mês, mas sempre a partir da data-âncora original, nunca acumulando o resultado anterior), nomes de dias da semana por extenso, lista de meses, contagem de quantas vezes um dia da semana ocorre num período (usado no relatório de OPEC) |
| `duration.js` | Tudo relacionado a duração de vídeo/tempo: `mm:ss` ↔ segundos, formato com aspas (`5'55"`) pro teleprompter, e o algoritmo que **distribui os comerciais do OPEC entre as passagens de bloco do Espelho** (LPT — encaixa cada spot inteiro na passagem com menos tempo até agora, sem nunca fatiar um spot) |
| `espelho.js` | Lista de rótulos prontos pro item manual do Espelho, numeração automática dos blocos, cálculo de quantos dias faltam pro espelho expirar |
| `financeiro.js` | Geração de parcelas (`generateInstallments`), contrato mínimo (`generateContratoMinimo`) e conta fixa (`generateContaFixa`) usados em Contas a pagar/receber; `clientDisplayName()` (nome de exibição de empresa) |
| `opec.js` | `isExpiredBreak()` — inserção de OPEC vencida |
| `permissions.js` | Lista das abas com permissão configurável e o texto-resumo mostrado na tabela de Usuários (ex: "Matérias: Editar · OPEC: Visualizar") |
| `programas.js` | Leitura de horário(s) de um programa (compatível com o formato antigo de um único horário) |
| `realtime.js` | Notificação nativa do navegador, aplicação de um evento do WebSocket no estado local (`applyRealtimeEvent`), o "barramento" de eventos em tempo real usado por outras telas (`onRealtimeMessage`/`emitRealtimeMessage`, recebendo) e o seu par pro sentido contrário (`setSocketSend`/`sendRealtimeMessage`, usado pelo Chat pra mandar o aviso de "digitando..." pelo mesmo WebSocket que o `App.jsx` mantém), e o controle da versão do servidor (pra saber quando recarregar a página sozinho) |
| `text.js` | Caixa alta com acento preservado, `primeirosDoisNomes()` |
| `todoPendentes.js` | Contagem de tarefas não concluídas do menu + controle (localStorage) de quais tarefas já geraram notificação |
| `todoPriority.js` | Rótulos e ordem de prioridade do TO-DO, `isPrazoAtrasado()` |
| `validators.js` | `uid()` (gerador de id), `formatBRL()`, máscara e validação de CPF/CNPJ/telefone/email |
| `veiculacao.js` | Normalização e formatação das datas de veiculação de uma matéria (`{ data, local }`) |

### `api/` — conversa com o back-end
Cada arquivo cobre uma área da API (uma função por rota). Nenhum tem lógica de
tela — só monta a chamada `fetch`, trata erro e devolve o JSON.

- `client.js` — a base: `apiFetch` (injeta cookie de sessão e trata 401),
  `apiList/apiCreate/apiUpdate/apiDelete` genéricos para as coleções normais
  (`COLLECTIONS`), e `loadAllData()` que carrega tudo de uma vez no login.
- `auth.js` — login, logout, "quem sou eu".
- `users.js` — CRUD de usuários e a lista enxuta de "quem pode receber uma
  tarefa atribuída" (`/api/users/assignable`).
- `todos.js` — CRUD do TO-DO.
- `espelhoModelos.js` — CRUD dos modelos reutilizáveis do Espelho (MERCHAN, TEMPO...).
- `backup.js` — exportar/restaurar backup, configurar e testar o e-mail automático.
- `backupEmail.js` — monta o e-mail de backup (HTML com estilos inline + versão em texto), tamanho legível, texto de frequência e cálculo do próximo envio.
- `historico.js` — lista de eventos de auditoria (`GET /api/historico`, só admin).
- `chat.js` — tudo do Chat: listar usuários/conversas/mensagens, criar
  conversa privada/grupo, renomear grupo, adicionar/remover participante,
  mandar mensagem (texto e/ou anexo, usa `FormData` quando tem arquivo),
  apagar mensagem, marcar como lida, e `anexoUrl()` (monta a URL de
  download de um anexo a partir do nome salvo no servidor).

### `components/common/` — peças de interface reutilizadas
Componentes visuais genéricos, sem saber nada sobre "matéria" ou "cliente" —
recebem props e desenham. Se você quer mudar **como uma coisa se parece** (e
essa coisa aparece em várias abas), é aqui que mexe.

Principais: `Drawer` (painel lateral de criar/editar), `Field`/`FieldSection`
(campo de formulário com rótulo), `Toolbar` (busca + filtros + botão novo),
`Badge`, `StatCard` (os cartõezinhos de número no topo de cada aba),
`ConfirmDialog`/`InfoDialog`/`ViewDialog` (popups), `ValidatedInput` (campo
com máscara de CPF/CNPJ/telefone/e-mail), `DurationInput`/`IntegerInput`/`MoneyInput`
(`MaskedInputs.jsx` — campos só numéricos: duração m:ss, inteiro e valor em R$;
regras em `lib/masks.js`), `ToggleField`, `WeekdayPicker`,
`FlagPicker`, `PriorityPicker`, `PasswordInput`, `AutoGrowTextarea`, `DateInput` (campo de data com calendário próprio), `Select` (caixa de seleção com lista própria), `SortTh` (cabeçalho de coluna ordenável), `GlobalTooltip` (dicas estilizadas),
`CopyButton`, `LiveClock`, `EmptyRow`, `CancelPickerDialog`.

### `components/pickers/` — campos de busca ligados a outra coleção
Parecidos com os de `common/`, mas cada um sabe buscar dentro de uma coleção
específica (ex: procurar um cliente já cadastrado). Ficam separados de
`common/` porque têm essa dependência de dados, em vez de serem 100% genéricos.

`ClientePicker`, `AgenciaPicker`, `ColaboradorPicker`, `VeiculacaoPicker`,
`HorariosPicker`, `ExtrasEntrevistadoPicker`.

### `components/auth/`
Só a `LoginScreen.jsx` — tela de login (usuário/senha).

### `features/<área>/` — uma pasta por aba
Cada aba do menu tem sua pasta, com o componente que a `App.jsx` importa e
mostra quando essa aba está ativa. Abas simples são um arquivo só; abas mais
complexas (Espelho, Financeiro) têm popups/modais auxiliares na mesma pasta.

| Pasta | Componente principal | Aba no menu |
|---|---|---|
| `materias/` | `MateriasTab.jsx` | Matérias |
| `contatos/` | `ContatosTab.jsx` | Contatos |
| `entrevistados/` | `EntrevistadosTab.jsx` | Entrevistados |
| `programas/` | `ProgramasTab.jsx` | Programas |
| `opec/` | `OpecTab.jsx` | OPEC |
| `espelho/` | `EspelhoTab.jsx` + `EspelhoMateriasModal.jsx`, `EspelhoEntrevistadosModal.jsx`, `EspelhoItemManualModal.jsx` | Espelho |
| `clientesFornecedores/` | `ClientesFornecedoresTab.jsx` | Clientes / Fornecedores |
| `financeiro/` | `ContasAReceberTab.jsx` (Contas a receber) e `ContasAPagarTab.jsx` (Contas a pagar) | Contas a receber / Contas a pagar |
| `relatorios/` | `RelatorioBotao.jsx` (botão "Relatório" das páginas), `RelatorioDialog.jsx` (pop-up com filtros, totais, tabelas e PDF) | Contas a receber / Contas a pagar / OPEC |
| `colaboradores/` | `ColaboradoresTab.jsx` | Colaboradores |
| `atalhos/` | `AtalhosTab.jsx` | Atalhos |
| `configuracoes/` | `ConfiguracoesTab.jsx` + `UsuariosSecao.jsx`, `BackupSecao.jsx`, `HistoricoSecao.jsx`, `PermissionsEditor.jsx`, `SmtpCard.jsx`, `ChatArmazenamento.jsx` | Configurações (Usuários, Backup, Histórico e Chat são seções internas) |
| `todo/` | `TodoTab.jsx`, `TodoNavBadge.jsx` (número de pendentes no menu; lê o mini-estado de `lib/todoPendentes.js`, alimentado pelo `App.jsx` no login/WebSocket e pelo `TodoTab`) | TO-DO |
| `chat/` | `ChatTab.jsx` (aba de tela cheia) + `ChatContext.jsx` (estado compartilhado), `ChatThreadBody.jsx` (lista de mensagens + composer, reaproveitado), `EmojiPicker.jsx` (seletor de emojis do composer), `ReactionPicker.jsx` (reagir a uma mensagem), `GravadorAudio.jsx` + `AudioPlayer.jsx` (áudio), `ChatFloatingWidget.jsx` (balão flutuante), `ChatNavBadge.jsx`, `ChatNovaConversaModal.jsx`, `ChatGrupoModal.jsx` | Chat |

Note o nome real da coleção/aba em cada caso — nem sempre bate com o rótulo
mostrado no menu. Isso importa quando for mexer no código:

| Rótulo no menu | id da aba / coleção no banco | Arquivo |
|---|---|---|
| Matérias | `materias` | `features/materias/MateriasTab.jsx` |
| Espelho | `espelhos` | `features/espelho/EspelhoTab.jsx` |
| Clientes / Fornecedores | `clientesFornecedores` | `features/clientesFornecedores/ClientesFornecedoresTab.jsx` |
| Contas a receber | `contasReceber` | `features/financeiro/ContasAReceberTab.jsx` |
| Contas a pagar | `contasPagar` | `features/financeiro/ContasAPagarTab.jsx` |
| OPEC | `opec` | `features/opec/OpecTab.jsx` |
| Atalhos | `atalhos` | `features/atalhos/AtalhosTab.jsx` |

Hoje o id da coleção, o nome da pasta/arquivo e o rótulo do menu batem em
todos os casos — mas nem sempre foi assim. Em duas rodadas de migração,
seis coleções foram renomeadas pra bater com o rótulo do menu: Contas a
pagar usava `clientes` (nome herdado de quando essa aba se chamava
"Clientes"), OPEC usava `breaks`, Atalhos usava `links`, Matérias usava
`videos`, Clientes usava `clientesCadastro` e Contas a receber usava
`recebiveis`. Isso confundia quem lia o código, então os seis ids foram
migrados pros nomes atuais (e os arquivos/pastas correspondentes
renomeados junto, já que não tinham o mesmo risco de migração de dado —
ver observação no fim desta seção). Fica registrado aqui porque o **id da
coleção não é trivial de trocar** — ele está gravado no
banco (nome da tabela), na chave de permissão de cada usuário
(`permissions.clientes`, `permissions.breaks` etc.) e no histórico
(`historico.collection`) — então renomear exige uma migração, não só um
`find & replace` no código.

#### Como foi feita essa migração (e como fazer outra no futuro)

A migração mora inteira em `server/db.js`, roda sozinha toda vez que o
servidor sobe, e é **idempotente** — ou seja, rodar de novo depois que já
migrou não faz nada (não duplica tabela, não quebra nada). O mecanismo:

1. **Uma lista `RENAME_DE_COLECAO`** no topo do arquivo, com pares `[idAntigo, idNovo]`
   na ordem em que rodam (lista, e não objeto, porque o mesmo id pode aparecer dos dois lados
   em épocas diferentes). Pra fazer uma nova migração no futuro, basta adicionar um par no
   fim (ex: `["clientes", "clientesFornecedores"]`, a última feita: a aba Clientes virou
   Clientes / Fornecedores, e backups antigos com `data.clientes` são traduzidos em
   `server/backup.js`).
2. **Renomeia a tabela**, com um `ALTER TABLE ... RENAME TO ...`, mas só se a
   tabela antiga existir e a nova ainda não existir (é essa checagem que
   torna a migração segura de rodar várias vezes). Isso roda logo no início
   do arquivo, antes da lista `COLLECTIONS` ser montada — importante, porque
   o resto do arquivo já assume que as tabelas têm os nomes novos.
3. **Atualiza `historico.collection`**: qualquer linha do histórico que
   apontava pro id antigo passa a apontar pro novo, senão o Histórico mostra
   registros "órfãos".
4. **Atualiza `permissions` de cada usuário**: o campo `permissions` é um
   JSON (ex: `{"clientes":"edit"}`); a migração lê, troca a chave antiga pela
   nova mantendo o mesmo nível de acesso, e regrava. Sem isso, quem tinha
   permissão na coleção antiga perderia acesso silenciosamente depois do
   deploy.

   **Cuidado ao adicionar uma entrada nova**: os passos 3 e 4 só processam
   os pares que **realmente foram renomeados nesta execução**
   (`migradosNestaExecucao`), nunca o mapa `RENAME_DE_COLECAO` inteiro. Isso
   importa porque um id novo pode coincidir com um id antigo de uma
   migração de outra época — foi exatamente o que aconteceu com "clientes"
   (id antigo de uma migração passada, que virou "contasPagar"; e id novo
   de outra migração, que veio de "clientesCadastro"). Se os passos 3/4
   reaplicassem o mapa inteiro em todo boot, um usuário com permissão na
   coleção "clientes" de verdade seria silenciosamente "remigrado" pra
   "contasPagar" no boot seguinte — um bug real que apareceu e foi corrigido
   durante essa própria migração. Ao adicionar uma entrada nova no mapa,
   não reaproveite um id que já foi usado como origem OU destino em outra
   entrada, e sempre teste rodando a migração duas vezes seguidas (copiar o
   banco, rodar, conferir, rodar nas mesma cópia de novo, conferir que nada
   mudou na segunda vez).
5. **Só depois disso**: qualquer outro lugar do `db.js`/`index.js` que
   mencionava o id antigo (seeds, funções de "vencido"/"atrasado", nomes de
   coluna em queries `FROM`/`INTO`) precisa ser atualizado pro id novo — isso
   não é automático, é busca-e-troca manual no código, mas só depois que o
   banco já foi migrado é que faz sentido trocar.
6. **No front-end**: todo lugar que usa o id da coleção como string literal
   (`client/src/api/client.js`, `config/tabs.js`, `lib/permissions.js`,
   `lib/realtime.js`, e os pontos em `App.jsx` que leem/gravam
   `data.<coleção>`) precisa ser atualizado junto — senão o front pede uma
   coleção que não existe mais.

Importante: o nome do **arquivo/componente** nunca precisou ser gravado em
lugar nenhum (não é como o id da coleção) — é só como o código se organiza.
Então, ao criar ou renomear uma aba, o padrão é manter o nome do
arquivo/componente alinhado ao rótulo do menu, pra quem for mexer no código
não precisar adivinhar "qual arquivo é a aba X".

### `config/tabs.js`
Lista fixa das abas "normais" do menu (id, rótulo, ícone). É consultada tanto
pela `App.jsx` (pra montar o menu e decidir o que cada usuário pode ver, de
acordo com as permissões) quanto indiretamente pelo back-end, que usa os
mesmos ids como nomes de coleção. As abas "TO-DO", "Usuários", "Backup" e
"Histórico" **não** estão nessa lista — são adicionadas à parte na `App.jsx`
porque não seguem o sistema de permissão por coleção (TO-DO é liberado pra
todo mundo; Usuários, Backup e Histórico são só admin).

### `styles/index.css`
Um único arquivo CSS (cerca de 1450 linhas) para o app inteiro — não há
CSS Modules nem styled-components. Classes são globais, nomeadas por
contexto (ex: `.espelho-item`, `.todo-composer`, `.stat-grid`). Ao criar um
componente novo, o padrão é reaproveitar classes já existentes
(`btn-primary`, `btn-ghost`, `icon-btn`, `field-hint`, `drawer-actions`
etc.) em vez de inventar um esquema novo.

## Fluxo geral de dados

1. `App.jsx` carrega todos os dados permitidos ao usuário logo após o login
   (`loadAllData` em `api/client.js`) e guarda tudo num único estado `data`
   (um objeto com uma lista por coleção: `data.materias`, `data.clientes` etc.).
2. Cada `<XxxTab>` recebe a lista da sua coleção e três funções —
   `onCreate`, `onUpdate`, `onDelete` — que a `App.jsx` repassa para
   `api/client.js` e depois atualiza o estado local.
3. Quando outro usuário conectado muda algo, o servidor avisa por WebSocket
   (`server/realtime.js`) e o `App.jsx` aplica a mudança direto no estado
   (`applyRealtimeEvent`, em `lib/realtime.js`) — não recarrega a página.
4. Abas como TO-DO e Usuários não recebem dados prontos da `App.jsx`: elas
   mesmas chamam a API (`api/todos.js`, `api/users.js`) porque não fazem
   parte do carregamento inicial (TO-DO é por usuário; Usuários é só admin).

### Notificações de navegador — como a permissão é respeitada

Toda notificação (aviso de navegador via `Notification`, função
`showBrowserNotification` em `client/src/lib/realtime.js`) nasce de uma
mensagem WebSocket que o servidor manda. A regra de "quem pode ver aquela
coleção" é aplicada **no servidor, antes de mandar a mensagem** — o
cliente nunca recebe um evento de uma coleção que ele não tem permissão de
ver, então não precisa (e não deve) filtrar de novo no front:

- `broadcastChange(collection, type, payload, actorId)` em
  `server/realtime.js` já percorre só os usuários conectados que têm
  `permissions[collection]` como `"view"` ou `"edit"` (ou são admin) —
  usado por qualquer evento genérico de criar/editar/excluir numa coleção
  (matérias, espelhos, contas a receber etc.), e é o que fizemos pra
  "conta atrasada".
- `notifyUser(userId, msg)` avisa uma pessoa específica (ex: quando a
  própria conta dela muda).
- `notifyAdmins(msg, excludeUserId)` avisa só administradores (usado no
  TO-DO — quem recebe é a pessoa atribuída + os admins, nunca quem criou
  — e no Histórico, que é uma tela só de admin).

Pra adicionar uma notificação nova ligada a uma coleção existente, o
padrão é reusar `broadcastChange` com um `type` próprio (ex:
`"conta-atrasada"`) em vez de inventar um canal novo — assim a permissão
já vem de graça. No `client/src/App.jsx`, o handler da mensagem WebSocket
(dentro do `else if (msg.collection)`) é onde entra o `showBrowserNotification`
correspondente.

### Chat — como foi construído

O Chat não é uma coleção com permissão por aba (igual TO-DO/Histórico) —
qualquer usuário autenticado fala com qualquer outro, então a única
checagem de acesso é "essa pessoa participa dessa conversa?", feita em
`server/chat.js`. As rotas (`/api/chat/*`) estão em `server/index.js`,
registradas **antes** das rotas genéricas `/api/:collection` (mesmo motivo
do comentário já existente ali sobre Histórico/Backup/TO-DO: o Express
casa rota por ordem de registro, não por especificidade — se viessem
depois, `/api/:collection/:id` interceptaria `/api/chat/conversas` como se
"chat" fosse o nome de uma coleção).

**Tabelas** (criadas em `server/chat.js`, não em `server/db.js`):
- `conversas` — uma linha por conversa (privada ou grupo), no formato
  genérico `id/data(JSON)/updated_at` usado em outras tabelas pequenas.
  O JSON guarda `tipo` (`"privada"` ou `"grupo"`), `participantes` (lista
  de ids), `nome` (só grupo) e `criadoPor`.
- `mensagens` — ao contrário de `conversas`, tem uma coluna própria
  `conversa_id` (com índice) em vez de guardar isso só dentro do JSON,
  porque a consulta mais comum é "as últimas N mensagens DESSA conversa" e
  isso precisa ser rápido mesmo com histórico grande (o histórico é
  permanente — ver abaixo).
- `conversas_lidas` — chave composta `(conversa_id, user_id)`, guarda
  quando cada pessoa leu cada conversa pela última vez, usada pra calcular
  quantas mensagens "não lidas" tem (comparando `created_at` das mensagens
  com esse timestamp).

**Anexos**: ficam em `UPLOADS_DIR` (exportado por `server/chat.js`), que é
`path.join(path.dirname(dbPath), "uploads")` — ou seja, **ao lado do banco
de dados**, não dentro da pasta da aplicação. Isso importa porque o
`docker-compose.yml` só monta um volume persistente pro banco (`/data`); a
pasta `/app` (onde fica o código) é recriada do zero a cada
`docker compose up -d --build`. Guardar anexo em qualquer lugar dentro de
`/app` faria ele sumir no próximo deploy. O upload em si usa `multer`
(novo pacote em `server/package.json`), com uma lista de tipos permitidos
(imagens comuns, PDF, Word, Excel, CSV, texto — de propósito sem HTML/SVG
nem executável; vídeo liberado) e limite de 200MB por arquivo
(`ANEXO_MAX_MB`). A limpeza fica em `limparAnexos()` / `aplicarTetoDeAnexos()`
(`server/chat.js`, roda ao ligar e de hora em hora): expira anexos com mais de
14 dias (`ANEXO_RETENCAO_DIAS`), apaga arquivos órfãos com mais de 1 dia e
mantém a pasta abaixo de 20GB (`ANEXOS_QUOTA_GB`), sempre apagando os mais
antigos primeiro — a mensagem fica com `anexo.expirado`. O servidor também
sobe o `requestTimeout` do Node pra 30 min, senão upload grande em conexão
lenta era derrubado aos 5 min. O download (`GET /api/chat/anexos/:arquivo`)
confere que quem pediu participa de alguma conversa onde aquele arquivo foi
anexado antes de liberar.

**Tempo real** (`server/realtime.js`): além dos eventos genéricos de
coleção, o Chat tem os próprios tipos de mensagem WebSocket —
`chat-mensagem`, `chat-mensagem-apagada`, `chat-mensagem-reacao`, `chat-conversa-criada`,
`chat-conversa-atualizada`, `chat-grupo-apagado` (`{conversaId}`, quando o
criador apaga o grupo inteiro — ver abaixo; mandados via `notifyUsers`,
uma função que avisa uma lista específica de ids, não uma coleção inteira),
`chat-presence` (`{userId, online}`, mandado pra **todo mundo conectado**,
sem filtro de permissão — faz sentido só no Chat porque lá "quem fala com
quem" não depende de permissão de coleção) e `chat-typing` (`{conversaId,
userId}`, um retransmissor simples: o cliente manda `{type:"typing", ...}`
pro servidor pelo mesmo WebSocket, e o servidor só repassa pros outros
participantes da conversa — não é salvo no banco). O indicador de "digitando"
no cliente usa um canal novo pro sentido **cliente → servidor**
(`sendRealtimeMessage` em `lib/realtime.js`), que antes só existia no
sentido servidor → cliente.

**Grupo sem "dono" — exceto pra apagar**: uma simplificação deliberada —
qualquer participante de um grupo pode renomear, trocar a foto, adicionar
ou remover qualquer outro participante (inclusive a si mesmo, pra "sair").
Um grupo não pode ficar com menos de 2 participantes. A única ação restrita
a quem criou (`conversa.criadoPor`) é apagar o grupo inteiro —
`apagarGrupo()` em `server/chat.js`, rota `DELETE /api/chat/conversas/:id`
— porque, ao contrário de renomear ou trocar a foto, é destrutivo e sem
volta pra todo mundo do grupo de uma vez, então faz sentido restringir a
quem o criou em vez de "qualquer participante". A função apaga as linhas de
`mensagens` e `conversas_lidas` daquela conversa, devolve os nomes dos
arquivos envolvidos (foto do grupo + anexos das mensagens apagadas) pra
`server/index.js` remover do disco (`apagarFotoAntiga` + `fs.unlink` em
`UPLOADS_DIR`, mesmo padrão de limpeza já usado pra foto de perfil) — evita
acumular arquivo órfão quando um grupo inteiro é apagado. O servidor avisa
todo mundo que participava via `chat-grupo-apagado`, e o front-end (tanto
`ChatContext.jsx` recebendo esse evento quanto a própria chamada que
apagou) remove a conversa da lista e fecha qualquer balão flutuante aberto
com ela.

**Histórico permanente**: diferente do Espelho (que expira N dias — padrão 30, ajustável em Configurações → Espelho — depois de criado, por
uma rotina de limpeza automática em `server/db.js`), as mensagens do Chat
não têm nenhuma rotina de expiração — ficam guardadas indefinidamente.

**Front-end: estado compartilhado entre a aba e o balão flutuante**. Além
da aba "Chat" de tela cheia, existe um balão flutuante (estilo Messenger)
que fica visível por cima de qualquer outra aba do sistema — ver
`ChatFloatingWidget.jsx`. Os dois (aba e balão) precisam mostrar a mesma
lista de conversas, as mesmas mensagens chegando em tempo real, etc., sem
duplicar requisições nem ficar dessincronizados. A solução foi tirar todo o
estado do Chat de dentro do `ChatTab.jsx` (que monta/desmonta toda vez que
a pessoa troca de aba) e colocar num React Context (`ChatContext.jsx`),
montado uma vez só, lá em cima, em volta de todo o app autenticado
(`<ChatProvider>` em `App.jsx`) — assim ele continua vivo mesmo trocando de
aba, exatamente como a conexão WebSocket já fazia.

- `ChatContext.jsx` expõe um hook `useChat()` com todo o estado (conversas,
  usuários, quem está online, cache de mensagens por conversa, quem está
  digitando, quais balões estão abertos) e as ações (mandar mensagem, criar
  conversa, etc.). É o único lugar que assina `onRealtimeMessage` para
  eventos de Chat — nem `ChatTab.jsx` nem `ChatFloatingWidget.jsx` escutam
  o WebSocket diretamente.
- `ChatThreadBody.jsx` é a lista de mensagens + composer, usada tanto
  dentro da aba de tela cheia quanto dentro de cada balão flutuante (prop
  `compact` só ajusta o tamanho) — evita ter duas implementações da mesma
  tela de conversa.
- **"Visível" e marcação de lida**: o contexto guarda (numa `ref`, não
  `state`, porque é lido de dentro do handler do WebSocket) o conjunto de
  conversas que a pessoa está "olhando" agora — a aba de tela cheia marca a
  conversa selecionada como visível enquanto está montada (`useEffect` com
  `marcarVisivel`/`desmarcarVisivel` no cleanup), e abrir/minimizar/fechar
  um balão faz a mesma coisa (`abrirPopup`/`minimizarPopup`/`fecharPopup`
  em `ChatContext.jsx`). Uma mensagem que chega para uma conversa "visível"
  marca como lida na hora e não dispara notificação; se não estiver
  visível, soma no contador de não lidas (mostrado tanto no menu lateral,
  via `ChatNavBadge.jsx`, quanto no próprio balão) e dispara a notificação
  do navegador.
- O balão fica escondido enquanto a própria aba Chat de tela cheia está
  ativa (prop `ativo` em `ChatFloatingWidget.jsx`, calculada em `App.jsx`
  como `effectiveActiveTab !== "chat"`) — evitaria mostrar a mesma conversa
  duas vezes ao mesmo tempo.
- No máximo 3 balões abertos ao mesmo tempo (`abrirPopup` em
  `ChatContext.jsx`) — abrir um quarto fecha o mais antigo, do jeito que o
  Messenger também limita.
- **O balão sai do caminho de um formulário**: quando um `Drawer` ou
  `ConfirmDialog` abre em qualquer lugar do app (dentro de `.app-shell`), o
  `.chat-widget-dock` desliza pra fora da tela via CSS puro — regra
  `.app-shell:has(.drawer-overlay, .confirm-overlay) ~ .chat-widget-dock`
  em `client/src/styles/index.css`. É importante que o seletor fique restrito
  a overlays **dentro de `.app-shell`**: tanto `ChatNovaConversaModal.jsx`
  quanto `ChatGrupoModal.jsx` também usam `.drawer-overlay` e também são
  renderizados **dentro do próprio** `.chat-widget-dock` (fluxo de "nova
  conversa"/"gerenciar grupo" do balão) — se a regra não fosse restrita
  assim, o balão se empurraria sozinho ao abrir suas próprias janelinhas, e
  pior: aplicar `transform` num ancestral quebra o `position:fixed` de quem
  está dentro dele (vira um novo "containing block"), então essas duas
  modais perderiam o posicionamento fixo correto.

### Foto de perfil (usuário) e de grupo

Infra de upload separada da de anexo do Chat (ver `AVATARS_DIR` acima),
porque as regras de acesso são diferentes: anexo de mensagem só é liberado
pra quem participa daquela conversa (`arquivoPertenceAUsuario`); já uma
foto de perfil/grupo só precisa estar **logado** pra ver (mesma regra que
já vale pra qualquer nome de usuário, que é visível pra todo mundo).

- **Usuário**: `users.foto` (coluna própria, migração em `server/db.js`
  com o padrão try/catch já usado para `nome_completo`) — só admin troca
  (`POST`/`DELETE /api/users/:id/foto`, mesmo padrão `requireAuth,
  requireAdmin` de todo o resto de `/api/users*`; não existe edição de
  perfil próprio nesta versão).
- **Grupo**: guardado dentro do JSON da linha em `conversas` (campo
  `foto`, sem migração — é uma tabela `data TEXT` genérica), gerenciado por
  `definirFotoGrupo()` em `server/chat.js`. Segue a mesma regra de "qualquer
  participante pode" já usada pra renomear o grupo (`POST`/`DELETE
  /api/chat/conversas/:id/foto`).
- Os dois tipos de upload passam pelo mesmo `multer` (`uploadFoto` em
  `server/index.js`), que só aceita imagem (JPEG/PNG/GIF/WEBP) e limita a
  5MB. A foto anterior é apagada do disco (`apagarFotoAntiga`) assim que a
  nova é salva (ou a foto é removida), pra não acumular arquivo órfão em
  `AVATARS_DIR`.
- **Servir a foto**: `GET /api/avatars/:arquivo` (`requireAuth` só, sem
  checagem de participante — ver comentário acima).
- **Front-end**: um componente único, `components/common/Avatar.jsx`,
  decide o que mostrar (foto, ícone de grupo, ou círculo com a inicial) —
  usado em todo lugar que hoje mostra "quem é" alguém (linhas da lista de
  conversas, cabeçalho da conversa, balão flutuante, modais de
  nova-conversa/gerenciar-grupo, tabela de Usuários). `fotoPorId`/
  `fotoConversa()` em `ChatContext.jsx` (paralelos a `nomePorId`/
  `nomeConversa()`) resolvem qual foto mostrar pra cada conversa. Como a
  lista de usuários do Chat (`usuarios` em `ChatContext.jsx`) só era
  carregada uma vez no início, o contexto agora também escuta o evento
  genérico de coleção `{collection:"users"}` do WebSocket (o mesmo que
  `UsuariosSecao.jsx` já escutava) pra recarregar essa lista sozinho — sem isso,
  trocar a foto de alguém pela tela Usuários (Configurações) não refletiria no Chat de quem
  já estava com a aba aberta, só depois de um F5.

### Sinal sonoro de mensagem nova

`playNotificationSound()` em `client/src/lib/realtime.js` — toca
`client/public/sounds/notificacao.wav` (um áudio estático de ~250ms, servido
direto pelo Vite a partir de `public/`, sem passar pelo build/bundler).
Chamado dentro de `ChatContext.jsx`, no mesmo handler que já processa o
tipo de mensagem WebSocket `chat-mensagem`.

**Por que toca sempre, mesmo com a conversa aberta na tela**: o servidor já
exclui o autor da lista de quem recebe esse evento (`notifyUsers(...,
req.user.id)` em `server/index.js`, na rota de mandar mensagem) — ou seja,
`chat-mensagem` só chega pelo WebSocket pra quem **não** escreveu aquela
mensagem. Isso significa que não precisa checar "é minha própria mensagem?"
nem "a conversa está visível?" antes de tocar o som: é seguro tocar sempre
que o evento chegar (igual WhatsApp/Messenger — só a pessoa que mandou não
ouve o próprio som).

Reaproveita um único `<audio>` (`new Audio(...)` chamado uma vez só,
guardado em variável do módulo) em vez de criar um elemento novo a cada
mensagem — só rebobina (`currentTime = 0`) e chama `.play()` de novo. A
Promise de `.play()` é capturada com `.catch(() => {})` porque alguns
navegadores recusam autoplay de áudio sem interação prévia da pessoa com a
página (não deveria acontecer aqui, já que logar exige clicar num botão,
mas é tratado mesmo assim pra nunca gerar um erro não tratado no console).
Não existe opção de desligar o som nesta versão.

## "Onde eu mexo para..." — atalho por pedido comum

| Pedido | Arquivo(s) prováveis |
|---|---|
| Mudar como o tempo total do Espelho é calculado, ou a distribuição do OPEC entre as passagens de bloco | `client/src/lib/duration.js` (função `distribuirSpotsEmPassagens`) e `client/src/features/espelho/EspelhoTab.jsx` |
| Mudar o texto/formato do .txt do teleprompter | `client/src/features/espelho/EspelhoTab.jsx` (função `gerarTextoTeleprompter`) |
| Mudar o layout do PDF do Espelho (o que sai ao clicar "Baixar PDF") | `client/src/features/espelho/EspelhoTab.jsx` (bloco `<div className="print-only espelho-print">` no fim do arquivo) e `client/src/styles/index.css` (regras `@media print`, dentro delas as específicas de `.espelho-print-table`) |
| Mudar o fuso horário do sistema, ou algo que depende de "hoje"/hora | Pela tela: Configurações → Geral (`features/configuracoes/GeralSecao.jsx`). Servidor: tabela `app_config` (chave `fuso`) em `server/db.js` — `getFuso`/`setFuso`/`restaurarFuso`/`hojeISO`; `aplicarFuso()` põe o valor em `process.env.TZ` ao iniciar e a cada mudança. Nunca use `new Date().toISOString().slice(0, 10)` para "hoje" (é UTC): use `hojeISO()`. Rotas `/api/config/fuso` em `index.js`. Cliente: `lib/fuso.js` (`hojeISO`, `partesAgora`, `formatHora/formatData/formatDataHora`), carregado em `App.jsx` junto com os dados; ao receber `fuso-config` a página recarrega. Para mostrar hora/data na tela, use essas funções em vez de `toLocale*String` solto |
| Mudar as redes sociais (botões "Publicado nas redes") | Lista padrão em `server/db.js` (`REDES_PADRAO`, `getRedes`/`setRedes`, tabela `app_config` chave `redes`); rotas `/api/config/redes` em `index.js`; tela em `features/configuracoes/RedesSecao.jsx`. Botões e ícones da lista: `components/pickers/PublicacoesRedes.jsx` (ícones em `components/common/IconeRede.jsx` — para dar ícone a uma rede nova, acrescente o nome ali); regras em `lib/publicacoes.js`; hook `features/configuracoes/useRedes.js`. O dado fica em `publicacoes` (`[{rede, data}]`) em matérias e entrevistados (`MateriasTab.jsx`, `EntrevistadosTab.jsx`) |
| Mudar o Início personalizável (cartões, tamanhos iniciais, tipos de cartão, upload) | Tela: `features/inicio/InicioTab.jsx` (grade de 12 colunas com células quadradas via `react-grid-layout` no computador — o conteúdo de cada cartão se adapta ao tamanho por container queries `@container ini` em `styles/index.css` — pilha no celular; modo Personalizar), `features/inicio/CartoesCustom.jsx` (post-it, links, foto, vídeo), `features/inicio/EditorCartao.jsx` (janela de edição). Regras puras e arranjo padrão: `lib/inicioLayout.js` (`layoutPadrao`, `alturaDaLista`, `youtubeEmbed`). Servidor: `server/inicio.js` (tabela `inicio_layout`, validação `sanitizarLayout`, pasta `inicio-arquivos/` ao lado do banco) e rotas `/api/inicio/*` em `index.js`. Estilos `.ini-*` no fim de `styles/index.css`. Para um novo cartão do sistema: acrescente em `SISTEMA`/`NOMES_SISTEMA`/`ORDEM_PADRAO` (`inicioLayout.js`), na lista `SISTEMA` de `server/inicio.js` e no objeto `sistema` do `InicioTab.jsx` |
| Mudar o "Novo / já vi" dos espelhos | Servidor: `server/espelhoVistos.js` (tabelas `espelho_vistos` e `espelho_vistos_base`; ao criar um espelho, `index.js` já marca como visto para quem criou). Cliente: `features/espelho/useEspelhoVistos.js` (estado compartilhado; regra `ehNovo`), contador do menu em `EspelhoNavBadge.jsx` (usado em `App.jsx`), etiqueta/botão em `EspelhoTab.jsx`, estilos `.espelho-linha.nao-visto` |
| Mudar quantos dias o espelho leva pra sumir sozinho | Pela tela: Configurações → Espelho (`features/configuracoes/EspelhoSecao.jsx`). Valor na tabela `espelho_config` (`server/db.js`: `getEspelhoRetencaoDias`/`setEspelhoRetencaoDias`; padrão 30 em `ESPELHO_RETENCAO_PADRAO`, faixa 1–365). A contagem parte do campo `criadoEm` do espelho, gravado pelo servidor em `createItem` e preservado em `updateItem`; limpeza em `pruneEspelhosVencidos` (chamada por `pruneEspelhosELog` em `index.js`). No cliente: `lib/espelho.js` (`diasParaExpirar`) e `features/espelho/useEspelhoRetencao.js` (busca o prazo e escuta o evento `espelho-config`) |
| Mudar a aparência de um checkbox, botão, badge etc. em geral | `client/src/styles/index.css` — e, se o componente for genérico, o arquivo dele em `client/src/components/common/` |
| Mudar as cores do tema claro (acessibilidade) | `client/src/styles/index.css` (bloco `:root[data-theme="claro"]`) e `client/src/lib/theme.js` |
| Adicionar um campo novo no cadastro de Entrevistados | `client/src/features/entrevistados/EntrevistadosTab.jsx` (o `<Drawer>` do formulário e o `<ViewDialog>`) |
| Mudar a regra de quando um entrevistado vira "inativo" sozinho | `server/db.js` (função `pruneEntrevistadosVencidos`) e `server/index.js` (`pruneEntrevistadosELog`, que registra a ação no Histórico como usuário sintético `Sistema`) — roda inteiramente no servidor, não no navegador |
| Adicionar um campo novo em Matérias | `client/src/features/materias/MateriasTab.jsx` |
| Mudar as regras de quem pode ver/editar cada aba | `server/index.js` (`requireCollectionAccess`) no back-end, e `client/src/lib/permissions.js` + `client/src/features/configuracoes/PermissionsEditor.jsx` no front |
| Mudar o cálculo de parcelamento/contrato mínimo/conta fixa do financeiro | `client/src/lib/financeiro.js` |
| Mudar como a área de conteúdo das abas rola (cartões, busca, tabela) ou o respiro reservado no final pro balão de chat flutuante não cobrir os botões da última linha | `client/src/styles/index.css` (regra `.content`, incluindo a versão mobile dentro do `@media (max-width:880px)`) |
| Uma tabela (`.table-wrap`) fica espremida/cortada numa tela baixa, em vez da página inteira rolar | `client/src/styles/index.css` (regra `.table-wrap` — tem `flex-shrink:0` de propósito, ver comentário ali sobre a pegadinha do `overflow-x` sozinho virar `overflow-y:auto` também e zerar a altura mínima automática dentro de um flex container) |
| O balão de chat flutuante volta a cobrir os botões da última linha de uma lista grande (ex: muitas matérias), mesmo rolando a página até o fim | `client/src/styles/index.css` (regra `.content > div` — o respiro (`padding-bottom`) pro balão tem que ficar no FILHO, não no `.content` que rola, e precisa de `min-height:auto`; ver o comentário grande ali, é uma pegadinha real do flexbox com scroll) |
| Mudar o respiro entre o painel do Chat (aba de tela cheia) e a borda de baixo da janela | `client/src/styles/index.css` (regra `.content > .chat-shell` — `margin-bottom:28px`. **Importante**: isso tem que ser `margin`, não `padding` — `.chat-shell` tem `flex:1` dentro de `.content`, e num item `flex:1` o `padding-bottom` só empurra o conteúdo de dentro pra cima sem afastar a borda da caixa da borda da janela (a altura total do item já é definida pelo `flex-grow`, preenchendo o espaço disponível; padding só reparte esse espaço fixo entre conteúdo e borda). `margin-bottom`, por outro lado, é descontado do espaço disponível ANTES do `flex-grow` calcular quanto o item cresce, então sobra de fato uma faixa vazia visível entre a borda do painel e a borda da janela. Essa troca (de padding pra margin) foi feita na v1.8.7 depois que um print real do usuário mostrou a borda do painel grudada na borda da janela mesmo com `padding-bottom:48px` aplicado) |
| **Pegadinha** — por que `.content > .chat-shell` precisa redeclarar `padding-bottom:0` mesmo não querendo nenhum padding ali | `client/src/styles/index.css` (mesma regra). `.content > div` (a regra genérica que vale pra TODA aba) dá `padding-bottom:130px` por padrão (reserva pro balão de chat flutuante não cobrir a última linha de listas longas noutras abas). Antes, enquanto `.chat-shell` ainda declarava seu PRÓPRIO `padding-bottom` (18px, depois 28px, depois 48px), isso automaticamente cancelava o valor genérico (cascata por propriedade: a declaração mais específica vence SÓ pra essa propriedade). Mas na v1.8.7, ao trocar pra `margin-bottom` (ver linha acima), a propriedade `padding-bottom` parou de ser redeclarada aqui — e os 130px genéricos voltaram a valer por tabela, empurrando sidebar/conversa/composer 130px pra cima por DENTRO do painel, sobrando um vão vazio enorme entre a caixa de digitar e a borda do painel (foi esse o vão "estranho" que apareceu no print do usuário na v1.8.7). Corrigido na v1.8.8 redeclarando `padding-bottom:0` explicitamente — qualquer mudança futura em `.content > .chat-shell` que pare de redeclarar `padding-bottom` corre o mesmo risco de reintroduzir esse bug |
| Mudar o respiro interno da caixa de digitar mensagem do Chat (entre o texto e a borda de baixo do PAINEL, não da janela) | `client/src/styles/index.css` (regra `.chat-composer` — `padding:14px 14px 18px`; esse aqui é um padding comum, funciona normalmente porque `.chat-composer` não é um item `flex:1`, sua altura é definida pelo próprio conteúdo) |
| Mudar o número da versão mostrado embaixo do nome "Sintonia", no topo do menu lateral (ex: "v1.4.2") | **Não edita direto** no componente — é só `client/package.json` (campo `version`). O valor chega até a tela via `vite.config.js` (`define: { __APP_VERSION__ }`), lido em `client/src/App.jsx` (`.brand-sub`). Isso existe assim de propósito: antes a versão ficava escrita à mão no componente e passou várias entregas seguidas desatualizada (mostrando "v1.1.0" enquanto o `package.json` já estava muito à frente) — agora não tem mais como esquecer, ela sempre reflete o `package.json` no momento do build. |
| Mudar o layout da aba Chat (de tela cheia) em telas pequenas (celular) — por exemplo qual painel aparece sozinho (lista vs conversa) | `client/src/styles/index.css` (bloco `@media (max-width:880px)` logo depois das regras de `.chat-shell`/`.chat-sidebar`/`.chat-thread`) |
| Mudar como os campos numéricos se comportam (duração m:ss, inteiro, valor em R$) ou aplicar a máscara num campo novo | `client/src/lib/masks.js` (regras) e `client/src/components/common/MaskedInputs.jsx` (`DurationInput`, `IntegerInput`, `MoneyInput`). Não use `<input type="number">` pra isso: no Firefox ele deixa digitar letras e em todos os navegadores aceita `e`, `+`, `-` e `.`. Valor em R$ guarda string decimal (`"1234.56"`) no formulário, igual ao antigo `type="number"`. CPF/CNPJ/telefone ficam em `lib/validators.js` + `ValidatedInput` |
| Mudar o tamanho do balão de chat do canto da tela (largura/altura/letra) | `client/src/styles/index.css` (`.chat-popup` — `width:380px`, `height:min(580px, calc(100vh - 110px))`; override de celular no `@media (max-width:640px)`; letra em `.chat-mensagens-compacta .chat-bolha` e `.chat-popup-body .chat-composer-linha textarea`; lista de conversas em `.chat-widget-lista`) |
| Mudar a rolagem automática do Chat (ir pro fim ao abrir, não puxar de volta ao ler histórico) | `ChatThreadBody.jsx`: `grudadoNoFimRef`, `irParaFim`, `aoRolar` (considera "no fim" a menos de 80px), `useLayoutEffect` ao trocar de conversa/chegar mensagem, e `onLoad`/`onLoadedMetadata` em imagem/vídeo (a altura cresce depois que a mídia carrega) |
| Mudar o separador de dia, as reações (emoji) ou o "responder a uma mensagem" do Chat | **Front**: `ChatThreadBody.jsx` (`chaveDia`/`rotuloDia` = separador "Hoje/Ontem/data" comparando o dia local de cada mensagem; `reagir`; `responder`/`respondendo` + barra "Respondendo a…"; `irParaMensagem` rola até a original e a pisca), `ReactionPicker.jsx` (barrinha de 6 emojis + "+", em portal), `ChatContext.jsx` (`reagirMensagem`, evento `chat-mensagem-reacao`) e `index.css` (`.chat-dia-separador`, `.chat-acoes-msg`, `.chat-citacao`, `.chat-reacao*`, `.reacao-picker`, `.chat-resposta-barra`). **Back**: `server/chat.js` (`criarMensagem` grava `respostaA` e `reacoes` dentro do JSON da mensagem; `reagirMensagem`) e a rota `PUT .../mensagens/:id/reacao` em `server/index.js` |
| Mudar a gravação/reprodução de áudio do Chat | **Front**: `GravadorAudio.jsx` (hook `useGravadorAudio` — MediaRecorder, tempo, limite de 10 min, mensagens de erro: endereço inseguro, microfone negado, sem microfone), `AudioPlayer.jsx` (player do balão; tem o truque `currentTime = 1e101` pra gravações webm sem duração poderem ser "puladas"), integração no `ChatThreadBody.jsx` (botão de microfone no lugar do enviar quando a caixa está vazia, barra `.chat-gravando`, `avisoAudio`) e `index.css` (`.chat-audio*`, `.chat-gravando*`). **Back**: tipos `audio/*` liberados em `TIPOS_ANEXO_PERMITIDOS` e gravação de `anexo.duracaoSeg` em `server/index.js`. Requer https/localhost (ver DEPLOY.md) |
| Mudar o botão "Cancelar contas" (fixa / parcelas; Contas a pagar e a receber) | `lib/financeiro.js` (`buildCancelableSeries` agrupa por `grupoId`: `ids` = não pagos de hoje em diante, `vencidasIds` = vencidos não pagos; `cancelSeries` apaga e, em conta fixa, marca o resto com `contaFixaCancelada`), usado por `ContasAPagarTab.jsx` e `ContasAReceberTab.jsx` e `components/common/CancelPickerDialog.jsx` (lista + confirmação). Botão: classe `.btn-amarelo` (mesmo tom do selo Pendente, com versão pro tema claro) |
| Mudar o que aparece no Início, ou os prazos dele | `client/src/lib/inicio.js` (regras e prazos) e `client/src/features/inicio/InicioTab.jsx` (blocos e permissões) |
| Mudar quantas senhas erradas bloqueiam, ou por quanto tempo | `LIMITE` em `server/loginGuard.js` |
| Mudar a fonte dos botões/campos ou o balão do chat sobre popups | fim do `index.css`: regra global `button,input,select,textarea{font-family:inherit}` (sem ela o navegador usa Arial nos botões) e, no celular (≤640px), `.app-shell:has(.confirm-overlay) ~ .chat-widget-dock{opacity:0}` — o balão some enquanto um popup central está aberto, pra não cobrir botões como "Baixar PDF" |
| Mudar as cores do tema claro de peças que têm fundo próprio (selo "Admin" da lateral, botão "Copiar" dos Atalhos) | bloco "Tema claro: peças que tinham fundo escuro fixo" no fim do `index.css`. Regra: toda peça com `background:#...` escuro fixo precisa de um `:root[data-theme="claro"] ...` ao lado |
| Mudar as tabelas no celular (viram cartões) | `components/common/MobileTables.jsx` (montado em `main.jsx`; copia o texto de cada `<th>` pro `data-label` de cada `<td>`) + bloco "Tabelas como cartões no celular (≤640px)" no fim do `index.css`. Cabeçalhos `.th-sortable` viram os chips "Ordenar por" (a linha rola na horizontal; a regra antiga que deixa o 1º `th` fixo é anulada nos chips, senão o primeiro chip ficava grudado em cima dos outros ao rolar) |
| Mudar as cores dos selos (Badge) nos dois temas | `index.css` (`.badge-<tom>` e a versão `:root[data-theme="claro"]`); `Badge.jsx` só escolhe a classe |
| Mudar o layout da aba Chat no celular | Bloco "Aba Chat no celular" no fim de `index.css` (`@media (max-width: 880px)`): `.content > .chat-shell` com margem negativa (tela cheia), `.chat-conversa-row`, `.chat-thread-header` (o botão voltar é `.icon-btn.mobile-only`; só os outros ícones levam `margin-left:auto`), `.chat-composer` (textarea 16px, `safe-area-inset-bottom`) |
| Mudar responder/reagir no celular | `ChatThreadBody.jsx`: gesto de arrastar pra direita (`gestoInicio/gestoMover/gestoFim`, mínimo `SWIPE_MIN`), toque no balão ativa `.ativa`. CSS (bloco "Chat no celular" no fim do `index.css`, só em `@media (hover: none)`): botões `.chat-acao-msg` viram uma linha embaixo com rótulo (`.rotulo`), seletor `.reacao-picker` com botões 40px e grade de 6 colunas |
| Mudar arrastar-e-soltar / colar arquivo no Chat | `ChatThreadBody.jsx`: `aceitarArquivo` (regra única de anexar: limite de tamanho + aviso; usada pelo clipe, pelo arrastar e pelo colar), `soltarRef` + `useEffect` com os ouvintes `dragenter/dragover/dragleave/drop` (ficam no elemento **pai** da lista — `.chat-thread` na aba, `.chat-popup-body` no balão —, por isso esses dois têm `position:relative`), `arrastando` (mostra `.chat-drop-overlay`; só reage se o arrasto tem arquivo, não texto) e `onPaste` da caixa de digitar. CSS: `.chat-drop-overlay`/`.chat-drop-caixa` |
| Mudar o visual das dicas ao passar o mouse (tooltip) de todo o sistema | `client/src/components/common/GlobalTooltip.jsx` (montado uma vez em `main.jsx`; escuta o mouse/teclado no documento e transforma qualquer `title="..."` num balão, movendo o texto pra `data-tip` e dando `aria-label` a botões só de ícone) e `.app-tooltip` em `index.css`. Pra uma tela nova ganhar a dica estilizada basta usar `title` normalmente |
| Mudar o visual da lista que abre nas caixas de seleção (todas as tela) | `client/src/components/common/Select.jsx` (mesma interface do `<select>`: `value`, `onChange` com `e.target.value` — sempre texto — e filhos `<option>`; o "botão" continua sendo um `<select>` real com a opção escolhida, então todo o CSS dos campos segue valendo, e a lista abre num portal no `document.body`) e `.select-menu`/`.select-opcao*` em `index.css`. Campo novo de escolha: use `<Select>` — não `<select>` |
| Mudar o visual dos campos de "criar item novo" no item manual do Espelho (lista, Nome do item, Duração, Texto) | `EspelhoItemManualModal.jsx` e `index.css`: `.espelho-custom-row select`, `.espelho-custom-nome` (campo "Nome do item", aparece em "Outro...") e `.espelho-custom-duracao` compartilham a mesma regra de aparência (fundo, borda, foco) — campo novo nessa linha precisa entrar nesses seletores, senão fica com o visual padrão do navegador |
| Mudar a ordenação por clique no cabeçalho das tabelas (regra de uma coluna, padrão da aba, ou ligar numa tabela nova) | `client/src/lib/sort.js` (`useSortable(linhas, ACESSORES, padrão)` + `comparaVencimento`) e `components/common/SortTh.jsx` (cabeçalho clicável) + `thead th.th-sortable` em `index.css`. Em cada aba: um objeto `SORT_ACESSORES` no topo do arquivo (coluna → função que devolve o valor a comparar, ou `{ get, cmp }` pra regra própria, como o vencimento), `const { rows, sort } = useSortable(filtered, ...)`, `<SortTh sort={sort} k="coluna">` no `<thead>` e `rows.map(...)` no corpo. Vazios vão sempre pro fim; empates mantêm a ordem anterior |
| Mudar o calendário / campo de data | `client/src/components/common/DateInput.jsx` (mesma interface do `<input type="date">`: `value` "AAAA-MM-DD" e `onChange` com `e.target.value`; calendário em portal no `document.body`, fixo na tela, abre pra cima se não couber) e `.date-input`/`.datepicker*` em `index.css` (usa as variáveis de cor, então funciona nos dois temas). Pra um campo novo de data, use `<DateInput>` — não `<input type="date">` |
| Mudar o aviso de "arquivo grande → mande por link" ou o balão de dica do clipe | `ChatThreadBody.jsx` (estado `avisoGrande`, bloco `.chat-aviso`, e `.chat-dica-wrap` > `.chat-dica` ao redor do clipe) e `index.css` (`.chat-aviso*`, `.chat-dica*`; o balão é CSS: aparece em `:hover` ou foco de teclado (`:has(button:focus-visible)` — nunca `:focus-within`, que deixava o balão preso depois do clique) e some após clicar no clipe (classe `.oculta`, estado `dicaClipeOculta`) até o mouse sair; abre pra cima pra não ser cortado no balão flutuante) |
| Mudar o tamanho das letras do Chat | `index.css`: tamanhos da aba de tela cheia ficam em `.chat-bolha`, `.chat-composer-linha textarea`, `.chat-conversa-*`, etc.; o balão flutuante sobrescreve com `.chat-mensagens-compacta .chat-bolha` e `.chat-popup-body ...` (14px) |
| Mudar o crescimento automático da caixa de digitar do Chat (sem rolagem) | `client/src/components/common/AutoGrowTextarea.jsx` (altura = `scrollHeight` + borda; sem somar a borda sobram ~2px escondidos) e `.chat-composer-linha textarea` em `index.css` (`overflow-y:hidden`; `max-height:50vh` é só rede de segurança) |
| Mudar os emojis do Chat (quais aparecem, categorias, abas) ou o comportamento do seletor | `client/src/features/chat/EmojiPicker.jsx` (lista curada em `CATEGORIAS`, sem dependência externa; "recentes" fica no `localStorage`, chave `sintonia.chat.emojis-recentes`). É aberto pelo botão de carinha em `ChatThreadBody.jsx` (que insere o emoji na posição do cursor) e estilizado em `client/src/styles/index.css` (`.emoji-picker*`, ancorado no `.chat-composer`, que por isso tem `position:relative`) |
| Mudar o comportamento da caixa de texto do Chat (ex: altura máxima antes de rolar por dentro) | `client/src/components/common/AutoGrowTextarea.jsx` e `client/src/styles/index.css` (`.chat-composer-linha textarea`, `max-height`) |
| Mudar a regra de quem pode trocar a foto de perfil de um usuário, ou de um grupo | `server/index.js` (rotas `/api/users/:id/foto` e `/api/chat/conversas/:id/foto`) — ver seção "Foto de perfil (usuário) e de grupo" acima |
| Mudar onde/como a foto de perfil ou de grupo aparece na tela | `client/src/components/common/Avatar.jsx` (componente único usado em todo lugar) |
| Mudar quando o balão flutuante do Chat desliza pra fora do caminho de um formulário | `client/src/styles/index.css` (regra `.app-shell:has(.drawer-overlay) ~ .chat-widget-dock` — só reage a Drawer/formulário; diálogos centrais como ConfirmDialog, ViewDialog e os popups de escolha do Espelho usam `.confirm-overlay` e ficam de fora de propósito, ver comentário acima da regra) |
| Mudar quem pode apagar um grupo do Chat (hoje: só quem criou) | `server/chat.js` (função `apagarGrupo`) e `client/src/features/chat/ChatGrupoModal.jsx` (variável `souCriador`) |
| Trocar o som de notificação de mensagem nova, ou mudar quando ele toca | `client/public/sounds/notificacao.wav` (o arquivo em si) e `client/src/lib/realtime.js` (`playNotificationSound`) / `client/src/features/chat/ChatContext.jsx` (onde é chamado) |
| Mudar depois de quantos meses a conta fixa "repõe" lançamentos futuros | `server/db.js` (constante `CONTA_FIXA_BUFFER_MESES`) e `client/src/lib/financeiro.js` (mesma constante, usada só na criação inicial) |
| Adicionar uma coleção/aba totalmente nova | Ver checklist abaixo |
| Mudar o ícone/logo do Sintonia (quadrado vermelho com a antena, **sem borda preta**) | O mesmo desenho está em 4 lugares, mude todos: `client/public/favicon.svg` (aba do navegador — suba o `?v=` em `client/index.html` pra furar o cache), `NOTIFICATION_ICON` em `client/src/lib/realtime.js` (SVG em base64, notificações), `client/src/components/common/BrandIcon.jsx` (login e menu lateral) e `server/assets/sintonia-icone.png` (e-mail de backup; gere o PNG de novo a partir do SVG) |
| Mudar o visual/texto do e-mail de backup (cores, itens do resumo, passos) | `server/backupEmail.js` (`montarEmailBackup`, lista `ROTULOS_CONTAGEM`). O ícone do cabeçalho é `server/assets/sintonia-icone.png` (cópia em PNG do `client/public/favicon.svg`, enviado como imagem embutida `cid:sintonia-logo` em `sendBackupEmail`) — se o logo do sistema mudar, gere o PNG de novo |
| Mudar o assunto do e-mail, o anexo, ou a frequência mínima de checagem | `server/backup.js` (`sendBackupEmail`, `checkAndRunScheduled`) |
| Mudar a duração da sessão de login (hoje: 12h) | `server/auth.js` (`TOKEN_TTL`, `COOKIE_MAX_AGE_MS`) |
| Mudar a senha/usuário padrão do admin criado na primeira execução | `server/db.js` (função `seedAdminIfEmpty`) |
| Mudar os dados de exemplo que aparecem numa instalação nova | `server/db.js` (função `seedIfEmpty`) |
| Mudar o texto do convite de notificações do navegador | `client/src/App.jsx` (bloco `notifPromptVisible`) |
| Mudar a regra de quando uma conta a receber/pagar vira "Atrasado" sozinha, ou o texto do aviso | `server/db.js` (`pruneRecebiveisAtrasados` / `pruneContasPagarAtrasadas`) e `server/index.js` (`pruneRecebiveisELog` / `pruneContasPagarELog`) no back-end; `client/src/App.jsx` (bloco `msg.type === "conta-atrasada"`) no front |
| Adicionar uma notificação de navegador nova ligada a uma coleção | Ver "Notificações de navegador" acima — reusar `broadcastChange` no back-end + um `case` novo em `client/src/App.jsx` |
| Adicionar um terceiro tipo de cartão em Atalhos (além de Link/Texto) | `client/src/features/atalhos/AtalhosTab.jsx` (função `tipoDoItem`, o `<select>` de tipo no formulário, as duas seções `links`/`textos` e o filtro `filtroTipo`). CSS: `.atalhos-filtro*`, `.atalhos-secao*`, `.textos-grid`, `.texto-card*` no fim do `index.css` |
| Mudar ícones ou rótulos do menu lateral | `client/src/config/tabs.js` |
| Mudar o filtro de cliente do Relatórios (opções da lista, ou quais relatórios/tabelas ele afeta) | `client/src/features/relatorios/RelatorioDialog.jsx` (estado `cliente`, `clienteOptions` e o `<Field label="Cliente">`) — é só front-end, não mexe no servidor |
| Mudar a largura de uma coluna de uma tabela de Relatórios na impressão/PDF, ou adicionar/remover uma coluna | `client/src/features/relatorios/RelatorioDialog.jsx` (o `<colgroup>` de cada `<table>` — as porcentagens de cada `<col>` têm que somar 100%) e, se for mudar o comportamento em geral (tamanho de fonte, padding), `client/src/styles/index.css` (regras `table`, `.table-wrap table/thead th/tbody td` dentro de `@media print`) |
| Por que uma tabela de Relatórios na impressão/PDF usa `table-layout:fixed` com `<colgroup>` em vez de deixar o navegador calcular a largura sozinho | Já tentamos `table-layout:auto` (cada coluna do tamanho que o conteúdo pede) pra cabeçalho longo não quebrar no meio da palavra — mas descobrimos (bug só visível no navegador de verdade, não no PDF gerado por aqui) que em `auto` a largura declarada é tratada como mínimo, não máximo: se o conteúdo pedir mais espaço, a tabela estoura a largura da página e CORTA as últimas colunas fora da folha. `fixed` + `<colgroup>` com porcentagem fixa por coluna garante que isso nunca aconteça, não importa o conteúdo. A tabela do Espelho (`.espelho-print-table`) já usava esse padrão desde sempre, com sua própria regra — só as tabelas de Relatórios (dentro de `.table-wrap`) usavam a regra genérica `table` do `@media print` |

### Checklist para adicionar uma coleção/aba nova
Como as coleções normais (`materias`, `clientes` etc.) seguem um padrão comum
nos dois lados, adicionar uma nova aba parecida envolve mexer em vários
lugares:
1. `server/db.js` — adicionar o nome na lista `COLLECTIONS` (cria a tabela
   sozinho na próxima vez que o servidor subir).
2. `client/src/api/client.js` — adicionar o nome na lista `COLLECTIONS` e no
   objeto `base` de `loadAllData`.
3. `client/src/config/tabs.js` — adicionar a entrada do menu (id, rótulo, ícone).
4. `client/src/lib/permissions.js` — adicionar em `TAB_PERMISSION_META`, para
   aparecer no editor de permissões de usuários.
5. `client/src/features/<nova-área>/NovaTab.jsx` — criar o componente da aba.
6. `client/src/App.jsx` — importar o componente e adicionar o bloco
   `{effectiveActiveTab === "novaColecao" && (<NovaTab ... />)}`.

## Dados do e-mail de envio (SMTP) guardados no banco
`backup.js` mantém a tabela `smtp_config` (uma linha). A senha é cifrada com
AES-256-GCM, com chave derivada (SHA-256) do segredo da aplicação
(`getAppSecret()` em `auth.js`, o mesmo do `.jwt-secret`); se o segredo mudar,
a senha não decifra e o sistema trata como "não configurado". `smtpEfetivo()`
usa primeiro o que está no banco e, se vazio, as variáveis `SMTP_*` do
ambiente. A tabela não faz parte do arquivo de backup exportado.

## Regras dos anexos do chat no banco
`chat.js` mantém `chat_config` (uma linha; colunas nulas = usar o padrão das
variáveis de ambiente). `getLimitesChat()` é lido a cada uso (limpeza, teto de
espaço) e o `multer` do upload é criado por requisição (`uploadAnexo()`) para
que o limite de MB novo valha sem reiniciar o servidor.

## Relatório em pop-up e impressão (PDF)
O relatório não é mais uma aba: `RelatorioBotao` (nas toolbars de Contas a
receber, Contas a pagar e OPEC, via `extraActions`) abre o `RelatorioDialog`.
O conteúdo do relatório é renderizado duas vezes: dentro do pop-up (tela) e
numa cópia `.report-print-root.print-only` inserida por portal em
`document.body`. Em `@media print`, `body:has(.report-print-root) #root`
fica oculto, então o navegador imprime só a cópia limpa (sem menu, sem
pop-up), e o PDF sai igual ao da antiga aba. A permissão "Relatórios" foi
removida: quem enxerga a página enxerga o botão (chaves `relatorios` antigas
guardadas nos usuários são ignoradas).

## Padrão de fontes dos PDFs
Último bloco `@media print` do `index.css` ("Padrão de fontes de TODOS os
PDFs"): variáveis `--pdf-font`, `--pdf-corpo` (11,5px) e `--pdf-rotulo`
(10px) valem para `.report-print-root` (relatórios) e `.espelho-print`
(Espelho), com `!important` porque as regras de tela/tabela antigas têm
tamanhos próprios. Para mudar o tamanho/fonte de TODOS os PDFs de uma vez,
altere só essas variáveis; para um PDF novo, use uma dessas duas classes.

## Desempenho (carregamento e compressão)
- **Compressão gzip**: `server/index.js` usa o pacote `compression` antes de
  tudo — respostas JSON, JS e CSS saem bem menores (principalmente no 4G/Wi‑Fi
  fraco da redação).
- **Abas sob demanda**: em `client/src/App.jsx` todas as abas, exceto
  Matérias (a primeira tela), são carregadas com `lazy()` dentro de um
  `<Suspense>`. O pacote principal caiu de ~437 kB para ~271 kB; cada aba só
  baixa o próprio código na primeira vez que é aberta. Aba nova: siga o mesmo
  padrão `const XTab = lazy(() => import(...).then(m => ({ default: m.XTab })))`.

## Renomeação "espelhos" → "espelho"
O id interno do Espelho (tabela do banco, permissão dos usuários, histórico e
mensagens em tempo real) era `espelhos` e agora é `espelho`, igual ao menu.
- **Banco existente:** ao iniciar, `server/db.js` (mapa `RENAME_DE_COLECAO`)
  renomeia a tabela e converte o histórico e as permissões dos usuários — sem
  perder nada e sem passo manual. Numa instalação nova a tabela já nasce
  `espelho`.
- **Backups antigos:** `normalizarBackupLegado()` em `server/backup.js` traduz
  `espelhos` → `espelho` (dados e permissões) ao restaurar; a tela
  Configurações → Backup também conta os espelhos de arquivos antigos.
- Os modelos (`espelho_modelos`) não mudaram.

## Backup automático × "Enviar teste agora"
O agendador (`checkAndRunScheduled` em `server/backup.js`) manda no máximo um
backup automático por dia. Para saber se "hoje já foi", ele olha o histórico
(`backup_envios`, última linha com `ok = 1` e `origem = 'auto'`) — função
`ultimoEnvioAutomatico()`. O envio de teste aparece no histórico como
`teste` e **não conta**: antes (até a v1.16.0 do servidor) um teste feito de
manhã marcava o dia como "já enviado" e o backup do horário marcado era
pulado. O texto "Último envio automático" na tela usa o mesmo cálculo.

## OPEC — "Ver para o dia"
`client/src/features/opec/OpecTab.jsx`: estado `diaRef`; `noArNoDia(item, dia)`
(dia da semana + `inicio` + `vencimento`/`naoVence`, igual a `opecSpotsSegundos`
em `EspelhoTab.jsx` — se uma regra mudar, mude nas duas); `caemAntes` (VTs que
valem hoje mas vencem antes de `diaRef`) alimenta o aviso. Só front-end, sem
mudança no servidor ou no banco. Estilos `.opec-dia-*` no fim de `index.css`.

## Entrevistados — campo `duracao`
Novo campo `duracao` ("m:ss") em cada entrevistado (`EntrevistadosTab.jsx`,
`DurationInput`). Não há mudança no servidor: a coleção guarda o JSON como vem, e
registros antigos sem o campo continuam funcionando (mostram "—").
`EspelhoTab.jsx → adicionarMultiplosEntrevistados` copia `ent.duracao` para o item
do roteiro. A ordenação e o selo "HOJE" ficam em `EspelhoEntrevistadosModal.jsx`
(classe `.espelho-modal-row-hoje` no `index.css`).

## Entrevistados — `datasVeiculacao`
Campo `datasVeiculacao: [{ data, local }]` (mesmo formato das Matérias; `local` =
sigla do programa), editado com `VeiculacaoPicker` em `EntrevistadosTab.jsx`. Só
front-end; registros antigos sem o campo funcionam. `EspelhoTab.jsx →
entrevistadosDisponiveis` monta o atalho do dia (veiculação OU Programa+Data do
agendamento principal). Estilos: `.espelho-materia-pick-texto` no `index.css`.

## Guarda de saída (alterações não salvas)
`client/src/lib/saidaGuard.js`: uma tela com trabalho não salvo registra uma função
(`registrarGuardaDeSaida`) que diz se há alterações; `haAlteracoesNaoSalvas()` é
consultada pelo menu em `App.jsx` antes de trocar de aba — se houver, guarda a aba
em `abaPendente` e mostra o `ConfirmDialog` "Sair sem salvar?". Hoje só o
`EspelhoTab.jsx` registra (compara `form` com `formOriginal`, o mesmo critério do
botão "Voltar") e também liga um `beforeunload` para F5/fechar a página. Para outra
tela usar o mesmo guarda, basta chamar `registrarGuardaDeSaida` num `useEffect`.


## Veiculação automática (Espelho → Entrevistados)
`EspelhoTab.jsx → marcarVeiculacoesAutomaticas` agora trata também os itens
`tipo: "entrevistado"` (usa o prop `onUpdateEntrevistado`, ligado em `App.jsx` a
`updateItemInList("entrevistados", ...)`). Falhas (ex.: 403 sem permissão de Editar
em Entrevistados) voltam em `falhas` com `tipo` e alimentam o `ConfirmDialog`
"Algumas veiculações não foram marcadas". Não desfaz a veiculação se o item sair do
espelho depois.

## Aviso de repetição — entrevistados
`EspelhoEntrevistadosModal.jsx` recebe `programaSigla` e `dataEspelho`;
`veiculacoesNoPrograma(v)` filtra `v.datasVeiculacao` por programa (excluindo o dia
do espelho) e alimenta o selo `.espelho-modal-row-repetida` e o `ConfirmDialog` de
repetição — espelha `EspelhoMateriasModal.jsx` (que não exclui o dia do espelho).

## Fonte padrão no `<body>`
`index.css` define `body{ font-family:'IBM Plex Sans', ... }` além do `.app-shell`.
Qualquer popup renderizado **fora** do `.app-shell` (como o "Sair sem salvar?" no fim
do `App.jsx`) herdava a fonte serifada do navegador; com a regra no `body`, herda a
fonte do sistema.

## Bloqueio de tentativas de login
`server/loginGuard.js` guarda, em `Map`s na memória, as falhas por `usuário|ip` e por `ip`
(5 falhas → 15 min; teto de 50 por IP; erros com mais de 15 min não contam; acertar zera).
A rota `POST /api/auth/login` (`server/index.js`) consulta `verificarBloqueio` antes de comparar
a senha e chama `registrarFalha`/`registrarSucesso`. O texto das mensagens sai de
`mensagemFalha`/`mensagemBloqueio`. No cliente: `components/auth/LoginScreen.jsx` trava o botão
até `bloqueadoAte` (o erro carrega `bloqueadoAte`, ver `api/auth.js`). O Histórico mostra a ação
`seguranca` (`ACTION_META` em `HistoricoSecao.jsx`). O IP real exige `TRUST_PROXY` atrás de proxy.

## Aviso "Sair sem salvar?" nos formulários laterais
Hook `components/common/useAvisoNaoSalvo.jsx`: tira uma foto (`JSON.stringify`) dos valores quando o
formulário abre e compara ao tentar fechar. Cada aba usa `pedirFechar` no `onClose` do `Drawer` e no botão
"Cancelar", e renderiza `{avisoNaoSalvo}` logo depois do `</Drawer>`. Salvar chama o `setDrawerOpen(false)`
direto (sem pergunta). Estado fora de `form` (ex.: um campo de busca) não conta como alteração. Ao criar uma
aba nova com formulário lateral, repita esse padrão.

## Início (painel de abertura)
`features/inicio/InicioTab.jsx` (tela) + `lib/inicio.js` (regras puras: `insercoesNoArHoje`, `vencemEmBreve`,
`minhasTarefas`, `espelhosExpirando`, `contasEmAtraso`, `materiasEmAndamento`). Não é uma aba de permissão: está
sempre disponível e é adicionada ao menu em `App.jsx` (`visibleTabs`, primeiro item; `activeTab` inicial = `"inicio"`).
Cada bloco consulta `currentUser.permissions` (`pode(col)`) e só usa `data.<coleção>` das abas liberadas
(o `loadAllData` já só carrega as acessíveis). As tarefas vêm de `apiListTodos()` e recarregam nos eventos
`todo-created`/`todo-completed`. A regra "vai ao ar hoje" mora em `lib/opec.js` (`noArNoDia`), compartilhada com a OPEC.
Limites ajustáveis no topo de `lib/inicio.js` (`DIAS_OPEC_VENCENDO` = 3, `DIAS_CONTAS_A_VENCER` = 7) e `LIMITE_LINHAS` em `InicioTab.jsx` (5).

## Correção ortográfica
Não há dicionário no sistema: é o corretor do navegador, ligado com `spellCheck lang="pt-BR"`. Todo
`<textarea>` (e o `AutoGrowTextarea`, usado no Chat e no Espelho) já vem com isso; nos campos de uma linha
só entraram Retranca (Matérias), Título do espelho e o título do TO-DO. Em campo novo de texto
corrido, copie o mesmo par de atributos; em campo de nome/CNPJ/e-mail/usuário NÃO ligue (e use
`spellCheck={false}` se o navegador sublinhar). A página já é `lang="pt-BR"` (`client/index.html`).

| Mudar o espaço (GB) por usuário para fotos/vídeos do Início | `server/inicio.js` (`getQuotaGB`, `setQuotaGB`, `usoDoUsuario`, `usoPorUsuario`; chave `inicio_quota_gb` em `app_config`, padrão `INICIO_QUOTA_PADRAO_GB`), checagem no `POST /api/inicio/arquivos` em `server/index.js`; tela em `client/src/features/configuracoes/InicioEspacoSecao.jsx` |

| Cartões do Início: Tempo (Open-Meteo) e Site (iframe); post-it com salvamento automático | `client/src/features/inicio/CartaoTempo.jsx`, `CartoesCustom.jsx` (`PostIt`, `Site`), `InicioTab.jsx` (`alterarPostit`), tipos `tempo`/`site` em `server/inicio.js` (`sanitizarLayout`) e `lib/inicioLayout.js` (`BASE`); alças em `styles/index.css` (bloco "Alças de redimensionar", seletores repetem a classe do tipo para vencer o CSS da biblioteca) |
