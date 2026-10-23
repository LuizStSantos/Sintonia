import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, Paperclip, Smile, Trash2, File as FileIcon, Download, AlertTriangle, X, HardDrive, Clock, Link2, CornerUpLeft, SmilePlus, Mic, MicOff, UploadCloud } from "lucide-react";
import { anexoUrl, apiLimitesChat } from "../../api/chat.js";
import { onRealtimeMessage } from "../../lib/realtime.js";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { AutoGrowTextarea } from "../../components/common/AutoGrowTextarea.jsx";
import { useChat } from "./ChatContext.jsx";
import { EmojiPicker } from "./EmojiPicker.jsx";
import { ReactionPicker } from "./ReactionPicker.jsx";
import { AudioPlayer } from "./AudioPlayer.jsx";
import { useGravadorAudio, formatarTempo, MAX_GRAVACAO_SEG } from "./GravadorAudio.jsx";
import { hojeISO, formatHora as formatHoraFuso, formatData } from "../../lib/fuso.js";

function formatHora(iso) {
  if (!iso) return "";
  return formatHoraFuso(new Date(iso));
}

// Separador de dia na conversa: "Hoje", "Ontem" ou a data. Compara pelo dia
// LOCAL de quem está olhando (mensagem de ontem 23:50 e de hoje 00:10 são dias
// diferentes mesmo estando a minutos de distância; e ontem 11:39 e hoje 11:40
// também — antes isso ficava tudo "no mesmo dia" porque só aparecia a hora).
function chaveDia(iso) {
  return hojeISO(new Date(iso));
}
function rotuloDia(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86400000);
  if (chaveDia(iso) === chaveDia(hoje.toISOString())) return "Hoje";
  if (chaveDia(iso) === chaveDia(ontem.toISOString())) return "Ontem";
  const dias = (hoje - d) / 86400000;
  const base = formatData(d);
  if (dias < 7) {
    const sem = formatData(d, { weekday: "long" });
    return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${base.slice(0, 5)}`;
  }
  return base;
}

// Texto curto da mensagem pra citação/resposta (cobre mensagem só com anexo).
function resumoMensagem(m) {
  const t = (m.texto || "").replace(/\s+/g, " ").trim();
  if (t) return t.length > 140 ? `${t.slice(0, 140)}…` : t;
  const tipo = m.anexo?.tipo || m.anexoTipo;
  if (tipo?.startsWith("audio/")) return "🎤 Áudio";
  const nome = m.anexo?.nomeOriginal || m.anexoNome;
  return nome ? `📎 ${nome}` : "";
}

function formatTamanho(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Limites dos anexos (vêm do servidor — Configurações > Chat ou docker-compose).
// Ficam em cache para abrir rápido, mas são buscados de novo toda vez que um
// Chat abre e atualizados na hora quando o admin muda as regras ("chat-limites").
const LIMITES_PADRAO = { anexoMaxMb: 200, retencaoDias: 14 };
let limitesCache = null;
function useLimitesAnexo() {
  const [limites, setLimites] = useState(limitesCache || LIMITES_PADRAO);
  useEffect(() => {
    let ativo = true;
    apiLimitesChat()
      .then((l) => { limitesCache = l; if (ativo) setLimites(l); })
      .catch(() => {});
    const sair = onRealtimeMessage((msg) => {
      if (msg.type === "chat-limites" && msg.payload) {
        limitesCache = msg.payload;
        if (ativo) setLimites(msg.payload);
      }
    });
    return () => { ativo = false; sair(); };
  }, []);
  return limites;
}

// Lista de mensagens + indicador de "digitando" + composer — usado tanto na
// aba Chat de tela cheia quanto em cada balão flutuante, pra não duplicar
// essa lógica (só muda o `compact`, que deixa tudo mais enxuto pro balão).
export function ChatThreadBody({ conversa, compact = false }) {
  const { currentUser, mensagensPorConversa, carregandoMensagensPorConversa, digitando, nomePorId, avisarDigitando, enviarMensagem, apagarMensagem, reagirMensagem } = useChat();
  const mensagens = mensagensPorConversa[conversa.id] || [];
  const carregandoMensagens = !!carregandoMensagensPorConversa[conversa.id];
  const digitandoSet = digitando[conversa.id];

  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoGrande, setAvisoGrande] = useState(null);
  // Depois de clicar no clipe, a dica fica escondida até o mouse sair do botão
  // (senão ela ficava aberta por cima do aviso/chip do arquivo escolhido).
  const [dicaClipeOculta, setDicaClipeOculta] = useState(false);
  const [respondendo, setRespondendo] = useState(null); // mensagem à qual estou respondendo
  const [reacaoAberta, setReacaoAberta] = useState(null); // { id, el } — seletor de reação aberto
  const [arrastando, setArrastando] = useState(false); // arrastando arquivo por cima da conversa
  const [avisoAudio, setAvisoAudio] = useState(null); // { titulo, texto } quando o microfone não pode ser usado
  const [msgAtiva, setMsgAtiva] = useState(null); // toque no celular mostra as ações da mensagem
  const [confirmApagar, setConfirmApagar] = useState(null);
  const [emojisAberto, setEmojisAberto] = useState(false);
  const limites = useLimitesAnexo();

  const listaRef = useRef(null);
  // "Colado no fim": enquanto o usuário não rolou pra cima, qualquer mudança de
  // altura (mensagem nova, imagem/vídeo terminando de carregar) mantém a
  // conversa no final. Se ele subiu pra ler o histórico, não puxamos de volta.
  const grudadoNoFimRef = useRef(true);
  const fileInputRef = useRef(null);
  const linhaRef = useRef(null);
  const emojiBtnRef = useRef(null);

  const irParaFim = () => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  const aoRolar = () => {
    const el = listaRef.current;
    if (el) grudadoNoFimRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  // Reação nova aumenta a altura da última mensagem — se estou colado no fim, acompanha.
  const totalReacoes = mensagens.reduce((n, m) => n + Object.keys(m.reacoes || {}).length, 0);
  const aoMidiaCarregar = () => { if (grudadoNoFimRef.current) irParaFim(); };

  // Trocou de conversa: sempre começa na última mensagem.
  useLayoutEffect(() => {
    grudadoNoFimRef.current = true;
    irParaFim();
    setRespondendo(null);
    setReacaoAberta(null);
  }, [conversa.id]);

  // Chegou mensagem / terminou de carregar o histórico.
  useLayoutEffect(() => {
    if (grudadoNoFimRef.current) irParaFim();
  }, [mensagens.length, carregandoMensagens, digitandoSet?.size, totalReacoes]);

  const enviar = async () => {
    if (!texto.trim() && !arquivo) return;
    setEnviando(true);
    setErro("");
    grudadoNoFimRef.current = true;
    try {
      await enviarMensagem(conversa.id, { texto: texto.trim(), arquivo, respostaA: respondendo?.id });
      setTexto("");
      setRespondendo(null);
      setArquivo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  // Insere o emoji na posição do cursor (ou no fim, se a caixa nunca teve
  // foco) e devolve o foco/cursor pra logo depois dele.
  const inserirEmoji = (emoji) => {
    const el = linhaRef.current?.querySelector("textarea");
    const inicio = el && el.selectionStart != null ? el.selectionStart : texto.length;
    const fim = el && el.selectionEnd != null ? el.selectionEnd : texto.length;
    setTexto(texto.slice(0, inicio) + emoji + texto.slice(fim));
    avisarDigitando(conversa);
    const pos = inicio + emoji.length;
    requestAnimationFrame(() => {
      const alvo = linhaRef.current?.querySelector("textarea");
      if (!alvo) return;
      alvo.focus();
      alvo.setSelectionRange(pos, pos);
    });
  };

  // Anexar um arquivo (pelo clipe, arrastando pra conversa ou colando):
  // recusa na hora (sem nem tentar enviar) o que passa do limite, com a
  // orientação de mandar por link.
  const aceitarArquivo = (f) => {
    if (f && f.size > limites.anexoMaxMb * 1024 * 1024) {
      setArquivo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setErro("");
      setAvisoAudio(null);
      setAvisoGrande({ nome: f.name, tamanho: formatTamanho(f.size) });
      return;
    }
    setErro("");
    setAvisoGrande(null);
    setAvisoAudio(null);
    setArquivo(f);
  };
  const escolherArquivo = (e) => aceitarArquivo(e.target.files?.[0] || null);

  // Arrastar e soltar: a conversa inteira (lista + caixa de digitar) vira área
  // de soltar. Os ouvintes ficam no elemento pai (a coluna da conversa), por
  // isso são nativos e usam a versão mais recente da função via ref.
  const soltarRef = useRef(null);
  const gravandoRef = useRef(false);
  gravandoRef.current = false; // atualizado abaixo, depois de criar o gravador
  soltarRef.current = (arquivos, itens) => {
    if (gravandoRef.current) return;
    const lista = Array.from(arquivos || []);
    if (lista.length === 0) return;
    const entrada = itens?.[0]?.webkitGetAsEntry?.();
    if (entrada?.isDirectory) { setErro("Pastas não podem ser enviadas — compacte em .zip ou mande por link."); return; }
    aceitarArquivo(lista[0]);
    if (lista.length > 1) setErro(`Só dá pra mandar 1 arquivo por mensagem — anexei "${lista[0].name}". Envie e depois arraste o próximo.`);
    requestAnimationFrame(() => linhaRef.current?.querySelector("textarea")?.focus());
  };
  useEffect(() => {
    const alvo = listaRef.current?.parentElement;
    if (!alvo) return;
    let nivel = 0;
    const temArquivo = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const entrar = (e) => { if (!temArquivo(e)) return; e.preventDefault(); nivel++; setArrastando(true); };
    const sobre = (e) => { if (!temArquivo(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
    const sair = (e) => { if (!temArquivo(e)) return; nivel = Math.max(0, nivel - 1); if (nivel === 0) setArrastando(false); };
    const soltar = (e) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      nivel = 0;
      setArrastando(false);
      soltarRef.current?.(e.dataTransfer.files, e.dataTransfer.items);
    };
    alvo.addEventListener("dragenter", entrar);
    alvo.addEventListener("dragover", sobre);
    alvo.addEventListener("dragleave", sair);
    alvo.addEventListener("drop", soltar);
    return () => {
      alvo.removeEventListener("dragenter", entrar);
      alvo.removeEventListener("dragover", sobre);
      alvo.removeEventListener("dragleave", sair);
      alvo.removeEventListener("drop", soltar);
    };
  }, [conversa.id]);

  const responder = (m) => {
    setRespondendo(m);
    setReacaoAberta(null);
    setMsgAtiva(null);
    requestAnimationFrame(() => linhaRef.current?.querySelector("textarea")?.focus());
  };

  // Celular: arrastar a mensagem para a direita responde (como no WhatsApp).
  const gestoRef = useRef(null);
  const SWIPE_MIN = 56;
  const gestoInicio = (e) => {
    const t = e.touches[0];
    gestoRef.current = { x: t.clientX, y: t.clientY, dx: 0, travado: null };
  };
  const gestoMover = (e) => {
    const g = gestoRef.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (g.travado === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) g.travado = Math.abs(dx) > Math.abs(dy) * 1.5 && dx > 0 ? "h" : "v";
    if (g.travado !== "h") return;
    g.dx = Math.min(dx, 90);
    e.currentTarget.style.transform = `translateX(${g.dx}px)`;
    e.currentTarget.style.transition = "none";
  };
  const gestoFim = (m) => (e) => {
    const g = gestoRef.current;
    gestoRef.current = null;
    const el = e.currentTarget;
    el.style.transition = "transform .18s ease-out";
    el.style.transform = "";
    if (g?.travado === "h" && g.dx >= SWIPE_MIN) {
      navigator.vibrate?.(15);
      responder(m);
    }
  };

  const reagir = async (m, emoji) => {
    setReacaoAberta(null);
    setMsgAtiva(null);
    try {
      await reagirMensagem(conversa.id, m.id, emoji);
    } catch (e) {
      setErro(e.message);
    }
  };

  // Clicar na citação leva até a mensagem original (e pisca ela). Se a
  // original não está carregada/foi apagada, não faz nada.
  const irParaMensagem = (id) => {
    const el = listaRef.current?.querySelector(`[data-msg-id="${id}"]`);
    if (!el) return;
    grudadoNoFimRef.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("destaque");
    setTimeout(() => el.classList.remove("destaque"), 1600);
  };


  // Gravar áudio: ao parar, envia direto (igual WhatsApp), respondendo à
  // mensagem selecionada, se houver.
  const enviarAudio = async (file, duracao) => {
    setEnviando(true);
    setErro("");
    grudadoNoFimRef.current = true;
    try {
      await enviarMensagem(conversa.id, { texto: "", arquivo: file, respostaA: respondendo?.id, duracao });
      setRespondendo(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };
  const gravador = useGravadorAudio({
    onPronto: enviarAudio,
    onErro: (e) => {
      const textos = {
        inseguro: ["Gravação indisponível neste endereço", "O navegador só libera o microfone em endereço seguro (https ou localhost). Acesse o sistema pelo endereço https, ou grave o áudio no celular e anexe o arquivo pelo clipe."],
        negado: ["Microfone bloqueado", "Clique no cadeado ao lado do endereço do site, permita o microfone e tente de novo."],
        "sem-microfone": ["Nenhum microfone encontrado", "Conecte um microfone (ou fone com microfone) e tente de novo."],
        "sem-suporte": ["Este navegador não grava áudio", "Use uma versão atual do Chrome, Edge, Firefox ou Safari — ou anexe um arquivo de áudio pelo clipe."],
        outro: ["Não foi possível gravar", e.detalhe || "Tente novamente."],
      };
      const [titulo, texto] = textos[e.tipo] || textos.outro;
      setAvisoGrande(null);
      setAvisoAudio({ titulo, texto });
    },
  });

  gravandoRef.current = gravador.gravando;

  const apagar = async (mensagemId) => {
    try {
      await apagarMensagem(conversa.id, mensagemId);
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <>
      {arrastando && (
        <div className="chat-drop-overlay" aria-hidden="true">
          <div className="chat-drop-caixa">
            <UploadCloud size={compact ? 30 : 42} />
            <strong>Solte para anexar</strong>
            <span>Até {limites.anexoMaxMb} MB · fica salvo {limites.retencaoDias} dias</span>
          </div>
        </div>
      )}
      <div ref={listaRef} onScroll={aoRolar} className={`chat-mensagens ${compact ? "chat-mensagens-compacta" : ""}`}>
        {carregandoMensagens && <p className="chat-vazio-hint">Carregando mensagens...</p>}
        {!carregandoMensagens && mensagens.length === 0 && (
          <p className="chat-vazio-hint">Nenhuma mensagem ainda. Diga oi!</p>
        )}
        {mensagens.map((m, idx) => {
          const minha = m.autorId === currentUser.id;
          const novoDia = idx === 0 || chaveDia(mensagens[idx - 1].createdAt) !== chaveDia(m.createdAt);
          const reacoes = m.reacoes || {};
          const grupos = {};
          Object.entries(reacoes).forEach(([uid, emoji]) => { (grupos[emoji] ||= []).push(uid); });
          const minhaReacao = reacoes[currentUser.id];
          return (
            <Fragment key={m.id}>
              {novoDia && (
                <div className="chat-dia-separador" role="separator">
                  <span>{rotuloDia(m.createdAt)}</span>
                </div>
              )}
              <div data-msg-id={m.id} className={`chat-bolha-wrap ${minha ? "minha" : ""} ${msgAtiva === m.id ? "ativa" : ""}`}>
                <div className="chat-bolha-coluna">
                  <div
                    className="chat-bolha"
                    onTouchStart={gestoInicio}
                    onTouchMove={gestoMover}
                    onTouchEnd={gestoFim(m)}
                    onTouchCancel={gestoFim(m)}
                    onClick={(e) => { if (window.matchMedia?.("(hover: none)").matches && !e.target.closest("a, button, video")) setMsgAtiva((v) => (v === m.id ? null : m.id)); }}
                  >
                    {!minha && conversa.tipo === "grupo" && <div className="chat-bolha-autor">{m.autorNome}</div>}
                    {m.respostaA && (
                      <button type="button" className="chat-citacao" onClick={() => irParaMensagem(m.respostaA.id)}>
                        <span className="chat-citacao-autor">{m.respostaA.autorId === currentUser.id ? "Você" : m.respostaA.autorNome}</span>
                        <span className="chat-citacao-texto">{resumoMensagem(m.respostaA) || "Mensagem"}</span>
                      </button>
                    )}
                    {m.texto && <div className="chat-bolha-texto">{m.texto}</div>}
                    {m.anexo && (
                      m.anexo.expirado ? (
                        <div className="chat-anexo-expirado" title={m.anexo.expiradoMotivo === "teto" ? "Apagado automaticamente para liberar espaço no servidor" : `Anexos ficam salvos por ${limites.retencaoDias} dias`}>
                          <FileIcon size={14} />
                          <span className="chat-anexo-nome">{m.anexo.nomeOriginal}</span>
                          <span>— arquivo expirado</span>
                        </div>
                      ) : m.anexo.tipo?.startsWith("audio/") ? (
                        <AudioPlayer src={anexoUrl(m.anexo.arquivo)} duracaoSeg={m.anexo.duracaoSeg} nome={m.anexo.nomeOriginal} />
                      ) : m.anexo.tipo?.startsWith("video/") ? (
                        <video className="chat-anexo-video" controls preload="metadata" onLoadedMetadata={aoMidiaCarregar} src={anexoUrl(m.anexo.arquivo)} />
                      ) : m.anexo.tipo?.startsWith("image/") ? (
                        <a href={anexoUrl(m.anexo.arquivo)} target="_blank" rel="noreferrer" className="chat-anexo-imagem">
                          <img src={anexoUrl(m.anexo.arquivo)} alt={m.anexo.nomeOriginal} onLoad={aoMidiaCarregar} />
                        </a>
                      ) : (
                        <a href={anexoUrl(m.anexo.arquivo)} target="_blank" rel="noreferrer" className="chat-anexo-arquivo">
                          <FileIcon size={16} />
                          <span className="chat-anexo-nome">{m.anexo.nomeOriginal}</span>
                          <span className="chat-anexo-tamanho">{formatTamanho(m.anexo.tamanho)}</span>
                          <Download size={14} />
                        </a>
                      )
                    )}
                    <div className="chat-bolha-rodape">
                      <span>{formatHora(m.createdAt)}</span>
                      {minha && (
                        <button className="chat-bolha-apagar" title="Apagar mensagem" onClick={() => setConfirmApagar(m.id)}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {Object.keys(grupos).length > 0 && (
                    <div className="chat-reacoes">
                      {Object.entries(grupos).map(([emoji, ids]) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`chat-reacao ${minhaReacao === emoji ? "minha" : ""}`}
                          title={ids.map((id) => (id === currentUser.id ? "Você" : nomePorId[id] || "Alguém")).join(", ")}
                          onClick={() => reagir(m, emoji)}
                        >
                          <span>{emoji}</span>
                          {ids.length > 1 && <span className="chat-reacao-n">{ids.length}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="chat-acoes-msg">
                  <button
                    type="button"
                    className="chat-acao-msg"
                    aria-label="Reagir"
                    onClick={(e) => {
                      const el = e.currentTarget;
                      setReacaoAberta((r) => (r?.id === m.id ? null : { id: m.id, el }));
                    }}
                  >
                    <SmilePlus size={15} /><span className="rotulo">Reagir</span>
                  </button>
                  <button type="button" className="chat-acao-msg" title="Responder" aria-label="Responder" onClick={() => responder(m)}>
                    <CornerUpLeft size={15} /><span className="rotulo">Responder</span>
                  </button>
                </div>
              </div>
            </Fragment>
          );
        })}
        {reacaoAberta && (() => {
          const alvo = mensagens.find((x) => x.id === reacaoAberta.id);
          if (!alvo) return null;
          return (
            <ReactionPicker
              anchorEl={reacaoAberta.el}
              minha={alvo.autorId === currentUser.id}
              atual={(alvo.reacoes || {})[currentUser.id]}
              onEscolher={(emoji) => reagir(alvo, emoji)}
              onFechar={() => setReacaoAberta(null)}
            />
          );
        })()}
        {digitandoSet?.size > 0 && (
          <div className="chat-digitando">
            {[...digitandoSet].map((id) => nomePorId[id] || "Alguém").join(", ")} digitando...
          </div>
        )}
      </div>

      {avisoGrande && (
        <div className="chat-aviso" role="alert">
          <span className="chat-aviso-icone"><AlertTriangle size={compact ? 15 : 18} /></span>
          <div className="chat-aviso-corpo">
            <strong className="chat-aviso-titulo">Arquivo grande demais para o Chat</strong>
            <span className="chat-aviso-arquivo">{avisoGrande.nome} · {avisoGrande.tamanho} (limite: {limites.anexoMaxMb} MB)</span>
            <span className="chat-aviso-texto">Envie por link e cole o link na mensagem:</span>
            <div className="chat-aviso-dicas">
              <span className="chat-aviso-dica">Google Drive</span>
              <span className="chat-aviso-dica">WeTransfer</span>
              <span className="chat-aviso-dica">Pasta da rede da redação</span>
            </div>
          </div>
          <button type="button" className="chat-aviso-fechar" aria-label="Fechar aviso" onClick={() => setAvisoGrande(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {avisoAudio && (
        <div className="chat-aviso" role="alert">
          <span className="chat-aviso-icone"><MicOff size={compact ? 15 : 18} /></span>
          <div className="chat-aviso-corpo">
            <strong className="chat-aviso-titulo">{avisoAudio.titulo}</strong>
            <span className="chat-aviso-texto">{avisoAudio.texto}</span>
          </div>
          <button type="button" className="chat-aviso-fechar" aria-label="Fechar aviso" onClick={() => setAvisoAudio(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {erro && <p className="chat-erro" style={{ margin: compact ? "0 10px" : "0 16px" }}>{erro}</p>}

      <div className="chat-composer">
        {respondendo && (
          <div className="chat-resposta-barra">
            <CornerUpLeft size={15} className="chat-resposta-icone" />
            <div className="chat-resposta-corpo">
              <span className="chat-resposta-autor">Respondendo a {respondendo.autorId === currentUser.id ? "você mesmo" : respondendo.autorNome}</span>
              <span className="chat-resposta-texto">{resumoMensagem(respondendo) || "Mensagem"}</span>
            </div>
            <button type="button" className="chat-resposta-fechar" aria-label="Cancelar resposta" title="Cancelar resposta" onClick={() => setRespondendo(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        {arquivo && (
          <div className="chat-composer-anexo">
            <FileIcon size={14} /> {arquivo.name} ({formatTamanho(arquivo.size)}){enviando ? " — enviando…" : ""}
            <button className="icon-btn" onClick={() => { setArquivo(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>×</button>
          </div>
        )}
        {emojisAberto && (
          <EmojiPicker
            anchorRef={emojiBtnRef}
            onEscolher={inserirEmoji}
            onFechar={() => setEmojisAberto(false)}
          />
        )}
        {gravador.gravando ? (
          <div key="gravando" className="chat-gravando" role="status">
            <button type="button" className="icon-btn chat-gravando-cancelar" aria-label="Cancelar gravação" title="Cancelar gravação" onClick={gravador.cancelar}>
              <Trash2 size={compact ? 16 : 18} />
            </button>
            <span className="chat-gravando-ponto" />
            <span className="chat-gravando-tempo">{formatarTempo(gravador.segundos)}</span>
            <span className="chat-gravando-texto">Gravando… (máx. {Math.round(MAX_GRAVACAO_SEG / 60)} min)</span>
            <button type="button" className="btn-primary chat-enviar-btn" aria-label="Enviar áudio" title="Enviar áudio" onClick={gravador.enviar}>
              <Send size={compact ? 14 : 16} />
            </button>
          </div>
        ) : (
          <div key="linha" className="chat-composer-linha" ref={linhaRef}>
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={escolherArquivo} />
            <div className={`chat-dica-wrap ${dicaClipeOculta ? "oculta" : ""}`} onMouseLeave={() => setDicaClipeOculta(false)}>
              <button className="icon-btn" aria-label="Anexar arquivo" onClick={() => { setDicaClipeOculta(true); fileInputRef.current?.click(); }}>
                <Paperclip size={compact ? 16 : 18} />
              </button>
              <div className="chat-dica" role="tooltip">
                <span className="chat-dica-titulo">Anexar arquivo</span>
                <span className="chat-dica-linha"><HardDrive size={14} /> Até <b>{limites.anexoMaxMb} MB</b> por arquivo</span>
                <span className="chat-dica-linha"><Clock size={14} /> Fica salvo por <b>{limites.retencaoDias} dias</b></span>
                <span className="chat-dica-rodape"><Link2 size={11} style={{ verticalAlign: "-1px" }} /> Maior que isso? Mande por link.</span>
              </div>
            </div>
            <button
              ref={emojiBtnRef}
              type="button"
              className={`icon-btn chat-emoji-btn ${emojisAberto ? "ativo" : ""}`}
              title="Emojis"
              aria-label="Emojis"
              aria-expanded={emojisAberto}
              onClick={() => setEmojisAberto((v) => !v)}
            >
              <Smile size={compact ? 16 : 18} />
            </button>
            <AutoGrowTextarea
              minRows={1}
              placeholder="Escreva uma mensagem..."
              value={texto}
              onChange={(e) => { setTexto(e.target.value); avisarDigitando(conversa); }}
              onPaste={(e) => {
                // Colar uma imagem/arquivo (ex: print de tela) anexa em vez de colar texto.
                const f = e.clipboardData?.files?.[0];
                if (f) { e.preventDefault(); aceitarArquivo(f); }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && respondendo) { e.preventDefault(); setRespondendo(null); return; }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
            />
            {!texto.trim() && !arquivo ? (
              <button
                type="button"
                className="btn-primary chat-enviar-btn chat-mic-btn"
                aria-label="Gravar áudio"
                title="Gravar áudio"
                disabled={enviando}
                onClick={() => { setAvisoAudio(null); gravador.iniciar(); }}
              >
                <Mic size={compact ? 14 : 16} />
              </button>
            ) : (
              <button className="btn-primary chat-enviar-btn" disabled={enviando} onClick={enviar}>
                <Send size={compact ? 14 : 16} />
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmApagar}
        title="Apagar mensagem"
        message="Tem certeza de que deseja apagar essa mensagem? Essa ação não pode ser desfeita."
        confirmLabel="Apagar"
        onCancel={() => setConfirmApagar(null)}
        onConfirm={() => { const id = confirmApagar; setConfirmApagar(null); apagar(id); }}
      />
    </>
  );
}
