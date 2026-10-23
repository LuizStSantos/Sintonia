import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { hojeISO } from "../../lib/fuso.js";

// Campo de data com calendário próprio (no lugar do <input type="date"> do
// navegador, que não dá pra estilizar e não acompanha o tema claro/escuro).
// Mesma "cara" de uso do input nativo: `value` em "AAAA-MM-DD" e `onChange`
// recebendo algo com `e.target.value` — por isso trocar nos formulários é só
// mudar o nome da tag. Também dá pra digitar a data (dd/mm/aaaa).
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_SEMANA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const pad = (n) => String(n).padStart(2, "0");
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? { y, m: mo, d } : null;
}
function isoParaBr(iso) {
  const p = parseIso(iso);
  return p ? `${pad(p.d)}/${pad(p.m + 1)}/${p.y}` : "";
}
function brParaIso(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return parseIso(iso) ? iso : null;
}
function mascara(digitos) {
  const d = digitos.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function hojeIso() {
  return hojeISO();
}

const LARGURA = 296;

export function DateInput({ value, onChange, className = "", disabled, min, max, placeholder = "dd/mm/aaaa", ...rest }) {
  const [texto, setTexto] = useState(isoParaBr(value));
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const [visao, setVisao] = useState("dias"); // "dias" | "meses"
  const sel = parseIso(value);
  const inicial = sel || (() => { const [y, m, d] = hojeISO().split("-").map(Number); return { y, m: m - 1, d }; })();
  const [mes, setMes] = useState({ y: inicial.y, m: inicial.m });

  const envolucroRef = useRef(null);
  const painelRef = useRef(null);

  // Mantém o texto digitado sincronizado quando o valor muda por fora (ex:
  // formulário resetado, "Hoje", "Limpar").
  useEffect(() => { setTexto(isoParaBr(value)); }, [value]);

  const emitir = (iso) => onChange?.({ target: { value: iso } });
  const dentroDoLimite = (iso) => (!min || iso >= min) && (!max || iso <= max);

  const abrir = () => {
    if (disabled) return;
    const p = parseIso(value);
    if (p) setMes({ y: p.y, m: p.m });
    setVisao("dias");
    setAberto(true);
  };
  const fechar = () => setAberto(false);

  // Posiciona o calendário (fixo na tela, fora de qualquer gaveta/modal com
  // overflow) — embaixo do campo, ou em cima se não couber.
  const posicionar = () => {
    const r = envolucroRef.current?.getBoundingClientRect();
    if (!r) return;
    const altura = painelRef.current?.offsetHeight || 340;
    const cabeEmbaixo = window.innerHeight - r.bottom >= altura + 12;
    const top = cabeEmbaixo ? r.bottom + 6 : Math.max(8, r.top - altura - 6);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - LARGURA - 8));
    setPos({ top, left });
  };
  useLayoutEffect(() => { if (aberto) posicionar(); }, [aberto, visao, mes]);
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e) => {
      if (painelRef.current?.contains(e.target) || envolucroRef.current?.contains(e.target)) return;
      fechar();
    };
    const aoTeclar = (e) => { if (e.key === "Escape") { e.stopPropagation(); fechar(); } };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto]);

  const aoDigitar = (e) => {
    const t = mascara(e.target.value);
    setTexto(t);
    if (t === "") { emitir(""); return; }
    const iso = brParaIso(t);
    if (iso && dentroDoLimite(iso)) emitir(iso);
  };
  const aoSair = () => {
    // Texto incompleto/inválido volta pro último valor válido.
    if (texto !== isoParaBr(value)) setTexto(isoParaBr(value));
  };

  const escolher = (iso) => { emitir(iso); fechar(); };

  const hoje = hojeIso();
  const celulas = useMemo(() => {
    const primeiro = new Date(mes.y, mes.m, 1);
    const inicio = new Date(mes.y, mes.m, 1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      return { iso: toIso(dt.getFullYear(), dt.getMonth(), dt.getDate()), dia: dt.getDate(), fora: dt.getMonth() !== mes.m, dow: dt.getDay() };
    });
  }, [mes]);

  const irMes = (delta) => {
    const dt = new Date(mes.y, mes.m + delta, 1);
    setMes({ y: dt.getFullYear(), m: dt.getMonth() });
  };

  const aoTeclarGrade = (e) => {
    const passos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in passos)) return;
    e.preventDefault();
    const atual = e.target.dataset?.iso;
    if (!atual) return;
    const p = parseIso(atual);
    const dt = new Date(p.y, p.m, p.d + passos[e.key]);
    const novo = toIso(dt.getFullYear(), dt.getMonth(), dt.getDate());
    setMes({ y: dt.getFullYear(), m: dt.getMonth() });
    requestAnimationFrame(() => painelRef.current?.querySelector(`[data-iso="${novo}"]`)?.focus());
  };

  return (
    <div className="date-input" ref={envolucroRef}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        value={texto}
        disabled={disabled}
        onChange={aoDigitar}
        onBlur={aoSair}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); abrir(); } }}
      />
      <button
        type="button"
        className="date-input-btn"
        aria-label="Abrir calendário"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => (aberto ? fechar() : abrir())}
      >
        <Calendar size={16} />
      </button>
      {aberto && createPortal(
        <div
          ref={painelRef}
          className="datepicker"
          role="dialog"
          aria-label="Escolher data"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: LARGURA }}
        >
          <div className="datepicker-topo">
            <button type="button" className="datepicker-titulo" onClick={() => setVisao(visao === "dias" ? "meses" : "dias")}>
              {visao === "dias" ? `${cap(MESES[mes.m])} de ${mes.y}` : mes.y}
              <span className="datepicker-seta">{visao === "dias" ? "▾" : "▴"}</span>
            </button>
            <div className="datepicker-nav">
              <button type="button" aria-label={visao === "dias" ? "Mês anterior" : "Ano anterior"} onClick={() => (visao === "dias" ? irMes(-1) : setMes({ ...mes, y: mes.y - 1 }))}><ChevronLeft size={18} /></button>
              <button type="button" aria-label={visao === "dias" ? "Próximo mês" : "Próximo ano"} onClick={() => (visao === "dias" ? irMes(1) : setMes({ ...mes, y: mes.y + 1 }))}><ChevronRight size={18} /></button>
            </div>
          </div>

          {visao === "meses" ? (
            <div className="datepicker-meses">
              {MESES_CURTOS.map((nome, i) => (
                <button
                  key={nome}
                  type="button"
                  className={`datepicker-mes ${i === mes.m ? "atual" : ""}`}
                  onClick={() => { setMes({ y: mes.y, m: i }); setVisao("dias"); }}
                >
                  {cap(nome)}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="datepicker-semana">
                {DIAS_SEMANA.map((d, i) => <span key={i} title={DIAS_SEMANA_LONGO[i]}>{d}</span>)}
              </div>
              <div className="datepicker-grade" onKeyDown={aoTeclarGrade}>
                {celulas.map((c) => {
                  const desativado = !dentroDoLimite(c.iso);
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      data-iso={c.iso}
                      disabled={desativado}
                      tabIndex={c.iso === (value || hoje) ? 0 : -1}
                      className={[
                        "datepicker-dia",
                        c.fora ? "fora" : "",
                        c.dow === 0 || c.dow === 6 ? "fim-semana" : "",
                        c.iso === hoje ? "hoje" : "",
                        c.iso === value ? "selecionado" : "",
                      ].join(" ")}
                      onClick={() => escolher(c.iso)}
                    >
                      {c.dia}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="datepicker-rodape">
            <button type="button" onClick={() => { emitir(""); fechar(); }}>Limpar</button>
            <button type="button" disabled={!dentroDoLimite(hoje)} onClick={() => escolher(hoje)}>Hoje</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
