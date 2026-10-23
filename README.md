# Sintonia — sistema de rotina para TV (rundown/gestão diária)

Projeto completo: front-end em React + back-end em Node/Express + banco de
dados SQLite (arquivo local, sem precisar instalar MySQL/Postgres) +
**sistema de login com usuários e permissões por aba** + **sincronização em
tempo real via WebSocket** (se um usuário cria, edita ou apaga algo, todos os
outros conectados veem a mudança na hora, sem precisar recarregar a página) +
**atualização automática após deploy** (quando você sobe uma versão nova com
`docker compose up -d --build`, todo mundo que estiver com o site aberto
recebe um aviso e a página recarrega sozinha, pegando o código novo — sem
precisar avisar ninguém, e sem perder o login).

```
controle-tv-db/
  server/     -> API (Express) + WebSocket (tempo real) + banco (SQLite) + autenticação
  client/     -> Front-end (React + Vite)
  docs/       -> documentação completa (ver abaixo)
```

## Documentação completa

Este README é só a porta de entrada. Para o resto, veja a pasta `docs/`:

- **[docs/FUNCIONALIDADES.md](./docs/FUNCIONALIDADES.md)** — o que cada aba
  faz (Matérias, OPEC, Espelho, Entrevistados, Financeiro, Relatórios,
  Usuários, Backup...), do ponto de vista de quem usa no dia a dia.
- **[docs/ARQUITETURA.md](./docs/ARQUITETURA.md)** — como o código do
  front-end está organizado (pastas `lib/`, `api/`, `components/`,
  `features/`...), com um guia de "onde eu mexo para..." por tipo de pedido.
- **[docs/API.md](./docs/API.md)** — rotas da API, autenticação, modelo de
  dados no banco e eventos do WebSocket.
- **[docs/DEPLOY.md](./docs/DEPLOY.md)** — instalar do zero num servidor,
  atualizar depois de uma mudança de código, backup/restauração pela linha
  de comando, e o que sobrevive (ou não) a uma atualização.

## Rodando com Docker (recomendado)

Um único comando sobe tudo (front, back e banco):

```
docker compose up -d --build
```

Acesse `http://SEU_SERVIDOR:3001`.

O banco SQLite fica num **volume Docker nomeado** (`controle-tv-data`), então
os dados sobrevivem a reinícios e atualizações do container. Guia completo de
instalação do zero, atualização e backup em [docs/DEPLOY.md](./docs/DEPLOY.md).

## Login — primeiro acesso

Na primeira vez que o servidor roda, ele cria automaticamente um usuário
administrador:

```
Usuário: admin
Senha:   admin123
```

**Troque essa senha assim que possível** (aba "Usuários" → editar o admin →
preencher "Nova senha"). Essa aba só aparece para usuários administradores.

### Como funcionam os usuários e permissões
- **Administrador**: vê e edita tudo, inclusive a aba "Usuários" (só admins a veem).
- **Usuário comum**: o admin escolhe, aba por aba, se a pessoa tem:
  - **Sem acesso** — a aba nem aparece no menu dela;
  - **Visualizar** — vê os dados mas não tem botão de criar/editar/excluir;
  - **Editar** — acesso completo naquela aba.
- Mudanças de permissão feitas pelo admin valem **na hora**, sem a pessoa
  precisar deslogar e logar de novo.
- Não é possível excluir ou rebaixar o único administrador restante (evita
  ficar todo mundo trancado pra fora do sistema).
- A sessão dura 12 horas (depois disso, pede login de novo).

### Importante sobre segurança
- Isso só existe nesta versão com servidor (Docker/Node). As outras versões
  do projeto (artifact do chat, `.zip` local com localStorage) **não têm
  login de verdade** — não dá pra proteger dados só no navegador, qualquer
  pessoa com acesso ao computador veria tudo pelo DevTools.
- Se for expor esse servidor na internet (não só na rede local), use HTTPS
  na frente (ex: Nginx, Caddy, Cloudflare Tunnel) e defina a variável de
  ambiente `COOKIE_SECURE=true` — sem HTTPS, o cookie de sessão trafega sem
  criptografia. Detalhes em [docs/DEPLOY.md](./docs/DEPLOY.md).
- O segredo usado para assinar as sessões (JWT) é gerado automaticamente e
  salvo num arquivo `.jwt-secret` ao lado do banco de dados. Se quiser fixar
  você mesmo, defina a variável de ambiente `JWT_SECRET`.

## Rodando sem Docker / desenvolvimento local

Ver [docs/DEPLOY.md](./docs/DEPLOY.md) — cobre instalação sem Docker, modo de
desenvolvimento (`npm run dev`) e onde ficam os dados nesse caso
(`server/data.db`).
