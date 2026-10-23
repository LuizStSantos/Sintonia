import { useMemo, useState } from "react";
import { Trash2, Pencil, Eye, Contact, BookUser } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { ValidatedInput } from "../../components/common/ValidatedInput.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  nome: (i) => i.nomeCompleto,
  funcao: (i) => i.funcao,
  celular: (i) => (i.celular || "").replace(/\D/g, ""),
  email: (i) => i.email,
};

export function ContatosTab({ items, onCreate, onUpdate, onDelete, canEdit = true }) {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ nomeCompleto: "", funcao: "", celular: "", email: "", endereco: "", observacoes: "" });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm(item);
    setDrawerOpen(true);
  };
  const save = async () => {
    if (!form.nomeCompleto?.trim()) return;
    if (editing) {
      await onUpdate({ ...form, id: editing });
    } else {
      await onCreate({ ...form, id: uid() });
    }
    setDrawerOpen(false);
  };

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        const haystack = `${i.nomeCompleto || ""} ${i.funcao || ""} ${i.celular || ""} ${i.email || ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .sort((a, b) => (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "", "pt-BR"));
  }, [items, search]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, { key: "nome", dir: "asc" });

  const stats = useMemo(() => {
    const total = items.length;
    const funcoes = new Set(items.map((i) => (i.funcao || "").trim()).filter(Boolean));
    return { total, funcoes: funcoes.size };
  }, [items]);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total de contatos" value={stats.total} icon={BookUser} />
        <StatCard label="Funções cadastradas" value={stats.funcoes} tone="blue" icon={Contact} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por nome, função, celular ou email..."
        onNew={canEdit ? openNew : undefined} newLabel="Novo contato"
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="nome">Nome completo</SortTh>
              <SortTh sort={sort} k="funcao">Função</SortTh>
              <SortTh sort={sort} k="celular">Celular</SortTh>
              <SortTh sort={sort} k="email">Email</SortTh>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={5} text="Nenhum contato encontrado." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="title-cell">{i.nomeCompleto}</td>
                <td>{i.funcao || "—"}</td>
                <td>{i.celular || "—"}</td>
                <td>{i.email || "—"}</td>
                <td className="actions-col">
                  <button className="icon-btn" onClick={() => setViewTarget(i)} aria-label="Visualizar"><Eye size={15} /></button>
                  {canEdit && (
                    <>
                      <button className="icon-btn" onClick={() => openEdit(i)} aria-label="Editar"><Pencil size={15} /></button>
                      <button className="icon-btn danger" onClick={() => setDeleteTarget(i)} aria-label="Excluir"><Trash2 size={15} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} title={editing ? "Editar contato" : "Novo contato"} onClose={pedirFechar}>
        <Field label="Nome completo">
          <input value={form.nomeCompleto || ""} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} placeholder="Nome completo do contato" />
        </Field>
        <Field label="Função">
          <input value={form.funcao || ""} onChange={(e) => setForm({ ...form, funcao: e.target.value })} placeholder="Ex: Agrônomo, Veterinário, Gerente de fazenda..." />
        </Field>
        <Field label="Celular">
          <ValidatedInput type="phone" value={form.celular || ""} onChange={(v) => setForm({ ...form, celular: v })} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="Email">
          <ValidatedInput type="email" value={form.email || ""} onChange={(v) => setForm({ ...form, email: v })} placeholder="contato@email.com" />
        </Field>
        <Field label="Endereço">
          <input value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" />
        </Field>
        <Field label="Observações">
          <textarea spellCheck lang="pt-BR"
            value={form.observacoes || ""}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            placeholder="Observações gerais..."
            rows={3}
          />
        </Field>
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar contato</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget?.nomeCompleto}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />

      <ViewDialog
        open={!!viewTarget}
        title={viewTarget?.nomeCompleto}
        onClose={() => setViewTarget(null)}
        fields={viewTarget ? [
          { label: "Função", value: viewTarget.funcao },
          { label: "Celular", value: viewTarget.celular },
          { label: "Email", value: viewTarget.email },
          { label: "Endereço", value: viewTarget.endereco },
          { label: "Observações", value: viewTarget.observacoes },
        ] : []}
      />
    </div>
  );
}

