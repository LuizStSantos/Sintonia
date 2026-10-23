import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onRealtimeMessage, sendRealtimeMessage, showBrowserNotification, playNotificationSound } from "../../lib/realtime.js";
import {
  apiListUsuariosChat,
  apiListOnline,
  apiListConversas,
  apiCriarConversaPrivada,
  apiCriarGrupo,
  apiRenomearGrupo,
  apiApagarGrupo,
  apiAdicionarParticipantes,
  apiRemoverParticipante,
  apiDefinirFotoGrupo,
  apiRemoverFotoGrupo,
  apiListMensagens,
  apiEnviarMensagem,
  apiApagarMensagem, apiReagirMensagem,
  apiMarcarComoLida,
} from "../../api/chat.js";

// Estado do Chat inteiro mora aqui, num Provider montado uma vez só lá em
// cima (ver App.jsx) — tanto a aba Chat de tela cheia quanto os balõezinhos
// flutuantes (estilo Messenger) leem e escrevem no mesmo lugar, em vez de
// cada um ter sua própria cópia. É isso que permite um balão continuar
// aberto (com as mensagens chegando em tempo real) mesmo trocando de aba,
// já que esse Provider fica montado o tempo todo, só a aba de tela cheia
// que monta/desmonta.
const ChatContext = createContext(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat() precisa estar dentro de <ChatProvider>");
  return ctx;
}

export function ChatProvider({ currentUser, children }) {
  const [conversas, setConversas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [carregando, setCarregando] = useState(true);
  const [mensagensPorConversa, setMensagensPorConversa] = useState({});
  const [carregandoMensagensPorConversa, setCarregandoMensagensPorConversa] = useState({});
  const [digitando, setDigitando] = useState({}); // conversaId -> Set(userId)
  const [popups, setPopups] = useState([]); // [{ conversaId, minimizado }], ordem = empilhamento

  // Quais conversas estão "na tela" agora (aba de tela cheia com essa
  // conversa selecionada, ou balão aberto e não minimizado) — usado pra não
  // notificar/contar como não lida uma mensagem de uma conversa que a
  // pessoa já está olhando. Ref (não state) porque é lido de dentro do
  // handler de tempo real, montado uma vez só.
  const visiveisRef = useRef(new Set());
  const typingTimeouts = useRef({});
  const ultimoTypingEnviado = useRef({});

  const nomePorId = useMemo(() => Object.fromEntries(usuarios.map((u) => [u.id, u.displayName || u.username])), [usuarios]);
  const fotoPorId = useMemo(() => Object.fromEntries(usuarios.map((u) => [u.id, u.foto || null])), [usuarios]);

  const nomeConversa = useCallback(
    (c) => {
      if (!c) return "";
      if (c.tipo === "grupo") return c.nome || "Grupo";
      const outroId = c.participantes.find((p) => p !== currentUser.id);
      return nomePorId[outroId] || "Usuário";
    },
    [currentUser.id, nomePorId]
  );

  // Foto a mostrar pra essa conversa: a do grupo (se tiver), ou a da outra
  // pessoa (se for privada) — paralelo ao nomeConversa acima. Sem foto
  // cadastrada, devolve null e quem chamou cai no círculo com a inicial.
  const fotoConversa = useCallback(
    (c) => {
      if (!c) return null;
      if (c.tipo === "grupo") return c.foto || null;
      const outroId = c.participantes.find((p) => p !== currentUser.id);
      return fotoPorId[outroId] || null;
    },
    [currentUser.id, fotoPorId]
  );

  const outroParticipanteId = useCallback(
    (c) => (c && c.tipo === "privada" ? c.participantes.find((p) => p !== currentUser.id) : null),
    [currentUser.id]
  );

  const totalNaoLidas = useMemo(() => conversas.reduce((soma, c) => soma + (c.naoLidas || 0), 0), [conversas]);

  // --- Carregamento inicial ---
  useEffect(() => {
    Promise.all([apiListConversas(), apiListUsuariosChat(), apiListOnline()])
      .then(([conv, users, online]) => {
        setConversas(conv);
        setUsuarios(users);
        setOnlineIds(new Set(online));
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const marcarVisivel = useCallback((conversaId) => {
    if (!conversaId) return;
    visiveisRef.current.add(conversaId);
    apiMarcarComoLida(conversaId).catch(() => {});
    setConversas((prev) => prev.map((c) => (c.id === conversaId ? { ...c, naoLidas: 0 } : c)));
  }, []);

  const desmarcarVisivel = useCallback((conversaId) => {
    if (!conversaId) return;
    visiveisRef.current.delete(conversaId);
  }, []);

  // --- Eventos em tempo real (um único assinante pra tudo que é Chat) ---
  useEffect(() => {
    const unsubscribe = onRealtimeMessage((msg) => {
      if (msg.type === "chat-mensagem") {
        const m = msg.payload;
        const visivel = visiveisRef.current.has(m.conversaId);
        // Esse evento só chega pra quem NÃO escreveu a mensagem (o servidor
        // já exclui o autor — ver notifyUsers em server/index.js), então
        // toca o sinal sonoro sempre, mesmo com a conversa aberta na tela
        // (igual WhatsApp/Messenger: só não toca pra mensagem que você
        // mesmo mandou).
        playNotificationSound();
        setMensagensPorConversa((prev) => {
          if (!prev[m.conversaId]) return prev; // só guarda se já carregou essa conversa antes
          if (prev[m.conversaId].some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.conversaId]: [...prev[m.conversaId], m] };
        });
        if (visivel) {
          apiMarcarComoLida(m.conversaId).catch(() => {});
        } else {
          showBrowserNotification(
            m.autorNome ? `Mensagem de ${m.autorNome}` : "Nova mensagem",
            m.texto || (m.anexo?.tipo?.startsWith("audio/") ? "Enviou um áudio." : "Enviou um anexo.")
          );
        }
        setConversas((prev) => {
          const existe = prev.some((c) => c.id === m.conversaId);
          if (!existe) return prev;
          return prev
            .map((c) =>
              c.id === m.conversaId
                ? { ...c, ultimaMensagem: m, ordenarPor: m.createdAt, naoLidas: visivel ? 0 : (c.naoLidas || 0) + 1 }
                : c
            )
            .sort((a, b) => (b.ordenarPor || "").localeCompare(a.ordenarPor || ""));
        });
        setDigitando((prev) => {
          if (!prev[m.conversaId]?.has(m.autorId)) return prev;
          const next = new Set(prev[m.conversaId]);
          next.delete(m.autorId);
          return { ...prev, [m.conversaId]: next };
        });
      } else if (msg.type === "chat-mensagem-reacao") {
        const { conversaId, mensagemId, reacoes } = msg.payload;
        setMensagensPorConversa((prev) => {
          if (!prev[conversaId]) return prev;
          return { ...prev, [conversaId]: prev[conversaId].map((m) => (m.id === mensagemId ? { ...m, reacoes } : m)) };
        });
      } else if (msg.type === "chat-mensagem-apagada") {
        const { conversaId, mensagemId } = msg.payload;
        setMensagensPorConversa((prev) => {
          if (!prev[conversaId]) return prev;
          return { ...prev, [conversaId]: prev[conversaId].filter((m) => m.id !== mensagemId) };
        });
      } else if (msg.type === "chat-conversa-criada") {
        setConversas((prev) =>
          prev.some((c) => c.id === msg.payload.id)
            ? prev
            : [{ ...msg.payload, ultimaMensagem: null, naoLidas: 0, ordenarPor: msg.payload.createdAt }, ...prev]
        );
      } else if (msg.type === "chat-conversa-atualizada") {
        setConversas((prev) => {
          const existe = prev.find((c) => c.id === msg.payload.id);
          if (!msg.payload.participantes.includes(currentUser.id)) {
            return prev.filter((c) => c.id !== msg.payload.id);
          }
          if (!existe) return [{ ...msg.payload, ultimaMensagem: null, naoLidas: 0, ordenarPor: msg.payload.updatedAt || msg.payload.createdAt }, ...prev];
          return prev.map((c) => (c.id === msg.payload.id ? { ...c, ...msg.payload } : c));
        });
        // Se a pessoa foi removida do grupo (ou saiu em outra aba/dispositivo),
        // fecha qualquer balão flutuante que estivesse aberto com ele.
        if (!msg.payload.participantes.includes(currentUser.id)) {
          setPopups((prev) => prev.filter((p) => p.conversaId !== msg.payload.id));
          visiveisRef.current.delete(msg.payload.id);
        }
      } else if (msg.type === "chat-grupo-apagado") {
        // Quem criou o grupo apagou ele (de qualquer dispositivo/aba) —
        // some da lista e fecha qualquer balão aberto com ele, pros outros
        // participantes também.
        const { conversaId } = msg.payload;
        setConversas((prev) => prev.filter((c) => c.id !== conversaId));
        setPopups((prev) => prev.filter((p) => p.conversaId !== conversaId));
        visiveisRef.current.delete(conversaId);
      } else if (msg.type === "chat-presence") {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          if (msg.online) next.add(msg.userId);
          else next.delete(msg.userId);
          return next;
        });
      } else if (msg.collection === "users") {
        // Alguém (admin) criou/editou/excluiu um usuário — inclui trocar a
        // foto de perfil de alguém. Recarrega a listinha de usuários do
        // Chat pra refletir na hora (nome, foto) sem precisar recarregar a
        // página inteira.
        apiListUsuariosChat().then(setUsuarios).catch(() => {});
      } else if (msg.type === "chat-typing") {
        const { conversaId, userId } = msg;
        setDigitando((prev) => {
          const next = new Set(prev[conversaId]);
          next.add(userId);
          return { ...prev, [conversaId]: next };
        });
        const key = `${conversaId}:${userId}`;
        clearTimeout(typingTimeouts.current[key]);
        typingTimeouts.current[key] = setTimeout(() => {
          setDigitando((prev) => {
            if (!prev[conversaId]) return prev;
            const next = new Set(prev[conversaId]);
            next.delete(userId);
            return { ...prev, [conversaId]: next };
          });
        }, 3000);
      }
    });
    return unsubscribe;
  }, [currentUser.id]);

  const garantirMensagensCarregadas = useCallback((conversaId) => {
    setMensagensPorConversa((prev) => {
      if (prev[conversaId]) return prev;
      setCarregandoMensagensPorConversa((p) => ({ ...p, [conversaId]: true }));
      apiListMensagens(conversaId)
        .then((lista) => {
          setMensagensPorConversa((p) => (p[conversaId] ? p : { ...p, [conversaId]: lista }));
        })
        .catch(() => {})
        .finally(() => setCarregandoMensagensPorConversa((p) => ({ ...p, [conversaId]: false })));
      return prev;
    });
  }, []);

  const avisarDigitando = useCallback((conversa) => {
    if (!conversa) return;
    const agora = Date.now();
    const ultimo = ultimoTypingEnviado.current[conversa.id] || 0;
    if (agora - ultimo < 1500) return;
    ultimoTypingEnviado.current[conversa.id] = agora;
    sendRealtimeMessage({ type: "typing", conversaId: conversa.id, participantes: conversa.participantes });
  }, []);

  const criarConversaPrivada = useCallback(async (outroUserId) => {
    const c = await apiCriarConversaPrivada(outroUserId);
    setConversas((prev) => (prev.some((x) => x.id === c.id) ? prev : [{ ...c, ultimaMensagem: null, naoLidas: 0, ordenarPor: c.createdAt }, ...prev]));
    return c;
  }, []);

  const criarGrupo = useCallback(async (nome, participantes) => {
    const c = await apiCriarGrupo(nome, participantes);
    setConversas((prev) => [{ ...c, ultimaMensagem: null, naoLidas: 0, ordenarPor: c.createdAt }, ...prev]);
    return c;
  }, []);

  const renomearGrupo = useCallback(async (conversaId, nome) => {
    const updated = await apiRenomearGrupo(conversaId, nome);
    setConversas((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    return updated;
  }, []);

  const adicionarParticipantes = useCallback(async (conversaId, ids) => {
    const updated = await apiAdicionarParticipantes(conversaId, ids);
    setConversas((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    return updated;
  }, []);

  const removerParticipante = useCallback(async (conversaId, userId) => {
    const updated = await apiRemoverParticipante(conversaId, userId);
    if (userId === currentUser.id) {
      setConversas((prev) => prev.filter((c) => c.id !== conversaId));
      setPopups((prev) => prev.filter((p) => p.conversaId !== conversaId));
      visiveisRef.current.delete(conversaId);
    } else {
      setConversas((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    }
    return updated;
  }, [currentUser.id]);

  const definirFotoGrupo = useCallback(async (conversaId, arquivo) => {
    const updated = await apiDefinirFotoGrupo(conversaId, arquivo);
    setConversas((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    return updated;
  }, []);

  const removerFotoGrupo = useCallback(async (conversaId) => {
    const updated = await apiRemoverFotoGrupo(conversaId);
    setConversas((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    return updated;
  }, []);

  // Apaga o grupo de vez (só quem criou pode — o servidor confere de novo,
  // isso aqui é só pra não deixar nem tentar na tela). Limpa local na hora
  // em vez de esperar o "chat-grupo-apagado" voltar pelo WebSocket, pra
  // quem apagou já ver sumir sem esperar o round-trip.
  const apagarGrupo = useCallback(async (conversaId) => {
    await apiApagarGrupo(conversaId);
    setConversas((prev) => prev.filter((c) => c.id !== conversaId));
    setPopups((prev) => prev.filter((p) => p.conversaId !== conversaId));
    visiveisRef.current.delete(conversaId);
  }, []);

  const enviarMensagem = useCallback(async (conversaId, { texto, arquivo, respostaA, duracao }) => {
    const saved = await apiEnviarMensagem(conversaId, { texto, arquivo, respostaA, duracao });
    setMensagensPorConversa((prev) => {
      const lista = prev[conversaId] || [];
      if (lista.some((m) => m.id === saved.id)) return prev;
      return { ...prev, [conversaId]: [...lista, saved] };
    });
    setConversas((prev) =>
      prev
        .map((c) => (c.id === conversaId ? { ...c, ultimaMensagem: saved, ordenarPor: saved.createdAt } : c))
        .sort((a, b) => (b.ordenarPor || "").localeCompare(a.ordenarPor || ""))
    );
    return saved;
  }, []);

  const aplicarReacoes = useCallback((conversaId, mensagemId, reacoes) => {
    setMensagensPorConversa((prev) => {
      if (!prev[conversaId]) return prev;
      return { ...prev, [conversaId]: prev[conversaId].map((m) => (m.id === mensagemId ? { ...m, reacoes } : m)) };
    });
  }, []);

  const reagirMensagem = useCallback(async (conversaId, mensagemId, emoji) => {
    const r = await apiReagirMensagem(conversaId, mensagemId, emoji);
    aplicarReacoes(conversaId, mensagemId, r.reacoes);
  }, [aplicarReacoes]);

  const apagarMensagem = useCallback(async (conversaId, mensagemId) => {
    await apiApagarMensagem(conversaId, mensagemId);
    setMensagensPorConversa((prev) => {
      if (!prev[conversaId]) return prev;
      return { ...prev, [conversaId]: prev[conversaId].filter((m) => m.id !== mensagemId) };
    });
  }, []);

  // --- Balões flutuantes (estilo Messenger) ---
  const abrirPopup = useCallback((conversaId) => {
    garantirMensagensCarregadas(conversaId);
    setPopups((prev) => {
      if (prev.some((p) => p.conversaId === conversaId)) {
        // já aberto — só garante que não está minimizado e traz pra frente
        return prev.map((p) => (p.conversaId === conversaId ? { ...p, minimizado: false } : p));
      }
      // no máximo 3 balões abertos ao mesmo tempo (igual o Messenger limita
      // em telas menores) — o mais antigo fecha pra abrir espaço
      const next = [...prev, { conversaId, minimizado: false }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    marcarVisivel(conversaId);
  }, [garantirMensagensCarregadas, marcarVisivel]);

  const fecharPopup = useCallback((conversaId) => {
    setPopups((prev) => prev.filter((p) => p.conversaId !== conversaId));
    desmarcarVisivel(conversaId);
  }, [desmarcarVisivel]);

  const minimizarPopup = useCallback((conversaId) => {
    setPopups((prev) => prev.map((p) => (p.conversaId === conversaId ? { ...p, minimizado: true } : p)));
    desmarcarVisivel(conversaId);
  }, [desmarcarVisivel]);

  const restaurarPopup = useCallback((conversaId) => {
    setPopups((prev) => prev.map((p) => (p.conversaId === conversaId ? { ...p, minimizado: false } : p)));
    marcarVisivel(conversaId);
  }, [marcarVisivel]);

  const value = useMemo(
    () => ({
      currentUser,
      conversas,
      usuarios,
      onlineIds,
      carregando,
      mensagensPorConversa,
      carregandoMensagensPorConversa,
      digitando,
      popups,
      nomePorId,
      fotoPorId,
      nomeConversa,
      fotoConversa,
      outroParticipanteId,
      totalNaoLidas,
      marcarVisivel,
      desmarcarVisivel,
      garantirMensagensCarregadas,
      avisarDigitando,
      criarConversaPrivada,
      criarGrupo,
      renomearGrupo,
      apagarGrupo,
      adicionarParticipantes,
      removerParticipante,
      definirFotoGrupo,
      removerFotoGrupo,
      enviarMensagem,
      apagarMensagem,
      reagirMensagem,
      abrirPopup,
      fecharPopup,
      minimizarPopup,
      restaurarPopup,
    }),
    [
      currentUser, conversas, usuarios, onlineIds, carregando, mensagensPorConversa,
      carregandoMensagensPorConversa, digitando, popups, nomePorId, fotoPorId, nomeConversa,
      fotoConversa, outroParticipanteId, totalNaoLidas, marcarVisivel, desmarcarVisivel,
      garantirMensagensCarregadas, avisarDigitando, criarConversaPrivada, criarGrupo,
      renomearGrupo, apagarGrupo, adicionarParticipantes, removerParticipante, definirFotoGrupo,
      removerFotoGrupo, enviarMensagem, apagarMensagem, reagirMensagem, abrirPopup, fecharPopup,
      minimizarPopup, restaurarPopup,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
