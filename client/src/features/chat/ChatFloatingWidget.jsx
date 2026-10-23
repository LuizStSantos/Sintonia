import { useRef, useState } from "react";
import { MessageCircle, X, Minus, Plus, Users as UsersIcon, Settings, Search } from "lucide-react";
import { useChat } from "./ChatContext.jsx";
import { ChatThreadBody } from "./ChatThreadBody.jsx";
import { ChatGrupoModal } from "./ChatGrupoModal.jsx";
import { ChatNovaConversaModal } from "./ChatNovaConversaModal.jsx";
import { Avatar } from "../../components/common/Avatar.jsx";

// O balãozinho flutuante estilo Messenger: um botão redondo fixo no canto
// da tela (com o total de não lidas), que abre uma listinha de conversas; ao
// escolher uma, ela vira uma janela flutuante própria, que fica por cima de
// qualquer aba do sistema (não só da aba Chat) até ser minimizada ou
// fechada. Pode ter até 3 balões abertos ao mesmo tempo (ver abrirPopup no
// ChatContext). Fica escondido enquanto a própria aba Chat de tela cheia
// está ativa, pra não duplicar a mesma coisa duas vezes na tela.
export function ChatFloatingWidget({ ativo }) {
  const { currentUser, conversas, onlineIds, nomeConversa, fotoConversa, outroParticipanteId, totalNaoLidas, popups, abrirPopup, fecharPopup, minimizarPopup, restaurarPopup, usuarios, renomearGrupo, apagarGrupo, adicionarParticipantes, removerParticipante, definirFotoGrupo, removerFotoGrupo, criarConversaPrivada, criarGrupo } = useChat();
  const [listaAberta, setListaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [grupoGerenciando, setGrupoGerenciando] = useState(null); // conversaId
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const launcherRef = useRef(null);

  if (!ativo) return null;

  const conversasFiltradas = conversas.filter((c) => !busca.trim() || nomeConversa(c).toLowerCase().includes(busca.trim().toLowerCase()));

  const escolherConversa = (conversaId) => {
    abrirPopup(conversaId);
    setListaAberta(false);
    setBusca("");
  };

  const conversaGerenciando = grupoGerenciando ? conversas.find((c) => c.id === grupoGerenciando) : null;

  return (
    <div className="chat-widget-dock">
      {popups.map(({ conversaId, minimizado }) => {
        const conversa = conversas.find((c) => c.id === conversaId);
        if (!conversa) return null;
        const isOnline = conversa.tipo === "grupo"
          ? conversa.participantes.some((p) => p !== currentUser.id && onlineIds.has(p))
          : onlineIds.has(outroParticipanteId(conversa));
        return (
          <div key={conversaId} className={`chat-popup ${minimizado ? "minimizado" : ""}`}>
            <button
              type="button"
              className="chat-popup-header"
              onClick={() => (minimizado ? restaurarPopup(conversaId) : minimizarPopup(conversaId))}
            >
              <span className="chat-avatar-wrap">
                <Avatar small nome={nomeConversa(conversa)} foto={fotoConversa(conversa)} icon={conversa.tipo === "grupo" ? UsersIcon : undefined} />
                {isOnline && <span className="chat-online-dot" />}
              </span>
              <span className="chat-popup-nome">{nomeConversa(conversa)}</span>
              {conversa.tipo === "grupo" && !minimizado && (
                <span
                  role="button"
                  tabIndex={0}
                  className="icon-btn chat-popup-icon-btn"
                  title="Gerenciar grupo"
                  onClick={(e) => { e.stopPropagation(); setGrupoGerenciando(conversaId); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setGrupoGerenciando(conversaId))}
                >
                  <Settings size={14} />
                </span>
              )}
              <span
                role="button"
                tabIndex={0}
                className="icon-btn chat-popup-icon-btn"
                title={minimizado ? "Expandir" : "Minimizar"}
                onClick={(e) => { e.stopPropagation(); minimizado ? restaurarPopup(conversaId) : minimizarPopup(conversaId); }}
              >
                <Minus size={14} />
              </span>
              <span
                role="button"
                tabIndex={0}
                className="icon-btn chat-popup-icon-btn"
                title="Fechar"
                onClick={(e) => { e.stopPropagation(); fecharPopup(conversaId); }}
              >
                <X size={14} />
              </span>
            </button>
            {!minimizado && (
              <div className="chat-popup-body">
                <ChatThreadBody conversa={conversa} compact />
              </div>
            )}
          </div>
        );
      })}

      {listaAberta && (
        <div className="chat-widget-lista">
          <div className="chat-widget-lista-header">
            <div className="chat-busca-usuario">
              <Search size={13} />
              <input type="text" placeholder="Buscar conversa..." value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
            </div>
            <button type="button" className="btn-primary chat-nova-btn" title="Nova conversa" onClick={() => { setNovaConversaAberta(true); setListaAberta(false); }}>
              <Plus size={14} />
            </button>
          </div>
          <div className="chat-usuarios-lista chat-widget-lista-itens">
            {conversasFiltradas.length === 0 && <p className="chat-vazio-hint">Nenhuma conversa ainda.</p>}
            {conversasFiltradas.map((c) => {
              const outroId = outroParticipanteId(c);
              const isOnline = c.tipo === "grupo"
                ? c.participantes.some((p) => p !== currentUser.id && onlineIds.has(p))
                : onlineIds.has(outroId);
              return (
                <button key={c.id} type="button" className="chat-usuario-row" onClick={() => escolherConversa(c.id)}>
                  <span className="chat-avatar-wrap">
                    <Avatar nome={nomeConversa(c)} foto={fotoConversa(c)} icon={c.tipo === "grupo" ? UsersIcon : undefined} />
                    {isOnline && <span className="chat-online-dot" />}
                  </span>
                  <span className="chat-usuario-nome">{nomeConversa(c)}</span>
                  {c.naoLidas > 0 && <span className="chat-conversa-badge">{c.naoLidas > 99 ? "99+" : c.naoLidas}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button ref={launcherRef} type="button" className="chat-widget-launcher" onClick={() => setListaAberta((v) => !v)} title="Chat">
        <MessageCircle size={22} />
        {totalNaoLidas > 0 && <span className="chat-widget-badge">{totalNaoLidas > 99 ? "99+" : totalNaoLidas}</span>}
      </button>

      {novaConversaAberta && (
        <ChatNovaConversaModal
          usuarios={usuarios}
          onClose={() => setNovaConversaAberta(false)}
          onEscolherPrivada={async (outroUserId) => {
            const c = await criarConversaPrivada(outroUserId);
            abrirPopup(c.id);
            setNovaConversaAberta(false);
          }}
          onCriarGrupo={async (nome, participantes) => {
            const c = await criarGrupo(nome, participantes);
            abrirPopup(c.id);
            setNovaConversaAberta(false);
          }}
        />
      )}

      {conversaGerenciando && (
        <ChatGrupoModal
          conversa={conversaGerenciando}
          usuarios={usuarios}
          currentUser={currentUser}
          onClose={() => setGrupoGerenciando(null)}
          onRenomear={(nome) => renomearGrupo(conversaGerenciando.id, nome)}
          onAdicionar={(ids) => adicionarParticipantes(conversaGerenciando.id, ids)}
          onRemover={(userId) => removerParticipante(conversaGerenciando.id, userId)}
          onDefinirFoto={(arquivo) => definirFotoGrupo(conversaGerenciando.id, arquivo)}
          onRemoverFoto={() => removerFotoGrupo(conversaGerenciando.id)}
          onApagar={async () => { await apagarGrupo(conversaGerenciando.id); fecharPopup(conversaGerenciando.id); setGrupoGerenciando(null); }}
          onSair={async () => { await removerParticipante(conversaGerenciando.id, currentUser.id); setGrupoGerenciando(null); }}
        />
      )}
    </div>
  );
}
