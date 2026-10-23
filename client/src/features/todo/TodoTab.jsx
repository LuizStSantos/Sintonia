import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check, AlertTriangle, Clock3, Users, ListChecks } from "lucide-react";
import { formatDateBR } from "../../lib/dates.js";
import { PRIORIDADE_LABEL, PRIORIDADE_ORDEM, isPrazoAtrasado } from "../../lib/todoPriority.js";
import { atualizarPendentes } from "../../lib/todoPendentes.js";
import { onRealtimeMessage } from "../../lib/realtime.js";
import { apiListTodos, apiCreateTodo, apiUpdateTodo, apiDeleteTodo } from "../../api/todos.js";
import { apiListUsers, apiListAssignableUsers } from "../../api/users.js";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { ToggleField } from "../../components/common/ToggleField.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { PriorityPicker } from "../../components/common/PriorityPicker.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";

export function TodoTab({ currentUser }) {
  const isAdmin = currentUser.role === "admin";
  const podeAtribuir = isAdmin || !!currentUser.permissions?.atribuirTarefas;
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaPrioridade, setNovaPrioridade] = useState("normal");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [atribuirA, setAtribuirA] = useState("");
  const [usuariosParaAtribuir, setUsuariosParaAtribuir] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [mostrarConcluidas, setMostrarConcluidas] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editPrioridade, setEditPrioridade] = useState("normal");
  const [editPrazo, setEditPrazo] = useState("");
  const [editConcluida, setEditConcluida] = useState(false);
  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({
    aberto: !!editing,
    valores: { editTitulo, editDescricao, editPrioridade, editPrazo, editConcluida },
    fechar: () => setEditing(null),
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    apiListTodos()
      .then(setTodos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    if (isAdmin) {
      apiListUsers().then(setUsuariosParaAtribuir).catch(() => {});
    } else if (podeAtribuir) {
      apiListAssignableUsers().then(setUsuariosParaAtribuir).catch(() => {});
    }
    // Se chegar um aviso em tempo real de tarefa nova (via WebSocket) que
    // essa pessoa deveria ver, adiciona na lista sem precisar recarregar.
    const unsubscribe = onRealtimeMessage((msg) => {
      if (msg.type === "todo-created" && msg.payload) {
        setTodos((prev) => (prev.some((t) => t.id === msg.payload.id) ? prev : [msg.payload, ...prev]));
      }
      if (msg.type === "todo-completed" && msg.payload) {
        setTodos((prev) => prev.map((t) => (t.id === msg.payload.id ? { ...t, concluida: true } : t)));
      }
    });
    return unsubscribe;
  }, []);

  // Mantém o número no menu lateral igual ao da lista.
  useEffect(() => {
    if (!loading) atualizarPendentes(todos, currentUser.id);
  }, [todos, loading]);

  const adicionar = async () => {
    if (!novoTitulo.trim()) return;
    setError("");
    try {
      const payload = { texto: novoTitulo.trim(), descricao: novaDescricao.trim(), prioridade: novaPrioridade, prazo: novoPrazo };
      if (podeAtribuir && atribuirA) payload.assignToUserId = atribuirA;
      const created = await apiCreateTodo(payload);
      setTodos((prev) => [created, ...prev]);
      setNovoTitulo("");
      setNovaDescricao("");
      setNovoPrazo("");
      setNovaPrioridade("normal");
      setAtribuirA("");
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleConcluida = async (t) => {
    try {
      const updated = await apiUpdateTodo(t.id, { concluida: !t.concluida });
      setTodos((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch (e) {
      setError(e.message);
    }
  };

  const confirmarExclusao = async () => {
    try {
      await apiDeleteTodo(deleteTarget.id);
      setTodos((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
      setEditing(null);
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    }
  };

  const abrirDetalhes = (t) => {
    setEditing(t);
    setEditTitulo(t.texto);
    setEditDescricao(t.descricao || "");
    setEditPrioridade(t.prioridade || "normal");
    setEditPrazo(t.prazo || "");
    setEditConcluida(t.concluida);
  };

  const salvarEdicao = async () => {
    if (!editTitulo.trim()) return;
    setSalvandoEdicao(true);
    try {
      const updated = await apiUpdateTodo(editing.id, {
        texto: editTitulo.trim(),
        descricao: editDescricao.trim(),
        prioridade: editPrioridade,
        prazo: editPrazo,
        concluida: editConcluida,
      });
      setTodos((prev) => prev.map((x) => (x.id === editing.id ? updated : x)));
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const usuarios = useMemo(() => [...new Set(todos.map((t) => t.userName))].sort(), [todos]);

  // Pendentes primeiro (mais prioritárias no topo), concluídas por último
  const filtradas = useMemo(() => {
    return todos
      .filter((t) => {
        const matchUsuario = !filtroUsuario || t.userName === filtroUsuario;
        const matchConcluida = mostrarConcluidas || !t.concluida;
        return matchUsuario && matchConcluida;
      })
      .slice()
      .sort((a, b) => {
        if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
        const pa = PRIORIDADE_ORDEM[a.prioridade] ?? 1;
        const pb = PRIORIDADE_ORDEM[b.prioridade] ?? 1;
        if (pa !== pb) return pa - pb;
        if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
        if (a.prazo) return -1;
        if (b.prazo) return 1;
        return 0;
      });
  }, [todos, filtroUsuario, mostrarConcluidas]);

  const stats = useMemo(() => {
    const minhas = todos.filter((t) => t.userId === currentUser.id);
    return {
      pendentes: minhas.filter((t) => !t.concluida).length,
      concluidas: minhas.filter((t) => t.concluida).length,
      totalSistema: todos.length,
    };
  }, [todos, currentUser.id]);

  if (loading) return <p>Carregando tarefas...</p>;

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Minhas pendentes" value={stats.pendentes} icon={ListChecks} />
        <StatCard label="Minhas concluídas" value={stats.concluidas} tone="green" icon={Check} />
        {isAdmin && <StatCard label="Total no sistema (todos os usuários)" value={stats.totalSistema} tone="blue" icon={Users} />}
      </div>

      <div className="todo-composer">
        <input
          spellCheck
          lang="pt-BR"
          className="todo-composer-titulo"
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="O que precisa ser feito?"
        />
        <textarea spellCheck lang="pt-BR"
          className="todo-composer-descricao"
          value={novaDescricao}
          onChange={(e) => setNovaDescricao(e.target.value)}
          placeholder="Detalhes (opcional) — o que exatamente fazer, contexto, links..."
          rows={2}
        />
        {podeAtribuir && (
          <Select className="todo-composer-atribuir" value={atribuirA} onChange={(e) => setAtribuirA(e.target.value)} title="Atribuir a">
            <option value="">Para mim</option>
            {usuariosParaAtribuir.filter((u) => u.id !== currentUser.id).map((u) => (
              <option key={u.id} value={u.id}>Atribuir a {u.displayName || u.username}</option>
            ))}
          </Select>
        )}
        <div className="todo-composer-row">
          <PriorityPicker value={novaPrioridade} onChange={setNovaPrioridade} />
          <Field label="Prazo (opcional)">
            <DateInput value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
          </Field>
          <button className="btn-primary todo-composer-submit" onClick={adicionar}><Plus size={16} /> Adicionar tarefa</button>
        </div>
      </div>
      {atribuirA && (
        <p className="picker-confirm" style={{ marginTop: -8, marginBottom: 14 }}>
          <Check size={13} /> Essa tarefa vai aparecer pra <strong>{(() => { const u = usuariosParaAtribuir.find((u) => u.id === atribuirA); return u?.displayName || u?.username; })()}</strong>, não pra você.
        </p>
      )}

      {error && <p className="duplicate-warning"><AlertTriangle size={15} /> {error}</p>}

      <div className="toolbar todo-toolbar">
        {(isAdmin || podeAtribuir) && (
          <Select className="select-filter" value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
            <option value="">Todos os usuários</option>
            {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        )}
        <label className="checkbox-field checkbox-inline">
          <input type="checkbox" className="app-checkbox" checked={mostrarConcluidas} onChange={(e) => setMostrarConcluidas(e.target.checked)} />
          <span>Mostrar concluídas</span>
        </label>
      </div>

      <div className="todo-list">
        {filtradas.length === 0 && <p className="empty-row">Nenhuma tarefa por aqui.</p>}
        {filtradas.map((t) => (
          <div key={t.id} className={`todo-item todo-priority-${t.prioridade || "normal"}${t.concluida ? " todo-done" : ""}`}>
            <input className="app-checkbox todo-check" type="checkbox" checked={t.concluida} onChange={() => toggleConcluida(t)} aria-label="Marcar como concluída" />
            <div className="todo-item-body" onClick={() => abrirDetalhes(t)}>
              <span className="todo-item-texto">{t.texto}</span>
              {t.descricao && <p className="todo-item-descricao">{t.descricao}</p>}
              <div className="todo-item-meta">
                {(isAdmin || podeAtribuir) && t.userId !== currentUser.id && <span className="todo-item-user">{t.userName}</span>}
                {t.atribuidaPor && <span className="todo-item-atribuida">atribuída por {t.atribuidaPor}</span>}
                <span className={`todo-priority-tag todo-priority-tag-${t.prioridade || "normal"}`}>{PRIORIDADE_LABEL[t.prioridade] || "Normal"}</span>
                {t.prazo && (
                  <span className={`todo-item-prazo${isPrazoAtrasado(t) ? " todo-overdue" : ""}`}>
                    <Clock3 size={11} /> {formatDateBR(t.prazo)}
                  </span>
                )}
              </div>
            </div>
            <button className="icon-btn danger todo-delete" onClick={() => setDeleteTarget(t)} aria-label="Excluir"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget?.texto}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmarExclusao}
      />

      <Drawer open={!!editing} title="Detalhes da tarefa" onClose={pedirFechar}>
        <Field label="Título">
          <input spellCheck lang="pt-BR" value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} placeholder="O que precisa ser feito?" />
        </Field>
        <Field label="Descrição">
          <textarea spellCheck lang="pt-BR"
            value={editDescricao}
            onChange={(e) => setEditDescricao(e.target.value)}
            placeholder="Detalhes (opcional) — o que exatamente fazer, contexto, links..."
            rows={4}
          />
        </Field>
        <Field label="Prioridade">
          <PriorityPicker value={editPrioridade} onChange={setEditPrioridade} />
        </Field>
        <Field label="Prazo (opcional)">
          <DateInput value={editPrazo} onChange={(e) => setEditPrazo(e.target.value)} />
        </Field>
        <div style={{ marginBottom: 4 }}>
          <ToggleField
            checked={editConcluida}
            onChange={(e) => setEditConcluida(e.target.checked)}
            title="Concluída"
          />
        </div>
        {editing && editing.userId !== currentUser.id && (isAdmin || podeAtribuir) && (
          <p className="field-hint">Essa tarefa é de {editing.userName}.</p>
        )}
        <div className="drawer-actions">
          <button className="btn-primary danger-btn" onClick={() => setDeleteTarget(editing)}><Trash2 size={15} /> Excluir</button>
          <button className="btn-primary" onClick={salvarEdicao} disabled={salvandoEdicao}>{salvandoEdicao ? "Salvando..." : "Salvar alterações"}</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}
    </div>
  );
}

