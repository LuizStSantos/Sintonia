import { useState } from "react";
import { Users, DatabaseBackup, History, MessageCircle, ScrollText, Globe } from "lucide-react";
import { UsuariosSecao } from "./UsuariosSecao.jsx";
import { BackupSecao } from "./BackupSecao.jsx";
import { HistoricoSecao } from "./HistoricoSecao.jsx";
import { ChatArmazenamento } from "./ChatArmazenamento.jsx";
import { GeralSecao } from "./GeralSecao.jsx";
import { InicioEspacoSecao } from "./InicioEspacoSecao.jsx";
import { RedesSecao } from "./RedesSecao.jsx";
import { EspelhoSecao } from "./EspelhoSecao.jsx";

const SECOES = [
  { id: "geral", label: "Geral", icon: Globe },
  { id: "users", label: "Usuários", icon: Users },
  { id: "backup", label: "Backup", icon: DatabaseBackup },
  { id: "historico", label: "Histórico", icon: History },
  { id: "espelho", label: "Espelho", icon: ScrollText },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

export function ConfiguracoesTab({ currentUser, onRestore }) {
  const [secao, setSecao] = useState(() => {
    try { return sessionStorage.getItem("sintonia_config_secao") || "users"; } catch { return "users"; }
  });
  const escolher = (id) => {
    setSecao(id);
    try { sessionStorage.setItem("sintonia_config_secao", id); } catch { /* sem storage */ }
  };
  return (
    <div>
      <div className="config-secoes" role="tablist">
        {SECOES.map((s) => (
          <button key={s.id} role="tab" aria-selected={secao === s.id} className={`config-secao${secao === s.id ? " ativa" : ""}`} onClick={() => escolher(s.id)}>
            <s.icon size={16} /> {s.label}
          </button>
        ))}
      </div>
      {secao === "geral" && <><GeralSecao /><RedesSecao /><InicioEspacoSecao /></>}
      {secao === "users" && <UsuariosSecao currentUser={currentUser} />}
      {secao === "backup" && <BackupSecao onRestore={onRestore} />}
      {secao === "historico" && <HistoricoSecao />}
      {secao === "espelho" && <EspelhoSecao />}
      {secao === "chat" && <ChatArmazenamento />}
    </div>
  );
}
