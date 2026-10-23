import { useEffect, useRef, useState } from "react";

// Seletor de emojis do Chat — sem dependência externa (lista curada aqui
// mesmo). Abre como um painel logo acima da caixa de digitar; fecha ao
// clicar fora, ao apertar Esc ou ao escolher um emoji (a menos que o usuário
// segure Shift, pra inserir vários de seguida).
const CATEGORIAS = [
  {
    id: "carinhas",
    icone: "😀",
    titulo: "Carinhas",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🙂", "😉", "😊", "😇",
      "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "🤔", "🤨", "😐", "😑",
      "😶", "🙄", "😏", "😬", "😮", "😯", "😲", "😳", "🥺", "😢", "😭", "😤",
      "😠", "😡", "🤬", "😱", "😨", "😰", "😓", "🤗", "🤭", "🤫", "🤥", "😴",
      "🤤", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "😵", "🤯", "🥳", "😎",
      "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😞", "😔", "😖", "😣", "😩", "😫",
    ],
  },
  {
    id: "gestos",
    icone: "👍",
    titulo: "Gestos e pessoas",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇",
      "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "🙏", "👏", "🙌", "👐", "🤲",
      "💪", "✍️", "🤳", "💅", "👀", "👁️", "🧠", "🙋", "🙋‍♂️", "🙋‍♀️", "🤷", "🤷‍♂️",
      "🤷‍♀️", "🙆", "🙅", "🙇", "🤦", "🤦‍♂️", "🤦‍♀️", "💁", "🧑‍💻", "👨‍💻", "👩‍💻", "🎤",
    ],
  },
  {
    id: "coracoes",
    icone: "❤️",
    titulo: "Corações e símbolos",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "✨", "⭐", "🌟", "💫", "🔥", "💥",
      "💯", "✅", "❌", "❗", "❓", "‼️", "⚠️", "🚫", "➕", "➖", "➡️", "⬅️",
      "⬆️", "⬇️", "🔔", "🔕", "🔒", "🔓", "🔑", "📌", "📍", "⏰", "⏳", "🆗",
    ],
  },
  {
    id: "trabalho",
    icone: "📺",
    titulo: "TV e trabalho",
    emojis: [
      "📺", "📡", "🎬", "🎥", "📹", "📷", "🎙️", "🎧", "🎞️", "🎭", "📰", "🗞️",
      "📢", "📣", "📞", "☎️", "📱", "💻", "🖥️", "⌨️", "🖨️", "📁", "📂", "📄",
      "📃", "📋", "📝", "✏️", "🖊️", "📎", "📅", "📆", "🗓️", "📊", "📈", "📉",
      "💰", "💵", "💳", "🧾", "🏢", "🏛️", "🚗", "🚚", "✈️", "🏠", "🎯", "🏆",
    ],
  },
  {
    id: "natureza",
    icone: "🌎",
    titulo: "Natureza e comida",
    emojis: [
      "🌞", "🌝", "🌙", "⭐", "☁️", "⛅", "🌧️", "⛈️", "🌈", "❄️", "🌎", "🌳",
      "🌴", "🌵", "🌹", "🌻", "🌼", "🍀", "🐶", "🐱", "🐭", "🐴", "🐮", "🐷",
      "🐔", "🐥", "🦆", "🦅", "🐢", "🐍", "🐟", "🐬", "🍎", "🍌", "🍉", "🍇",
      "🍓", "🍍", "🥑", "🌽", "🥕", "🍕", "🍔", "🍟", "🌭", "🥪", "🍰", "🎂",
      "🍫", "🍿", "☕", "🍺", "🍻", "🥂", "🍷", "🥤",
    ],
  },
  {
    id: "festa",
    icone: "🎉",
    titulo: "Festa e diversão",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎂", "🥳", "🎵", "🎶", "🎸", "🥁", "⚽", "🏀",
      "🏈", "🎾", "🏐", "🏓", "🎮", "🎲", "🎰", "🏅", "🥇", "🥈", "🥉", "🏁",
    ],
  },
];

const CHAVE_RECENTES = "sintonia.chat.emojis-recentes";
const MAX_RECENTES = 16;

function lerRecentes() {
  try {
    const bruto = localStorage.getItem(CHAVE_RECENTES);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.slice(0, MAX_RECENTES) : [];
  } catch {
    return [];
  }
}

function salvarRecente(emoji) {
  try {
    const nova = [emoji, ...lerRecentes().filter((e) => e !== emoji)].slice(0, MAX_RECENTES);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(nova));
    return nova;
  } catch {
    return null;
  }
}

export function EmojiPicker({ onEscolher, onFechar, anchorRef }) {
  const painelRef = useRef(null);
  const [recentes, setRecentes] = useState(lerRecentes);
  const [categoriaId, setCategoriaId] = useState(() => (lerRecentes().length > 0 ? "recentes" : "carinhas"));

  useEffect(() => {
    const aoClicar = (e) => {
      if (painelRef.current?.contains(e.target)) return;
      // O botão que abre o seletor decide sozinho se alterna (abrir/fechar).
      if (anchorRef?.current?.contains(e.target)) return;
      onFechar();
    };
    const aoTeclar = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
      }
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar, anchorRef]);

  const escolher = (emoji, e) => {
    const nova = salvarRecente(emoji);
    if (nova) setRecentes(nova);
    onEscolher(emoji);
    if (!e.shiftKey) onFechar();
  };

  const abas = recentes.length > 0
    ? [{ id: "recentes", icone: "🕘", titulo: "Usados recentemente", emojis: recentes }, ...CATEGORIAS]
    : CATEGORIAS;
  const categoria = abas.find((c) => c.id === categoriaId) || abas[0];

  return (
    <div className="emoji-picker" ref={painelRef} role="dialog" aria-label="Escolher emoji">
      <div className="emoji-picker-abas" role="tablist">
        {abas.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === categoria.id}
            title={c.titulo}
            className={`emoji-picker-aba ${c.id === categoria.id ? "ativa" : ""}`}
            onClick={() => setCategoriaId(c.id)}
          >
            {c.icone}
          </button>
        ))}
      </div>
      <div className="emoji-picker-titulo">{categoria.titulo}</div>
      <div className="emoji-picker-grade">
        {categoria.emojis.map((emoji) => (
          <button key={emoji} type="button" className="emoji-picker-item" onClick={(e) => escolher(emoji, e)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
