import { API_BASE, apiFetch, safeJson } from "./client.js";

async function apiGetBackupConfig() {
  const res = await apiFetch(`${API_BASE}/backup/config`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar a configuração de backup");
  return res.json();
}

async function apiGetBackupResumo() {
  const res = await apiFetch(`${API_BASE}/backup/resumo`);
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao carregar o resumo");
  return res.json();
}

async function apiSetBackupConfig(payload) {
  const res = await apiFetch(`${API_BASE}/backup/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao salvar a configuração de backup");
  return res.json();
}

async function apiSendTestBackup(email) {
  const res = await apiFetch(`${API_BASE}/backup/send-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao enviar o e-mail de teste");
  return res.json();
}

async function apiRestoreBackup(backupJson) {
  const res = await apiFetch(`${API_BASE}/backup/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(backupJson),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || "Falha ao restaurar o backup");
  return res.json();
}


export { apiGetBackupResumo, apiGetBackupConfig, apiSetBackupConfig, apiSendTestBackup, apiRestoreBackup };
