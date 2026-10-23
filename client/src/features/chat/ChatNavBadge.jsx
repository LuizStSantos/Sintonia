import { useChat } from "./ChatContext.jsx";

// Separado do resto do menu lateral porque só ele precisa ler o contexto do
// Chat — assim o `App.jsx` não precisa saber nada sobre não lidas, só
// colocar esse componente no lugar do número no item "Chat" do menu.
export function ChatNavBadge() {
  const { totalNaoLidas } = useChat();
  if (!totalNaoLidas) return null;
  return <span className="nav-badge">{totalNaoLidas > 99 ? "99+" : totalNaoLidas}</span>;
}
