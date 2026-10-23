import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, AlertTriangle, Eye, FileDown, ScrollText, ArrowUp, ArrowDown, FileText, GripVertical, Check, Clock3, Repeat2 } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { formatDateBR, todayISO, diaSemanaExtenso, WEEKDAY_KEYS_BY_INDEX } from "../../lib/dates.js";
import { formatDuracaoAspas, parseDuracaoParaSegundos, formatSegundosParaDuracao, distribuirSpotsEmPassagens } from "../../lib/duration.js";
import { caixaAlta, primeirosDoisNomes } from "../../lib/text.js";
import { getHorarios, formatHorarios } from "../../lib/programas.js";
import { numeroBlocoNoIndice, diasParaExpirar, tomDoPrograma } from "../../lib/espelho.js";
import { useEspelhoRetencao } from "./useEspelhoRetencao.js";
import { useEspelhoVistos } from "./useEspelhoVistos.js";
import { apiListEspelhoModelos, apiCreateEspelhoModelo, apiUpdateEspelhoModelo, apiDeleteEspelhoModelo } from "../../api/espelhoModelos.js";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Field } from "../../components/common/Field.jsx";
import { DurationInput } from "../../components/common/MaskedInputs.jsx";
import { AutoGrowTextarea } from "../../components/common/AutoGrowTextarea.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { EspelhoMateriasModal } from "./EspelhoMateriasModal.jsx";
import { EspelhoEntrevistadosModal } from "./EspelhoEntrevistadosModal.jsx";
import { EspelhoItemManualModal } from "./EspelhoItemManualModal.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { registrarGuardaDeSaida } from "../../lib/saidaGuard.js";

export function EspelhoTab({ items, onCreate, onUpdate, onDelete, canEdit = true, programasItems, videosItems, entrevistadosItems, currentUser, breaksItems, onUpdateVideo, onUpdateEntrevistado }) {
  const retencaoDias = useEspelhoRetencao();
  const { novos, atualizados, marcar: marcarVisto, marcarTodos: marcarTodosVistos } = useEspelhoVistos(items, currentUser?.id);
  const [modo, setModo] = useState("lista");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  // Snapshot do form assim que o editor abre (novo ou edição) — comparado
  // com o form atual para saber se há alterações não salvas ao clicar em
  // "Voltar", e assim avisar antes de perder o que foi digitado.
  const [formOriginal, setFormOriginal] = useState(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // Texto "Fulano trocou X por Y" mostrado no editor quando o espelho foi aberto já alterado por outra pessoa.
  const [avisoAlteracao, setAvisoAlteracao] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Avisos sobre matérias que NÃO tiveram a veiculação marcada automaticamente
  // ao salvar (normalmente por falta de permissão de Editar em Matérias) —
  // fica visível na tela até a pessoa confirmar que viu, em vez de voltar
  // pra lista sozinho e esconder o problema.
  const [avisoVeiculacao, setAvisoVeiculacao] = useState(null);
  const [camposFaltando, setCamposFaltando] = useState(() => new Set());
  const [materiasModalOpen, setMateriasModalOpen] = useState(false);
  const [entrevistadosModalOpen, setEntrevistadosModalOpen] = useState(false);
  const [itemManualModalOpen, setItemManualModalOpen] = useState(false);
  // Troca de item: id do item que está sendo trocado (os popups de escolha
  // colocam o que for escolhido NO LUGAR dele, em vez de no fim do roteiro) e
  // o item cujo menu "Trocar por…" está aberto.
  const [trocandoId, setTrocandoId] = useState(null);
  const [menuTrocaId, setMenuTrocaId] = useState(null);

  const [modelos, setModelos] = useState([]);
  useEffect(() => {
    apiListEspelhoModelos().then(setModelos).catch(() => {});
  }, []);

  // Salva (ou atualiza, se já existir um com esse nome) um modelo
  // reutilizável — chamado pelo popup de item manual quando a pessoa marca
  // "salvar como modelo" ao criar um item novo.
  const salvarModelo = async (nome, texto) => {
    try {
      const existente = modelos.find((m) => m.nome === nome);
      if (existente) {
        const updated = await apiUpdateEspelhoModelo(existente.id, { texto });
        setModelos((prev) => prev.map((m) => (m.id === existente.id ? updated : m)));
      } else {
        const created = await apiCreateEspelhoModelo({ nome, texto });
        setModelos((prev) => [...prev, created]);
      }
    } catch (e) {
      setErro(e.message);
    }
  };

  const removerModelo = async (id) => {
    try {
      await apiDeleteEspelhoModelo(id);
      setModelos((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setErro(e.message);
    }
  };

  const novoEspelho = () => {
    const inicial = { titulo: "", programaId: "", programaNome: "", programaSigla: "", horarioPrograma: "", data: todayISO(), itens: [] };
    setForm(inicial);
    setFormOriginal(inicial);
    setEditingId(null);
    setErro("");
    setModo("editor");
  };

  const abrirEdicao = (esp) => {
    setAvisoAlteracao(atualizados.has(esp.id) ? `${esp.alteradoPorNome || "Alguém"} ${esp.alteracao || "alterou este espelho"} (${new Date(esp.alteradoEm).toLocaleString("pt-BR")})` : "");
    marcarVisto(esp.id);
    const inicial = { ...esp, itens: (esp.itens || []).map((i) => ({ ...i })) };
    setForm(inicial);
    setFormOriginal(inicial);
    setEditingId(esp.id);
    setErro("");
    setModo("editor");
  };

  const voltarLista = () => {
    setModo("lista");
    setForm(null);
    setFormOriginal(null);
    setEditingId(null);
  };

  const temAlteracoes = () => modo === "editor" && !!form && !!formOriginal && JSON.stringify(form) !== JSON.stringify(formOriginal);

  // Avisa o resto do sistema (troca de aba, atualizar/fechar a página) que
  // existe um espelho com alterações não salvas.
  useEffect(() => {
    const sair = registrarGuardaDeSaida(temAlteracoes);
    const aoFechar = (e) => {
      if (temAlteracoes()) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", aoFechar);
    return () => { sair(); window.removeEventListener("beforeunload", aoFechar); };
  });

  // Só deixa sair direto se nada mudou desde que o editor abriu — senão
  // pede confirmação, pra não perder um espelho montado por engano.
  const clicarVoltar = () => {
    if (form && formOriginal && JSON.stringify(form) !== JSON.stringify(formOriginal)) {
      setConfirmarSaida(true);
    } else {
      voltarLista();
    }
  };

  const selecionarPrograma = (programaId) => {
    const p = (programasItems || []).find((pp) => pp.id === programaId);
    setForm((f) => {
      const tituloEraAuto = !f.titulo?.trim() || f.titulo === `ESPELHO DO PROGRAMA: ${(f.programaNome || "").toUpperCase()}`;
      return {
        ...f,
        programaId,
        programaNome: p?.nome || "",
        programaSigla: p?.sigla || p?.nome || "",
        horarioPrograma: p && getHorarios(p).length > 0 ? formatHorarios(p) : "",
        titulo: tituloEraAuto && p ? `ESPELHO DO PROGRAMA: ${p.nome.toUpperCase()}` : f.titulo,
      };
    });
  };

  const idsJaAdicionados = useMemo(() => {
    return new Set((form?.itens || []).filter((i) => i.tipo === "materia").map((i) => i.materiaId));
  }, [form?.itens]);

  const idsJaAdicionadosEntrevistados = useMemo(() => {
    return new Set((form?.itens || []).filter((i) => i.tipo === "entrevistado").map((i) => i.entrevistadoId));
  }, [form?.itens]);

  // Duração "ao vivo" de um item de matéria: busca o valor atual lá na aba
  // Matérias em vez do que foi copiado no momento em que a matéria foi
  // adicionada ao espelho. Assim, se a matéria ainda estava em edição (sem
  // tempo definido) quando entrou no roteiro, e alguém preenche a duração
  // dela depois, o espelho atualiza sozinho — sem precisar editar aqui de
  // novo. Se a matéria foi excluída depois de adicionada, usa o último
  // valor que tinha sido salvo no item.
  const duracaoAtualItem = (item) => {
    if (item.tipo === "materia" && item.materiaId) {
      const materiaAtual = (videosItems || []).find((v) => v.id === item.materiaId);
      if (materiaAtual) return materiaAtual.duracao || "";
    }
    return item.duracao || "";
  };

  // Entrevistados "do dia": quem tem veiculação marcada pra esse dia + programa,
  // ou cujo agendamento principal (Programa + Data) é esse — mesmo atalho das matérias.
  const entrevistadosDisponiveis = useMemo(() => {
    if (!form?.data || !form?.programaSigla) return [];
    return (entrevistadosItems || [])
      .filter((e) => {
        if (idsJaAdicionadosEntrevistados.has(e.id)) return false;
        const porVeiculacao = (e.datasVeiculacao || []).some((dv) => dv.data === form.data && dv.local === form.programaSigla);
        const porAgendamento = e.data === form.data && e.programa === form.programaSigla;
        return porVeiculacao || porAgendamento;
      })
      .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
  }, [form?.data, form?.programaSigla, entrevistadosItems, idsJaAdicionadosEntrevistados]);

  const materiasDisponiveis = useMemo(() => {
    if (!form?.data || !form?.programaSigla) return [];
    return (videosItems || []).filter((v) => {
      if (idsJaAdicionados.has(v.id)) return false;
      return (v.datasVeiculacao || []).some((dv) => dv.data === form.data && dv.local === form.programaSigla);
    });
  }, [form?.data, form?.programaSigla, videosItems, idsJaAdicionados]);

  // Lista de spots de OPEC (comerciais) que valem pro dia da semana + programa
  // deste espelho — cada ocorrência (quantidade dentro do mesmo break) entra
  // como um spot separado e indivisível, em segundos.
  const opecSpotsSegundos = useMemo(() => {
    if (!form?.data || !form?.programaSigla) return [];
    const diaKey = WEEKDAY_KEYS_BY_INDEX[new Date(form.data + "T00:00:00").getDay()];
    const spots = [];
    (breaksItems || []).forEach((b) => {
      if (b.programa !== form.programaSigla) return;
      if (!(b.diasSemana || []).includes(diaKey)) return;
      if (b.inicio && b.inicio > form.data) return;
      if (!b.naoVence && b.vencimento && b.vencimento < form.data) return;
      const dur = parseDuracaoParaSegundos(b.duracao);
      if (dur <= 0) return;
      const qtd = Math.max(1, Number(b.quantidade) || 1);
      for (let i = 0; i < qtd; i++) spots.push(dur);
    });
    return spots;
  }, [breaksItems, form?.data, form?.programaSigla]);

  // Índices (na lista de itens) de cada passagem de bloco, na ordem em que aparecem.
  const passagemIndices = useMemo(
    () => (form?.itens || []).map((it, idx) => (it.tipo === "passagem" ? idx : null)).filter((x) => x !== null),
    [form?.itens]
  );

  // Distribui o tempo total de OPEC do dia entre as passagens de bloco existentes,
  // sem quebrar nenhum spot — mapeado por id do item -> segundos calculados.
  const passagemDuracoesAuto = useMemo(() => {
    const n = passagemIndices.length;
    if (n === 0 || opecSpotsSegundos.length === 0) return {};
    const bins = distribuirSpotsEmPassagens(opecSpotsSegundos, n);
    const map = {};
    passagemIndices.forEach((idx, i) => {
      const item = form.itens[idx];
      if (item) map[item.id] = bins[i];
    });
    return map;
  }, [passagemIndices, opecSpotsSegundos, form?.itens]);

  // Texto de duração exibido numa passagem: usa o valor calculado automaticamente
  // quando existe configuração de OPEC pro dia; senão cai pro campo manual.
  const passagemDuracaoTexto = (item) => {
    const auto = passagemDuracoesAuto[item.id];
    if (auto !== undefined && auto > 0) return formatSegundosParaDuracao(auto);
    return item.duracao || "";
  };

  // Tempo total do espelho: soma das durações de todos os itens de conteúdo
  // (matérias, entrevistados, itens manuais) + soma do tempo de break (calculado
  // automaticamente quando há OPEC configurado, ou digitado manualmente na passagem).
  const temposTotais = useMemo(() => {
    const itens = form?.itens || [];
    let conteudoSeg = 0;
    let breakSeg = 0;
    itens.forEach((item) => {
      if (item.tipo === "passagem") {
        const auto = passagemDuracoesAuto[item.id];
        breakSeg += auto !== undefined && auto > 0 ? auto : parseDuracaoParaSegundos(item.duracao);
      } else {
        conteudoSeg += parseDuracaoParaSegundos(duracaoAtualItem(item));
      }
    });
    return { conteudoSeg, breakSeg, totalSeg: conteudoSeg + breakSeg };
  }, [form?.itens, passagemDuracoesAuto, videosItems]);

  // O teleprompter usado na bancada trava se o texto tiver uma "/" — então o
  // gerador do .txt nunca deixa essa barra passar (troca por "-"), inclusive
  // na linha de data, que por isso é DD-MM em vez de DD/MM.
  const sanitizarTeleprompter = (str) => String(str || "").replace(/\//g, "-");

  const gerarTextoTeleprompter = () => {
    const linhas = [];
    const cabecalhoPrograma = (form.titulo || form.programaNome || "").trim();
    if (cabecalhoPrograma) {
      linhas.push(sanitizarTeleprompter(caixaAlta(cabecalhoPrograma)));
      linhas.push("====");
    }
    if (form.data) {
      const [, mm, dd] = form.data.split("-");
      linhas.push(sanitizarTeleprompter(`DATA:${dd}-${mm} ${diaSemanaExtenso(form.data)}`));
    } else {
      linhas.push("DATA:");
    }
    linhas.push("====");
    (form.itens || []).forEach((item) => {
      if (item.tipo === "passagem") {
        const durTxt = passagemDuracaoTexto(item);
        const durFmt = durTxt ? formatDuracaoAspas(durTxt) : "";
        linhas.push(sanitizarTeleprompter(`${durFmt ? durFmt + " " : ""}PASSAGEM DE BLOCO`));
      } else {
        const durAtual = duracaoAtualItem(item);
        const durFmt = durAtual ? formatDuracaoAspas(durAtual) : "";
        linhas.push(sanitizarTeleprompter(`${durFmt ? durFmt + " " : ""}${caixaAlta(item.retranca)}`));
        const texto = (item.texto || "").trim();
        if (texto) {
          linhas.push("--");
          texto.split("\n").forEach((l) => linhas.push(sanitizarTeleprompter(caixaAlta(l))));
        }
      }
      linhas.push("====");
    });
    return linhas.join("\n");
  };

  const baixarTeleprompterTxt = () => {
    const texto = gerarTextoTeleprompter();
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const nomeBase = (form.titulo || form.programaNome || "espelho").trim().replace(/[^\p{L}\p{N}]+/gu, "_");
    const dataSufixo = form.data ? form.data.replace(/-/g, "") : "";
    a.download = `${nomeBase}${dataSufixo ? `_${dataSufixo}` : ""}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const adicionarMateria = (materia) => {
    const item = { id: uid(), tipo: "materia", retranca: materia.titulo, duracao: materia.duracao || "", texto: materia.cabeca || "", materiaId: materia.id };
    setForm((f) => ({ ...f, itens: [...(f.itens || []), item] }));
  };

  // Sem troca em andamento: coloca no fim do roteiro. Em troca: o primeiro
  // escolhido toma o lugar do item trocado (mesma posição) e, se mais de um
  // foi escolhido, os demais entram logo depois dele.
  const aplicarNovosItens = (novosItens) => {
    const alvo = trocandoId;
    setTrocandoId(null);
    setForm((f) => {
      const itens = f.itens || [];
      const pos = alvo ? itens.findIndex((i) => i.id === alvo) : -1;
      if (pos < 0) return { ...f, itens: [...itens, ...novosItens] };
      return { ...f, itens: [...itens.slice(0, pos), ...novosItens, ...itens.slice(pos + 1)] };
    });
  };

  const iniciarTroca = (itemId, tipoNovo) => {
    setMenuTrocaId(null);
    setTrocandoId(itemId);
    if (tipoNovo === "materia") setMateriasModalOpen(true);
    else if (tipoNovo === "entrevistado") setEntrevistadosModalOpen(true);
    else setItemManualModalOpen(true);
  };
  const fecharModalEscolha = (setter) => () => { setter(false); setTrocandoId(null); };

  const adicionarMultiplasMaterias = (materiasEscolhidas) => {
    const novosItens = materiasEscolhidas.map((materia) => ({
      id: uid(), tipo: "materia", retranca: materia.titulo, duracao: materia.duracao || "", texto: materia.cabeca || "", materiaId: materia.id,
    }));
    aplicarNovosItens(novosItens);
  };

  const adicionarMultiplosEntrevistados = (entrevistadosEscolhidos) => {
    const novosItens = entrevistadosEscolhidos.map((ent) => ({
      id: uid(),
      tipo: "entrevistado",
      retranca: `ENTR ${ent.nomeCompleto}`,
      duracao: ent.duracao || "",
      texto: ent.cabeca || ent.linhaFina || "",
      entrevistadoId: ent.id,
    }));
    aplicarNovosItens(novosItens);
  };

  const adicionarPassagem = () => {
    const item = { id: uid(), tipo: "passagem", duracao: "" };
    setForm((f) => ({ ...f, itens: [...(f.itens || []), item] }));
  };

  const adicionarItensManuais = (itensEscolhidos) => {
    const novosItens = itensEscolhidos.map((it) => ({
      id: uid(), tipo: "custom", retranca: it.retranca, duracao: it.duracao || "", texto: it.texto,
    }));
    aplicarNovosItens(novosItens);
  };

  const moverItem = (index, direcao) => {
    setForm((f) => {
      const itens = [...f.itens];
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= itens.length) return f;
      [itens[index], itens[alvo]] = [itens[alvo], itens[index]];
      return { ...f, itens };
    });
  };

  // Reordenar arrastando com o mouse (a alça ⣿ em cada item) — além das
  // setas, que continuam funcionando (melhor pra celular/touch).
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const moverItemPara = (de, para) => {
    setForm((f) => {
      const itens = [...f.itens];
      if (de === para || de < 0 || para < 0 || de >= itens.length || para >= itens.length) return f;
      const [item] = itens.splice(de, 1);
      itens.splice(para, 0, item);
      return { ...f, itens };
    });
  };
  const dragHandlers = (idx) => canEdit ? {
    onDragOver: (e) => { e.preventDefault(); if (overIndex !== idx) setOverIndex(idx); },
    onDragLeave: () => setOverIndex((o) => (o === idx ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      if (dragIndex !== null) moverItemPara(dragIndex, idx);
      setDragIndex(null);
      setOverIndex(null);
    },
  } : {};

  const removerItem = (id) => setForm((f) => ({ ...f, itens: f.itens.filter((i) => i.id !== id) }));
  const editarItem = (id, campo, valor) => setForm((f) => ({ ...f, itens: f.itens.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)) }));

  // O espelho controla as datas de veiculação lá em Matérias e Entrevistados,
  // automaticamente, só quando uma PESSOA salva o espelho:
  //  - colocou uma matéria/entrevistado no roteiro → marca "este dia + este programa";
  //  - tirou do roteiro (ou trocou por outro) → desmarca esse dia + programa;
  //  - mudou a data ou o programa do espelho → move a marca dos que continuam nele.
  // Nunca mexe em veiculação por conta do tempo: a validade do espelho (ele
  // some sozinho depois de N dias) é feita só no servidor, apaga o espelho e
  // não passa por aqui, então as datas de veiculação já registradas ficam
  // como estão. Também não desmarca se outro espelho do mesmo dia e programa
  // ainda usa o item.
  //
  // Cada ajuste faz um PUT em Matérias/Entrevistados — sem permissão de EDITAR
  // lá o servidor recusa (403); a falha nunca desfaz o salvamento do espelho
  // (já foi salvo) e volta como lista pra aparecer pra quem salvou.
  const sincronizarVeiculacoes = async (itens, original) => {
    if (!form.data || !form.programaSigla) return [];
    const falhas = [];
    const novo = { data: form.data, local: form.programaSigla };
    const antigo = original?.data && (original.programaSigla || original.programaNome) ? { data: original.data, local: original.programaSigla || original.programaNome } : null;
    const igual = (a, b) => !!a && !!b && a.data === b.data && a.local === b.local;
    const grupos = [
      { tipo: "materia", campo: "materiaId", lista: videosItems, atualizar: onUpdateVideo, nome: (r) => r.titulo || "Matéria sem título" },
      { tipo: "entrevistado", campo: "entrevistadoId", lista: entrevistadosItems, atualizar: onUpdateEntrevistado, nome: (r) => r.nomeCompleto || "Entrevistado sem nome" },
    ];
    for (const g of grupos) {
      if (!g.atualizar) continue;
      const idsDe = (lista) => new Set((lista || []).filter((i) => i.tipo === g.tipo && i[g.campo]).map((i) => i[g.campo]));
      const novos = idsDe(itens);
      const antigos = idsDe(original?.itens);
      const emOutroEspelho = (id) => !!antigo && (items || []).some((e) =>
        e.id !== editingId && e.data === antigo.data && (e.programaSigla || e.programaNome) === antigo.local &&
        (e.itens || []).some((i) => i.tipo === g.tipo && i[g.campo] === id));
      await Promise.all([...new Set([...novos, ...antigos])].map(async (id) => {
        const atual = (g.lista || []).find((r) => r.id === id);
        if (!atual) return;
        const antes = atual.datasVeiculacao || [];
        let datas = antes;
        if (antigos.has(id) && antigo && !(novos.has(id) && igual(antigo, novo)) && !emOutroEspelho(id)) {
          datas = datas.filter((dv) => !igual(dv, antigo));
        }
        if (novos.has(id) && !datas.some((dv) => igual(dv, novo))) datas = [...datas, novo];
        if (datas.length === antes.length && datas.every((d, i) => d === antes[i])) return;
        try {
          await g.atualizar({ ...atual, datasVeiculacao: datas });
        } catch (e) {
          falhas.push({ tipo: g.tipo, titulo: g.nome(atual), semPermissao: e.status === 403 });
        }
      }));
    }
    return falhas;
  };

  const salvar = async () => {
    // Em vez de um texto de aviso, destaca com borda vermelha só os campos
    // que faltam preencher (Programa, Data, Título) — mais fácil de ver de
    // cara qual campo corrigir do que ler uma frase.
    const faltando = new Set();
    if (!form.programaId) faltando.add("programa");
    if (!form.data) faltando.add("data");
    if (!form.titulo?.trim()) faltando.add("titulo");
    if (faltando.size > 0) {
      setCamposFaltando(faltando);
      return;
    }
    setCamposFaltando(new Set());
    setErro("");
    setSalvando(true);
    try {
      if (editingId) {
        await onUpdate({ ...form, id: editingId });
      } else {
        const criadoPor = primeirosDoisNomes(currentUser?.nomeCompleto) || currentUser?.username || "";
        await onCreate({ ...form, criadoPor });
      }
      const falhas = await sincronizarVeiculacoes(form.itens, editingId ? formOriginal : null);
      if (falhas.length > 0) {
        // Fica na tela em vez de voltar pra lista sozinho — o espelho já
        // foi salvo, mas a pessoa precisa VER que algumas matérias
        // ficaram sem a veiculação marcada, não descobrir isso só quando
        // outra pessoa notar depois.
        setAvisoVeiculacao(falhas);
      } else {
        voltarLista();
      }
    } catch (e) {
      setErro(e.message || "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = () => {
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
    if (editingId === deleteTarget.id) voltarLista();
  };

  const stats = useMemo(() => ({
    total: items.length,
    expirandoLogo: items.filter((e) => { const d = diasParaExpirar(e, retencaoDias); return d !== null && d <= 1; }).length,
  }), [items]);

  if (modo === "lista") {
    return (
      <div>
        <div className="stat-grid">
          <StatCard label="Espelhos salvos" value={stats.total} icon={ScrollText} />
          <StatCard label="Novos ou alterados" value={new Set([...novos, ...atualizados]).size} tone="green" icon={Eye} />
          <StatCard label="Expirando em até 1 dia" value={stats.expirandoLogo} tone="amber" icon={AlertTriangle} />
        </div>

        <div className="toolbar">
          <p className="espelho-aviso">Cada espelho fica salvo por {retencaoDias} dias, contados a partir do dia em que foi criado, e depois some sozinho.</p>
          {(novos.size > 0 || atualizados.size > 0) && (
            <button className="btn-ghost" onClick={marcarTodosVistos}><Check size={15} /> Marcar todos como vistos</button>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={novoEspelho}><Plus size={16} /> Novo espelho</button>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Programa</th>
                <th>Título</th>
                <th>Criado por</th>
                <th>Expira em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="empty-row">Nenhum espelho salvo ainda.</td></tr>
              )}
              {items.slice().sort((a, b) => (b.data || "").localeCompare(a.data || "") || (a.programaSigla || a.programaNome || "").localeCompare(b.programaSigla || b.programaNome || "", "pt-BR")).map((esp) => {
                const dias = diasParaExpirar(esp, retencaoDias);
                const sigla = esp.programaSigla || esp.programaNome || "";
                const tituloAuto = esp.titulo === `ESPELHO DO PROGRAMA: ${(esp.programaNome || "").toUpperCase()}`;
                const dow = esp.data ? diaSemanaExtenso(esp.data) : "";
                return (
                  <tr key={esp.id} className={`espelho-linha${novos.has(esp.id) || atualizados.has(esp.id) ? " nao-visto" : ""}`} onClick={() => abrirEdicao(esp)}>
                    <td className="espelho-data-cell">
                      <span className="espelho-data-dia mono">{formatDateBR(esp.data)}</span>
                      <span className="espelho-data-sem">{dow.charAt(0) + dow.slice(1).toLowerCase()}</span>
                    </td>
                    <td className="espelho-prog-cell">
                      {sigla ? <span className={`badge badge-${tomDoPrograma(sigla)}`}>{sigla}</span> : "—"}
                      {esp.programaNome && esp.programaNome !== sigla && <span className="espelho-prog-nome">{esp.programaNome}</span>}
                      {esp.horarioPrograma && <span className="espelho-prog-nome">{esp.horarioPrograma}</span>}
                    </td>
                    <td className={`title-cell espelho-titulo-cell${tituloAuto ? " auto" : ""}`}>{novos.has(esp.id) && <span className="badge badge-green espelho-novo">Novo</span>}{!novos.has(esp.id) && atualizados.has(esp.id) && <span className="badge badge-amber espelho-novo" title={`${esp.alteradoPorNome || "Alguém"} ${esp.alteracao || "alterou o espelho"} — ${new Date(esp.alteradoEm).toLocaleString("pt-BR")}`}>Atualizado</span>}{esp.titulo}{atualizados.has(esp.id) && esp.alteracao && <small className="espelho-alteracao">{esp.alteradoPorNome || "Alguém"} {esp.alteracao}</small>}</td>
                    <td>{esp.criadoPor || "—"}</td>
                    <td>{dias === null ? "—" : dias <= 0 ? "Hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}</td>
                    <td className="actions-col">
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); abrirEdicao(esp); }} aria-label="Abrir"><Eye size={15} /></button>
                      {canEdit && (
                        <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); setDeleteTarget(esp); }} aria-label="Excluir"><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Excluir espelho"
          message={deleteTarget && (
            <>Tem certeza de que deseja apagar o espelho <strong>"{deleteTarget.titulo}"</strong> do dia <strong>{formatDateBR(deleteTarget.data)}</strong>? Essa ação não pode ser desfeita.</>
          )}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmarExclusao}
        />
      </div>
    );
  }

  // modo === "editor"
  return (
    <div className="espelho-editor-shell">
      <div className="toolbar espelho-no-print">
        <button className="btn-ghost" onClick={clicarVoltar}>Voltar</button>
        <div
          className="espelho-tempo-pill"
          role="status"
          aria-label="Tempo total do espelho"
          title={`Conteúdo: ${formatSegundosParaDuracao(temposTotais.conteudoSeg) || "0:00"} · Break (passagens): ${formatSegundosParaDuracao(temposTotais.breakSeg) || "0:00"}`}
        >
          <Clock3 size={15} />
          <span className="espelho-tempo-rotulo">Tempo total</span>
          <strong>{formatSegundosParaDuracao(temposTotais.totalSeg) || "0:00"}</strong>
        </div>
        <div className="espelho-editor-acoes" style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => window.print()}><FileDown size={16} /> Baixar PDF</button>
          <button className="btn-ghost" onClick={baixarTeleprompterTxt}><FileText size={16} /> Baixar TXT (teleprompter)</button>
          {canEdit && (
            <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar espelho"}</button>
          )}
        </div>
      </div>

      {erro && <p className="duplicate-warning espelho-no-print"><AlertTriangle size={15} /> {erro}</p>}

      <div className="espelho-no-print espelho-form-fixed">
      <div className="espelho-form-grid">
        <Field label="Programa">
          <Select
            className={camposFaltando.has("programa") ? "input-invalid" : ""}
            value={form.programaId}
            onChange={(e) => { selecionarPrograma(e.target.value); setCamposFaltando((s) => { const n = new Set(s); n.delete("programa"); return n; }); }}
            disabled={!canEdit}
          >
            <option value="">Selecione um programa...</option>
            {(programasItems || []).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.sigla ? ` (${p.sigla})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Data de veiculação">
          <DateInput
            className={camposFaltando.has("data") ? "input-invalid" : ""}
           
            value={form.data}
            onChange={(e) => { setForm({ ...form, data: e.target.value }); setCamposFaltando((s) => { const n = new Set(s); n.delete("data"); return n; }); }}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Título do espelho">
          <input
            spellCheck
            lang="pt-BR"
            className={camposFaltando.has("titulo") ? "input-invalid" : ""}
            value={form.titulo}
            onChange={(e) => { setForm({ ...form, titulo: e.target.value }); setCamposFaltando((s) => { const n = new Set(s); n.delete("titulo"); return n; }); }}
            placeholder="Ex: ESPELHO DO PROGRAMA: SUCESSO NO CAMPO"
            disabled={!canEdit}
          />
        </Field>
      </div>
      {avisoAlteracao && (
        <div className="espelho-aviso-alteracao" role="status">
          <AlertTriangle size={15} /> <span><strong>Espelho alterado:</strong> {avisoAlteracao}</span>
          <button type="button" className="icon-btn" onClick={() => setAvisoAlteracao("")} aria-label="Dispensar aviso">×</button>
        </div>
      )}
      {form.data && <p className="field-hint espelho-dia-semana">{diaSemanaExtenso(form.data)}{form.horarioPrograma ? ` · ${form.horarioPrograma}` : ""}</p>}

      {canEdit && (
        <div className="espelho-adders">
          <div className="espelho-adder-card">
            <h4>Adicionar matéria</h4>
            <p className="field-hint">Busca com filtro por status, ano e mês, e dá pra marcar várias de uma vez.</p>
            <button className="btn-ghost" onClick={() => setMateriasModalOpen(true)}><Search size={15} /> Escolher matérias</button>
            {form.programaId && form.data && materiasDisponiveis.length > 0 && (
              <>
                <p className="field-hint" style={{ marginTop: 2 }}>Atalho — com veiculação marcada pra esse dia nesse programa:</p>
                <div className="espelho-materia-list">
                  {materiasDisponiveis.map((m) => (
                    <button key={m.id} type="button" className="espelho-materia-pick" onClick={() => adicionarMateria(m)}>
                      <span className="espelho-materia-pick-titulo">{m.titulo}</span>
                      <span className="espelho-materia-pick-meta">{m.tipo}{m.duracao ? ` · ${m.duracao}` : ""}</span>
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="espelho-adder-card">
            <h4>Adicionar entrevistado</h4>
            <p className="field-hint">Busca com filtro por modalidade, ano e mês, e dá pra marcar vários de uma vez.</p>
            <button className="btn-ghost" onClick={() => setEntrevistadosModalOpen(true)}><Search size={15} /> Escolher entrevistados</button>
            {form.programaId && form.data && entrevistadosDisponiveis.length > 0 && (
              <>
                <p className="field-hint" style={{ marginTop: 2 }}>Atalho — com veiculação marcada pra esse dia nesse programa:</p>
                <div className="espelho-materia-list">
                  {entrevistadosDisponiveis.map((e) => (
                    <button key={e.id} type="button" className="espelho-materia-pick" onClick={() => adicionarMultiplosEntrevistados([e])}>
                      <span className="espelho-materia-pick-texto">
                        <span className="espelho-materia-pick-titulo">{e.nomeCompleto}</span>
                        <span className="espelho-materia-pick-meta">{[e.funcao, e.modalidade || "Presencial", e.horario, e.duracao].filter(Boolean).join(" · ")}</span>
                      </span>
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="espelho-adder-card">
            <h4>Passagem de bloco</h4>
            <p className="field-hint">Marca a transição pro próximo bloco (numeração é automática).</p>
            <button className="btn-ghost" onClick={adicionarPassagem}><Plus size={15} /> Adicionar passagem de bloco</button>
          </div>

          <div className="espelho-adder-card">
            <h4>Item manual</h4>
            <p className="field-hint">Escolha um modelo salvo (MERCHAN, TEMPO, COTAÇÕES...) ou crie um item novo, com a opção de marcar vários de uma vez.</p>
            <button className="btn-ghost" onClick={() => setItemManualModalOpen(true)}><Search size={15} /> Escolher / criar item</button>
          </div>
        </div>
      )}
      </div>

      <div className="espelho-editor-scroll espelho-no-print">
      <h3 className="espelho-itens-title">
        Roteiro ({(form.itens || []).length} {(form.itens || []).length === 1 ? "item" : "itens"})
        <span className="espelho-itens-tempos">
          Tempo total <strong>{formatSegundosParaDuracao(temposTotais.totalSeg) || "0:00"}</strong>
          {" · "}conteúdo {formatSegundosParaDuracao(temposTotais.conteudoSeg) || "0:00"}
          {" · "}break {formatSegundosParaDuracao(temposTotais.breakSeg) || "0:00"}
        </span>
      </h3>
      <div className="espelho-itens-list">
        {(form.itens || []).length === 0 && <p className="empty-row">Nenhum item adicionado ainda.</p>}
        {(form.itens || []).map((item, idx) => (
          item.tipo === "passagem" ? (
            <div
              key={item.id}
              className={`espelho-item espelho-item-passagem${dragIndex === idx ? " dragging" : ""}${overIndex === idx && dragIndex !== idx ? " drag-over" : ""}`}
              {...dragHandlers(idx)}
            >
              {canEdit && (
                <span
                  className="espelho-item-handle"
                  draggable
                  onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  aria-label="Arrastar pra reordenar"
                  title="Arrastar pra reordenar"
                >
                  <GripVertical size={14} />
                </span>
              )}
              <DurationInput
                className="espelho-passagem-duracao"
                value={passagemDuracaoTexto(item)}
                onChange={(v) => editarItem(item.id, "duracao", v)}
                placeholder="Duração"
                disabled={!canEdit || passagemDuracoesAuto[item.id] > 0}
                title={passagemDuracoesAuto[item.id] > 0 ? "Calculado automaticamente a partir do OPEC do dia" : ""}
              />
              {passagemDuracoesAuto[item.id] > 0 && <span className="espelho-passagem-auto-badge" title="Calculado automaticamente a partir do OPEC do dia">auto</span>}
              <span>PASSAGEM DE BLOCO – BLOCO {String(numeroBlocoNoIndice(form.itens, idx + 1)).padStart(2, "0")}</span>
              {canEdit && (
                <div className="espelho-item-actions">
                  <button className="icon-btn" onClick={() => moverItem(idx, -1)} disabled={idx === 0} aria-label="Mover pra cima"><ArrowUp size={14} /></button>
                  <button className="icon-btn" onClick={() => moverItem(idx, 1)} disabled={idx === form.itens.length - 1} aria-label="Mover pra baixo"><ArrowDown size={14} /></button>
                  <button className="icon-btn danger" onClick={() => removerItem(item.id)} aria-label="Excluir"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ) : (
            <div
              key={item.id}
              className={`espelho-item espelho-item-${item.tipo}${dragIndex === idx ? " dragging" : ""}${overIndex === idx && dragIndex !== idx ? " drag-over" : ""}`}
              {...dragHandlers(idx)}
            >
              <div className="espelho-item-head">
                {canEdit && (
                  <span
                    className="espelho-item-handle"
                    draggable
                    onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                    aria-label="Arrastar pra reordenar"
                    title="Arrastar pra reordenar"
                  >
                    <GripVertical size={14} />
                  </span>
                )}
                <input className="espelho-item-retranca" value={item.retranca} onChange={(e) => editarItem(item.id, "retranca", e.target.value)} disabled={!canEdit || item.tipo === "materia"} />
                <DurationInput
                  className="espelho-item-duracao"
                  value={duracaoAtualItem(item)}
                  onChange={(v) => editarItem(item.id, "duracao", v)}
                  placeholder="Duração"
                  disabled={!canEdit || item.tipo === "materia"}
                  title={item.tipo === "materia" ? "Vem da duração cadastrada na matéria — edite lá que atualiza aqui sozinho" : ""}
                />
                {canEdit && (
                  <div className="espelho-item-actions">
                    <button className="icon-btn" onClick={() => moverItem(idx, -1)} disabled={idx === 0} aria-label="Mover pra cima"><ArrowUp size={14} /></button>
                    <button className="icon-btn" onClick={() => moverItem(idx, 1)} disabled={idx === form.itens.length - 1} aria-label="Mover pra baixo"><ArrowDown size={14} /></button>
                    <div className="espelho-troca-wrap">
                      <button className="icon-btn" onClick={() => setMenuTrocaId(menuTrocaId === item.id ? null : item.id)} aria-label="Trocar por outro item" title="Trocar por outro item" aria-expanded={menuTrocaId === item.id}><Repeat2 size={14} /></button>
                      {menuTrocaId === item.id && (
                        <div className="espelho-troca-menu" role="menu">
                          <span className="espelho-troca-titulo">Trocar por…</span>
                          <button type="button" role="menuitem" onClick={() => iniciarTroca(item.id, "materia")}>Matéria</button>
                          <button type="button" role="menuitem" onClick={() => iniciarTroca(item.id, "entrevistado")}>Entrevistado</button>
                          <button type="button" role="menuitem" onClick={() => iniciarTroca(item.id, "custom")}>Item manual</button>
                        </div>
                      )}
                    </div>
                    <button className="icon-btn danger" onClick={() => removerItem(item.id)} aria-label="Excluir"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <AutoGrowTextarea className="espelho-item-texto" value={item.texto} onChange={(e) => editarItem(item.id, "texto", e.target.value)} minRows={2} disabled={!canEdit} />
            </div>
          )
        ))}
      </div>
      </div>

      <EspelhoMateriasModal
        open={materiasModalOpen}
        onClose={fecharModalEscolha(setMateriasModalOpen)}
        videosItems={videosItems}
        idsJaAdicionados={idsJaAdicionados}
        programaSigla={form.programaSigla}
        onConfirm={adicionarMultiplasMaterias}
      />

      <EspelhoEntrevistadosModal
        open={entrevistadosModalOpen}
        onClose={fecharModalEscolha(setEntrevistadosModalOpen)}
        entrevistadosItems={entrevistadosItems}
        idsJaAdicionados={idsJaAdicionadosEntrevistados}
        programaSigla={form.programaSigla}
        dataEspelho={form.data}
        onConfirm={adicionarMultiplosEntrevistados}
      />

      <EspelhoItemManualModal
        open={itemManualModalOpen}
        onClose={fecharModalEscolha(setItemManualModalOpen)}
        modelos={modelos}
        onConfirm={adicionarItensManuais}
        onSalvarModelo={salvarModelo}
        onRemoverModelo={removerModelo}
      />

      <ConfirmDialog
        open={confirmarSaida}
        title="Sair sem salvar?"
        message="Esse espelho tem alterações que ainda não foram salvas. Se sair agora, elas serão perdidas."
        confirmLabel="Sair sem salvar"
        onCancel={() => setConfirmarSaida(false)}
        onConfirm={() => { setConfirmarSaida(false); voltarLista(); }}
      />

      <ConfirmDialog
        open={!!avisoVeiculacao}
        title="Algumas veiculações não foram atualizadas"
        message={
          <>
            <p>O espelho foi salvo normalmente, mas estes itens não tiveram a veiculação atualizada automaticamente:</p>
            <ul className="aviso-veiculacao-lista">
              {(avisoVeiculacao || []).map((f, i) => <li key={i}>{f.titulo} <span style={{ opacity: 0.6 }}>({f.tipo === "entrevistado" ? "entrevistado" : "matéria"})</span></li>)}
            </ul>
            {(avisoVeiculacao || []).some((f) => f.semPermissao) && (
              <p>Isso costuma acontecer quando quem salvou o espelho não tem permissão de <strong>Editar</strong> em {(avisoVeiculacao || []).some((f) => f.semPermissao && f.tipo === "entrevistado") ? "Entrevistados" : ""}{(avisoVeiculacao || []).some((f) => f.semPermissao && f.tipo === "entrevistado") && (avisoVeiculacao || []).some((f) => f.semPermissao && f.tipo === "materia") ? " ou " : ""}{(avisoVeiculacao || []).some((f) => f.semPermissao && f.tipo === "materia") ? "Matérias" : ""} (só a permissão de Espelho não é suficiente) — peça a um administrador pra conferir em Usuários.</p>
            )}
          </>
        }
        confirmLabel="Entendi, voltar pra lista"
        onCancel={() => setAvisoVeiculacao(null)}
        onConfirm={() => { setAvisoVeiculacao(null); voltarLista(); }}
      />

      <div className="print-only espelho-print">
        <div className="report-print-brand">Sintonia</div>
        <table className="espelho-print-table">
          <colgroup>
            <col style={{ width: "140px" }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={2} className="espelho-print-title-cell">{caixaAlta(form.titulo)}</th>
            </tr>
            <tr>
              <th>DATA: {formatDateBR(form.data)}</th>
              <th>{diaSemanaExtenso(form.data)}{form.horarioPrograma ? ` — ${form.horarioPrograma}` : ""}: BLOCO 01</th>
            </tr>
          </thead>
          <tbody>
            {(form.itens || []).map((item, idx) => item.tipo === "passagem" ? (
              <tr key={item.id}>
                <td colSpan={2} className="espelho-print-passagem-label">
                  {passagemDuracaoTexto(item) ? `${passagemDuracaoTexto(item)} — ` : ""}PASSAGEM DE BLOCO – BLOCO {String(numeroBlocoNoIndice(form.itens, idx + 1)).padStart(2, "0")}
                </td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td className="espelho-print-retranca">{duracaoAtualItem(item) ? `${duracaoAtualItem(item)} ` : ""}{caixaAlta(item.retranca)}</td>
                <td className="espelho-print-texto">{caixaAlta(item.texto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="espelho-print-total-cell">
                TEMPO TOTAL: {formatSegundosParaDuracao(temposTotais.totalSeg) || "0:00"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

