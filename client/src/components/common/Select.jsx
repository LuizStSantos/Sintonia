import { Children, Fragment, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

// Caixa de seleção com lista própria (no lugar da lista nativa do navegador,
// que é cinza/padrão e não acompanha o tema). Mesma interface do <select>:
// `value`, `onChange` (recebe `e.target.value`, sempre texto) e filhos
// <option value="...">. Por isso trocar nos formulários é só mudar o nome da
// tag. O "botão" continua sendo um <select> de verdade (com uma opção só: a
// escolhida), então todo o CSS existente dos campos continua valendo; só a
// lista que abre é nossa.

function textoDe(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  if (isValidElement(node)) return textoDe(node.props.children);
  return "";
}

// Achata os filhos (arrays, fragments, condicionais) numa lista de opções.
function coletarOpcoes(children, saida = []) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) { coletarOpcoes(c.props.children, saida); return; }
    if (c.type === "option") {
      const texto = textoDe(c.props.children);
      saida.push({
        valor: String(c.props.value ?? texto),
        rotulo: c.props.children,
        texto,
        desativada: !!c.props.disabled,
      });
    }
  });
  return saida;
}

export function Select({ children, value, onChange, disabled, className, style, ...rest }) {
  const opcoes = useMemo(() => coletarOpcoes(children), [children]);
  const valorAtual = value == null ? "" : String(value);
  const indiceSel = opcoes.findIndex((o) => o.valor === valorAtual);
  const exibida = opcoes[indiceSel >= 0 ? indiceSel : 0];

  const [aberto, setAberto] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const [pos, setPos] = useState(null);
  const gatilhoRef = useRef(null);
  const menuRef = useRef(null);
  const buscaRef = useRef({ texto: "", t: null });

  const abrir = () => {
    if (disabled || opcoes.length === 0) return;
    setAtiva(indiceSel >= 0 ? indiceSel : 0);
    setAberto(true);
  };
  const fechar = () => setAberto(false);
  const escolher = (i) => {
    const o = opcoes[i];
    if (!o || o.desativada) return;
    fechar();
    if (o.valor !== valorAtual) onChange?.({ target: { value: o.valor } });
    gatilhoRef.current?.focus();
  };

  const posicionar = () => {
    const r = gatilhoRef.current?.getBoundingClientRect();
    if (!r) return;
    const margem = 8;
    const alturaMenu = Math.min(menuRef.current?.scrollHeight || 280, 280) + 2;
    const espacoBaixo = window.innerHeight - r.bottom - margem;
    const espacoCima = r.top - margem;
    const embaixo = espacoBaixo >= alturaMenu || espacoBaixo >= espacoCima;
    const largura = Math.min(Math.max(r.width, 210), Math.min(440, window.innerWidth - 2 * margem));
    const left = Math.min(Math.max(margem, r.left), window.innerWidth - largura - margem);
    const maxAltura = Math.max(120, Math.min(280, embaixo ? espacoBaixo : espacoCima));
    const altura = Math.min(alturaMenu, maxAltura);
    setPos({ left, width: largura, maxAltura, top: embaixo ? r.bottom + 4 : r.top - altura - 4 });
  };
  useLayoutEffect(() => { if (aberto) posicionar(); }, [aberto]);

  // Mantém a opção destacada visível dentro da lista.
  useEffect(() => {
    if (!aberto) return;
    menuRef.current?.querySelector(`[data-i="${ativa}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativa, pos]);

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e) => {
      if (menuRef.current?.contains(e.target) || gatilhoRef.current?.contains(e.target)) return;
      fechar();
    };
    const mover = (de, passo) => {
      let i = de;
      for (let n = 0; n < opcoes.length; n++) {
        i = (i + passo + opcoes.length) % opcoes.length;
        if (!opcoes[i].desativada) return i;
      }
      return de;
    };
    const aoTeclar = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setAtiva((a) => mover(a, 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAtiva((a) => mover(a, -1)); return; }
      if (e.key === "Home") { e.preventDefault(); setAtiva(mover(-1, 1)); return; }
      if (e.key === "End") { e.preventDefault(); setAtiva(mover(0, -1)); return; }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(ativa); return; }
      if (e.key === "Tab") { fechar(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Digitar letras pula pra opção que começa com elas.
        const b = buscaRef.current;
        clearTimeout(b.t);
        b.texto += e.key.toLowerCase();
        b.t = setTimeout(() => { b.texto = ""; }, 700);
        const i = opcoes.findIndex((o) => !o.desativada && o.texto.toLowerCase().startsWith(b.texto));
        if (i >= 0) setAtiva(i);
      }
    };
    const aoMudarTela = (e) => { if (e.type === "resize" || !menuRef.current?.contains(e.target)) posicionar(); };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("resize", aoMudarTela);
    window.addEventListener("scroll", aoMudarTela, true);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("resize", aoMudarTela);
      window.removeEventListener("scroll", aoMudarTela, true);
    };
  }, [aberto, ativa, opcoes, valorAtual]);

  return (
    <>
      <select
        {...rest}
        ref={gatilhoRef}
        className={className}
        style={style}
        disabled={disabled}
        value={exibida ? exibida.valor : ""}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onChange={() => {}}
        onMouseDown={(e) => {
          e.preventDefault();
          if (disabled) return;
          gatilhoRef.current?.focus();
          aberto ? fechar() : abrir();
        }}
        onKeyDown={(e) => {
          if (aberto) return;
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); abrir(); }
        }}
      >
        <option value={exibida ? exibida.valor : ""}>{exibida ? exibida.texto : ""}</option>
      </select>
      {aberto && createPortal(
        <div
          ref={menuRef}
          className="select-menu"
          role="listbox"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width, maxHeight: pos?.maxAltura }}
        >
          {opcoes.map((o, i) => (
            <div
              key={`${o.valor}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === indiceSel}
              aria-disabled={o.desativada || undefined}
              className={`select-opcao ${i === ativa ? "ativa" : ""} ${i === indiceSel ? "selecionada" : ""} ${o.desativada ? "desativada" : ""}`}
              onMouseEnter={() => !o.desativada && setAtiva(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(i)}
            >
              <span className="select-opcao-texto">{o.rotulo}</span>
              {i === indiceSel && <Check size={15} className="select-opcao-check" />}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
