# Funcionalidades do Sintonia

Este documento descreve o que cada aba do sistema faz, do ponto de vista de
quem usa no dia a dia (produção, redação, financeiro, administração). Para a
estrutura de arquivos por trás de cada aba, ver [ARQUITETURA.md](./ARQUITETURA.md).
Para as rotas da API, ver [API.md](./API.md).

Em quase todas as abas de cadastro, o padrão é o mesmo: uma tabela com busca
e filtros no topo, um botão "Novo..." que abre um painel lateral (drawer)
para preencher os dados, e ícones de visualizar/editar/excluir em cada linha.
Quem só tem permissão de "Visualizar" naquela aba não vê os botões de
criar/editar/excluir. As seções abaixo destacam o que é específico de cada
aba, não esse comportamento comum.

## Matérias
Cadastro das matérias/VTs que entram no jornal: retranca (título), cabeça
(texto lido pelo apresentador antes do VT), repórter, tipo (VT, VT Completo,
Stand Up, Sonora, NC, PG), duração e status (Redação → Edição → Pronto).

**Campos só com números**: todo campo numérico do sistema recusa letras e
símbolos (inclusive ao colar) e formata sozinho enquanto você digita:
duração (Matérias e Espelho) entra da direita pra esquerda como um timer —
digitar `130` vira `1:30`, `1030` vira `10:30` (segundos acima de 59 são
convertidos em minutos ao sair do campo: `90` → `1:30`); duração e
quantidade do OPEC aceitam só dígitos; valores em R$ (Contas a pagar e a
receber) entram como centavos, com vírgula e milhar automáticos (`150` →
`1,50`, `123456` → `1.234,56`); CPF, CNPJ e telefone continuam com suas
máscaras próprias.

- **Sinalizadores**: uma matéria pode ser marcada como Urgente, Gaveta e/ou
  Prioridade ao mesmo tempo — aparecem como bolinhas coloridas na frente do
  título na tabela.
- **Datas de veiculação**: cada matéria pode ter várias datas/locais de
  veiculação (ex: foi ao ar no SC dia 10 e no SUCA dia 12). É essa lista que
  faz a matéria aparecer como sugestão ao montar o Espelho daquele dia/programa.
- **Filtros**: busca por texto, status, ano e mês (o filtro de ano já vem
  marcado no ano atual).
- Botões de "copiar retranca + tempo" e "copiar cabeça" na tela de
  visualização — úteis para colar rápido em outro lugar (ex: um grupo de WhatsApp).

## Contatos
Agenda simples de fontes/contatos gerais (não ligados a uma entrevista
agendada): nome, função, celular, e-mail, endereço, observações. Sem data ou
vencimento — fica cadastrado indefinidamente até alguém excluir.

## Entrevistados
Agenda de entrevistas marcadas: nome, função, linha fina (sobre o que vai
falar), programa, data, horário, modalidade (Presencial/Online/Gravado) e
cabeça (texto de apresentação).

- **Mais de um entrevistado no mesmo bloco**: dá para adicionar "extras" —
  outras pessoas que vão falar junto, sem precisar criar um registro separado
  para cada uma.
- **Arquivar em vez de excluir**: o botão de excluir não apaga o registro —
  só marca como "inativo". A entrevista some da lista normal, mas continua
  salva para consulta futura. Um checkbox "Mostrar inativos" traz de volta, e
  dá para reativar a qualquer momento. Isso preserva o histórico de quem já
  foi entrevistado, sem acumular linhas antigas na visão do dia a dia.
- **Expiração automática**: uma entrevista cuja *data já passou* vira
  inativa sozinha — mesma regra do arquivamento manual (some da lista
  normal, mas continua salva, e aparece marcando "Mostrar inativos"). Isso
  roda no servidor (não depende de um usuário estar com o app aberto),
  tanto a cada consulta da lista de entrevistados quanto periodicamente a
  cada 30 minutos — não precisa fazer nada manualmente. No Histórico, essa
  inativação automática aparece atribuída a **"Sistema"**, não a um usuário
  específico, pra não confundir a auditoria com o nome de quem por acaso
  estava logado no momento em que a expiração ocorreu.

## Programas
Cadastro dos programas/telejornais (ex: "Sucesso no Campo", sigla "SUCA"):
nome, sigla, descrição, dias da semana no ar e um ou mais horários (um
programa pode ter reprise à noite, por exemplo). O sistema avisa se você
tentar cadastrar um nome ou sigla já usados por outro programa.

Esse cadastro alimenta os seletores de "programa" em Entrevistados, OPEC e
Espelho — por isso vale manter consistente (a sigla usada aqui é o que
aparece nas outras telas).

## OPEC
Cadastro dos comerciais/inserções publicitárias que entram nos blocos dos
programas: nome do VT, programa, cliente, dias da semana em que vai ao ar,
duração (em segundos), quantas vezes se repete dentro do mesmo break, início
da veiculação e vencimento (ou "não vence", para VTs sem prazo fixo).

- Uma inserção vencida (passou da data) **some sozinha** da lista (mas
  continua existindo no banco para aparecer em relatórios de períodos
  passados) — a menos que esteja marcada como "não vence".
- É essa configuração que alimenta o cálculo automático de tempo de break
  dentro do Espelho (ver seção Espelho abaixo).
- Tem um atalho para buscar um cliente já cadastrado (aba Clientes) e
  preencher o nome automaticamente.

## Espelho
A aba mais elaborada do sistema: monta o roteiro completo de um programa
para um dia específico, na ordem em que os itens vão ao ar.

**Montagem do roteiro**
- Escolha o programa e a data — isso já sugere um título automático
  ("ESPELHO DO PROGRAMA: ...") e mostra o dia da semana e horário do programa.
- **Aviso de campo faltando**: se tentar salvar sem escolher o programa, sem
  preencher a data ou sem título, o sistema não deixa salvar — marca com
  borda vermelha só o(s) campo(s) que falta(m) preencher (pode ser mais de
  um ao mesmo tempo), sem sair da tela nem perder o que já foi preenchido.
  A borda vermelha de cada campo some assim que ele é preenchido.
- **Aviso ao voltar sem salvar**: se a pessoa montar ou editar um espelho e
  clicar em "Voltar" sem ter clicado em "Salvar espelho", aparece um aviso
  perguntando se quer mesmo sair sem salvar (com opção de cancelar e
  continuar editando, ou confirmar e sair perdendo o que foi feito). Se
  nada tiver sido alterado desde que abriu o espelho, "Voltar" funciona
  direto, sem perguntar nada.
- **Confirmação de exclusão com a data**: ao apagar um espelho na lista, o
  aviso de confirmação mostra o título **e a data de veiculação** (ex:
  "...do dia 12/10/2026?"), já que pode haver mais de um espelho com o
  mesmo título de programa em dias diferentes.
- **Notificação de navegador ao criar espelho**: quando alguém salva um
  espelho novo, os outros usuários com a aba aberta (que já autorizaram
  notificações do navegador) recebem um aviso "Novo espelho adicionado"
  com o título e a data de veiculação (ex: "ESPELHO DO PROGRAMA: SUCESSO NO
  CAMPO — 12/10/2026"). Quem criou o espelho não recebe aviso do próprio.
- **Adicionar matéria**: um popup com busca e filtro por status/ano/mês deixa
  marcar várias matérias de uma vez. Também aparece um atalho com as matérias
  que já têm veiculação marcada para esse dia/programa exato (vindo da aba
  Matérias). Ao **salvar o espelho** (clicando em "Salvar espelho" — não ao
  simplesmente adicionar o item na tela), o sistema marca sozinho a
  veiculação de cada matéria do roteiro lá na aba Matérias — a data e o
  programa deste espelho — pra não precisar marcar duas vezes a mesma
  coisa. Só marca o que ainda não tiver (não duplica nem mexe em
  veiculações já existentes de outros dias/programas), e só depois que o
  espelho é realmente salvo — se a pessoa adicionar uma matéria e sair sem
  salvar, nada é marcado. **Isso só funciona para matérias adicionadas pelo
  popup "Escolher matérias"** (busca e seleciona uma matéria já cadastrada):
  um item digitado/editado manualmente direto no roteiro do espelho não tem
  vínculo com nenhum registro da aba Matérias, então não há o que marcar
  automaticamente.
- **Aviso quando a marcação automática falha**: se alguma matéria do roteiro
  não puder ter a veiculação marcada ao salvar (o caso mais comum é quem
  salvou o espelho não ter permissão de **Editar** em Matérias — só a
  permissão de Espelho não é suficiente), o espelho é salvo normalmente
  mesmo assim, e aparece um aviso listando quais matérias ficaram pendentes,
  pra quem salvou avisar um administrador em vez de achar que deu tudo
  certo silenciosamente.
- **Aviso de repetição**: no popup "Escolher matérias", uma matéria que já
  foi veiculada antes **nesse mesmo programa** (em qualquer dia, não só
  hoje) aparece marcada com um aviso (⚠ já veiculada em DD/MM) direto na
  lista. Se você tentar adicionar uma matéria assim, o sistema pergunta
  antes de confirmar, mostrando a(s) data(s) em que ela já foi ao ar — só
  segue se você confirmar "Adicionar mesmo assim". Isso ajuda a evitar
  repetir sem querer uma matéria que já foi exibida.
- **Adicionar entrevistado**: mesma ideia, com filtro por modalidade/ano/mês.
- **Passagem de bloco**: marca a transição para o próximo bloco comercial —
  a numeração dos blocos é calculada automaticamente pela posição no roteiro.
- **Item manual**: para itens que não vêm de outra aba (ex: "COTAÇÕES",
  "TEMPO", "MERCHAN"). Dá para escolher um modelo salvo (texto pronto,
  reutilizável entre espelhos) ou criar um novo, e opcionalmente salvar esse
  texto como modelo para usar de novo depois.
  - **Editar um modelo antes de adicionar**: cada modelo salvo tem um botão
    de lápis — clicando nele, o nome e o texto do modelo carregam no
    formulário "criar item novo" pra ajustar à vontade antes de adicionar ao
    roteiro. Por padrão vem marcado "salvar as alterações nesse modelo"
    (atualiza o modelo salvo, sem duplicar); se desmarcar, a edição vale só
    para aquele item ali, sem mudar o modelo guardado. Dá pra cancelar a
    edição a qualquer momento e voltar ao formulário em branco.
- **Reordenar**: setas para cima/baixo em cada item, ou arrastar pela alça
  (⣿) — funciona tanto no mouse quanto em touch (as setas são o caminho mais
  fácil no celular).

**Cálculo automático de tempo**
- Cada item de conteúdo (matéria, entrevistado, item manual) soma sua
  duração ao tempo total.
- **Duração da matéria sempre atualizada**: o campo de duração de um item de
  matéria no espelho não é digitado ali — ele vem direto da duração
  cadastrada na aba Matérias (por isso aparece "trancado" pra edição no
  espelho, igual ao título). Então se uma matéria for adicionada ao roteiro
  ainda em edição, sem duração definida, e alguém preencher essa duração
  depois lá em Matérias, o espelho (e o tempo total) atualiza sozinho,
  mesmo em espelhos já salvos — não precisa editar em dois lugares.
- As passagens de bloco calculam o tempo do break **automaticamente**,
  distribuindo os comerciais cadastrados no OPEC para aquele dia da semana e
  programa entre as passagens existentes, sem nunca dividir um comercial ao
  meio (um badge "auto" aparece quando isso está acontecendo). Como essa
  conta também é feita na hora, a partir dos comerciais cadastrados no OPEC
  pra aquele dia, adicionar (ou remover) um comercial no OPEC atualiza o
  tempo do break sozinho também. Se não houver OPEC configurado para aquele
  dia/programa, o campo de duração da passagem fica editável manualmente.
- O tempo total (conteúdo + break) aparece no rodapé do PDF, só uma vez — no
  final de verdade, na última página, mesmo em um roteiro grande que ocupa
  várias páginas impressas (não repete em cada página).

**Exportação**
- **Baixar PDF**: usa a função de imprimir do navegador (Ctrl+P / "Salvar
  como PDF"), com um layout específico de impressão (só aparece a tabela
  formatada, sem os botões e formulários da tela). O cabeçalho (título do
  programa + data) aparece só uma vez, no topo da primeira página — mesmo em
  um roteiro grande que ocupa várias páginas impressas, ele não se repete no
  topo de cada página seguinte (e o "TEMPO TOTAL" do rodapé, pelo mesmo
  motivo, não repete em cada página — só sai uma vez, no final de
  verdade).
- **Baixar TXT (teleprompter)**: gera um arquivo de texto no formato que o
  teleprompter da bancada espera. Importante: esse arquivo **nunca contém a
  barra "/"** (o teleprompter trava com ela) — datas saem como `DD-MM` em vez
  de `DD/MM`, e qualquer "/" dentro de um texto digitado é trocada por "-"
  automaticamente.

**Expiração automática**: um espelho salvo desaparece sozinho depois de um
prazo contado a partir do dia em que ele foi **criado** (não da data de
veiculação) — 30 dias por padrão, e o administrador muda em Configurações →
Espelho (de 1 a 365 dias; o aviso no topo da lista e a coluna "Expira em"
acompanham). Editar o espelho não renova o prazo. Ao diminuir o prazo, o
sistema avisa quantos espelhos serão apagados antes de confirmar. Isso roda tanto ao abrir
a aba quanto periodicamente no servidor, então some mesmo que ninguém abra o
sistema naquele dia.

## Clientes / Fornecedores (cadastro)
(A aba se chamava "Clientes"; o nome mudou e todos os cadastros, permissões e o histórico
foram migrados sozinhos na primeira vez que o servidor sobe.)
Cadastro-mestre de empresas/anunciantes e fornecedores: razão social, nome fantasia, CNPJ,
inscrições, endereço, contato, observações. Serve como fonte para preencher
rapidamente um lançamento em Contas a pagar, Contas a receber ou uma
inserção de OPEC (pelo picker de busca de cliente), sem redigitar os dados
toda vez. Avisa se você tentar cadastrar razão social, nome fantasia ou CNPJ
já usados por outro cliente.

## Contas a receber
Lançamentos financeiros de dinheiro que a emissora vai **receber**
(anunciantes). Cada lançamento tem empresa, valor, vencimento e status
(Pendente/Pago/Atrasado).

- **Parcelamento**: divide o valor total em várias parcelas, todas vencendo
  no mesmo dia de cada mês seguinte (ex: 1ª parcela 15/01, 2ª 15/02, 3ª
  15/03...). Quando o dia não existe no mês seguinte (ex: dia 31 e o mês só
  tem 30 ou 28 dias), a parcela cai no último dia daquele mês — mas a
  próxima parcela volta pro dia original (não acumula o desvio).
- **Contrato mínimo**: repete o mesmo valor todo mês (não divide), por um
  número definido de meses, com a mesma regra de dia fixo acima.
- **Agência**: se o lançamento tem uma agência de publicidade por trás, dá
  para vincular a um registro existente em Contas a pagar. Ao marcar o
  lançamento como "Pago", o sistema lembra que há um repasse pendente para
  essa agência, com atalho direto para a aba Contas a pagar.
- **Atraso automático + notificação**: o sistema checa sozinho, **de fundo,
  sem ninguém precisar abrir nada**, a cada 30 minutos no servidor, se algum
  lançamento "Pendente" passou do vencimento; se sim, muda o status para
  "Atrasado" sozinho e manda um aviso de navegador "Conta atrasada" com o
  nome do cliente, valor e data de vencimento. Abrir a aba de Contas a
  receber também dispara essa mesma checagem na hora (além da automática de
  30 em 30 minutos) — é só um jeito extra de não esperar até 30 minutos se
  alguém entrar na tela logo depois do vencimento passar, não é obrigatório
  pra a checagem acontecer. **Só quem tem permissão de ver "Contas a
  receber" recebe esse aviso** — quem não tem acesso a essa aba nunca vê
  essa notificação (mesma regra que já vale pra qualquer notificação de
  mudança de dado: o servidor só manda pra quem pode ver aquela coleção).
  Um lançamento já pago ("Pago") nunca é marcado como atrasado, e o aviso
  só dispara uma vez por lançamento (na transição de Pendente pra Atrasado,
  não fica repetindo a cada checagem).

## Contas a pagar
Lançamentos financeiros de dinheiro que a emissora vai **pagar**
(fornecedores, prestadores, agências, ou despesas fixas). Além de
parcelamento e contrato mínimo (mesma lógica de Contas a receber), tem um
terceiro tipo:

- **Conta fixa**: uma despesa recorrente sem data de fim (ex: salário, água,
  luz, internet). O sistema gera lançamentos com 6 meses de folga à frente e
  **vai completando sozinho** para manter essa folga, mesmo que o servidor
  fique meses ligado sem reiniciar. Pode ser vinculada a um colaborador (ex:
  para representar o salário de alguém). Uma conta fixa só para de se repor
  quando alguém usa o botão amarelo **"Cancelar contas"** — os lançamentos
  futuros ainda não pagos são apagados, e o que sobra fica marcado como "série
  cancelada" (não gera mais nada, mas o histórico continua).
  No formulário da conta fixa há também **"Buscar cliente cadastrado (opcional)"**:
  ao escolher um cliente, o sistema puxa nome fantasia, CNPJ, inscrições, endereço,
  telefone e e-mail do cadastro (o "Nome da conta" digitado é mantido). Na tabela
  aparece o nome do cliente e, embaixo, o nome da conta.
- **Cancelar parcelas que faltam**: o mesmo botão "Cancelar contas"
  também cancela **parcelamentos e contratos mínimos** em andamento (ex: 12x
  em que 6 já foram pagas). A lista mostra "6 pagas de 12 · faltam 6"; ao
  confirmar, as parcelas futuras **não pagas** são apagadas e as pagas ficam
  no histórico. Se houver parcelas vencidas e não pagas, aparece uma opção
  para excluí-las também (desmarcada por padrão). Nunca apaga lançamento pago. **Contas a receber** tem o mesmo botão amarelo "Cancelar contas", com a mesma regra, para parcelamentos e contratos em andamento.
- **Atraso automático + notificação**: mesma regra de Contas a receber —
  checagem de fundo a cada 30 minutos (não depende de ninguém abrir a aba),
  muda sozinho pra "Atrasado" e manda o aviso "Conta a pagar atrasada" (nome
  diferente do de Contas a receber, pra não confundir qual é qual) com
  fornecedor/cliente, valor e vencimento. Só quem tem permissão de ver
  "Contas a pagar" recebe.

## Relatórios (botão "Relatório" nas páginas)
Não existe mais uma aba "Relatórios" no menu. Em vez disso, as páginas
**Contas a receber**, **Contas a pagar** e **OPEC** têm um botão
**Relatório** na barra de ferramentas, que abre um **pop-up** (fecha com
"Fechar", no X ou com a tecla Esc) com os filtros, os totais e as tabelas, e
um botão **Baixar PDF** (mesmo mecanismo de impressão do navegador; o PDF
sai só com o relatório, sem menu nem pop-up). O botão aparece para quem
enxerga a página (inclusive quem só pode visualizar); a permissão separada
"Relatórios" deixou de existir. Os títulos de cada seção ("Por mês", "Lançamentos detalhados") têm espaço folgado em relação às tabelas. Os três relatórios:

- **Contas a Receber** e **Contas a Pagar**: escolha um período por mês/ano
  ("De" até "Até"), e o relatório mostra o total do período, quanto está
  pago/recebido, pendente e em atraso, um resumo por mês e uma lista
  detalhada de cada lançamento. O pop-up já abre no mês atual.
- **OPEC**: como as inserções de OPEC não têm vencimento mensal (são
  recorrências semanais), esse relatório calcula, para um período de datas
  escolhido, quantas vezes cada VT realmente foi ao ar (contando os dias da
  semana marcados, respeitando o início e o vencimento de cada inserção).
  O relatório de OPEC também filtra por **Programa** (além de Cliente) e tem o
  seletor **Resumo / Dia a dia**. A visão **Dia a dia** lista cada data do período
  com o dia da semana e quantas inserções foram ao ar naquele dia (somando tudo
  que estava no ar, com a quantidade por break), mais o total do período; dias
  sem nenhuma inserção não aparecem. Serve para gerar, por exemplo, só o
  programa X de um cliente e depois o programa Y. O PDF mostra cliente e
  programa no cabeçalho.

Além do período, dá pra filtrar o relatório por **cliente** — o filtro fica
disponível nos três pop-ups (Contas a Receber, Contas a Pagar e OPEC), com a
lista de opções sempre mostrando todos os clientes que já lançaram algo
naquele tipo de relatório, independente do período escolhido. Cada pop-up começa em "Todos os clientes". Quando um
cliente é selecionado, tanto os totais/resumos na tela quanto o PDF gerado
(que mostra o nome do cliente escolhido no cabeçalho) refletem só os
lançamentos dele.

Em telas baixas (notebook pequeno), com os cartões de totais e as tabelas
todos empilhados, pode não caber tudo de uma vez — nesse caso a página
inteira rola normalmente pra ver o resto, em vez de uma tabela ficar
espremida num cantinho minúsculo. No PDF, cada tabela tem a largura de cada
coluna definida de propósito (proporcional ao conteúdo esperado, não
dividida em partes exatamente iguais) — a do relatório de OPEC, por
exemplo, dá mais espaço pras colunas "Dias da semana", "Qtd/break" e
"Inserções" do que pra "Programa". Isso evita tanto cabeçalho/data
quebrando no meio (ex: "20/12/2026" virar "20/12/202" + "6") quanto a
tabela passar da largura da página e cortar as últimas colunas fora da
folha.

## Fontes dos PDFs (padrão único)
Todos os PDFs do sistema (os três relatórios e o Espelho) usam a **mesma
família de letra** (IBM Plex Sans, a mesma do sistema, inclusive nos números —
que usam algarismos de largura fixa para as colunas alinharem, sem a fonte
"de máquina de escrever" que alguns valores usavam) e a **mesma escala de
tamanhos**: título do documento 18, título de seção 13, texto e tabelas
11,5, cabeçalhos de tabela e rótulos 10, marca "Sintonia" e data de geração
10,5. O Espelho mantém o título do programa um pouco maior (15) por ser o
destaque da folha. Nos relatórios, os quatro cartões de totais ficam sempre
numa linha só.

**Margens e páginas:** os PDFs usam folha **A4 em pé** com margens fixas
(12 mm em cima/embaixo e 10 mm nas laterais, definidas no próprio sistema),
então nada encosta na borda nem é cortado, mesmo com "Margens: padrão" no
diálogo de impressão do navegador. Quando a lista é longa, continua nas
páginas seguintes sem cortar linhas no meio, e o cabeçalho da tabela se
repete em cada página.

## Colaboradores
Cadastro da equipe interna (repórteres, cinegrafistas, editores etc.): nome,
data de nascimento, CPF, CNPJ (para quem é PJ), função, celular, e-mail,
endereço, observações. Usado como fonte para vincular um colaborador a uma
conta fixa (ex: salário) em Contas a pagar.

## Uso no celular (telas até 640px)
Verificação completa de todas as abas em 375px e 320px de largura (sem
rolagem lateral da página, nada cortado, botões fáceis de tocar):

- **Tabelas viram cartões**: cada linha vira um cartão com "Coluna: valor"
  (título em cima, botões ver/editar/apagar numa faixa embaixo). Os
  cabeçalhos clicáveis viram botões **"Ordenar por"** numa fila que rola de
  lado. Vale para todas as abas com tabela (Matérias, Contatos, Contas a
  pagar/receber, Relatórios, Histórico, Usuários etc.). No computador nada muda.
- **Botões maiores**: dias da semana, prioridades, permissões, calendário e
  "mostrar senha" têm pelo menos ~38px de altura.
- **Espelho**: a barra do editor (Baixar PDF / TXT / Salvar) quebra em linhas
  em vez de vazar da tela.
- **Backup**: o campo "Choose File" em inglês foi trocado por um botão
  "Escolher arquivo de backup".
- **Selos de status (Pendente, Pago, Atrasado...)** agora têm cores próprias
  no tema claro (antes ficavam escuros).
- Chat no celular: ver "Chat" (responder/reagir por toque e arrastar).

## Ícone do Sintonia
O ícone (quadrado vermelho com a antena branca, **sem borda preta**) é o mesmo
em todos os lugares: aba do navegador, notificações do navegador, tela de
login, menu lateral e cabeçalho do e-mail de backup.

## Atalhos
Um mural de cartões, com dois tipos:

- **Link**: nome, descrição opcional e a URL. Clicar no cartão abre o link
  numa aba nova, sem sair do sistema. Serve pra guardar coisas como artes
  do Canva, sites de referência, planilhas externas etc.
- **Texto**: nome, descrição opcional e um texto livre (ex: um bloco de
  hashtags, uma legenda pronta, e-mails de envio que se repetem toda semana).
  O texto aparece **inteiro dentro do cartão** (numa caixa; se for grande,
  mostra o começo e um botão "Mostrar tudo / Mostrar menos") e o botão
  **"Copiar texto"** copia pro clipboard (vira "Copiado!" por um instante).

A tela é organizada em **duas seções**: **Links** (cartões azuis, "abrem em
outra aba") e **Textos para copiar** (cartões maiores, com faixa âmbar),
mais três botões em cima — **Todos / Links / Textos para copiar**, cada um
com a quantidade — para ver só um tipo. A busca vale para todos. Sujeito a
permissão por usuário, igual às outras abas.

## Configurações (só administradores)
Uma única aba do menu, **Configurações**, reúne o que antes eram quatro itens
separados, em abas internas: **Geral**, **Usuários**, **Backup**, **Histórico**,
**Espelho** e **Chat**. A aba **Geral** guarda o **fuso horário do sistema** (ver "Fuso horário" no fim deste arquivo). O funcionamento de cada uma está nas seções abaixo
(Usuários, Backup, Histórico); a aba **Espelho** define por quantos dias um
espelho salvo é guardado (contados da criação, padrão 30, de 1 a 365) — ver
"Expiração automática" na seção do Espelho; a aba **Chat** mostra o **espaço ocupado pelo chat**:
barra de uso dos anexos em relação ao limite (GB), número de mensagens,
conversas, anexos guardados, tamanho dos anexos e tamanho total do banco.
Logo abaixo ficam as **regras dos anexos, editáveis na própria tela**:
tamanho máximo de cada anexo (1–1000 MB), dias de guarda (1–365) e limite
total (1–2000 GB). Ao salvar, valem na hora para novos envios e a limpeza
roda imediatamente (se você diminuir o prazo ou o limite, anexos antigos são
apagados — a tela pede confirmação). "Voltar ao padrão" apaga o que foi
salvo e volta aos valores do `docker-compose.yml` (padrão 200 MB / 14 dias /
20 GB). Mensagens de texto nunca são apagadas por essas regras. Os valores do
`docker-compose.yml` são só o ponto de partida: o que for salvo na tela
vence. Quando o admin salva, **quem está com o Chat aberto vê o aviso do campo
de envio ("Até X MB · fica salvo Y dias") mudar na hora, sem recarregar**; e o
Chat busca os valores de novo toda vez que abre. A última aba
aberta é lembrada durante a sessão do navegador.

## Relatórios de permissão / Usuários (só administradores)
Gestão de quem acessa o sistema. Cada usuário tem um nome de login, senha,
nome completo (opcional — usado para mostrar um nome mais legível em vez do
login em telas como o TO-DO, o rodapé da barra lateral (mostra os 2
primeiros nomes ali, ex: "Luiz Santos" em vez de "luizstsantos") e "Criado
por" no Espelho), uma foto de perfil opcional (mostrada no lugar do
círculo com a inicial, em toda a aba Chat e também nessa própria
listagem), e um papel: **Administrador** (acesso total, inclusive esta
aba) ou **Usuário comum**. Quem não tiver nome completo cadastrado
continua vendo o login normalmente nesses lugares, e quem não tiver foto
continua vendo o círculo colorido com a inicial.

Para usuário comum, o admin configura, aba por aba: **Sem acesso** (a aba
nem aparece no menu dela), **Visualizar** (vê os dados, sem botões de
criar/editar/excluir) ou **Editar** (acesso completo). Existe também uma
permissão separada, "Pode atribuir tarefas de TO-DO a outras pessoas", que
não está ligada a nenhuma aba específica.

Mudanças de permissão valem na hora, para todo mundo conectado, sem precisar
deslogar. Não é possível excluir ou rebaixar o último administrador restante
(trava de segurança para não trancar todo mundo para fora do sistema).

## TO-DO
Lista de tarefas pessoal, disponível para qualquer usuário logado (não tem
permissão configurável por aba — todo mundo vê a própria lista).

- Cada tarefa tem título, descrição opcional, prioridade (Baixa/Normal/Alta)
  e prazo opcional.
- **Atribuir a outra pessoa**: administradores, e usuários com a permissão
  "Pode atribuir tarefas" liberada, podem criar uma tarefa e atribuí-la a
  outra pessoa em vez de para si mesmos. Quem recebe uma tarefa nova é
  avisado na hora (WebSocket) e, se tiver autorizado, recebe uma notificação
  do navegador mesmo estando em outra aba.
- A descrição aparece na lista exatamente como foi digitada (quebras de linha e recuos preservados).
- **Número no menu**: o item "TO-DO" da barra lateral mostra, em um círculo
  vermelho, quantas tarefas suas ainda não foram concluídas. O número muda na
  hora quando você marca/desmarca, exclui ou recebe uma tarefa nova.
- **Tarefas recebidas enquanto você estava fora**: ao entrar no sistema, se
  alguém atribuiu tarefas a você desde a última vez, aparece uma notificação
  do navegador ("Nova tarefa..." ou "Você recebeu N tarefas novas"). Cada
  tarefa só avisa uma vez. Na primeira vez que a pessoa usa o navegador, as
  tarefas já existentes não geram aviso.
- Administradores veem as tarefas de todo mundo (com filtro por pessoa);
  usuário comum vê as próprias mais as que ele mesmo atribuiu a alguém.

## Chat
Mensagens entre usuários, privadas ou em grupo — qualquer pessoa logada pode
falar com qualquer outra (não é uma "coleção" com permissão por aba, igual o
TO-DO: todo mundo tem acesso).

- **Tamanho do balão e da caixa de texto**: o balão do canto da tela tem 380px
  de largura e até 580px de altura (encolhe sozinho em telas baixas/celular),
  com letra do mesmo tamanho da aba Chat pra dar pra ler. A caixa de digitar
  (balão e aba) cresce sozinha conforme você digita ou pula linha
  (Shift+Enter), sem barra de rolagem, e volta ao tamanho de uma linha ao
  enviar.

- **Emojis**: ao lado do clipe de anexo, a caixa de digitar tem um botão de
  carinha (😊) que abre um seletor de emojis, tanto na aba Chat de tela
  cheia quanto no balão flutuante. Ele tem abas (carinhas, gestos, corações
  e símbolos, TV e trabalho, natureza e comida, festa), uma aba "usados
  recentemente" (guardada no navegador, até 16) e insere o emoji exatamente
  na posição do cursor. Fecha sozinho ao escolher um emoji, ao clicar fora ou
  ao apertar Esc — segurando Shift ao clicar, ele fica aberto pra escolher
  vários de seguida. Os emojis também funcionam se digitados/colados direto
  (ou pelo seletor de emojis do próprio sistema, Win+. / Ctrl+Cmd+Espaço).

- **Balão flutuante (estilo Messenger)**: além da aba "Chat" de tela cheia,
  existe um balãozinho redondo fixo no canto inferior direito da tela,
  visível em **qualquer outra aba** do sistema (Matérias, Espelho, TO-DO
  etc.) — clique nele pra ver a lista de conversas e abrir uma, que vira
  uma janelinha flutuante por cima da tela, sem precisar sair da aba que
  você está usando. Dá pra ter até 3 balões de conversa abertos ao mesmo
  tempo; cada um pode ser minimizado (vira só uma barrinha com o nome) ou
  fechado. O balão só some quando você está dentro da própria aba Chat de
  tela cheia (pra não mostrar a mesma coisa duas vezes). Como ele fica fixo
  por cima de tudo no canto inferior direito, a área de conteúdo de cada aba
  reserva um respiro no final da lista — assim, ao rolar até o fim de uma
  lista grande (ex: muitas matérias), a última linha e os botões de
  ver/editar/apagar dela não ficam escondidos atrás do balão. Quando um
  formulário (de qualquer aba) abre por cima da tela, o balão desliza
  sozinho pra fora do caminho (não fica mais em cima do formulário) e volta
  ao lugar assim que o formulário fecha. Isso vale só pra formulário de
  verdade — um diálogo central como uma caixa de confirmação, a
  visualização (👁) de um item ou os popups de escolha do Espelho ("Adicionar
  matéria", "Item manual" etc.) ficam no meio da tela, longe do canto onde o
  balão mora, então o balão fica parado nesses casos. E, claro, isso também
  não acontece quando é o próprio balão que abre uma das suas janelinhas
  (nova conversa, gerenciar grupo), já que aí não há sobreposição a evitar. As
  janelinhas de conversa (tanto o balão quanto o cabeçalho da conversa na
  aba de tela cheia) têm as quatro quinas arredondadas.
- **Conversa privada**: ao escolher uma pessoa na busca, abre (ou reabre, se
  já existir) uma conversa só entre vocês dois. Não dá pra ter duas conversas
  privadas distintas com a mesma pessoa — o sistema sempre reaproveita a
  existente.
- **Grupo**: dá um nome e escolhe quem participa (precisa de pelo menos mais
  1 pessoa além de quem está criando). Dentro de um grupo, **não existe
  "dono/administrador"** pra maioria das ações — qualquer participante pode
  renomear o grupo, trocar a foto, adicionar novos participantes ou remover
  qualquer outro (inclusive remover a si mesmo, ou seja, "sair do grupo").
  Um grupo não pode ficar com menos de 2 participantes. A exceção é
  **apagar o grupo inteiro**: só quem criou o grupo (o botão "Apagar
  grupo", vermelho, dentro de "Gerenciar grupo") pode fazer isso — os
  demais participantes só têm a opção de sair. Apagar um grupo é definitivo
  e some para todo mundo na hora: todas as mensagens e anexos daquela
  conversa são apagados (ninguém recupera depois).
- **Anexos**: além de texto, dá pra mandar imagem (mostrada em miniatura na
  própria conversa), vídeo (com player na própria conversa) ou arquivo (PDF,
  Word, Excel, CSV, texto) — **até 200MB por arquivo**. Se o arquivo passar
  disso, o Chat avisa na hora (antes de enviar) e orienta a mandar por link
  (Google Drive, WeTransfer ou a pasta da rede da redação) e colar o link na
  mensagem — o aviso é um cartão destacado (ícone de alerta, nome e tamanho do
  arquivo, sugestões de onde mandar o link e botão X pra fechar). Só quem
  participa da conversa consegue baixar o anexo, mesmo sabendo o link direto.
- **Quanto tempo os anexos ficam salvos**: **14 dias** (mensagens, imagens,
  vídeos, tudo). Depois disso o arquivo é apagado do servidor, mas a mensagem
  continua na conversa com o aviso "arquivo expirado" (o texto da mensagem
  nunca é apagado). Além do prazo, a pasta de anexos tem um **teto de 20GB**:
  se passar, os anexos mais antigos são apagados antes dos 14 dias (aparece
  igual "arquivo expirado"). Apagar uma mensagem também apaga o arquivo dela
  do servidor. Ao passar o mouse (ou focar com o teclado) no clipe de anexar, abre um balão
  com o limite, o prazo e a dica de mandar por link. O balão some assim que
  você clica no clipe (pra não ficar por cima do aviso ou do arquivo escolhido)
  e só volta depois que o mouse sair do botão e entrar de novo.
- **Letras do Chat**: na aba de tela cheia o texto é maior (mensagens e caixa
  de digitar em 15,5px, lista de conversas em 15px) para leitura confortável.
- **Rolagem sempre no fim**: ao abrir uma conversa (aba ou balão), ela já aparece
  nas últimas mensagens, mesmo que tenha imagem/vídeo que termina de carregar
  depois. Se você subir pra ler o histórico, o Chat não puxa de volta; ao
  mandar uma mensagem ele desce de novo.
- **Separador de dia**: a conversa mostra uma faixa "Hoje", "Ontem", o dia da
  semana (últimos 7 dias) ou a data, sempre que o dia muda — então uma mensagem
  de ontem às 11:39 e outra de hoje às 11:40 aparecem claramente em dias
  diferentes.
- **Reagir a uma mensagem com emoji**: passe o mouse na mensagem e clique no
  carinha com "+" — abre uma barrinha com 👍 ❤️ 😂 😮 😢 🙏 e um "+" com mais
  opções. A reação aparece embaixo do balão (com contador quando várias pessoas
  usam o mesmo emoji; passe o mouse pra ver quem foi). Cada pessoa tem uma
  reação por mensagem: escolher outro emoji troca, clicar na sua reação (ou
  escolher o mesmo) tira. Aparece pra todos em tempo real. No celular, toque na
  mensagem pra mostrar os botões.
- **Responder a uma mensagem específica**: passe o mouse e clique na setinha
  de "Responder" — a caixa de digitar mostra "Respondendo a …" (X ou Esc
  cancelam) e a mensagem enviada leva a citação da original no topo do balão.
  Clicar na citação rola até a mensagem original e a destaca. Se a original for
  apagada depois, a citação continua mostrando o que ela dizia.
- **Aba Chat no celular**: o chat ocupa a tela toda (sem as bordas dos lados);
  a lista de conversas tem linhas e fotos maiores; dentro da conversa o botão de
  voltar fica no canto esquerdo, com a foto e o nome ao lado; a caixa de digitar
  tem letra de 16px (o iPhone não dá zoom ao tocar) e botões fáceis de apertar.
- **No celular (tela de toque)**: tocar numa mensagem mostra, embaixo dela, os
  botões grandes **Reagir** e **Responder**; **arrastar a mensagem para a
  direita** responde direto (o balão acompanha o dedo e, ao passar do ponto,
  vibra e abre "Respondendo a..."). O seletor de emojis tem botões maiores e
  cabe em telas estreitas (320px).
- **Arrastar e soltar / colar**: dá pra arrastar um arquivo do computador pra
  cima da conversa (aba ou balão) — aparece "Solte para anexar" e ao soltar o
  arquivo fica anexado, pronto pra enviar (não envia sozinho; você ainda pode
  escrever uma mensagem junto). Também dá pra **colar** uma imagem ou arquivo
  (ex: print de tela com Ctrl+V) na caixa de digitar. Vale 1 arquivo por
  mensagem (se arrastar vários, anexa o primeiro e avisa); pastas não podem ser
  enviadas; acima do limite aparece o mesmo aviso de "mande por link".
- **Áudio**: quando a caixa de digitar está vazia, o botão de enviar vira um
  **microfone**. Clique pra gravar (aparece o tempo correndo, a lixeira
  cancela, o botão de enviar manda na hora; máximo 10 minutos; gravações com
  menos de 1 segundo são descartadas). O áudio aparece no balão com um player:
  play/pause, barra de progresso (dá pra clicar pra pular), tempo e velocidade
  1x → 1,5x → 2x; só um áudio toca por vez. Também dá pra anexar um arquivo de
  áudio (mp3, m4a, ogg, wav…) pelo clipe. Segue as mesmas regras dos outros
  anexos (200MB, 14 dias). Na lista de conversas aparece "🎤 Áudio". **O
  microfone só funciona em endereço seguro (https ou localhost)** — fora disso
  o Chat mostra um aviso explicando; anexar arquivo de áudio funciona sempre.
- **Apagar mensagem**: só quem escreveu pode apagar a própria mensagem
  (sem limite de tempo). Não existe "editar" mensagem nesta versão.
- **Caixa de texto que cresce sozinha**: ao digitar uma mensagem com mais de
  uma linha, a caixa aumenta de altura conforme o texto, sem barra de
  rolagem (só passa a rolar por dentro se ocupar mais da metade da tela),
  tanto na aba de tela cheia quanto nos balões flutuantes. Volta ao tamanho
  normal assim que a mensagem é enviada.
- **Em telas pequenas (celular)**: só aparece um painel por vez — a lista de
  conversas OU a conversa aberta, nunca os dois ao mesmo tempo — com um
  botão de voltar no topo da conversa pra retornar à lista.
- **Indicador de "online"**: uma bolinha verde mostra quem está com o
  sistema aberto agora (em qualquer aba/dispositivo).
- **Indicador de "digitando..."**: aparece pros outros participantes da
  conversa enquanto alguém está escrevendo — some sozinho se a pessoa parar
  (não é salvo, é só um aviso em tempo real).
- **Notificação de mensagem nova**: se a pessoa não estiver olhando aquela
  conversa agora (nem na aba Chat de tela cheia, nem num balão flutuante
  aberto e não minimizado) — e tiver autorizado notificações do navegador —
  recebe um aviso mesmo estando em outra aba do sistema ou minimizado. O
  menu lateral e o balão flutuante mostram, cada um, um contador do total de
  mensagens não lidas, que soma ou zera automaticamente conforme as
  conversas são abertas/fechadas/minimizadas (não existe um "marcar tudo
  como lido" manual — é tudo automático, por conversa).
- **Sinal sonoro**: toca um "tlim" curto sempre que chega uma mensagem de
  outra pessoa — mesmo com a conversa aberta na tela (só não toca pra
  mensagem que você mesmo mandou, é claro). Não tem configuração pra
  desligar nesta versão.
- **Histórico permanente**: diferente do Espelho (que expira depois de 30
  dias), as mensagens do Chat ficam guardadas para sempre — não há limpeza
  automática.
- **Foto de perfil e de grupo**: cada pessoa pode ter uma foto de perfil
  (igual uma inicial colorida, mas com imagem) — mostrada em toda a aba
  Chat (lista de conversas, cabeçalho, balão flutuante, nova conversa) e
  também na listagem de Usuários. Sem foto cadastrada, continua aparecendo
  o círculo colorido com a inicial do nome, igual antes. Quem pode trocar a
  foto de **usuário** é só um administrador (pela tela Usuários (Configurações), ao editar
  alguém — não existe edição do próprio perfil nesta versão); já a foto de
  um **grupo** de conversa pode ser trocada ou removida por **qualquer
  participante** do grupo (mesma regra de quem pode renomear o grupo).
  Aceita imagem JPEG, PNG, GIF ou WEBP, até 5MB; ao trocar ou remover, a
  foto anterior é apagada do disco sozinha, sem acumular arquivo órfão.

## Backup (só administradores)
No topo da aba há um **painel de situação** com três cartões: **último backup
por e-mail** (data, tamanho e destino), **próximo backup** agendado e
**situação do e-mail** (funcionando, não configurado no servidor, ou "último
envio falhou" com o motivo). Mais abaixo há o **histórico de envios**
(últimos 10: data, resultado, tamanho e destino; testes aparecem marcados
como "(teste)"). Falhas repetidas do envio automático no mesmo dia aparecem
numa linha só.

Três funções:

1. **Baixar backup agora**: gera e baixa um arquivo `.json` com todos os
   dados do sistema (todas as coleções, usuários e tarefas do TO-DO).
2. **Restaurar backup** (agora com conferência antes de substituir): envia um arquivo `.json` de backup gerado
   anteriormente. **Isso substitui todos os dados atuais do servidor**,
   inclusive os usuários — pode ser necessário fazer login de novo depois.
   Ao escolher o arquivo, a tela mostra **o que há dentro** (data em que foi
   gerado e a quantidade de matérias, contatos, contas, usuários, tarefas
   etc.) e **avisa em destaque se o arquivo tem menos dados do que o sistema
   tem hoje** (ou seja, o que foi criado depois do backup será perdido). Para
   confirmar é preciso **digitar RESTAURAR** — não pode ser desfeito.
3. **Backup automático por e-mail**: depois de preencher o **Servidor de
   e-mail** (cartão logo acima da configuração, na própria aba — botões
   prontos para Gmail/Outlook, e-mail que envia, senha de app e remetente
   opcional; a senha é guardada cifrada e nunca volta para a tela; ver
   [DEPLOY.md](./DEPLOY.md)), dá para agendar um envio automático (diário ou
   semanal, num horário fixo) para um e-mail de destino, com um botão para
   testar o envio na hora. Sem SMTP configurado, essa parte fica indisponível,
   mas baixar/restaurar manualmente continua funcionando normalmente.

   **Confiabilidade do envio agendado**: o servidor confere a cada minuto e
   envia assim que o horário chega — se estava desligado ou reiniciando na
   hora marcada, envia ao voltar (até 6 horas depois do horário). Se o envio
   falhar (ex: senha SMTP errada), tenta de novo a cada 15 minutos, no máximo
   um envio com sucesso por dia, e o motivo da falha aparece em vermelho na
   aba Configurações → Backup ("O último envio automático falhou...") até o próximo sucesso.

   **O e-mail** é um aviso bonito e informativo (e não só um anexo): selo
   "Backup concluído com sucesso", data e hora, nome e tamanho do arquivo,
   frequência e **data do próximo backup**, um resumo com a **quantidade de
   registros de cada coisa** (matérias, contatos, contas a pagar/receber,
   usuários, tarefas etc. — ajuda a perceber se algo sumiu entre um backup e
   outro), os 3 passos para restaurar (Configurações → Backup → escolher o arquivo → conferir o resumo e digitar RESTAURAR) e um aviso para guardar o arquivo com
   cuidado. O cabeçalho usa o **ícone do Sintonia** (a antena), embutido no corpo do e-mail (não aparece como anexo). O assunto mostra data e tamanho (ex: "✅ Backup Sintonia —
   04/10/2026 — 1,3 MB"). Quem usa leitor sem HTML recebe a versão em texto.
   O arquivo anexo (`backup-sintonia-AAAA-MM-DD.json`) é o mesmo de sempre.

## Histórico (só administradores)
Registro automático de auditoria: toda vez que alguém cria, edita ou exclui
um registro em qualquer aba (matérias, clientes, contatos, usuários etc.), o
sistema grava sozinho um evento — não precisa de nenhuma ação manual da
pessoa que fez a mudança. A lista mostra, do mais recente para o mais
antigo: data/hora, quem fez, o tipo de ação (Criou/Editou/Apagou) e uma
descrição em português do que mudou — por exemplo:

> 28/09 10:14 — Rodrigo mudou "Stand up — Trânsito na avenida central" de
> Redação → Pronto
> 28/09 09:50 — Ana apagou o cliente "Loja XPTO"
> 28/09 09:30 — admin criou o usuário "joao"

Quando o campo alterado numa edição é o `status`, a descrição mostra a
mudança de → para; para qualquer outro campo, mostra uma descrição genérica
de edição (com os nomes dos campos alterados, quando possível). O histórico
nunca guarda o registro inteiro (antes/depois) — só o rótulo do item e a
frase pronta —, então não existe risco de aparecer senha nem hash de usuário
ali, mesmo quando a mudança é em Usuários.

- **Filtros**: busca por texto (descrição, item ou usuário), aba/coleção,
  usuário responsável e período (data início/fim).
- Some sozinho: eventos com mais de 180 dias são apagados automaticamente
  (rotina que roda no início do servidor e depois uma vez por dia).
- Atualiza em tempo real para quem está com a aba aberta (WebSocket), sem
  precisar recarregar a página.
- Aba visível **só para administradores** — o mesmo padrão de "Usuários" e
  "Backup": nem aparece no menu, nem a rota da API responde, para quem não é
  admin.

## Tema claro (acessibilidade)
Um botão de "Tema claro" (ícone de sol) troca o fundo escuro padrão por um
tema branco, pra quem tem dificuldade de enxergar as cores escuras. Aparece
em dois lugares: no canto da tela de login (funciona mesmo antes de entrar)
e no rodapé da barra lateral, junto do nome do usuário. Clicando de novo
("Tema escuro", ícone de lua) volta pro visual padrão.

- É por pessoa/navegador: cada um liga ou desliga do seu jeito, e a escolha
  fica salva no próprio navegador (não depende de login nem mexe no que
  outras pessoas veem).
- Cobre o sistema inteiro — sidebar, botões, tabelas, textos, ícones — sem
  precisar mexer aba por aba, porque todo o visual usa um conjunto pequeno
  de cores centralizadas que o tema claro substitui por um fundo branco com
  texto escuro (os tons de destaque — vermelho, âmbar, verde, azul — também
  ficam um pouco mais escuros nesse tema, pra continuar com bom contraste
  em cima de branco).
- Continua ligado entre sessões (fica salvo no navegador) até a pessoa
  trocar de novo.

## Usabilidade em celular
O sistema inteiro (todas as abas, telas e formulários) foi revisado pensando
em quem usa pelo celular:

- **Página rola inteira**: em qualquer tela, incluindo o editor de Espelho,
  a página rola normal de cima a baixo — nada fica "preso" ocupando espaço
  que a tela pequena não tem.
- **Tabelas com coluna fixa**: como as tabelas (Matérias, Contatos, OPEC,
  Clientes, Histórico etc.) têm mais colunas do que cabe na largura de um
  celular, elas rolam de lado — mas a primeira coluna (o que identifica a
  linha, tipo "Retranca" ou "Nome do VT") e os botões de editar/apagar
  ficam sempre fixos na tela, só as colunas do meio é que passam. Assim dá
  pra editar ou apagar um item sem precisar rolar até o fim pra achar o
  botão.
- **Botões e caixinhas de marcar maiores**: ícones de ação (ver, editar,
  apagar) e checkboxes ficam com uma área de toque um pouco maior no
  celular, mais fácil de acertar com o dedo.
- **Menu lateral**: continua como um menu que desliza da esquerda, com um
  fundo escurecido atrás pra indicar que é um painel por cima da tela.
- **Aviso de notificações não tampa mais o menu**: o banner "Ative as
  notificações..." (quando aparece) agora fica dentro do conteúdo normal da
  página, abaixo do cabeçalho — antes ele ficava fixo cobrindo a tela
  inteira do topo no celular, tampando até o botão do menu (☰), e quem não
  tivesse dispensado esse aviso na hora ficava sem conseguir navegar.
- **Item do roteiro do Espelho não corta mais o título**: no celular, cada
  item do roteiro agora mostra o título (retranca) numa linha própria, com
  a duração e os botões de mover/excluir na linha de baixo — antes tudo
  ficava espremido numa linha só e o título aparecia cortado com só 4-5
  letras visíveis, impossível de identificar qual item era.

## Visual padrão: dicas (tooltips) e campo de data

- **Dicas ao passar o mouse**: toda dica do sistema (botões só com ícone,
  emojis, etc.) aparece num balão estilizado, que acompanha o tema escuro e o
  tema claro/branco, no lugar do balãozinho feio do navegador. Também aparece
  ao navegar com o teclado (Tab).
- **Campos de data**: todos os campos de data (Matérias, OPEC, Entrevistados,
  Contas a pagar/receber, TO-DO, Histórico, Relatórios, Espelho, etc.) usam
  um calendário próprio, nos dois temas. Dá pra clicar no ícone do calendário
  ou digitar a data (dd/mm/aaaa). Clicar no mês/ano abre a escolha rápida de
  mês; as setas trocam de mês; "Hoje" e "Limpar" ficam no rodapé; o dia de
  hoje vem com contorno e o dia escolhido destacado. Setas do teclado
  navegam pelos dias e Esc fecha. Campos de hora continuam nativos (mas
  seguem o tema).


- **Versão do sistema**: aparece embaixo do nome "Sintonia", no topo do menu
  lateral (ex: "v1.11.1"), no lugar da antiga frase "Operação diária". Não
  aparece mais no rodapé do menu.

- **Caixas de seleção (listas)**: todas as listas de escolher uma opção
  (status, programa, ano, mês, dia da semana, tipo, cliente etc.) abrem numa
  lista própria, nos dois temas: cantos arredondados, opção sob o mouse
  destacada, a escolhida marcada com um visto, rolagem quando é comprida e
  abertura pra cima se faltar espaço embaixo. Teclado: setas navegam, Enter
  escolhe, Esc fecha, digitar a primeira letra pula pra opção.

- **Ordenar tabelas clicando no cabeçalho**: em Matérias, Entrevistados,
  Programas, OPEC, Clientes, Colaboradores, Contatos, Contas a pagar, Contas a
  receber, Usuários e Histórico, clicar no nome de uma coluna ordena por ela
  (A→Z, menor→maior, mais antigo→mais novo); clicar de novo inverte. A coluna
  ativa mostra uma setinha (↑ ou ↓) e as outras mostram um indicador discreto
  ao passar o mouse. Linhas sem valor ("—") ficam sempre no fim. A ordem
  volta ao padrão ao sair da aba.
  - **Contas a pagar e a receber** abrem ordenadas por **vencimento, do mais
    perto para o mais longe** (quem ainda vai vencer vem primeiro; contas já
    passadas vêm depois, da mais recente para a mais antiga). Clicar em
    Vencimento de novo mostra primeiro as que vencem mais pra frente. Em
    Empresa: A→Z e depois Z→A.
  - Padrões: Matérias e Histórico (ordem original), Entrevistados (data e
    horário), OPEC (vencimento; "Não vence" no fim), demais (nome A→Z).


## TO-DO: aviso de tarefa concluída
Quando alguém atribui uma tarefa a outra pessoa e ela marca como concluída,
quem atribuiu recebe uma notificação do navegador ("Tarefa concluída — fulano
concluiu: …") e a tarefa já aparece como concluída na lista dele, sem
recarregar. Quem concluiu não recebe aviso da própria ação, e desmarcar e
marcar de novo avisa outra vez.

## OPEC: "Ver para o dia"
Na aba OPEC, o campo **Ver para o dia** mostra só o que estará no ar numa data
futura (ex.: montar na quinta a OPEC de segunda). A lista passa a respeitar o
dia da semana, o início e o vencimento de cada VT daquela data — a mesma regra
que o Espelho usa na passagem de bloco. Acima da tabela aparece o resumo
("N inserção(ões)") e, em destaque, os VTs que **estão no ar
hoje mas vencem antes da data escolhida** e por isso não entram. O botão
**Limpar** volta à lista normal. Respeita o filtro de programa. Não altera nenhum
dado; é só uma visão.

## Entrevistados: duração e lista do Espelho em ordem
- **Duração (opcional)** no cadastro de Entrevistados (formato m:ss, ex.: 3:00),
  com coluna "Duração" na tabela (ordenável) e no "Visualizar". Quando a
  entrevista é adicionada num Espelho, a duração já vem preenchida no item
  (continua editável no Espelho).
- **Espelho → Adicionar entrevistados**: a lista agora vem da data mais recente
  para a mais antiga (datas futuras no topo; no mesmo dia, pelo horário, do mais
  cedo ao mais tarde; sem data vai para o final). Quem é do dia recebe o selo
  vermelho **HOJE** e a linha destacada. A duração, quando existe, aparece depois
  do horário.

## Entrevistados: datas de veiculação
Cada entrevistado agora pode ter **Datas de veiculação (opcional)** — pares dia +
programa, igual às Matérias — para reaproveitar a mesma entrevista em vários dias.
O agendamento principal (Programa, Data, Horário) continua como era; a veiculação
só soma. Aparece no "Visualizar". No **Espelho**, o card "Adicionar entrevistado"
ganhou o **atalho do dia**: lista quem tem veiculação marcada para o dia e o
programa do espelho (ou cujo agendamento principal é esse), ordenado por horário,
com 1 clique para adicionar; quem já está no roteiro some da lista. (Não há coluna
"Veiculação" na tabela de Entrevistados — só no cadastro e no "Visualizar".)

## Espelho: aviso "Sair sem salvar?"
Se você está montando um espelho com alterações não salvas e clica em **outra aba
do menu**, aparece o aviso **"Sair sem salvar?"** com os botões **Continuar
editando** (fica onde está, nada se perde) e **Sair sem salvar** (troca de aba e o
que foi digitado é descartado). Sem alterações, ou com o editor
aberto mas intocado, a troca é direta. O navegador também avisa ao atualizar a
página (F5) ou fechar a aba com um espelho não salvo. O botão "Voltar" do próprio
Espelho continua com o aviso dele.


## Veiculação automática dos entrevistados
Ao **salvar um espelho**, cada entrevistado do roteiro recebe automaticamente, no
cadastro, a veiculação "dia do espelho + programa do espelho" (se ainda não tiver) —
igual ao que já acontece com as matérias. Quem salva precisa ter permissão de
**Editar** em Entrevistados; sem ela o espelho é salvo normalmente e aparece o aviso
"Algumas veiculações não foram marcadas", listando quem ficou de fora (entrevistado
ou matéria) e o motivo.

## Espelho: aviso de entrevistado já veiculado
Na janela **Escolher entrevistados**, quem já foi veiculado antes **nesse mesmo
programa** mostra, na linha, o aviso amarelo "já veiculado em dd/mm/aaaa, …" (as
datas vêm da ficha do entrevistado — marcadas à mão ou gravadas automaticamente por
espelhos anteriores; o dia do próprio espelho não conta, nem datas de outros
programas). Ao clicar em **Adicionar selecionados** com algum deles marcado, abre o
popup "Entrevistado já veiculado nesse programa" listando as datas, com **Adicionar
mesmo assim** ou **Cancelar** — igual ao que já existe para matérias. O atalho do dia
adiciona direto, sem esse popup.

## Início (tela de abertura)
Ao entrar, a primeira tela é o **Início**, um resumo do dia (também é o primeiro
item do menu). Em cima, a saudação (Bom dia / Boa tarde / Boa noite + nome) e a
data. Depois, quatro cartões e cinco blocos de lista; **cada um só aparece se a
pessoa tem acesso à aba de onde vêm os dados** (administrador vê tudo; quem só
pode *visualizar* uma aba também vê o bloco dela):

| Bloco | Mostra | Vem de |
|---|---|---|
| Cartão "Matérias em andamento" e lista | matérias em Redação ou Edição, as mais recentes primeiro | Matérias |
| Cartão "Inserções no ar hoje" e lista "No ar hoje (OPEC)" | VTs que vão ao ar hoje (mesma regra da OPEC e do Espelho: dia da semana, início e vencimento); o cartão soma a quantidade de inserções | OPEC |
| Cartão "Minhas tarefas pendentes" e lista "Minhas tarefas" | tarefas não concluídas **da própria pessoa**: atrasadas primeiro, depois por prazo e prioridade | TO-DO (todos têm) |
| Cartão "Contas em atraso" | quantidade de contas com status Atrasado (a receber + a pagar que a pessoa pode ver) | Contas a receber / a pagar |
| Lista "Vencem em breve" | VTs da OPEC que vencem em até 3 dias; contas pendentes que vencem em até 7 dias; e as já atrasadas. A lista começa pelas atrasadas (a mais antiga primeiro) e segue por data: hoje, amanhã e adiante | OPEC / Contas |
| Lista "Espelhos prestes a expirar" | os espelhos que vão sumir primeiro, com os dias que faltam (usa o prazo de Configurações → Espelho) | Espelho |

Cada lista mostra até 5 linhas ("e mais N…" quando há mais). Clicar numa linha ou
no link do topo do bloco abre a aba correspondente. Quem não tem acesso a nada
vê só "Minhas tarefas". No celular os blocos ficam um embaixo do outro.

## Proteção contra tentativa de adivinhar senha
- **5 senhas erradas seguidas** para o mesmo usuário, vindas do mesmo lugar (IP),
  bloqueiam esse usuário nesse lugar por **15 minutos**. Colegas não são afetados.
- A partir da **3ª** senha errada a tela avisa quantas tentativas restam.
- No bloqueio, o botão vira "Bloqueado" e a mensagem diz até que horas; até a
  senha certa é recusada durante a espera. Passado o prazo, tudo volta sozinho.
- Teto extra: 50 erros em 15 minutos vindos do mesmo IP (qualquer usuário) também
  bloqueiam esse IP, contra quem fica trocando de usuário.
- Errar não revela se o usuário existe (a mensagem é a mesma).
- Cada bloqueio vira uma linha no **Histórico** (ação "Segurança", aba Usuários),
  e quem estiver com o Histórico aberto vê na hora.
- Acertar a senha zera a contagem. A contagem fica na memória do servidor:
  reiniciar o servidor desbloqueia todo mundo.
- Atrás de proxy (Nginx, Cloudflare…) é preciso definir `TRUST_PROXY` (ver DEPLOY.md);
  sem isso todos aparecem com o IP do proxy.

## Formulários laterais: aviso "Sair sem salvar?"
Todos os formulários que abrem do lado direito (Matérias, Contatos, Entrevistados,
Programas, OPEC, Clientes, Contas a receber, Contas a pagar, Colaboradores,
Atalhos, Usuários e os detalhes de uma tarefa do TO-DO) avisam antes de perder
o que foi digitado. Se a pessoa **mudou algo** e tenta fechar (X, "Cancelar" ou
clique fora), aparece "Sair sem salvar?" com **Continuar editando** e **Sair sem
salvar**. Se **não mudou nada**, fecha direto, sem pergunta. Salvar fecha normalmente.
Enquanto há alteração pendente, recarregar ou fechar a aba do navegador também
mostra o aviso do próprio navegador.

## Correção ortográfica (português do Brasil)
Os campos de texto onde se escreve conteúdo usam o **corretor do próprio navegador, em
português do Brasil**: palavras erradas ficam sublinhadas e, no computador, o clique direito
mostra as sugestões. Está ligado em **todas as caixas de texto grandes** (Cabeça, Linha fina,
descrições, observações, texto dos itens do Espelho, detalhes do TO-DO, mensagens do Chat…) e nos
títulos de conteúdo (**Retranca** da matéria, **Título do espelho**, título da tarefa). Nomes de
pessoas, CNPJ, e-mail, links e o campo de usuário do login ficam sem correção de propósito.
Limites: quem corrige é o navegador (cada um usa o seu dicionário), então nomes próprios locais
podem aparecer sublinhados e não dá para "ensinar" palavras ao sistema; e alguns celulares só
corrigem enquanto a pessoa digita. Para ter um dicionário próprio da redação seria preciso uma
etapa à parte.

## Fuso horário do sistema
Em **Configurações → Geral** o administrador escolhe o fuso horário do sistema
(padrão: Brasília). Há uma lista com os fusos do Brasil primeiro (cada um com a
diferença para o horário de Greenwich, ex.: GMT-4 para Manaus) e, depois, todos
os outros do mundo; a tela mostra a hora de agora no fuso escolhido. Ao salvar
há uma confirmação, e a página recarrega para todos os usuários conectados.
Nenhum dado salvo é alterado — só a hora que o sistema considera.

O que segue o fuso escolhido: o que é "hoje" (entrevistas e contas que vencem,
datas sugeridas, destaque do dia nos calendários, "no ar hoje"), o horário do
backup automático e o texto dos e-mails de backup, o nome do arquivo de backup,
o relógio, os horários do chat, do Histórico, do Backup e dos relatórios. Vale
igual para todo mundo, mesmo que o computador de alguém esteja em outro fuso.
Correção importante: antes, o "hoje" era calculado em UTC e virava o dia às 21h
de Brasília (contas e entrevistas eram marcadas como vencidas três horas cedo
demais); agora acompanha o fuso escolhido. "Voltar ao padrão" restaura o fuso
inicial (Brasília, ou a variável opcional `TZ` do servidor).

## Início: novo arranjo
Os cartões de números dividem a linha toda em partes iguais (não importa quantos
a pessoa pode ver), os quadros ficam em duas colunas de mesma altura e os quadros
sem nada para mostrar vão para o fim da tela. Um quadro que sobra sozinho na
última linha ocupa a largura toda. Em "Espelhos prestes a expirar" cada linha
mostra também a data de veiculação, para distinguir espelhos de título parecido.
Arquivos: `features/inicio/InicioTab.jsx` e as regras `.inicio-*` em `styles/index.css`.

## Publicação nas redes sociais (Matérias e Entrevistados)
No formulário de cada matéria e de cada entrevistado há "Publicado nas redes":
uma fileira de botões (YouTube, Instagram, Facebook, TikTok, Site, WhatsApp).
Um clique marca como publicado **hoje** (o botão fica verde com ✓); clicar de
novo desmarca. Cada rede marcada mostra abaixo a data, que pode ser corrigida.
Na lista aparece a coluna **Redes** só com o **ícone** de cada rede (o nome aparece
ao passar o mouse; redes sem ícone próprio mostram um círculo com a inicial). A data
não aparece na lista: veja no formulário ou no detalhe (olhinho), que mostra
"Redes sociais" com nome e data. A mudança também vai
para o Histórico ("publicações nas redes").

A lista de redes é do administrador: **Configurações → Geral → Redes sociais**
permite acrescentar outras (ex.: Threads, Kwai), remover as que não usa e
"Voltar ao padrão". Remover uma rede da lista não apaga as marcações já feitas:
quem já foi marcado com ela continua marcado. Dado guardado em `publicacoes`
(lista de `{rede, data}`) no próprio registro; sem migração — registros antigos
simplesmente aparecem sem redes.

## Espelho: lista mais fácil de ler
Na lista de espelhos salvos, a primeira coluna é a **data** com o dia da semana
embaixo (ex.: 14/10/2026 · Quarta-feira), depois o **programa** como etiqueta
colorida (a sigla, com o nome do programa e o horário embaixo) e só então o
título. Cada programa tem sempre a mesma cor, então dá para distinguir de relance.
A ordem é da data mais recente para a mais antiga e, no mesmo dia, por programa.
Títulos automáticos ("ESPELHO DO PROGRAMA: ...") aparecem mais discretos. A linha
inteira é clicável para abrir o espelho. Código: lista em `features/espelho/EspelhoTab.jsx`,
cor por programa em `tomDoPrograma` (`lib/espelho.js`).

## Início personalizável
Cada pessoa monta o seu Início. Em **Personalizar** (canto superior direito) os
cartões ganham uma alça para **arrastar** e podem ter o tamanho mudado puxando a
**qualquer borda** (cima, baixo, esquerda, direita) ou **qualquer canto** (no celular: setas para mudar a ordem). Nada é salvo até clicar em **Concluir**;
**Cancelar** descarta e **Restaurar padrão** volta ao modelo original.
O modelo original é compacto e uniforme: os números ocupam uma linha de quadradinhos e os
painéis têm todos a mesma altura (3 quadradinhos), em linhas de 3 ou 2, com rolagem interna.
Quem já tinha um Início salvo mantém o seu; para ver o novo modelo, use **Restaurar padrão**.

**Adicionar cartão** oferece:
- **Post-it**: nota de texto em papel colorido (6 cores); escreve direto no cartão.
- **Links**: lista de atalhos com nome e endereço (abre em nova aba; só http/https).
- **Foto**: envia um arquivo (JPG, PNG, GIF, WEBP, até 15 MB) ou cola o endereço da imagem; legenda opcional; "preencher o cartão" ou "mostrar inteira".
- **Vídeo**: envia um arquivo (MP4, WEBM, MOV, até 150 MB) ou cola um link do YouTube/.mp4; legenda opcional.
- Os **cartões do sistema** (números e listas: OPEC hoje, vencem em breve, tarefas, matérias, espelhos) podem ser movidos, redimensionados, removidos e trazidos de volta por esse mesmo menu. Continuam só aparecendo se a pessoa tem acesso à aba de origem.

O arranjo é **pessoal** (só a própria pessoa vê e mexe) e fica no servidor, então
acompanha em qualquer aparelho. Fotos e vídeos enviados também são pessoais. Ao
remover o cartão, restaurar o padrão ou excluir o usuário, os arquivos
correspondentes são apagados do servidor.

### Grade de quadradinhos
A grade tem 12 colunas e as células são **quadradas**: um cartão ocupa, por exemplo,
3×3 células; puxando a borda direita vira 6×3, puxando a de baixo vira 3×6, puxando
o canto vira 6×6. Qualquer cartão pode ser reduzido até 1×1. O **conteúdo se
reorganiza sozinho** conforme o tamanho: os cartões de número ficam em linha
(largos) ou empilhados e centralizados (quadrados/altos); as listas escondem as
etiquetas e o texto de apoio quando ficam estreitas ou baixas (e encurtam o
"Abrir …" para uma seta); o post-it aumenta ou diminui a letra junto com o
cartão; links e legendas se compactam. No celular não há grade: os cartões ficam
em pilha. Layouts salvos antes dessa mudança são convertidos automaticamente.
Código: `lib/inicioLayout.js` (`COLUNAS`, `layoutPadrao`, `migrarLayout`) e as
regras `@container ini` no fim de `styles/index.css`.

## Espelho: "já vi esse espelho?"
Cada pessoa tem o seu controle do que já abriu. Um espelho aparece como **novo**
para você quando outra pessoa o criou e você ainda não o abriu: na lista ele ganha a
etiqueta verde **Novo**, uma faixa verde na lateral e letra em negrito; o menu mostra
o contador vermelho ao lado de "Espelho"; e há um cartão "Novos que ainda não abri".
Abrir o espelho (clicar na linha ou no olhinho) tira a marca. O botão **Marcar todos
como vistos** limpa tudo de uma vez. Quem cria o espelho já o considera visto. A
marca é pessoal: o que você abriu não muda nada para os outros.
Regra de partida: só contam como novos os espelhos criados **depois** da primeira
vez que a pessoa usou o sistema com esse recurso (para não aparecerem dezenas de
"novos" de uma vez). A tela atualiza ao vivo quando alguém cria um espelho.
Código: `server/espelhoVistos.js`, `features/espelho/useEspelhoVistos.js` e
`EspelhoNavBadge.jsx`.

### Espaço de cada usuário para fotos e vídeos do Início
Em **Configurações > Geral** o administrador define quantos **GB** cada usuário pode
guardar com fotos e vídeos enviados nos cartões do Início (padrão 1 GB; aceita de 0,1 a
500 GB, com vírgula). O limite vale por pessoa. Ao passar dele, o envio é recusado com
um aviso e a pessoa pode apagar um cartão e salvar, ou colar um link (link não gasta
espaço). A tela mostra o total usado e uma barra por usuário. Diminuir o limite não apaga
nada. Na janela de edição do cartão de foto/vídeo, cada pessoa vê "Seu espaço: X de Y usados".

### Caixa de texto das Redes sociais
A caixa "Nova rede" em Configurações > Geral agora tem o mesmo visual dos outros campos
(fundo, borda, foco azul, tema claro).

### Início: post-it direto, alças maiores, cartões Tempo e Site
- **Post-it sem "Personalizar"**: o texto do post-it se escreve direto no cartão, a qualquer
  momento. Salva sozinho um instante depois de parar de digitar (aparece "Salvando…" e
  "Post-it salvo" perto do botão Personalizar). As cores aparecem ao passar o mouse sobre o
  post-it (no celular ficam sempre visíveis).
- **Alças de tamanho bem visíveis**: no modo Personalizar, cada cartão mostra barras azuis
  grossas nos quatro lados e marcas de canto nos quatro cantos; basta puxar.
- **Cartão Tempo**: previsão do tempo da cidade escolhida (busca pelo nome no lápis do cartão):
  temperatura agora, descrição, sensação, umidade, vento e próximos 5 dias. Atualiza a cada 10
  minutos. Usa o serviço gratuito Open-Meteo, então o computador precisa ter internet. Em
  tamanhos pequenos mostra só a temperatura.
- **Cartão Site**: mostra uma página dentro do cartão, como um navegador pequeno, com botão
  **Abrir** para abrir em outra aba. Alguns sites (bancos, Google, redes sociais) não permitem
  ser exibidos assim; nesses o cartão fica em branco e o botão Abrir resolve.
- **Cartão novo ao lado dos outros**: ao adicionar um cartão, ele ocupa a primeira vaga livre
  (de cima para baixo, da esquerda para a direita), em vez de sempre ir para o final da página.
- **Vários cartões de Tempo**: cada cartão Tempo tem a sua própria cidade (lápis do cartão).
  Para ver várias cidades, adicione um cartão Tempo para cada uma.
- **Barra de mover e botões (Personalizar)**: a barra de cima do cartão inteira arrasta o
  cartão (com a palavra "Mover"); o X, o lápis e as cores ficam recuados das bordas, e as
  marcas de canto e as barrinhas azuis de esticar ficam do lado de fora do cartão, sem cobrir
  nenhum botão.

### Espelho: tempo total ao vivo
Enquanto monta o espelho, o **tempo total** aparece o tempo todo no topo (ao lado de "Baixar PDF")
e também na linha "Roteiro", junto com a divisão em conteúdo e break (passagens de bloco).
Atualiza sozinho a cada item adicionado, removido ou com a duração alterada. É o mesmo valor
que sai no rodapé do PDF ("TEMPO TOTAL"); antes só dava para ver baixando o PDF.


### Contas a pagar / a receber: Atrasado + Pendente juntos
No filtro de status existe a opção **Atrasado + Pendente**, que mostra de uma vez tudo o que ainda não foi pago. Os cartões de valores continuam separados.

### Espelho: aviso de alteração
- Quando alguém salva um espelho que já existia e algo mudou (itens colocados, tirados, trocados, ordem, textos/tempos, data, programa, título), o servidor guarda quando, quem e o quê (`alteradoEm`, `alteradoPorId`, `alteradoPorNome`, `alteracao`). Salvar sem mudar nada não gera aviso, e o cliente não consegue forjar esses campos.
- Para quem já tinha visto o espelho (ou nunca o abriu, mas ele mudou depois da sua primeira visita), a lista mostra a etiqueta **Atualizado** com o resumo ("fulano trocou X por Y"), o contador do menu soma novos + atualizados e chega uma notificação do navegador.
- Ao abrir um espelho atualizado, o editor mostra um aviso com o que mudou; a marca de "visto" é renovada, então uma nova alteração volta a avisar. Quem fez a alteração não é avisado.

### Espelho: trocar um item por outro
Cada item do roteiro tem o botão **Trocar por…** (matéria, entrevistado ou item manual). O escolhido assume a mesma posição do item trocado (se escolher vários, os demais entram logo depois). Passagens de bloco não são trocáveis.

### Espelho: veiculação automática ao alterar
Ao salvar o espelho, as datas de veiculação em Matérias e Entrevistados acompanham o roteiro: colocar marca "dia + programa do espelho"; tirar ou trocar desmarca (a menos que outro espelho do mesmo dia e programa ainda use o item); mudar a data/programa move a marca. **Só acontece quando uma pessoa salva.** A expiração automática do espelho (e a exclusão do espelho) não mexe nas veiculações já registradas. Se faltar permissão de Editar em Matérias/Entrevistados, o aviso na tela lista o que não foi atualizado.
