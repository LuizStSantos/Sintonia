# ---- Etapa 1: build do front-end ----
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ---- Etapa 2: servidor final ----
FROM node:20-slim AS server
WORKDIR /app/server

# Dependências apenas de produção (express, better-sqlite3, cors, bcryptjs, cookie-parser, jsonwebtoken, ws)
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ .
COPY --from=client-build /app/client/dist ../client/dist

ENV NODE_ENV=production
# Fuso horário: escolhido em Configurações → Geral (sem escolha, vale Brasília).
ENV PORT=3001
# Caminho do banco dentro do container — mapeie um volume para esta pasta
ENV DB_PATH=/data/data.db

EXPOSE 3001
VOLUME ["/data"]

CMD ["node", "index.js"]
