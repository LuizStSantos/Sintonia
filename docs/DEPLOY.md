# Deploy — instalar do zero, atualizar e fazer backup

Este guia cobre: instalar o Sintonia num servidor/VPS novo, atualizar depois
de uma mudança de código, e fazer backup/restauração do banco de dados pela
linha de comando (fora do sistema — para o backup pela própria interface,
ver **Configurações → Backup** e [FUNCIONALIDADES.md](./FUNCIONALIDADES.md)).

O jeito recomendado de rodar em produção é com **Docker** — um único
container roda o front-end (já compilado) e o back-end juntos, e o banco de
dados fica num volume Docker separado, que sobrevive a atualizações.

## 1. Instalação do zero num VPS novo

Pressupõe um VPS Linux (Ubuntu/Debian) limpo, acesso root ou sudo, e o
código do projeto (pasta `controle-tv-db/`) já copiado para o servidor (via
`git clone`, `scp`, upload de `.zip`, etc.).

### 1.1. Instalar o Docker (se ainda não tiver)
```bash
curl -fsSL https://get.docker.com | sh
```
Isso instala o Docker Engine e o plugin `docker compose`. Confirme com:
```bash
docker --version
docker compose version
```

### 1.2. Subir o sistema
Dentro da pasta do projeto (onde está o `docker-compose.yml`):
```bash
cd controle-tv-db
docker compose up -d --build
```
Isso builda a imagem (front-end React compilado + servidor Node) e sobe o
container em segundo plano. Na primeira execução, o servidor cria
automaticamente o banco de dados, alguns registros de exemplo e o usuário
administrador padrão.

### 1.3. Acessar
```
http://SEU_SERVIDOR:3001
```
Login padrão:
```
Usuário: admin
Senha:   admin123
```
**Troque essa senha assim que possível** (aba "Usuários" → editar o admin →
"Nova senha"). Essa aba só aparece para administradores.

### 1.4. Ajustes comuns antes ou logo depois de subir

Edite `docker-compose.yml` conforme a necessidade:

- **Trocar a porta exposta**: mude `ports: ["3001:3001"]` para, por exemplo,
  `ports: ["8080:3001"]` (a porta da esquerda é a externa).
- **IP real atrás de proxy (`TRUST_PROXY`)**: o bloqueio de senhas erradas conta por IP.
  Se o sistema fica atrás de Nginx, Cloudflare, Caddy ou outro proxy, defina
  `TRUST_PROXY=1` (número de proxies na frente) no `docker-compose.yml`; sem isso todos
  os acessos parecem vir do IP do proxy. Sem proxy, deixe como está (não defina).
- **Acesso por HTTPS** (domínio próprio, Cloudflare, proxy/load balancer com
  SSL na frente): defina `COOKIE_SECURE=true`. Sem isso, o navegador pode não
  guardar corretamente a sessão de login quando o acesso é por `https://`.
  Isso é a única mudança necessária do lado do Docker — a porta interna
  (`3001`) não precisa mudar, desde que o que estiver na frente (proxy, load
  balancer, ou a equipe cuidando do domínio) consiga alcançá-la.
  - Se for usar o **proxy do Cloudflare** (nuvem laranja) apontando direto
    para o Cloudflare: ele só repassa tráfego em portas específicas — HTTP:
    `80, 8080, 8880, 2052, 2082, 2086, 2095` / HTTPS: `443, 2053, 2083, 2087,
    2096, 8443`. A porta `3001` não está nessa lista, então nesse caso
    específico mapeie para uma porta suportada (ex: `ports: ["80:3001"]`).
    Isso não se aplica se o SSL já é resolvido por outro meio (proxy/load
    balancer próprio) apontando direto para a sua porta.
  - No painel do Cloudflare (SSL/TLS), use o modo **"Full"** (ou "Full
    strict" se o servidor tiver certificado próprio) e ative **"Always Use
    HTTPS"**.
- **Backup automático por e-mail**: **não se configura mais no
  `docker-compose.yml`.** Entre como administrador em **Configurações →
  Backup → Servidor de e-mail**, informe o servidor (botões prontos para
  Gmail e Outlook), o e-mail que envia e a senha de app, e salve. A senha
  fica guardada **cifrada** no banco (não aparece mais na tela e não entra
  no arquivo de backup) e vale enquanto o arquivo `.jwt-secret` do volume
  existir — se ele for apagado, é preciso digitar a senha de novo. Como
  está no volume de dados, **sobrevive a atualizações e a reextrair o
  `.zip`**. (Quem ainda tiver `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
  `SMTP_PASS`/`SMTP_FROM` no seu `docker-compose.yml` antigo continua
  funcionando: o sistema só usa essas variáveis se nada tiver sido salvo na
  tela.) Frequência, horário e e-mail de destino ficam na própria tela Configurações → Backup.
- **Fuso horário**: quem escolhe é o administrador, em Configurações → Geral
  (fica salvo no banco). Não precisa de nenhuma variável no Docker; sem escolha,
  vale Brasília. Se quiser outro fuso inicial, dá para definir `TZ` (ex.:
  `TZ=America/Manaus`) — ele só vale até alguém escolher na tela.

**Fotos e vídeos do Início:** ficam na pasta `inicio-arquivos`, ao lado do banco
(mesmo volume do Docker, então sobrevivem a atualizações). Não entram no backup
em JSON (o backup guarda os dados, não os arquivos) — se precisar preservá-los,
copie essa pasta junto com o banco. O layout de cada usuário (posição, textos e
links dos cartões) está no banco e entra normalmente.

**Anexos do Chat (tamanho, prazo e espaço):** por padrão cada arquivo pode ter
até 200MB, fica salvo 14 dias e a pasta de anexos tem teto de 20GB. Pra mudar,
use **Configurações → Chat → Regras dos anexos** (fica no banco, sobrevive a
atualizações). Não é mais necessário editar o `docker-compose.yml`; as
variáveis `ANEXO_MAX_MB`, `ANEXO_RETENCAO_DIAS` e `ANEXOS_QUOTA_GB` ainda
existem, mas só definem o valor padrão de quem as tiver no arquivo antigo.
Se o acesso passa por um proxy na frente do sistema, **o limite dele também
conta**: Nginx precisa de `client_max_body_size 200m;` (o padrão dele é 1MB) e
o plano gratuito do Cloudflare recusa envios acima de 100MB de uma vez — acima
disso o anexo falha mesmo com o sistema liberando 200MB. Garanta ainda que o
disco do servidor tem folga além dos 20GB do teto.

**Gravar áudio no Chat usa o microfone, e o navegador só libera o microfone em
endereço seguro** — `https://…` ou `http://localhost`. Com o HTTPS na frente
(como em produção) funciona normal. Abrindo direto pelo IP/porta da rede
interna (`http://192.168.x.x:3001`) o botão de gravar mostra um aviso e não
grava; nesse caso use o endereço https, ou anexe um arquivo de áudio pelo
clipe (isso funciona em qualquer endereço). Em um computador específico dá
pra liberar manualmente em `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
(adicionando o endereço) — só como quebra-galho.

Depois de editar `docker-compose.yml`, aplique com:
```bash
docker compose up -d
```
(não precisa `--build` se só mudou variáveis de ambiente, não o código).

## 2. Atualizar depois de uma mudança de código

### Se o código já está atualizado na pasta do servidor
```bash
cd controle-tv-db
docker compose up -d --build
```
Isso reconstrói a imagem com o código novo e reinicia o container. O banco
de dados **não é afetado** (fica no volume `controle-tv-data`, fora da
imagem). Quem estiver com o sistema aberto no navegador recebe um aviso
("Nova versão disponível") e a página recarrega sozinha, sem precisar avisar
ninguém manualmente e sem perder o login (ver
[API.md](./API.md#websocket-tempo-real) para como isso funciona).

Algumas atualizações incluem uma migração de banco pequena e automática
(ex: renomear uma tabela interna) — ela roda sozinha assim que o servidor
sobe, é segura de rodar mesmo que o servidor reinicie várias vezes seguidas
(não duplica nada se já tiver rodado antes) e não apaga nem altera dado
nenhum, só reorganiza como ele é identificado internamente. Se isso
acontecer, aparece uma linha tipo `[controle-tv] Migração: coleção "x"
renomeada para "y".` no log do container (`docker compose logs -f`) — é só
informativo, não precisa fazer nada.

### Se você está trocando os arquivos por completo (ex: apagar a pasta e reextrair um `.zip` novo)
Esse é o ponto que mais gera confusão, então vale destacar:

> **O volume nomeado `controle-tv-data` (o banco de dados) é gerenciado pelo
> Docker e sobrevive a `rm -rf` na pasta do projeto — mas o
> `docker-compose.yml` em si é só um arquivo dentro dessa pasta, e não
> sobrevive.** Se você apagar a pasta inteira do projeto e reextrair um
> `.zip` novo por cima, o `docker-compose.yml` novo vem com os valores
> padrão do repositório (`COOKIE_SECURE=true` já vem no padrão atual, mas
> **uma porta customizada que você tenha mudado anteriormente se perde**,
> porque é só texto naquele arquivo; o e-mail do backup e as regras do Chat
> ficam no banco e não se perdem).

Antes de apagar/substituir a pasta do projeto num update:
```bash
cp docker-compose.yml ~/docker-compose.yml.bak
```
E depois de reextrair o código novo, compare o `docker-compose.yml.bak` com
o novo e reaplique manualmente qualquer customização (porta,
`COOKIE_SECURE` se for diferente do padrão) antes de rodar
`docker compose up -d --build`.

O volume `controle-tv-data` (dados, usuários, senhas) é identificado pelo
**nome do projeto Docker Compose** (por padrão, o nome da pasta) — então, se
a pasta nova tiver exatamente o mesmo nome no mesmo caminho, o Docker
Compose volta a usar o mesmo volume automaticamente e os dados continuam lá.
Para conferir que o volume existe e qual é o nome real dele:
```bash
docker volume ls | grep controle-tv
docker volume inspect controle-tv-db_controle-tv-data
```

### Sem docker-compose (Docker puro)
```bash
docker build -t controle-tv .
docker run -d \
  --name controle-tv \
  -p 3001:3001 \
  -v controle-tv-data:/data \
  --restart unless-stopped \
  controle-tv
```
Para atualizar: pare e remova o container antigo (`docker stop controle-tv
&& docker rm controle-tv`), rebuilde a imagem e rode o `docker run` de novo
com o mesmo nome de volume (`-v controle-tv-data:/data`) — os dados
continuam no volume independente do container ser recriado.

### Parar o sistema (sem apagar dados)
```bash
docker compose down
```
Os dados continuam guardados no volume — só somem se você rodar
`docker compose down -v` (o `-v` remove os volumes também — **evite isso**
a menos que queira apagar tudo de propósito).

## 3. Backup e restauração

### Pela interface do sistema (recomendado no dia a dia)
Aba "Backup" (só administradores) — baixa/restaura um `.json` com tudo
(coleções, usuários, TO-DO), e pode agendar envio automático por e-mail. Ver
detalhes em [FUNCIONALIDADES.md](./FUNCIONALIDADES.md#backup-só-administradores).

### Pela linha de comando (backup direto do arquivo SQLite)
Útil como backup adicional/externo, sem depender do sistema estar no ar:
```bash
docker run --rm -v controle-tv-db_controle-tv-data:/data -v $(pwd):/backup debian \
  cp /data/data.db /backup/data-backup.db
```
Isso copia o arquivo `data.db` de dentro do volume para a pasta atual do seu
terminal. Guarde esse arquivo em local seguro (fora do próprio servidor, se
possível — um backup que mora no mesmo servidor não ajuda se o servidor
inteiro falhar).

Para restaurar um backup desse tipo (arquivo `.db` bruto), a forma mais
simples é copiar o arquivo de volta para dentro do volume, no lugar do
`data.db` atual, com o container parado:
```bash
docker compose stop
docker run --rm -v controle-tv-db_controle-tv-data:/data -v $(pwd):/backup debian \
  cp /backup/data-backup.db /data/data.db
docker compose start
```
Para restauração pela interface (arquivo `.json` gerado em Configurações → Backup, não
o `.db` bruto), use a própria tela **Configurações → Backup** — é mais simples e não exige
mexer em volume ou parar o container.

## 4. Rodando sem Docker (não recomendado para produção, mas possível)

Requer Node.js 18+ instalado no servidor (`node -v` para conferir).

```bash
cd server && npm install
cd ../client && npm install && npm run build
```
Isso gera `client/dist` — o servidor Express detecta essa pasta
automaticamente e passa a servir o site por ela.

```bash
cd ../server
npm start
```
Acesse `http://SEU_SERVIDOR:3001` (mesma porta serve o site e a API). Para
mudar a porta: `PORT=8080 npm start`.

Dados ficam em `server/data.db` (criado automaticamente na primeira
execução). Para começar do zero, apague esse arquivo (e `data.db-shm`,
`data.db-wal`, `.jwt-secret`, se existirem) e reinicie o servidor.

Para o servidor não cair quando você fechar o terminal, use o
[pm2](https://pm2.keymetrics.io/):
```bash
npm install -g pm2
cd server
pm2 start index.js --name controle-tv
pm2 save
pm2 startup
```

### Desenvolvimento local (com recarregamento automático do front)
Dois terminais separados:
```bash
cd server && npm start
```
```bash
cd client && npm run dev
```
O Vite abre em `http://localhost:5173` e encaminha `/api` e `/ws` para o
servidor na porta 3001 automaticamente (configurado em
`client/vite.config.js`).

## 5. Referência rápida — o que sobrevive a uma atualização e o que não

| Item | Sobrevive a `docker compose up -d --build`? | Sobrevive a apagar a pasta e reextrair o código? |
|---|---|---|
| Dados (matérias, clientes, usuários, senhas...) — volume `controle-tv-data` | Sim | Sim, **desde que o nome/caminho da pasta do projeto continue o mesmo** (o volume é por nome de projeto Compose) |
| `.jwt-secret` (dentro do volume, junto com o banco) | Sim | Sim (mesma razão acima) |
| Configurações em `docker-compose.yml` (porta customizada, `COOKIE_SECURE`) | Sim (o arquivo não muda sozinho) | **Não** — é só um arquivo de texto na pasta; se a pasta for apagada e recriada a partir de um `.zip`/`git clone` novo, essas edições se perdem e voltam ao padrão do repositório |
| Configuração de backup automático (frequência, horário, e-mail) — salva no banco | Sim | Sim (está no banco, não no `docker-compose.yml`) |

**Resumo prático**: antes de qualquer atualização que envolva apagar e
recriar a pasta do projeto, guarde uma cópia do `docker-compose.yml` em
outro lugar. O banco de dados está seguro (no volume Docker); o arquivo de
configuração do Compose, não.
