import { useEffect, useState } from "react";
import { Plus, Users as UsersIcon, Settings, MessageCircle, ArrowLeft } from "lucide-react";
import { ChatNovaConversaModal } from "./ChatNovaConversaModal.jsx";
import { ChatGrupoModal } from "./ChatGrupoModal.jsx";
import { ChatThreadBody } from "./ChatThreadBody.jsx";
import { Avatar } from "../../components/common/Avatar.jsx";
import { useChat } from "./ChatContext.jsx";

export function ChatTab() {
  const {
    currentUser, conversas, usuarios, onlineIds, carregando, nomeConversa, fotoConversa, outroParticipanteId,
    marcarVisivel, desmarcarVisivel, garantirMensagensCarregadas,
    criarConversaPrivada, criarGrupo, renomearGrupo, apagarGrupo, adicionarParticipantes, removerParticipante,
    definirFotoGrupo, removerFotoGrupo,
  } = useChat();

  const [conversaAtivaId, setConversaAtivaId] = useState(null);
  const [busca, setBusca] = useState("");
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const [grupoModalAberto, setGrupoModalAberto] = useState(false);

  // Marca a conversa aberta como "visível" (pra não contar/notificar
  // mensagem dela como não lida) enquanto essa aba estiver com ela
  // selecionada — desmarca automaticamente ao trocar de conversa ou ao sair
  // da aba Chat (quando o componente desmonta).
  useEffect(() => {
    if (!conversaAtivaId) return;
    marcarVisivel(conversaAtivaId);
    garantirMensagensCarregadas(conversaAtivaId);
    return () => desmarcarVisivel(conversaAtivaId);
  }, [conversaAtivaId, marcarVisivel, desmarcarVisivel, garantirMensagensCarregadas]);

  const conversaAtiva = conversas.find((c) => c.id === conversaAtivaId) || null;

  // Se o grupo ativo deixou de existir pra essa pessoa (foi removida /
  // saiu em outro dispositivo), fecha a conversa sozinho.
  useEffect(() => {
    if (conversaAtivaId && !conversaAtiva) setConversaAtivaId(null);
  }, [conversaAtivaId, conversaAtiva]);

  const conversasFiltradas = conversas.filter((c) => {
    if (!busca.trim()) return true;
    return nomeConversa(c).toLowerCase().includes(busca.trim().toLowerCase());
  });

  const abrirPrivada = async (outroUserId) => {
    const c = await criarConversaPrivada(outroUserId);
    setConversaAtivaId(c.id);
    setNovaConversaAberta(false);
  };

  const criarGrupoENavegar = async (nome, participantes) => {
    const c = await criarGrupo(nome, participantes);
    setConversaAtivaId(c.id);
    setNovaConversaAberta(false);
  };

  const sairDoGrupo = async () => {
    await removerParticipante(conversaAtiva.id, currentUser.id);
    setConversaAtivaId(null);
    setGrupoModalAberto(false);
  };

  const apagarGrupoENavegar = async () => {
    await apagarGrupo(conversaAtiva.id);
    setConversaAtivaId(null);
    setGrupoModalAberto(false);
  };

  if (carregando) {
    return <p className="chat-vazio-hint" style={{ padding: 20 }}>Carregando conversas...</p>;
  }

  return (
    <div className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div className="chat-busca-usuario">
            <input type="text" placeholder="Buscar conversa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <button className="btn-primary chat-nova-btn" onClick={() => setNovaConversaAberta(true)} title="Nova conversa">
            <Plus size={16} />
          </button>
        </div>

        <div className="chat-conversas-lista">
          {conversasFiltradas.length === 0 && (
            <p className="chat-vazio-hint">
              {busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Clique em + para começar."}
            </p>
          )}
          {conversasFiltradas.map((c) => {
            const outroId = outroParticipanteId(c);
            const isOnline = c.tipo === "grupo"
              ? c.participantes.some((p) => p !== currentUser.id && onlineIds.has(p))
              : onlineIds.has(outroId);
            const preview = c.ultimaMensagem
              ? (c.ultimaMensagem.texto || (c.ultimaMensagem.anexo ? (c.ultimaMensagem.anexo.tipo?.startsWith("audio/") ? "🎤 Áudio" : `📎 ${c.ultimaMensagem.anexo.nomeOriginal}`) : ""))
              : "Nenhuma mensagem ainda";
            return (
              <button
                key={c.id}
                className={`chat-conversa-row ${conversaAtivaId === c.id ? "active" : ""}`}
                onClick={() => setConversaAtivaId(c.id)}
              >
                <span className="chat-avatar-wrap">
                  <Avatar nome={nomeConversa(c)} foto={fotoConversa(c)} icon={c.tipo === "grupo" ? UsersIcon : undefined} />
                  {isOnline && <span className="chat-online-dot" />}
                </span>
                <span className="chat-conversa-info">
                  <span className="chat-conversa-nome">{nomeConversa(c)}</span>
                  <span className="chat-conversa-preview">{preview}</span>
                </span>
                {c.naoLidas > 0 && <span className="chat-conversa-badge">{c.naoLidas > 99 ? "99+" : c.naoLidas}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="chat-thread">
        {!conversaAtiva ? (
          <div className="chat-thread-vazio">
            <MessageCircle size={40} strokeWidth={1.3} />
            <p>Escolha uma conversa ao lado ou comece uma nova.</p>
          </div>
        ) : (
          <>
            <header className="chat-thread-header">
              <button className="icon-btn mobile-only" onClick={() => setConversaAtivaId(null)} aria-label="Voltar">
                <ArrowLeft size={18} />
              </button>
              <span className="chat-avatar-wrap">
                <Avatar nome={nomeConversa(conversaAtiva)} foto={fotoConversa(conversaAtiva)} icon={conversaAtiva.tipo === "grupo" ? UsersIcon : undefined} />
              </span>
              <div className="chat-thread-header-info">
                <strong>{nomeConversa(conversaAtiva)}</strong>
                {conversaAtiva.tipo === "grupo" ? (
                  <span className="chat-thread-header-sub">{conversaAtiva.participantes.length} participantes</span>
                ) : (
                  <span className="chat-thread-header-sub">
                    {onlineIds.has(outroParticipanteId(conversaAtiva)) ? "online" : "offline"}
                  </span>
                )}
              </div>
              {conversaAtiva.tipo === "grupo" && (
                <button className="icon-btn" title="Gerenciar grupo" onClick={() => setGrupoModalAberto(true)}>
                  <Settings size={17} />
                </button>
              )}
            </header>

            <ChatThreadBody conversa={conversaAtiva} />
          </>
        )}
      </section>

      {novaConversaAberta && (
        <ChatNovaConversaModal
          usuarios={usuarios}
          onClose={() => setNovaConversaAberta(false)}
          onEscolherPrivada={abrirPrivada}
          onCriarGrupo={criarGrupoENavegar}
        />
      )}

      {grupoModalAberto && conversaAtiva?.tipo === "grupo" && (
        <ChatGrupoModal
          conversa={conversaAtiva}
          usuarios={usuarios}
          currentUser={currentUser}
          onClose={() => setGrupoModalAberto(false)}
          onRenomear={(nome) => renomearGrupo(conversaAtiva.id, nome)}
          onAdicionar={(ids) => adicionarParticipantes(conversaAtiva.id, ids)}
          onRemover={(userId) => removerParticipante(conversaAtiva.id, userId)}
          onDefinirFoto={(arquivo) => definirFotoGrupo(conversaAtiva.id, arquivo)}
          onRemoverFoto={() => removerFotoGrupo(conversaAtiva.id)}
          onApagar={apagarGrupoENavegar}
          onSair={sairDoGrupo}
        />
      )}
    </div>
  );
}
