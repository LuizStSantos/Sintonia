import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BrandIcon } from "./components/common/BrandIcon.jsx";
import { X, Menu, LogOut, ListChecks, Bell, Settings, MessageCircle, Home } from "lucide-react";

import { apiGetFuso } from "./api/configuracoes.js";
import { setFuso, getFuso } from "./lib/fuso.js";
import { COLLECTIONS, apiCreate, apiUpdate, apiDelete, loadAllData, setUnauthorizedHandler } from "./api/client.js";
import { authLogout, authMe } from "./api/auth.js";
import { showBrowserNotification, applyRealtimeEvent, emitRealtimeMessage, setSocketSend, getKnownBuildId, setKnownBuildId } from "./lib/realtime.js";
import { primeirosDoisNomes } from "./lib/text.js";
import { formatDateBR } from "./lib/dates.js";
import { formatBRL } from "./lib/validators.js";

import { LiveClock } from "./components/common/LiveClock.jsx";
import { AppCredit } from "./components/common/AppCredit.jsx";
import { ThemeToggle } from "./components/common/ThemeToggle.jsx";
import { LoginScreen } from "./components/auth/LoginScreen.jsx";

import { MateriasTab } from "./features/materias/MateriasTab.jsx";
const ContasAPagarTab = lazy(() => import("./features/financeiro/ContasAPagarTab.jsx").then((m) => ({ default: m.ContasAPagarTab })));
const ContasAReceberTab = lazy(() => import("./features/financeiro/ContasAReceberTab.jsx").then((m) => ({ default: m.ContasAReceberTab })));
const ColaboradoresTab = lazy(() => import("./features/colaboradores/ColaboradoresTab.jsx").then((m) => ({ default: m.ColaboradoresTab })));
const ContatosTab = lazy(() => import("./features/contatos/ContatosTab.jsx").then((m) => ({ default: m.ContatosTab })));
const ProgramasTab = lazy(() => import("./features/programas/ProgramasTab.jsx").then((m) => ({ default: m.ProgramasTab })));
const EntrevistadosTab = lazy(() => import("./features/entrevistados/EntrevistadosTab.jsx").then((m) => ({ default: m.EntrevistadosTab })));
const ClientesFornecedoresTab = lazy(() => import("./features/clientesFornecedores/ClientesFornecedoresTab.jsx").then((m) => ({ default: m.ClientesFornecedoresTab })));
const OpecTab = lazy(() => import("./features/opec/OpecTab.jsx").then((m) => ({ default: m.OpecTab })));
const AtalhosTab = lazy(() => import("./features/atalhos/AtalhosTab.jsx").then((m) => ({ default: m.AtalhosTab })));
const EspelhoTab = lazy(() => import("./features/espelho/EspelhoTab.jsx").then((m) => ({ default: m.EspelhoTab })));
const TodoTab = lazy(() => import("./features/todo/TodoTab.jsx").then((m) => ({ default: m.TodoTab })));
const InicioTab = lazy(() => import("./features/inicio/InicioTab.jsx").then((m) => ({ default: m.InicioTab })));
const ChatTab = lazy(() => import("./features/chat/ChatTab.jsx").then((m) => ({ default: m.ChatTab })));
import { ChatProvider } from "./features/chat/ChatContext.jsx";
import { ChatFloatingWidget } from "./features/chat/ChatFloatingWidget.jsx";
import { ChatNavBadge } from "./features/chat/ChatNavBadge.jsx";
import { TodoNavBadge } from "./features/todo/TodoNavBadge.jsx";
import { EspelhoNavBadge } from "./features/espelho/EspelhoNavBadge.jsx";
import { apiListTodos } from "./api/todos.js";
import { atualizarPendentes, adicionarPendente, tarefasNaoAvisadas, marcarAvisada } from "./lib/todoPendentes.js";
const ConfiguracoesTab = lazy(() => import("./features/configuracoes/ConfiguracoesTab.jsx").then((m) => ({ default: m.ConfiguracoesTab })));

import { TABS } from "./config/tabs.js";
import { haAlteracoesNaoSalvas } from "./lib/saidaGuard.js";
import { ConfirmDialog } from "./components/common/ConfirmDialog.jsx";

export default function App() {
  const [authState, setAuthState] = useState("loading"); // loading | anon | authed
  const [currentUser, setCurrentUser] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState("inicio");
  // Aba que a pessoa tentou abrir enquanto tinha alterações não salvas (ex.: um
  // espelho em montagem) — enquanto tiver valor, mostra "Sair sem salvar?".
  const [abaPendente, setAbaPendente] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(false);
  const [notifPromptVisible, setNotifPromptVisible] = useState(false);

  // Se o navegador suporta notificação e a pessoa ainda não decidiu
  // (aceitar/recusar) e não dispensou o aviso antes, mostra o convite.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const dismissed = localStorage.getItem("sintonia:notif-dismissed");
    if (Notification.permission === "default" && !dismissed) {
      setNotifPromptVisible(true);
    }
  }, []);

  const ativarNotificacoes = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().finally(() => setNotifPromptVisible(false));
  };
  const dispensarNotifPrompt = () => {
    localStorage.setItem("sintonia:notif-dismissed", "1");
    setNotifPromptVisible(false);
  };

  // Verifica se já existe uma sessão válida (cookie) ao abrir o app
  useEffect(() => {
    authMe()
      .then((u) => {
        setCurrentUser(u);
        setAuthState("authed");
      })
      .catch(() => setAuthState("anon"));
  }, []);

  // Se qualquer chamada à API voltar 401 (sessão expirada), derruba pra tela de login
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCurrentUser(null);
      setData(null);
      setAuthState("anon");
    });
  }, []);

  useEffect(() => {
    if (authState !== "authed" || !currentUser) return;
    const isAdmin = currentUser.role === "admin";
    const accessibleCollections = isAdmin
      ? COLLECTIONS
      : COLLECTIONS.filter((c) => (currentUser.permissions?.[c] || "none") !== "none");

    // Entrevistas com a data já passada são marcadas como inativas
    // automaticamente (não apagadas!) pelo servidor — ver
    // pruneEntrevistadosELog em server/index.js. Isso roda a cada leitura
    // da coleção "entrevistados" e periodicamente no servidor, então já
    // chega pronto aqui; não precisa (e não deve) ser refeito no cliente,
    // pra não atribuir a ação automática a quem por acaso estava logado.
    // O fuso horário do sistema precisa estar definido ANTES de mostrar os
    // dados, senão "hoje" e os horários piscariam no fuso errado.
    Promise.all([
      loadAllData(accessibleCollections),
      apiGetFuso().then((c) => setFuso(c.fuso)).catch(() => {}),
    ])
      .then(([loaded]) => setData(loaded))
      .catch((e) => setLoadError(e.message));
  }, [authState, currentUser]);

  // Número de tarefas não concluídas no menu + aviso de tarefas que alguém
  // atribuiu enquanto a pessoa estava fora.
  useEffect(() => {
    if (authState !== "authed" || !currentUser) return;
    apiListTodos()
      .then((todos) => {
        atualizarPendentes(todos, currentUser.id);
        const novas = tarefasNaoAvisadas(todos, currentUser.id);
        if (novas.length === 1) {
          const t = novas[0];
          showBrowserNotification("Nova tarefa no TO-DO", `${t.atribuidaPor || "Alguém"} atribuiu a você: ${t.texto}`);
        } else if (novas.length > 1) {
          showBrowserNotification("Novas tarefas no TO-DO", `Você recebeu ${novas.length} tarefas novas enquanto estava fora.`);
        }
      })
      .catch(() => {});
  }, [authState, currentUser?.id]);

  // Conexão em tempo real: mantém os dados sincronizados entre todos os
  // usuários conectados, sem precisar dar refresh na página. Reconecta
  // sozinho se a conexão cair (ex: instabilidade de rede).
  useEffect(() => {
    if (authState !== "authed" || !currentUser) return;
    let socket;
    let reconnectTimer;
    let closedIntentionally = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      // Deixa outras partes da árvore (o Chat, pro indicador de
      // "digitando...") mandarem mensagens pelo mesmo socket.
      setSocketSend((m) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
      });

      socket.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (msg.type === "hello") {
          if (getKnownBuildId() && getKnownBuildId() !== msg.buildId) {
            // O servidor reiniciou com código novo (deploy) enquanto essa
            // aba estava aberta — recarrega sozinho pra pegar a versão nova.
            setUpdateNoticeVisible(true);
            setTimeout(() => window.location.reload(), 1500);
            return;
          }
          setKnownBuildId(msg.buildId);
          return;
        }
        if (msg.type === "fuso-config" && msg.payload?.fuso && msg.payload.fuso !== getFuso()) {
          // O admin trocou o fuso: recarrega para todo mundo ficar igual.
          setUpdateNoticeVisible(true);
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        emitRealtimeMessage(msg);
        if (msg.type === "account-updated") {
          authMe().then(setCurrentUser).catch(() => {});
        } else if (msg.type === "account-deleted") {
          handleLogout();
        } else if (msg.type === "todo-created") {
          // O servidor já garante que só quem precisa saber recebe isso
          // (a pessoa atribuída + outros admins) — nunca quem criou.
          const quem = msg.payload?.atribuidaPor || msg.payload?.userName;
          if (msg.payload) {
            adicionarPendente(msg.payload, currentUser.id);
            marcarAvisada(msg.payload.id, currentUser.id);
          }
          showBrowserNotification(
            "Nova tarefa no TO-DO",
            quem ? `${quem} adicionou: ${msg.payload.texto}` : msg.payload?.texto || "Uma nova tarefa foi adicionada."
          );
        } else if (msg.type === "todo-completed") {
          // Só chega pra quem atribuiu a tarefa a outra pessoa.
          showBrowserNotification(
            "Tarefa concluída",
            `${msg.payload?.concluidaPor || msg.payload?.userName || "Alguém"} concluiu: ${msg.payload?.texto || ""}`
          );
        } else if (msg.collection) {
          if (msg.type === "created" && msg.collection === "materias" && msg.actorId !== currentUser?.id) {
            showBrowserNotification("Nova matéria", msg.payload?.titulo || "Uma nova matéria foi adicionada.");
          }
          if (msg.type === "created" && msg.collection === "espelho" && msg.actorId !== currentUser?.id) {
            const nome = msg.payload?.titulo || "Espelho";
            const dataVeiculacao = msg.payload?.data ? formatDateBR(msg.payload.data) : "";
            showBrowserNotification("Novo espelho adicionado", dataVeiculacao ? `${nome} — ${dataVeiculacao}` : nome);
          }
          if (msg.type === "updated" && msg.collection === "espelho" && msg.actorId !== currentUser?.id && msg.payload?.alteracao) {
            showBrowserNotification("Espelho alterado", `${msg.payload.alteradoPorNome || "Alguém"} ${msg.payload.alteracao} — ${msg.payload.titulo || "Espelho"}`);
          }
          if (msg.type === "conta-atrasada" && (msg.collection === "contasReceber" || msg.collection === "contasPagar")) {
            // Aviso automático do sistema (venceu e ainda tava "Pendente") —
            // o servidor só manda essa mensagem pra quem tem permissão de
            // ver a coleção em questão ("contasReceber" = Contas a receber,
            // "contasPagar" = Contas a pagar — ver canView em realtime.js),
            // então não precisa checar de novo aqui quem deve ou não receber.
            const titulo = msg.collection === "contasReceber" ? "Conta atrasada" : "Conta a pagar atrasada";
            const cliente = msg.payload?.cliente || "Cliente";
            const valor = msg.payload?.valor != null ? formatBRL(msg.payload.valor) : "";
            const venceu = msg.payload?.vencimento ? formatDateBR(msg.payload.vencimento) : "";
            showBrowserNotification(titulo, `${cliente}${valor ? ` — ${valor}` : ""}${venceu ? ` (venceu em ${venceu})` : ""}`);
          }
          setData((prev) => applyRealtimeEvent(prev, msg));
        }
      };

      socket.onclose = () => {
        if (closedIntentionally) return;
        reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      closedIntentionally = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [authState, currentUser?.id]);

  const createItem = useCallback(async (key, item) => {
    const saved = await apiCreate(key, item);
    setData((prev) => {
      // Se o aviso em tempo real (WebSocket) já adicionou esse item antes
      // dessa resposta chegar, não adiciona de novo (evita duplicar na tela)
      if (prev[key].some((i) => i.id === saved.id)) return prev;
      return {
        ...prev,
        [key]: key === "opec" ? [...prev[key], saved] : [saved, ...prev[key]],
      };
    });
  }, []);

  const updateItemInList = useCallback(async (key, item) => {
    const saved = await apiUpdate(key, item);
    setData((prev) => ({
      ...prev,
      [key]: prev[key].map((i) => (i.id === saved.id ? saved : i)),
    }));
  }, []);

  const removeItem = useCallback(async (key, id) => {
    await apiDelete(key, id);
    setData((prev) => ({
      ...prev,
      [key]: prev[key].filter((i) => i.id !== id),
    }));
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAuthState("authed");
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch (e) {
      /* mesmo se der erro na chamada, derruba a sessão local */
    }
    setCurrentUser(null);
    setData(null);
    setAuthState("anon");
  };

  if (authState === "loading") {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-text">Carregando...</div>
      </div>
    );
  }

  if (authState === "anon" || !currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === "admin";
  const permittedTabs = isAdmin ? TABS : TABS.filter((t) => (currentUser.permissions?.[t.id] || "none") !== "none");
  const visibleTabs = [
    { id: "inicio", label: "Início", icon: Home },
    ...permittedTabs,
    { id: "todos", label: "TO-DO", icon: ListChecks },
    { id: "chat", label: "Chat", icon: MessageCircle },
    ...(isAdmin ? [{ id: "configuracoes", label: "Configurações", icon: Settings }] : []),
  ];

  const effectiveActiveTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id || null;

  const canEditTab = (tabId) => isAdmin || currentUser.permissions?.[tabId] === "edit";

  if (loadError) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-text">
          Não foi possível conectar ao servidor.<br />
          Verifique se o back-end está rodando ({loadError}).
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-text">Carregando painel...</div>
      </div>
    );
  }

  const activeMeta = visibleTabs.find((t) => t.id === effectiveActiveTab);

  return (
    <ChatProvider currentUser={currentUser}>
    <div className="app-shell">

      {updateNoticeVisible && (
        <div className="update-notice">Nova versão disponível — atualizando a página...</div>
      )}

      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand">
          <BrandIcon size={36} />
          <div className="brand-text">
            <div className="brand-title">Sintonia</div>
            <div className="brand-sub">v{__APP_VERSION__}</div>
          </div>
        </div>

        <nav className="nav">
          {visibleTabs.length === 0 && (
            <p className="no-access-hint">Você ainda não tem acesso a nenhuma aba. Fale com um administrador.</p>
          )}
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`nav-item ${effectiveActiveTab === t.id ? "active" : ""}`}
                onClick={() => {
                  setMobileNavOpen(false);
                  if (t.id !== effectiveActiveTab && haAlteracoesNaoSalvas()) {
                    setAbaPendente(t.id);
                    return;
                  }
                  setActiveTab(t.id);
                }}
              >
                <Icon size={17} strokeWidth={2} />
                <span>{t.label}</span>
                {t.id === "chat" ? <ChatNavBadge /> : t.id === "todos" ? <TodoNavBadge /> : t.id === "espelho" ? <EspelhoNavBadge items={data?.espelho} userId={currentUser.id} /> : t.badge ? <span className="nav-badge">{t.badge > 99 ? "99+" : t.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="user-block">
          <div className="user-block-name" title={currentUser.username}>
            {primeirosDoisNomes(currentUser.nomeCompleto) || currentUser.username}
            {isAdmin && <span className="user-admin-tag">Admin</span>}
          </div>
          <ThemeToggle className="sidebar-theme-toggle" />
          <button className="btn-ghost user-logout-btn" onClick={handleLogout}>
            <LogOut size={14} strokeWidth={2.2} />
            Sair
          </button>
        </div>

        <LiveClock />
        <AppCredit />
      </aside>

      {mobileNavOpen && <div className="mobile-overlay" onClick={() => setMobileNavOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div>
            <h1>{activeMeta ? activeMeta.label : "Sem acesso"}</h1>
          </div>
        </header>

        {notifPromptVisible && (
          <div className="notif-banner">
            <Bell size={16} />
            <span>Ative as notificações do navegador pra saber na hora quando alguém adicionar uma matéria ou te atribuir uma tarefa no TO-DO.</span>
            <button className="btn-primary" onClick={ativarNotificacoes}>Ativar notificações</button>
            <button className="icon-btn" onClick={dispensarNotifPrompt} aria-label="Dispensar">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="content">
          <Suspense fallback={<p className="no-access-hint">Carregando…</p>}>
          {effectiveActiveTab === "inicio" && (
            <InicioTab currentUser={currentUser} data={data} onNavigate={(id) => setActiveTab(id)} />
          )}
          {effectiveActiveTab === "materias" && (
            <MateriasTab
              items={data.materias}
              canEdit={canEditTab("materias")}
              onCreate={(item) => createItem("materias", item)}
              onUpdate={(item) => updateItemInList("materias", item)}
              onDelete={(id) => removeItem("materias", id)}
              programasItems={data.programas}
            />
          )}
          {effectiveActiveTab === "contasPagar" && (
            <ContasAPagarTab
              items={data.contasPagar}
              canEdit={canEditTab("contasPagar")}
              onCreate={(item) => createItem("contasPagar", item)}
              onUpdate={(item) => updateItemInList("contasPagar", item)}
              onDelete={(id) => removeItem("contasPagar", id)}
              clientesCadastroItems={data.clientesFornecedores}
              colaboradoresItems={data.colaboradores}
            />
          )}
          {effectiveActiveTab === "colaboradores" && (
            <ColaboradoresTab
              items={data.colaboradores}
              canEdit={canEditTab("colaboradores")}
              onCreate={(item) => createItem("colaboradores", item)}
              onUpdate={(item) => updateItemInList("colaboradores", item)}
              onDelete={(id) => removeItem("colaboradores", id)}
            />
          )}
          {effectiveActiveTab === "contatos" && (
            <ContatosTab
              items={data.contatos}
              canEdit={canEditTab("contatos")}
              onCreate={(item) => createItem("contatos", item)}
              onUpdate={(item) => updateItemInList("contatos", item)}
              onDelete={(id) => removeItem("contatos", id)}
            />
          )}
          {effectiveActiveTab === "entrevistados" && (
            <EntrevistadosTab
              items={data.entrevistados}
              canEdit={canEditTab("entrevistados")}
              onCreate={(item) => createItem("entrevistados", item)}
              onUpdate={(item) => updateItemInList("entrevistados", item)}
              onDelete={(id) => removeItem("entrevistados", id)}
              programasItems={data.programas}
            />
          )}
          {effectiveActiveTab === "programas" && (
            <ProgramasTab
              items={data.programas}
              canEdit={canEditTab("programas")}
              onCreate={(item) => createItem("programas", item)}
              onUpdate={(item) => updateItemInList("programas", item)}
              onDelete={(id) => removeItem("programas", id)}
            />
          )}
          {effectiveActiveTab === "clientesFornecedores" && (
            <ClientesFornecedoresTab
              items={data.clientesFornecedores}
              canEdit={canEditTab("clientesFornecedores")}
              onCreate={(item) => createItem("clientesFornecedores", item)}
              onUpdate={(item) => updateItemInList("clientesFornecedores", item)}
              onDelete={(id) => removeItem("clientesFornecedores", id)}
            />
          )}
          {effectiveActiveTab === "contasReceber" && (
            <ContasAReceberTab
              items={data.contasReceber}
              canEdit={canEditTab("contasReceber")}
              onCreate={(item) => createItem("contasReceber", item)}
              onUpdate={(item) => updateItemInList("contasReceber", item)}
              onDelete={(id) => removeItem("contasReceber", id)}
              onNavigateToClientes={() => setActiveTab("contasPagar")}
              clientesItems={data.contasPagar}
              clientesCadastroItems={data.clientesFornecedores}
            />
          )}
          {effectiveActiveTab === "opec" && (
            <OpecTab
              items={data.opec}
              canEdit={canEditTab("opec")}
              onCreate={(item) => createItem("opec", item)}
              onUpdate={(item) => updateItemInList("opec", item)}
              onDelete={(id) => removeItem("opec", id)}
              clientesCadastroItems={data.clientesFornecedores}
              programasItems={data.programas}
            />
          )}
          {effectiveActiveTab === "espelho" && (
            <EspelhoTab
              items={data.espelho}
              canEdit={canEditTab("espelho")}
              onCreate={(item) => createItem("espelho", item)}
              onUpdate={(item) => updateItemInList("espelho", item)}
              onDelete={(id) => removeItem("espelho", id)}
              programasItems={data.programas}
              videosItems={data.materias}
              entrevistadosItems={data.entrevistados}
              breaksItems={data.opec}
              currentUser={currentUser}
              onUpdateVideo={(item) => updateItemInList("materias", item)}
              onUpdateEntrevistado={(item) => updateItemInList("entrevistados", item)}
            />
          )}
          {effectiveActiveTab === "atalhos" && (
            <AtalhosTab
              items={data.atalhos}
              canEdit={canEditTab("atalhos")}
              onCreate={(item) => createItem("atalhos", item)}
              onUpdate={(item) => updateItemInList("atalhos", item)}
              onDelete={(id) => removeItem("atalhos", id)}
            />
          )}
          {effectiveActiveTab === "todos" && (
            <TodoTab currentUser={currentUser} />
          )}
          {effectiveActiveTab === "chat" && <ChatTab />}
          {effectiveActiveTab === "configuracoes" && isAdmin && (
            <ConfiguracoesTab currentUser={currentUser} onRestore={() => window.location.reload()} />
          )}
          {!effectiveActiveTab && (
            <p className="no-access-hint">Você ainda não tem acesso a nenhuma aba. Fale com um administrador.</p>
          )}
          </Suspense>
        </div>
      </main>
    </div>
    <ConfirmDialog
      open={!!abaPendente}
      title="Sair sem salvar?"
      message="Você tem alterações que ainda não foram salvas. Se sair desta aba agora, tudo que foi feito será perdido."
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      onCancel={() => setAbaPendente(null)}
      onConfirm={() => { setActiveTab(abaPendente); setAbaPendente(null); }}
    />
    <ChatFloatingWidget ativo={effectiveActiveTab !== "chat"} />
    </ChatProvider>
  );
}

