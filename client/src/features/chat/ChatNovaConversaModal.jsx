import { useState } from "react";
import { X, Search, Users as UsersIcon, User } from "lucide-react";
import { Avatar } from "../../components/common/Avatar.jsx";

// Modal de "nova conversa" — duas abas: escolher uma pessoa (conversa
// privada, reaproveita a existente se já houver uma — isso é feito no
// servidor, ver criarOuAbrirPrivada em chat.js) ou montar um grupo (nome +
// pelo menos mais 1 participante).
export function ChatNovaConversaModal({ usuarios, onClose, onEscolherPrivada, onCriarGrupo }) {
  const [aba, setAba] = useState("privada");
  const [busca, setBusca] = useState("");
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [selecionados, setSelecionados] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const filtrados = usuarios.filter((u) =>
    !busca.trim() || (u.displayName || u.username).toLowerCase().includes(busca.trim().toLowerCase())
  );

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmarGrupo = async () => {
    if (!nomeGrupo.trim()) { setErro("Dê um nome ao grupo."); return; }
    if (selecionados.length === 0) { setErro("Escolha pelo menos mais 1 pessoa."); return; }
    setSalvando(true);
    setErro("");
    try {
      await onCriarGrupo(nomeGrupo.trim(), selecionados);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel chat-nova-conversa" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Nova conversa</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="chat-nova-abas">
            <button className={`chat-nova-aba ${aba === "privada" ? "active" : ""}`} onClick={() => setAba("privada")}>
              <User size={14} /> Conversa privada
            </button>
            <button className={`chat-nova-aba ${aba === "grupo" ? "active" : ""}`} onClick={() => setAba("grupo")}>
              <UsersIcon size={14} /> Grupo
            </button>
          </div>

          <div className="chat-busca-usuario">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar pessoa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {aba === "grupo" && (
            <div className="field" style={{ marginBottom: 10 }}>
              <span className="field-label">Nome do grupo</span>
              <input type="text" value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} placeholder="Ex: Equipe de Reportagem" />
            </div>
          )}

          {erro && <p className="chat-erro">{erro}</p>}

          <div className="chat-usuarios-lista">
            {filtrados.length === 0 && <p className="chat-vazio-hint">Nenhum usuário encontrado.</p>}
            {filtrados.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`chat-usuario-row ${aba === "grupo" && selecionados.includes(u.id) ? "selected" : ""}`}
                onClick={() => (aba === "grupo" ? toggleSelecionado(u.id) : onEscolherPrivada(u.id))}
              >
                {aba === "grupo" && (
                  <input type="checkbox" className="app-checkbox" checked={selecionados.includes(u.id)} onChange={() => {}} />
                )}
                <Avatar nome={u.displayName || u.username} foto={u.foto} />
                <span className="chat-usuario-nome">{u.displayName || u.username}</span>
              </button>
            ))}
          </div>

          {aba === "grupo" && (
            <div className="drawer-actions">
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" disabled={salvando} onClick={confirmarGrupo}>
                {salvando ? "Criando..." : "Criar grupo"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
