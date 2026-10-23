import { avatarUrl } from "../../api/client.js";

// Avatar usado em todo lugar que mostra "quem é" alguém (Chat, lista de
// Usuários): se a pessoa (ou o grupo) tem uma foto cadastrada, mostra a
// foto; senão cai no círculo colorido com a inicial do nome — ou, pra um
// grupo sem foto, o ícone de "pessoas" (passado via `icon`). Mantém a
// classe `chat-avatar` em qualquer um dos 3 casos pra herdar o tamanho e o
// arredondamento já definidos no CSS (inclusive o `.small` dos balões).
export function Avatar({ nome, foto, icon: Icon, small = false, className = "" }) {
  const classes = `chat-avatar ${small ? "small" : ""} ${className}`.trim();
  if (foto) {
    return <img className={classes} src={avatarUrl(foto)} alt={nome || ""} />;
  }
  if (Icon) {
    return (
      <span className={classes}>
        <Icon size={small ? 12 : 14} />
      </span>
    );
  }
  return <span className={classes}>{(nome || "?").slice(0, 1).toUpperCase()}</span>;
}
