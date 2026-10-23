import { useMemo, useState } from "react";
import { Trash2, Pencil, AlertTriangle, Eye, Building2 } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { clientDisplayName } from "../../lib/financeiro.js";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { FieldSection } from "../../components/common/FieldSection.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { ValidatedInput } from "../../components/common/ValidatedInput.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  nome: (i) => clientDisplayName(i),
  cnpj: (i) => (i.cnpj || "").replace(/\D/g, ""),
  telefone: (i) => (i.telefone || "").replace(/\D/g, ""),
  email: (i) => i.email,
};

// Nome do componente/arquivo acompanha o rótulo do menu ("Clientes / Fornecedores") e a
// coleção no banco/permissões ("clientesFornecedores") — não confundir com a coleção
// "contasPagar" (aba "Contas a pagar", em
// `features/financeiro/ContasAPagarTab.jsx`), que já se chamou "clientes"
// no passado e foi migrada justamente pra não se confundir com esta aqui.
export function ClientesFornecedoresTab({ items, onCreate, onUpdate, onDelete, canEdit = true }) {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({
      razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "", inscricaoMunicipal: "",
      endereco: "", telefone: "", email: "", observacoes: "",
    });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm(item);
    setDrawerOpen(true);
  };

  // Verifica se já existe outro cliente cadastrado com a mesma razão
  // social, nome fantasia ou CNPJ (ignorando maiúsculas/pontuação) — evita
  // cadastro duplicado. Ao editar, ignora o próprio registro sendo editado.
  const duplicate = useMemo(() => {
    const nomeRazao = (form.razaoSocial || "").trim().toLowerCase();
    const nomeFantasia = (form.nomeFantasia || "").trim().toLowerCase();
    const cnpjDigits = (form.cnpj || "").replace(/\D/g, "");
    if (!nomeRazao && !nomeFantasia && !cnpjDigits) return null;
    const found = items.find((i) => {
      if (editing && i.id === editing) return false;
      const iRazao = (i.razaoSocial || "").trim().toLowerCase();
      const iFantasia = (i.nomeFantasia || "").trim().toLowerCase();
      const iCnpjDigits = (i.cnpj || "").replace(/\D/g, "");
      const matchRazao = nomeRazao && iRazao && iRazao === nomeRazao;
      const matchFantasia = nomeFantasia && iFantasia && iFantasia === nomeFantasia;
      const matchCnpj = cnpjDigits && iCnpjDigits && iCnpjDigits === cnpjDigits;
      return matchRazao || matchFantasia || matchCnpj;
    });
    if (!found) return null;
    const motivos = [];
    const fRazao = (found.razaoSocial || "").trim().toLowerCase();
    const fFantasia = (found.nomeFantasia || "").trim().toLowerCase();
    const fCnpjDigits = (found.cnpj || "").replace(/\D/g, "");
    if (nomeRazao && fRazao === nomeRazao) motivos.push("razão social");
    if (nomeFantasia && fFantasia === nomeFantasia) motivos.push("nome fantasia");
    if (cnpjDigits && fCnpjDigits === cnpjDigits) motivos.push("CNPJ");
    return { item: found, motivos };
  }, [items, form.razaoSocial, form.nomeFantasia, form.cnpj, editing]);

  const save = async () => {
    if (!form.razaoSocial?.trim() && !form.nomeFantasia?.trim()) return;
    if (duplicate) return;
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
        const haystack = `${clientDisplayName(i)} ${i.cnpj || ""} ${i.email || ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b), "pt-BR"));
  }, [items, search]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, { key: "nome", dir: "asc" });

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total de cadastros" value={items.length} icon={Building2} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por nome, CNPJ ou email..."
        onNew={canEdit ? openNew : undefined} newLabel="Novo cadastro"
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="nome">Nome</SortTh>
              <SortTh sort={sort} k="cnpj" className="mono-col">CNPJ</SortTh>
              <SortTh sort={sort} k="telefone">Telefone</SortTh>
              <SortTh sort={sort} k="email">Email</SortTh>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={5} text="Nenhum cliente ou fornecedor cadastrado." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="title-cell">{clientDisplayName(i)}</td>
                <td className="mono-col mono">{i.cnpj || "—"}</td>
                <td>{i.telefone || "—"}</td>
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

      <Drawer open={drawerOpen} title={editing ? "Editar cadastro" : "Novo cadastro"} onClose={pedirFechar}>
        <FieldSection title="Dados da empresa" />
        <Field label="Razão social">
          <input value={form.razaoSocial || ""} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} placeholder="Razão social completa" />
        </Field>
        <Field label="Nome fantasia">
          <input value={form.nomeFantasia || ""} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} placeholder="Nome fantasia" />
        </Field>
        <Field label="CNPJ">
          <ValidatedInput type="cnpj" className="mono" value={form.cnpj || ""} onChange={(v) => setForm({ ...form, cnpj: v })} placeholder="00.000.000/0000-00" />
        </Field>
        {duplicate && (
          <p className="duplicate-warning">
            <AlertTriangle size={15} />
            <span>
              Já existe um cliente cadastrado com o(a) mesmo(a) {duplicate.motivos.join(" e ")}: <strong>"{clientDisplayName(duplicate.item)}"</strong>.
              Não é possível salvar um cliente duplicado.
            </span>
          </p>
        )}
        <Field label="Inscrição estadual">
          <input value={form.inscricaoEstadual || ""} onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })} />
        </Field>
        <Field label="Inscrição municipal">
          <input value={form.inscricaoMunicipal || ""} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} />
        </Field>
        <Field label="Endereço">
          <input value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" />
        </Field>

        <FieldSection title="Contato" />
        <Field label="Telefone">
          <ValidatedInput type="phone" value={form.telefone || ""} onChange={(v) => setForm({ ...form, telefone: v })} placeholder="(00) 0000-0000" />
        </Field>
        <Field label="Email">
          <ValidatedInput type="email" value={form.email || ""} onChange={(v) => setForm({ ...form, email: v })} placeholder="contato@empresa.com" />
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
          <button className="btn-primary" onClick={save} disabled={!!duplicate}>Salvar cadastro</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget ? clientDisplayName(deleteTarget) : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />

      <ViewDialog
        open={!!viewTarget}
        title={viewTarget ? clientDisplayName(viewTarget) : ""}
        onClose={() => setViewTarget(null)}
        fields={viewTarget ? [
          { label: "Razão social", value: viewTarget.razaoSocial },
          { label: "Nome fantasia", value: viewTarget.nomeFantasia },
          { label: "CNPJ", value: viewTarget.cnpj },
          { label: "Inscrição estadual", value: viewTarget.inscricaoEstadual },
          { label: "Inscrição municipal", value: viewTarget.inscricaoMunicipal },
          { label: "Endereço", value: viewTarget.endereco },
          { label: "Telefone", value: viewTarget.telefone },
          { label: "Email", value: viewTarget.email },
          { label: "Observações", value: viewTarget.observacoes },
        ] : []}
      />
    </div>
  );
}

