import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

// Escolha rápida de reação a uma mensagem: uma barrinha com 6 emojis e um "+"
// que abre mais opções. Fica num portal (fixo na tela), porque a lista de
// mensagens rola e cortaria um painel posicionado dentro dela.
const RAPIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const MAIS = [
  "👏", "🔥", "🎉", "💯", "✅", "❌", "👀", "🤔", "😅", "😍", "🥰", "😎",
  "🤝", "💪", "🙌", "😊", "😁", "🤣", "😭", "😡", "😱", "🥳", "👌", "✌️",
  "⭐", "💔", "🚀", "📺", "🎬", "📰", "☕", "🍕",
];

export function ReactionPicker({ anchorEl, minha, atual, onEscolher, onFechar }) {
  const painelRef = useRef(null);
  const [expandido, setExpandido] = useState(false);
  const [pos, setPos] = useState(null);

  const posicionar = () => {
    const r = anchorEl?.getBoundingClientRect();
    const p = painelRef.current;
    if (!r || !p) return;
    const margem = 8;
    const w = p.offsetWidth, h = p.offsetHeight;
    const emCima = r.top - h - 8 >= margem;
    const top = emCima ? r.top - h - 8 : r.bottom + 8;
    // Alinha o painel pelo lado em que a mensagem está (minha → direita).
    const left = minha ? r.right - w : r.left;
    setPos({ top, left: Math.min(Math.max(margem, left), window.innerWidth - w - margem) });
  };
  useLayoutEffect(posicionar, [expandido, anchorEl]);

  useEffect(() => {
    const aoClicar = (e) => {
      if (painelRef.current?.contains(e.target) || anchorEl?.contains(e.target)) return;
      onFechar();
    };
    const aoTeclar = (e) => { if (e.key === "Escape") { e.stopPropagation(); onFechar(); } };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("resize", onFechar);
    window.addEventListener("scroll", onFechar, true);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("resize", onFechar);
      window.removeEventListener("scroll", onFechar, true);
    };
  }, [anchorEl, onFechar]);

  const item = (emoji) => (
    <button
      key={emoji}
      type="button"
      className={`reacao-opcao ${atual === emoji ? "atual" : ""}`}
      onClick={() => onEscolher(emoji)}
    >
      {emoji}
    </button>
  );

  return createPortal(
    <div
      ref={painelRef}
      className="reacao-picker"
      role="dialog"
      aria-label="Reagir à mensagem"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      <div className="reacao-picker-rapidas">
        {RAPIDAS.map(item)}
        <button
          type="button"
          className={`reacao-opcao reacao-mais ${expandido ? "atual" : ""}`}
          aria-label="Mais emojis"
          aria-expanded={expandido}
          onClick={() => setExpandido((v) => !v)}
        >
          <Plus size={16} />
        </button>
      </div>
      {expandido && <div className="reacao-picker-grade">{MAIS.map(item)}</div>}
    </div>,
    document.body
  );
}
