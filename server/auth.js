import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "data.db");
// Guarda o segredo do JWT ao lado do banco, para sobreviver a reinícios do
// container (mesmo volume). Se DB_PATH apontar para um volume Docker, o
// segredo persiste junto com os dados — sessões continuam válidas depois
// de um `docker compose up` novo, mas são todas invalidadas se o volume
// for apagado (o que é aceitável, já que os usuários também somem juntos).
const secretFile = path.join(path.dirname(dbPath), ".jwt-secret");

function loadOrCreateSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    const existing = fs.readFileSync(secretFile, "utf8").trim();
    if (existing) return existing;
  } catch (e) {
    /* ainda não existe — cria abaixo */
  }
  const secret = crypto.randomBytes(48).toString("hex");
  try {
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  } catch (e) {
    console.error("[controle-tv] Não foi possível salvar o segredo JWT em disco:", e.message);
  }
  return secret;
}

const SECRET = loadOrCreateSecret();
const TOKEN_TTL = "12h";

// Usado só para cifrar a senha de e-mail guardada no banco (backup.js).
export function getAppSecret() {
  return SECRET;
}

export const COOKIE_NAME = "controle_tv_token";
export const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}
