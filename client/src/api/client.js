const API_BASE = "/api";
const COLLECTIONS = ["materias", "contasPagar", "contasReceber", "colaboradores", "contatos", "clientesFornecedores", "entrevistados", "opec", "programas", "espelho", "atalhos"];

// Chamado sempre que uma requisição volta 401 (sessão expirada/inválida),
// para o App derrubar o usuário de volta pra tela de login. É setado pelo
// próprio App logo no primeiro render.
let handleUnauthorized = () => {};
function setUnauthorizedHandler(fn) {
  handleUnauthorized = fn;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Monta um Error com `.status` (código HTTP) anexado, além da mensagem —
// permite quem chama distinguir, por exemplo, "sem permissão" (403) de
// outras falhas, sem precisar comparar o texto da mensagem (que é só pra
// mostrar pro usuário, não pra lógica de código).
async function apiError(res, fallbackMsg) {
  const err = new Error((await safeJson(res))?.error || fallbackMsg);
  err.status = res.status;
  return err;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (res.status === 401) {
    handleUnauthorized();
  }
  return res;
}

async function apiList(col) {
  const res = await apiFetch(`${API_BASE}/${col}`);
  if (!res.ok) throw await apiError(res, `Falha ao carregar ${col}`);
  return res.json();
}

async function apiCreate(col, item) {
  const res = await apiFetch(`${API_BASE}/${col}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw await apiError(res, `Falha ao criar em ${col}`);
  return res.json();
}

async function apiUpdate(col, item) {
  const res = await apiFetch(`${API_BASE}/${col}/${item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw await apiError(res, `Falha ao atualizar em ${col}`);
  return res.json();
}

async function apiDelete(col, id) {
  const res = await apiFetch(`${API_BASE}/${col}/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw await apiError(res, `Falha ao excluir em ${col}`);
  }
}

async function loadAllData(accessibleCollections = COLLECTIONS) {
  const base = { materias: [], contasPagar: [], contasReceber: [], colaboradores: [], contatos: [], clientesFornecedores: [], entrevistados: [], opec: [], programas: [], espelho: [], atalhos: [] };
  const results = await Promise.all(accessibleCollections.map((c) => apiList(c)));
  accessibleCollections.forEach((c, i) => {
    base[c] = results[i];
  });
  return base;
}

// Aplica um evento recebido do WebSocket (criado/editado/excluído em alguma
// coleção) diretamente no estado local, sem precisar recarregar a página.
// É seguro receber o mesmo evento mais de uma vez (idempotente): se o item
// já existe (ex: foi você mesmo quem criou), não duplica.
// Notificações nativas do navegador — avisa a pessoa mesmo se ela estiver
// numa aba diferente do sistema (ou minimizado), sem precisar ficar
// checando a tela o tempo todo. Só funciona se o navegador suportar E a
// pessoa tiver autorizado (ver NotificationPermissionBanner).
// Ícone embutido diretamente como data URI (em vez de "/favicon.svg") pra
// nunca depender do navegador ter uma cópia em cache do favicon — alguns
// navegadores guardam o ícone de notificação por muito tempo, e se o
// favicon mudar depois (como aconteceu ao trocar o logo pra Sintonia), a
// notificação continuava mostrando o ícone antigo até isso ser corrigido.

// Monta a URL de uma foto de perfil (de usuário ou de grupo de conversa) a
// partir do nome do arquivo salvo no servidor — usado em vários lugares
// (Chat, Usuários), então fica aqui, não duplicado em cada api/*.js.
function avatarUrl(nomeArquivo) {
  return `${API_BASE}/avatars/${encodeURIComponent(nomeArquivo)}`;
}

export { API_BASE, COLLECTIONS, handleUnauthorized, setUnauthorizedHandler, safeJson, apiFetch, apiList, apiCreate, apiUpdate, apiDelete, loadAllData, avatarUrl };
