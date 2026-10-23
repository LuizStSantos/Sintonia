import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import {
  Video, Tv2, ListChecks, AlertTriangle, Pencil, Plus, X, GripVertical, ArrowUp, ArrowDown,
  StickyNote, Link2, Image as ImageIcon, RotateCcw, Check, CloudSun, Globe,
} from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Badge } from "../../components/common/Badge.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { TONE } from "../../lib/constants.js";
import { apiListTodos } from "../../api/todos.js";
import { apiGetInicioLayout, apiSetInicioLayout, apiResetInicioLayout } from "../../api/inicio.js";
import { onRealtimeMessage } from "../../lib/realtime.js";
import { todayISO } from "../../lib/dates.js";
import { primeirosDoisNomes } from "../../lib/text.js";
import { useEspelhoRetencao } from "../espelho/useEspelhoRetencao.js";
import {
  materiasEmAndamento, insercoesNoArHoje, vencemEmBreve, contasEmAtraso,
  minhasTarefas, espelhosExpirando, saudacao,
} from "../../lib/inicio.js";
import { formatData, partesAgora } from "../../lib/fuso.js";
import {
  COLUNAS, MARGEM, alturaDaLista, migrarLayout, CORES_POSTIT, NOMES_SISTEMA, SISTEMA, layoutPadrao, novoCartao, novoSistema,
  ordemDePilha, tamanhoMinimo,
} from "../../lib/inicioLayout.js";
import { PostIt, Links, Imagem, VideoCartao, Site } from "./CartoesCustom.jsx";
import { Tempo } from "./CartaoTempo.jsx";
import { EditorCartao } from "./EditorCartao.jsx";

// Cartão de número (ex.: "Matérias em andamento: 2").
function Numero({ label, value, tone, icon: Icon }) {
  const t = TONE[tone] || TONE.gray;
  return (
    <div className="ini-numero" style={{ "--acento": t.text }}>
      <span className="ini-numero-icone">{Icon && <Icon size={18} strokeWidth={2} />}</span>
      <div className="ini-numero-texto">
        <span className="ini-numero-valor">{value}</span>
        <span className="ini-numero-rotulo">{label}</span>
      </div>
    </div>
  );
}

// Lista (VTs no ar hoje, vencimentos, tarefas...). Rola por dentro quando o cartão é menor que o conteúdo.
function Lista({ titulo, linkLabel, aba, onNavigate, linhas, vazio, editando }) {
  const ir = (a) => { if (!editando) onNavigate(a); };
  return (
    <section className="ini-lista" aria-label={titulo}>
      <div className="ini-cab">
        <h3>{titulo}</h3>
        <button type="button" className="inicio-link" onClick={() => ir(aba)}>{linkLabel}</button>
      </div>
      <div className="ini-lista-corpo">
        {linhas.length === 0 && <p className="inicio-vazio">{vazio}</p>}
        {linhas.slice(0, 60).map((l) => (
          <button type="button" key={l.id} className="inicio-linha" onClick={() => ir(l.aba || aba)}>
            <span className="inicio-linha-texto">
              <span className="inicio-linha-titulo">{l.titulo}</span>
              <span className="inicio-linha-sub">{l.sub}</span>
            </span>
            {l.rotulo ? <Badge label={l.rotulo} tone={l.tom} /> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

// Tela de abertura: resumo do dia que cada pessoa monta do seu jeito. Os cartões do
// sistema só existem se a pessoa tem acesso à aba de onde vêm os dados.
export function InicioTab({ currentUser, data, onNavigate }) {
  const isAdmin = currentUser.role === "admin";
  const pode = (col) => isAdmin || (currentUser.permissions?.[col] || "none") !== "none";
  const hoje = todayISO();
  const retencaoDias = useEspelhoRetencao();

  // Tarefas: o TO-DO é de todo mundo, então esse bloco sempre aparece.
  const [todos, setTodos] = useState(null);
  useEffect(() => {
    let ativo = true;
    const carregar = () => apiListTodos().then((t) => { if (ativo) setTodos(t); }).catch(() => { if (ativo) setTodos((x) => x ?? []); });
    carregar();
    const sair = onRealtimeMessage((msg) => { if (msg.type === "todo-created" || msg.type === "todo-completed") carregar(); });
    return () => { ativo = false; sair(); };
  }, []);

  const verMaterias = pode("materias"), verOpec = pode("opec"), verEspelho = pode("espelho");
  const verReceber = pode("contasReceber"), verPagar = pode("contasPagar");

  const materias = useMemo(() => (verMaterias ? materiasEmAndamento(data.materias) : []), [verMaterias, data.materias]);
  const noAr = useMemo(() => (verOpec ? insercoesNoArHoje(data.opec, hoje) : { vts: [], insercoes: 0 }), [verOpec, data.opec, hoje]);
  const breve = useMemo(() => vencemEmBreve({
    opec: verOpec ? data.opec : [], contasReceber: verReceber ? data.contasReceber : [], contasPagar: verPagar ? data.contasPagar : [],
  }, hoje), [verOpec, verReceber, verPagar, data.opec, data.contasReceber, data.contasPagar, hoje]);
  const atrasadas = useMemo(() => contasEmAtraso({
    contasReceber: verReceber ? data.contasReceber : [], contasPagar: verPagar ? data.contasPagar : [],
  }), [verReceber, verPagar, data.contasReceber, data.contasPagar]);
  const tarefas = useMemo(() => minhasTarefas(todos, currentUser.id, hoje), [todos, currentUser.id, hoje]);
  const espelhos = useMemo(() => (verEspelho ? espelhosExpirando(data.espelho, retencaoDias) : []), [verEspelho, data.espelho, retencaoDias]);

  const primeiroNome = (primeirosDoisNomes(currentUser.nomeCompleto).split(" ")[0]) || currentUser.username;
  const nome = primeiroNome.charAt(0).toLocaleUpperCase("pt-BR") + primeiroNome.slice(1);
  const dataTxt = formatData(new Date(), { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const dataExtenso = dataTxt.charAt(0).toLocaleUpperCase("pt-BR") + dataTxt.slice(1);

  const abaBreve = verOpec ? "opec" : verReceber ? "contasReceber" : "contasPagar";
  const linksBreve = [verOpec && "OPEC", (verReceber || verPagar) && "Financeiro"].filter(Boolean);

  // Conteúdo de cada cartão do sistema (null = a pessoa não tem acesso).
  const sistema = {
    "stat-materias": verMaterias ? { num: { label: "Matérias em andamento", value: materias.length, tone: "amber", icon: Video } } : null,
    "stat-opec": verOpec ? { num: { label: "Inserções no ar hoje", value: noAr.insercoes, tone: "blue", icon: Tv2 } } : null,
    "stat-tarefas": { num: { label: "Minhas tarefas pendentes", value: todos === null ? "…" : tarefas.length, tone: "green", icon: ListChecks } },
    "stat-atraso": (verReceber || verPagar) ? { num: { label: "Contas em atraso", value: atrasadas, tone: atrasadas ? "red" : "gray", icon: AlertTriangle } } : null,
    "painel-opec": verOpec ? { lista: { titulo: "No ar hoje (OPEC)", linkLabel: "Ver tudo", aba: "opec", vazio: "Nenhum VT vai ao ar hoje.",
      linhas: noAr.vts.map((i) => ({ id: i.id, titulo: i.nomeVT || i.cliente || "VT", sub: `${i.programa || "—"} · ${Number(i.quantidade) || 1}x` })) } } : null,
    "painel-breve": (verOpec || verReceber || verPagar) ? { lista: { titulo: "Vencem em breve", linkLabel: `Abrir ${linksBreve[0]}`, aba: abaBreve, vazio: "Nada vencendo nos próximos dias.", linhas: breve } } : null,
    "painel-tarefas": { lista: { titulo: "Minhas tarefas", linkLabel: "Abrir TO-DO", aba: "todos", vazio: todos === null ? "Carregando..." : "Nenhuma tarefa pendente. Bom trabalho!", linhas: tarefas } },
    "painel-materias": verMaterias ? { lista: { titulo: "Matérias em andamento", linkLabel: "Abrir Matérias", aba: "materias", vazio: "Nenhuma matéria em redação ou edição.",
      linhas: materias.map((m) => ({ id: m.id, titulo: m.titulo || "Sem retranca", sub: [m.reporter, m.duracao].filter(Boolean).join(" · ") || "—", rotulo: m.status, tom: m.status === "Edição" ? "blue" : "amber" })) } } : null,
    "painel-espelho": verEspelho ? { lista: { titulo: "Espelhos prestes a expirar", linkLabel: "Abrir Espelho", aba: "espelho", vazio: "Nenhum espelho salvo.", linhas: espelhos } } : null,
  };
  const refsVisiveis = Object.keys(sistema).filter((r) => sistema[r]);

  // ---- Layout da pessoa ----
  const [salvo, setSalvo] = useState(undefined); // undefined = carregando, null = arranjo padrão
  useEffect(() => {
    let ativo = true;
    apiGetInicioLayout().then((l) => { if (ativo) setSalvo(migrarLayout(l)); }).catch(() => { if (ativo) setSalvo(null); });
    return () => { ativo = false; };
  }, []);
  const alturas = Object.fromEntries(refsVisiveis.filter((r) => sistema[r].lista).map((r) => [r, alturaDaLista(sistema[r].lista.linhas.length)]));
  const padrao = useMemo(() => layoutPadrao(refsVisiveis, alturas), [refsVisiveis.join("|"), JSON.stringify(alturas)]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = salvo?.cartoes ?? padrao;

  const [rascunho, setRascunho] = useState(null);
  const editando = rascunho !== null;
  const cartoes = editando ? rascunho : base;
  const mostrar = cartoes.filter((c) => c.tipo !== "sistema" || sistema[c.ref]);

  const [editorId, setEditorId] = useState(null);
  const [novoId, setNovoId] = useState(null);
  const [menuAdd, setMenuAdd] = useState(false);
  const [confRestaurar, setConfRestaurar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Largura disponível: define se mostra a grade (computador) ou a pilha (celular).
  const caixaRef = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => setLargura(Math.floor(el.getBoundingClientRect().width));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [salvo]);
  const pilha = largura > 0 && largura < 720;
  const celula = Math.max(40, (largura - MARGEM * (COLUNAS - 1)) / COLUNAS); // células quadradas

  const mudou = editando && JSON.stringify(rascunho) !== JSON.stringify(base);
  const entrar = () => { setErro(""); setRascunho(base.map((c) => ({ ...c, itens: c.itens ? c.itens.map((i) => ({ ...i })) : undefined }))); };
  const cancelar = () => {
    if (mudou && !window.confirm("Descartar as mudanças que você fez no Início?")) return;
    setRascunho(null); setEditorId(null); setNovoId(null); setErro("");
  };
  const concluir = async () => {
    setSalvando(true); setErro("");
    try {
      const l = await apiSetInicioLayout(rascunho);
      setSalvo(migrarLayout(l)); setRascunho(null);
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const restaurar = async () => {
    setConfRestaurar(false); setSalvando(true); setErro("");
    try { await apiResetInicioLayout(); setSalvo(null); setRascunho(null); }
    catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  // Post-it: dá para escrever direto no cartão, sem "Personalizar". Fora do modo
  // de edição o texto é salvo sozinho, um instante depois de parar de digitar.
  const [estadoNota, setEstadoNota] = useState(""); // "" | "salvando" | "salvo" | "erro"
  const notaRef = useRef({ timer: null, pendente: null });
  const enviarNota = async () => {
    const n = notaRef.current;
    clearTimeout(n.timer); n.timer = null;
    const lista = n.pendente; n.pendente = null;
    if (!lista) return;
    try { await apiSetInicioLayout(lista); setEstadoNota("salvo"); setTimeout(() => setEstadoNota((e) => (e === "salvo" ? "" : e)), 1800); }
    catch { setEstadoNota("erro"); }
  };
  useEffect(() => () => { if (notaRef.current.pendente) enviarNota(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const alterarPostit = (id, campos) => {
    if (editando) { mudar(id, campos); return; }
    const novos = base.map((c) => (c.id === id ? { ...c, ...campos } : c));
    setSalvo({ v: 2, cartoes: novos });
    setEstadoNota("salvando");
    const n = notaRef.current;
    n.pendente = novos;
    clearTimeout(n.timer);
    n.timer = setTimeout(enviarNota, campos.texto !== undefined ? 800 : 0);
  };

  const mudar = (id, campos) => setRascunho((r) => r.map((c) => (c.id === id ? { ...c, ...campos } : c)));
  const remover = (id) => setRascunho((r) => r.filter((c) => c.id !== id));
  const adicionar = (tipo) => {
    const c = novoCartao(tipo, rascunho);
    setRascunho((r) => [...r, c]);
    setMenuAdd(false);
    if (tipo !== "postit") { setEditorId(c.id); setNovoId(c.id); }
  };
  const adicionarSistema = (ref) => { setRascunho((r) => [...r.filter((c) => c.ref !== ref), novoSistema(ref, r)]); setMenuAdd(false); };
  const mover = (id, delta) => setRascunho((r) => {
    const ord = ordemDePilha(r.filter((c) => c.tipo !== "sistema" || sistema[c.ref]));
    const i = ord.findIndex((c) => c.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= ord.length) return r;
    const a = ord[i], b = ord[j];
    return r.map((c) => (c.id === a.id ? { ...c, x: b.x, y: b.y } : c.id === b.id ? { ...c, x: a.x, y: a.y } : c));
  });
  const onLayoutChange = (l) => {
    if (!editando) return;
    setRascunho((prev) => {
      if (!prev) return prev;
      let mud = false;
      const novo = prev.map((c) => {
        const g = l.find((i) => i.i === c.id);
        if (g && (g.x !== c.x || g.y !== c.y || g.w !== c.w || g.h !== c.h)) { mud = true; return { ...c, x: g.x, y: g.y, w: g.w, h: g.h }; }
        return c;
      });
      return mud ? novo : prev;
    });
  };

  const conteudo = (c) => {
    if (c.tipo === "sistema") {
      const s = sistema[c.ref];
      return s.num ? <Numero {...s.num} /> : <Lista {...s.lista} onNavigate={onNavigate} editando={editando} />;
    }
    if (c.tipo === "postit") return <PostIt cartao={c} editando={editando} onChange={(campos) => alterarPostit(c.id, campos)} />;
    if (c.tipo === "links") return <Links cartao={c} editando={editando} />;
    if (c.tipo === "imagem") return <Imagem cartao={c} editando={editando} />;
    if (c.tipo === "tempo") return <Tempo cartao={c} editando={editando} />;
    if (c.tipo === "site") return <Site cartao={c} editando={editando} />;
    return <VideoCartao cartao={c} editando={editando} />;
  };

  const cartaoEl = (c, i, total) => {
    const ehNum = c.tipo === "sistema" && SISTEMA[c.ref].tipo === "stat";
    const editavel = ["links", "imagem", "video", "tempo", "site"].includes(c.tipo);
    return (
      <div className={`ini-card tipo-${c.tipo}${editando ? " editando" : ""}${ehNum ? " numero" : ""}${pilha && !ehNum ? " larga" : ""}`}>
        {editando && (
          <div className="ini-edit-barra">
            {pilha ? (
              <span className="ini-mover">
                <button type="button" className="ini-btn" aria-label="Subir" disabled={i === 0} onClick={() => mover(c.id, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="ini-btn" aria-label="Descer" disabled={i === total - 1} onClick={() => mover(c.id, 1)}><ArrowDown size={14} /></button>
              </span>
            ) : (
              <span className="ini-alca" title="Arraste a barra para mover"><GripVertical size={15} /><span className="ini-alca-txt">Mover</span></span>
            )}
            <span className="ini-edit-acoes">
              {c.tipo === "postit" && CORES_POSTIT.map((cor) => (
                <button key={cor} type="button" className={`ini-cor cor-${cor}${c.cor === cor ? " ativa" : ""}`} aria-label={`Cor ${cor}`} onClick={() => mudar(c.id, { cor })} />
              ))}
              {editavel && <button type="button" className="ini-btn" aria-label="Editar cartão" onClick={() => setEditorId(c.id)}><Pencil size={14} /></button>}
              <button type="button" className="ini-btn perigo" aria-label="Remover cartão" onClick={() => remover(c.id)}><X size={14} /></button>
            </span>
          </div>
        )}
        <div className="ini-card-conteudo">{conteudo(c)}</div>
      </div>
    );
  };

  const layoutGrade = mostrar.map((c) => { const [mw, mh] = tamanhoMinimo(c); return { i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: mw, minH: mh }; });
  const ordenados = ordemDePilha(mostrar);
  const editor = editorId ? cartoes.find((c) => c.id === editorId) : null;
  const refsParaAdicionar = refsVisiveis.filter((r) => !cartoes.some((c) => c.tipo === "sistema" && c.ref === r));

  return (
    <div>
      <div className="inicio-saudacao">
        <div className="inicio-saudacao-nome">{saudacao(partesAgora().hora)}, {nome}</div>
        <div className="inicio-saudacao-data">{dataExtenso}</div>
        <div className="ini-barra">
          {estadoNota && !editando && <span className={`ini-nota-estado ${estadoNota}`} role="status">{estadoNota === "salvando" ? "Salvando…" : estadoNota === "salvo" ? "Post-it salvo" : "Não foi possível salvar o post-it"}</span>}
          {!editando ? (
            <button type="button" className="btn-ghost" onClick={entrar} disabled={salvo === undefined}><Pencil size={14} /> Personalizar</button>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={() => setMenuAdd(true)}><Plus size={14} /> Adicionar cartão</button>
              <button type="button" className="btn-ghost" onClick={() => setConfRestaurar(true)}><RotateCcw size={14} /> Restaurar padrão</button>
              <button type="button" className="btn-ghost" onClick={cancelar} disabled={salvando}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={concluir} disabled={salvando}><Check size={14} /> {salvando ? "Salvando..." : "Concluir"}</button>
            </>
          )}
        </div>
      </div>
      {editando && <p className="ini-dica">{pilha ? "Use as setas para mudar a ordem e o lápis para editar." : "Arraste pela barra de cima para mover. Puxe qualquer borda ou canto (pontos azuis) para mudar o tamanho: o conteúdo se ajusta sozinho."} Nada é salvo até clicar em Concluir.</p>}
      {erro && <p className="duplicate-warning" role="alert"><AlertTriangle size={15} /> <span>{erro}</span></p>}

      <div ref={caixaRef}>
        {salvo === undefined ? null : pilha ? (
          <div className="ini-pilha">
            {ordenados.map((c, i) => <div key={c.id} className={c.tipo === "sistema" && SISTEMA[c.ref].tipo === "stat" ? "" : "ini-pilha-larga"}>{cartaoEl(c, i, ordenados.length)}</div>)}
            {ordenados.length === 0 && <p className="inicio-vazio">Nenhum cartão. Use Personalizar para adicionar.</p>}
          </div>
        ) : (
          largura > 0 && (
            <GridLayout
              className="ini-grid"
              layout={layoutGrade}
              cols={COLUNAS}
              rowHeight={celula}
              margin={[MARGEM, MARGEM]}
              containerPadding={[0, 0]}
              width={largura}
              isDraggable={editando}
              isResizable={editando}
              draggableHandle=".ini-edit-barra"
              draggableCancel=".ini-btn,.ini-cor,.inicio-link,.inicio-linha,textarea,input,a"
              onLayoutChange={onLayoutChange}
              compactType="vertical"
              resizeHandles={["se", "e", "s", "n", "w", "ne", "nw", "sw"]}
            >
              {mostrar.map((c) => <div key={c.id}>{cartaoEl(c, 0, 0)}</div>)}
            </GridLayout>
          )
        )}
        {salvo !== undefined && !pilha && mostrar.length === 0 && <p className="inicio-vazio">Nenhum cartão. Use Personalizar para adicionar.</p>}
      </div>

      {menuAdd && (
        <div className="confirm-overlay" onClick={() => setMenuAdd(false)}>
          <div className="confirm-panel ini-editor" onClick={(e) => e.stopPropagation()}>
            <h3>Adicionar cartão</h3>
            <div className="ini-tipos">
              <button type="button" className="ini-tipo" onClick={() => adicionar("postit")}><StickyNote size={22} /><b>Post-it</b><span>Nota com cor</span></button>
              <button type="button" className="ini-tipo" onClick={() => adicionar("links")}><Link2 size={22} /><b>Links</b><span>Atalhos para sites</span></button>
              <button type="button" className="ini-tipo" onClick={() => adicionar("imagem")}><ImageIcon size={22} /><b>Foto</b><span>Imagem ou foto</span></button>
              <button type="button" className="ini-tipo" onClick={() => adicionar("video")}><Video size={22} /><b>Vídeo</b><span>Arquivo ou YouTube</span></button>
              <button type="button" className="ini-tipo" onClick={() => adicionar("tempo")}><CloudSun size={22} /><b>Tempo</b><span>Previsão da sua cidade</span></button>
              <button type="button" className="ini-tipo" onClick={() => adicionar("site")}><Globe size={22} /><b>Site</b><span>Página dentro do cartão</span></button>
            </div>
            {refsParaAdicionar.length > 0 && (
              <>
                <p className="armaz-legenda" style={{ marginTop: 14 }}>Cartões do sistema que você tirou:</p>
                <div className="ini-sistema-lista">
                  {refsParaAdicionar.map((r) => <button key={r} type="button" className="btn-ghost" onClick={() => adicionarSistema(r)}><Plus size={13} /> {NOMES_SISTEMA[r]}</button>)}
                </div>
              </>
            )}
            <div className="drawer-actions"><button className="btn-ghost" onClick={() => setMenuAdd(false)}>Fechar</button></div>
          </div>
        </div>
      )}

      {editor && (
        <EditorCartao
          key={editor.id}
          cartao={editor}
          onCancelar={() => { if (editor.id === novoId) remover(editor.id); setEditorId(null); setNovoId(null); }}
          onSalvar={(campos) => { mudar(editor.id, campos); setEditorId(null); setNovoId(null); }}
        />
      )}

      <ConfirmDialog
        open={confRestaurar}
        title="Restaurar o Início padrão?"
        message="Seus cartões e arranjo serão apagados e o Início volta ao modelo original. Fotos e vídeos que você enviou também serão apagados."
        confirmLabel="Restaurar"
        cancelLabel="Cancelar"
        onCancel={() => setConfRestaurar(false)}
        onConfirm={restaurar}
      />
    </div>
  );
}
