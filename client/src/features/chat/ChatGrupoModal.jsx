import { useRef, useState } from "react";
import { X, UserPlus, LogOut, Trash2, Camera, Users as UsersIcon } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { Avatar } from "../../components/common/Avatar.jsx";
import { useChat } from "./ChatContext.jsx";

// Gerenciar um grupo: renomear, foto, adicionar/remover participante, sair.
// Não existe "dono/admin" do grupo — qualquer participante pode fazer
// qualquer uma dessas ações (decisão deliberada, ver comentário em chat.js).
export function ChatGrupoModal({ conversa, usuarios, currentUser, onClose, onRenomear, onAdicionar, onRemover, onDefinirFoto, onRemoverFoto, onApagar, onSair }) {
  const { fotoPorId } = useChat();
  const [nome, setNome] = useState(conversa.nome || "");
  const [adicionando, setAdicionando] = useState(false);
  const [selecionadosNovos, setSelecionadosNovos] = useState([]);
  const [confirmSair, setConfirmSair] = useState(false);
  const [confirmRemover, setConfirmRemover] = useState(null); // userId
  const [confirmApagar, setConfirmApagar] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [apagando, setApagando] = useState(false);
  const fotoInputRef = useRef(null);

  // Só quem criou o grupo pode apagar ele de vez (diferente de renomear,
  // trocar foto ou adicionar/remover participante, que qualquer um pode —
  // ver comentário em chat.js). O servidor confere de novo, isso aqui é só
  // pra nem mostrar o botão pra quem não pode usar.
  const souCriador = conversa.criadoPor === currentUser.id;

  const nomePorId = Object.fromEntries(usuarios.map((u) => [u.id, u.displayName || u.username]));
  const foraDoGrupo = usuarios.filter((u) => !conversa.participantes.includes(u.id));

  const escolherFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setSalvandoFoto(true);
    setErro("");
    try {
      await onDefinirFoto(arquivo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoFoto(false);
    }
  };

  const removerFoto = async () => {
    setSalvandoFoto(true);
    setErro("");
    try {
      await onRemoverFoto();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoFoto(false);
    }
  };

  const salvarNome = async () => {
    if (!nome.trim() || nome.trim() === conversa.nome) return;
    setSalvando(true);
    setErro("");
    try {
      await onRenomear(nome.trim());
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const apagarGrupo = async () => {
    setApagando(true);
    setErro("");
    try {
      await onApagar();
      onClose();
    } catch (e) {
      setErro(e.message);
      setApagando(false);
    }
  };

  const confirmarAdicionar = async () => {
    if (selecionadosNovos.length === 0) return;
    setSalvando(true);
    setErro("");
    try {
      await onAdicionar(selecionadosNovos);
      setSelecionadosNovos([]);
      setAdicionando(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel chat-grupo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Gerenciar grupo</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {erro && <p className="chat-erro">{erro}</p>}

          <div className="chat-grupo-foto-row">
            <Avatar nome={conversa.nome} foto={conversa.foto} icon={UsersIcon} />
            <div className="chat-grupo-foto-acoes">
              <button type="button" className="btn-ghost" disabled={salvandoFoto} onClick={() => fotoInputRef.current?.click()}>
                <Camera size={14} /> {conversa.foto ? "Trocar foto" : "Adicionar foto"}
              </button>
              {conversa.foto && (
                <button type="button" className="btn-ghost danger" disabled={salvandoFoto} onClick={removerFoto}>
                  Remover foto
                </button>
              )}
              <input ref={fotoInputRef} type="file" accept="image/*" hidden onChange={escolherFoto} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <span className="field-label">Nome do grupo</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
              <button className="btn-ghost" disabled={salvando || !nome.trim() || nome.trim() === conversa.nome} onClick={salvarNome}>
                Salvar
              </button>
            </div>
          </div>

          <div className="chat-grupo-participantes-header">
            <span className="field-label">Participantes ({conversa.participantes.length})</span>
            <button className="icon-btn" title="Adicionar participante" onClick={() => setAdicionando((v) => !v)}>
              <UserPlus size={16} />
            </button>
          </div>

          {adicionando && (
            <div className="chat-usuarios-lista chat-usuarios-lista-compacta">
              {foraDoGrupo.length === 0 && <p className="chat-vazio-hint">Todo mundo já está no grupo.</p>}
              {foraDoGrupo.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`chat-usuario-row ${selecionadosNovos.includes(u.id) ? "selected" : ""}`}
                  onClick={() =>
                    setSelecionadosNovos((prev) => (prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]))
                  }
                >
                  <input type="checkbox" className="app-checkbox" checked={selecionadosNovos.includes(u.id)} onChange={() => {}} />
                  <Avatar nome={u.displayName || u.username} foto={u.foto} />
                  <span className="chat-usuario-nome">{u.displayName || u.username}</span>
                </button>
              ))}
              {foraDoGrupo.length > 0 && (
                <button className="btn-primary" style={{ marginTop: 8 }} disabled={salvando || selecionadosNovos.length === 0} onClick={confirmarAdicionar}>
                  Adicionar selecionados
                </button>
              )}
            </div>
          )}

          <div className="chat-participantes-lista">
            {conversa.participantes.map((pid) => (
              <div key={pid} className="chat-participante-row">
                <Avatar nome={nomePorId[pid] || (pid === currentUser.id ? "Você" : "?")} foto={fotoPorId[pid]} />
                <span className="chat-usuario-nome">
                  {pid === currentUser.id ? "Você" : nomePorId[pid] || "Usuário removido"}
                </span>
                {pid !== currentUser.id && (
                  <button className="icon-btn danger" title="Remover do grupo" onClick={() => setConfirmRemover(pid)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="drawer-actions">
            <button className="btn-ghost chat-sair-btn" onClick={() => setConfirmSair(true)}>
              <LogOut size={14} /> Sair do grupo
            </button>
            {souCriador && (
              <button className="btn-ghost danger chat-sair-btn" disabled={apagando} onClick={() => setConfirmApagar(true)}>
                <Trash2 size={14} /> Apagar grupo
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSair}
        title="Sair do grupo"
        message={`Tem certeza de que deseja sair de "${conversa.nome}"? Você vai parar de receber as mensagens dele.`}
        confirmLabel="Sair"
        onCancel={() => setConfirmSair(false)}
        onConfirm={() => { setConfirmSair(false); onSair(); }}
      />
      <ConfirmDialog
        open={!!confirmRemover}
        title="Remover do grupo"
        message={confirmRemover ? `Remover "${nomePorId[confirmRemover] || "esse usuário"}" do grupo?` : ""}
        confirmLabel="Remover"
        onCancel={() => setConfirmRemover(null)}
        onConfirm={async () => {
          const alvo = confirmRemover;
          setConfirmRemover(null);
          try {
            await onRemover(alvo);
          } catch (e) {
            setErro(e.message);
          }
        }}
      />
      <ConfirmDialog
        open={confirmApagar}
        title="Apagar grupo"
        message={`Apagar "${conversa.nome}" de vez? Todas as mensagens e anexos dele somem para todo mundo do grupo — essa ação não pode ser desfeita.`}
        confirmLabel="Apagar grupo"
        onCancel={() => setConfirmApagar(false)}
        onConfirm={() => { setConfirmApagar(false); apagarGrupo(); }}
      />
    </div>
  );
}
