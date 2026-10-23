import { API_BASE, safeJson } from "./client.js";

async function authLogin(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const corpo = await safeJson(res);
    // 429 = bloqueio temporário por senhas erradas; `bloqueadoAte` deixa a tela travar o botão.
    throw Object.assign(new Error(corpo?.error || "Falha no login"), { bloqueadoAte: corpo?.bloqueadoAte || null });
  }
  return res.json();
}

async function authLogout() {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
}

async function authMe() {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("not authenticated");
  return res.json();
}


export { authLogin, authLogout, authMe };
