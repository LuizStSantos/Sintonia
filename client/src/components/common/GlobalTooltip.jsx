import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Tooltip padrão do sistema, no lugar do balãozinho feio do navegador
// (atributo `title`). Montado uma única vez no app: escuta o mouse/teclado no
// documento inteiro e, pra qualquer elemento com `title="..."`, mostra um
// balão estilizado (que acompanha o tema claro/escuro). Assim todo `title`
// existente — e os que forem criados depois — já ganha o visual novo sem
// precisar trocar nada em cada tela.
//
// Como funciona: ao passar o mouse, o texto é movido de `title` para
// `data-tip` (senão o navegador mostraria o dele também). Pra continuar
// acessível a leitores de tela, botões só com ícone ganham `aria-label`.
const ATRASO_MS = 300;

export function GlobalTooltip() {
  const [tip, setTip] = useState(null); // { texto, alvo }
  const [pos, setPos] = useState(null);
  const balaoRef = useRef(null);
  const timerRef = useRef(null);
  const alvoAtualRef = useRef(null);

  useEffect(() => {
    const achar = (node) => {
      const el = node instanceof Element ? node.closest("[title], [data-tip]") : null;
      if (!el) return null;
      const t = el.getAttribute("title");
      if (t && t.trim()) {
        el.dataset.tip = t;
        el.removeAttribute("title");
        if (!el.getAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", t);
      }
      return el.dataset.tip ? el : null;
    };
    const esconder = () => {
      clearTimeout(timerRef.current);
      alvoAtualRef.current = null;
      setTip(null);
      setPos(null);
    };
    const mostrar = (node, atraso) => {
      const el = achar(node);
      if (!el) return;
      if (alvoAtualRef.current === el) return;
      clearTimeout(timerRef.current);
      alvoAtualRef.current = el;
      timerRef.current = setTimeout(() => {
        if (alvoAtualRef.current === el && el.isConnected) setTip({ texto: el.dataset.tip, alvo: el });
      }, atraso);
    };
    const aoEntrar = (e) => mostrar(e.target, ATRASO_MS);
    const aoSair = (e) => {
      const alvo = alvoAtualRef.current;
      if (alvo && !(e.relatedTarget instanceof Node && alvo.contains(e.relatedTarget))) esconder();
    };
    const aoFocar = (e) => mostrar(e.target, 0);
    document.addEventListener("mouseover", aoEntrar);
    document.addEventListener("mouseout", aoSair);
    document.addEventListener("focusin", aoFocar);
    document.addEventListener("focusout", esconder);
    document.addEventListener("mousedown", esconder, true);
    document.addEventListener("keydown", esconder, true);
    window.addEventListener("scroll", esconder, true);
    window.addEventListener("blur", esconder);
    return () => {
      document.removeEventListener("mouseover", aoEntrar);
      document.removeEventListener("mouseout", aoSair);
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", esconder);
      document.removeEventListener("mousedown", esconder, true);
      document.removeEventListener("keydown", esconder, true);
      window.removeEventListener("scroll", esconder, true);
      window.removeEventListener("blur", esconder);
      clearTimeout(timerRef.current);
    };
  }, []);

  // Se o elemento da dica sai da tela, some junto; se ele mudou de título, acompanha.
  useEffect(() => {
    if (!tip) return;
    const t = setInterval(() => {
      if (!tip.alvo.isConnected) { alvoAtualRef.current = null; setTip(null); setPos(null); return; }
      // O React pode reaproveitar o mesmo botão com outro `title` (ex: microfone
      // que vira "enviar"): se o título voltou, atualiza o texto da dica.
      const novo = tip.alvo.getAttribute("title");
      if (novo && novo.trim()) {
        tip.alvo.dataset.tip = novo;
        tip.alvo.removeAttribute("title");
        setTip({ texto: novo, alvo: tip.alvo });
      }
    }, 200);
    return () => clearInterval(t);
  }, [tip]);

  // Mede o balão e posiciona: em cima do elemento, centralizado; embaixo se
  // não couber; sempre dentro da tela.
  useLayoutEffect(() => {
    if (!tip || !balaoRef.current) return;
    const r = tip.alvo.getBoundingClientRect();
    const b = balaoRef.current.getBoundingClientRect();
    const margem = 8;
    const emCima = r.top - b.height - 10 >= margem;
    const top = emCima ? r.top - b.height - 10 : r.bottom + 10;
    const centro = r.left + r.width / 2;
    const left = Math.min(Math.max(margem, centro - b.width / 2), window.innerWidth - b.width - margem);
    setPos({ top, left, emCima, seta: Math.min(Math.max(14, centro - left), b.width - 14) });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={balaoRef}
      role="tooltip"
      className={`app-tooltip ${pos ? (pos.emCima ? "em-cima" : "embaixo") : ""}`}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, "--seta": `${pos?.seta ?? 20}px`, opacity: pos ? 1 : 0 }}
    >
      {tip.texto}
    </div>
  );
}
