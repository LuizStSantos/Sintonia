import { useMemo, useState } from "react";
import { RelatorioBotao } from "../relatorios/RelatorioBotao.jsx";
import { Banknote, Trash2, Pencil, Check, AlertTriangle, Clock3, Eye, CalendarX } from "lucide-react";
import { uid, formatBRL } from "../../lib/validators.js";
import { formatDateBR, todayISO, isOverdue, MONTHS } from "../../lib/dates.js";
import { clientDisplayName, generateInstallments, generateContratoMinimo, buildCancelableSeries, cancelSeries } from "../../lib/financeiro.js";
import { CLIENTE_STATUS, STATUS_EM_ABERTO } from "../../lib/constants.js";
import { Badge } from "../../components/common/Badge.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { MoneyInput } from "../../components/common/MaskedInputs.jsx";
import { FieldSection } from "../../components/common/FieldSection.jsx";
import { ToggleField } from "../../components/common/ToggleField.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { InfoDialog } from "../../components/common/InfoDialog.jsx";
import { ValidatedInput } from "../../components/common/ValidatedInput.jsx";
import { AgenciaPicker, resolveAgenciaNome } from "../../components/pickers/AgenciaPicker.jsx";
import { ClientePicker } from "../../components/pickers/ClientePicker.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { useSortable, comparaVencimento } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";
import { CancelPickerDialog } from "../../components/common/CancelPickerDialog.jsx";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  empresa: (i) => clientDisplayName(i),
  cnpj: (i) => (i.cnpj || "").replace(/\D/g, ""),
  telefone: (i) => (i.telefone || "").replace(/\D/g, ""),
  parcela: (i) => Number(String(i.parcela || "1/1").split("/")[0]),
  valor: (i) => Number(i.valor) || 0,
  vencimento: { get: (i) => i.vencimento, cmp: comparaVencimento },
  status: (i) => i.status,
};

// Nome do componente/arquivo acompanha o rótulo do menu ("Contas a
// receber") e a coleção no banco/permissões ("contasReceber"). Antes se
// chamava "Recebíveis" (arquivo RecebiveisTab.jsx) — "recebível" é
// sinônimo de "conta a receber", mas o nome foi alinhado ao padrão das
// outras abas.
export function ContasAReceberTab({ items, onCreate, onUpdate, onDelete, canEdit = true, onNavigateToClientes, clientesItems, clientesCadastroItems }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [cancelPickerOpen, setCancelPickerOpen] = useState(false);
  const [agencyNotice, setAgencyNotice] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({
      razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "", inscricaoMunicipal: "",
      endereco: "", telefone: "", email: "", descricaoProduto: "", temAgencia: false, agenciaClienteId: null,
      valor: "", parcelas: 1, usaParcelamento: false, usaContratoMinimo: false, mesesContrato: 1,
      vencimento: todayISO(), status: "Pendente",
    });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm(item);
    setDrawerOpen(true);
  };
  const save = async () => {
    if (!form.razaoSocial?.trim() && !form.nomeFantasia?.trim()) return;
    if (editing) {
      await onUpdate({ ...form, valor: Number(form.valor) || 0, id: editing });
    } else {
      const lancamentos = form.usaContratoMinimo ? generateContratoMinimo(form) : generateInstallments(form);
      for (const inst of lancamentos) {
        await onCreate({ ...inst, id: uid() });
      }
    }
    setDrawerOpen(false);
    if (form.status === "Pago" && form.temAgencia) {
      setAgencyNotice({ nomeAgencia: resolveAgenciaNome(form, clientesItems) });
    }
  };

  // Cancelar parcelas que faltam (parcelamento/contrato em andamento) — lógica em lib/financeiro.js
  const cancelableSeries = useMemo(() => buildCancelableSeries(items), [items]);
  const confirmCancelSeries = async (key, incluirVencidas) => {
    await cancelSeries(items, cancelableSeries, key, incluirVencidas, { onDelete, onUpdate });
    setCancelPickerOpen(false);
  };

  const yearOptions = useMemo(() => {
    const years = new Set(items.map((i) => (i.vencimento || "").slice(0, 4)).filter(Boolean));
    years.add(todayISO().slice(0, 4));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        const haystack = `${clientDisplayName(i)} ${i.cnpj || ""} ${i.descricaoProduto || i.campanha || ""}`.toLowerCase();
        const matchSearch = haystack.includes(search.toLowerCase());
        const matchStatus = !statusFilter || (statusFilter === STATUS_EM_ABERTO ? (i.status === "Atrasado" || i.status === "Pendente") : i.status === statusFilter);
        const matchYear = !yearFilter || (i.vencimento || "").slice(0, 4) === yearFilter;
        const matchMonth = !monthFilter || (i.vencimento || "").slice(5, 7) === monthFilter;
        return matchSearch && matchStatus && matchYear && matchMonth;
      })
      .sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b), "pt-BR"));
  }, [items, search, statusFilter, yearFilter, monthFilter]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, { key: "vencimento", dir: "asc" });

  const periodoLabel = useMemo(() => {
    if (!yearFilter && !monthFilter) return "Todos";
    const mesCurto = monthFilter ? MONTHS.find((m) => m.value === monthFilter)?.label.slice(0, 3) : "";
    if (yearFilter && monthFilter) return `${mesCurto}/${yearFilter}`;
    if (monthFilter) return mesCurto;
    return yearFilter;
  }, [yearFilter, monthFilter]);

  const periodItems = useMemo(() => {
    return items.filter((i) => {
      const matchYear = !yearFilter || (i.vencimento || "").slice(0, 4) === yearFilter;
      const matchMonth = !monthFilter || (i.vencimento || "").slice(5, 7) === monthFilter;
      return matchYear && matchMonth;
    });
  }, [items, yearFilter, monthFilter]);

  const totals = useMemo(() => {
    let total = 0, pendente = 0, atrasado = 0, pago = 0;
    periodItems.forEach((i) => {
      const v = Number(i.valor) || 0;
      total += v;
      if (i.status === "Pendente") pendente += v;
      if (i.status === "Atrasado") atrasado += v;
      if (i.status === "Pago") pago += v;
    });
    return { total, pendente, atrasado, pago };
  }, [periodItems]);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label={`Total a receber (${periodoLabel})`} value={formatBRL(totals.total)} icon={Banknote} />
        <StatCard label={`Pendente (${periodoLabel})`} value={formatBRL(totals.pendente)} tone="amber" icon={Clock3} />
        <StatCard label={`Em atraso (${periodoLabel})`} value={formatBRL(totals.atrasado)} tone="red" icon={AlertTriangle} />
        <StatCard label={`Recebido (${periodoLabel})`} value={formatBRL(totals.pago)} tone="green" icon={Check} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por empresa, CNPJ ou produto..."
        statusOptions={Object.keys(CLIENTE_STATUS)}
        statusExtras={[{ value: STATUS_EM_ABERTO, label: "Atrasado + Pendente" }]}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        extraFilter={
          <>
            <Select className="select-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">Todos os anos</option>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select className="select-filter" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">Todos os meses</option>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </>
        }
        onNew={canEdit ? openNew : undefined} newLabel="Novo lançamento"
        extraActions={
          <>
            {canEdit && (
              <button className="btn-primary btn-amarelo" onClick={() => setCancelPickerOpen(true)}>
                <CalendarX size={15} /> Cancelar contas
              </button>
            )}
            <RelatorioBotao tipo="receber" items={items} />
          </>
        }
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="empresa">Empresa</SortTh>
              <SortTh sort={sort} k="cnpj">CNPJ</SortTh>
              <SortTh sort={sort} k="telefone">Telefone</SortTh>
              <SortTh sort={sort} k="parcela" className="mono-col">Parcela</SortTh>
              <SortTh sort={sort} k="valor" className="mono-col">Valor</SortTh>
              <SortTh sort={sort} k="vencimento">Vencimento</SortTh>
              <SortTh sort={sort} k="status">Status</SortTh>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={8} text="Nenhum lançamento encontrado." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="title-cell">{clientDisplayName(i)}</td>
                <td className="mono-col mono">{i.cnpj || "—"}</td>
                <td>{i.telefone || "—"}</td>
                <td className="mono-col mono">{i.parcela || "1/1"}</td>
                <td className="mono-col mono">{formatBRL(i.valor)}</td>
                <td className={isOverdue(i.vencimento) && i.status !== "Pago" ? "overdue" : ""}>
                  {formatDateBR(i.vencimento)}
                </td>
                <td><Badge label={i.status} tone={CLIENTE_STATUS[i.status] || "gray"} /></td>
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

      <Drawer open={drawerOpen} title={editing ? "Editar lançamento" : "Novo lançamento"} onClose={pedirFechar}>
        {!editing && (
          <Field label="Buscar cliente cadastrado (opcional)">
            <ClientePicker
              clientesCadastro={clientesCadastroItems}
              onSelect={(c) => setForm({
                ...form,
                razaoSocial: c.razaoSocial || "",
                nomeFantasia: c.nomeFantasia || "",
                cnpj: c.cnpj || "",
                inscricaoEstadual: c.inscricaoEstadual || "",
                inscricaoMunicipal: c.inscricaoMunicipal || "",
                endereco: c.endereco || "",
                telefone: c.telefone || "",
                email: c.email || "",
              })}
            />
          </Field>
        )}
        <FieldSection title="Dados da empresa" />
        <Field label="Razão social">
          <input value={form.razaoSocial || ""} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} placeholder="Razão social da empresa" />
        </Field>
        <Field label="Nome fantasia">
          <input value={form.nomeFantasia || ""} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} placeholder="Nome fantasia" />
        </Field>
        <Field label="CNPJ">
          <ValidatedInput type="cnpj" className="mono" value={form.cnpj || ""} onChange={(v) => setForm({ ...form, cnpj: v })} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Inscrição estadual">
          <input value={form.inscricaoEstadual || ""} onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })} placeholder="Inscrição estadual" />
        </Field>
        <Field label="Inscrição municipal">
          <input value={form.inscricaoMunicipal || ""} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} placeholder="Inscrição municipal" />
        </Field>
        <Field label="Endereço">
          <input value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" />
        </Field>

        <FieldSection title="Contato" />
        <Field label="Telefone">
          <ValidatedInput type="phone" value={form.telefone || ""} onChange={(v) => setForm({ ...form, telefone: v })} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="Email">
          <ValidatedInput type="email" value={form.email || ""} onChange={(v) => setForm({ ...form, email: v })} placeholder="contato@empresa.com" />
        </Field>

        <FieldSection title="Detalhes do lançamento" />
        <Field label="Descrição do produto">
          <textarea spellCheck lang="pt-BR" value={form.descricaoProduto || ""} onChange={(e) => setForm({ ...form, descricaoProduto: e.target.value })} placeholder="O que está sendo contratado..." rows={3} />
        </Field>
        <ToggleField
          checked={!!form.temAgencia}
          onChange={(e) => setForm({ ...form, temAgencia: e.target.checked, agenciaClienteId: e.target.checked ? form.agenciaClienteId : null })}
          title="Tem agência?"
        />
        {form.temAgencia && (
          <Field label="Agência (vincule um registro de Contas a pagar)">
            <AgenciaPicker
              clientes={clientesItems}
              value={form.agenciaClienteId}
              onChange={(id) => setForm({ ...form, agenciaClienteId: id })}
            />
          </Field>
        )}
        <Field label={form.usaContratoMinimo ? "Valor mensal (R$)" : "Valor total (R$)"}>
          <MoneyInput className="mono" value={form.valor ?? ""} onChange={(v) => setForm({ ...form, valor: v })} placeholder="0,00" />
        </Field>

        <ToggleField
          checked={!!form.usaParcelamento}
          disabled={!!editing}
          onChange={(e) => setForm({
            ...form,
            usaParcelamento: e.target.checked,
            usaContratoMinimo: e.target.checked ? false : form.usaContratoMinimo,
            parcelas: e.target.checked ? (Number(form.parcelas) > 1 ? form.parcelas : 2) : 1,
            mesesContrato: e.target.checked ? 1 : form.mesesContrato,
          })}
          title="Parcelamento"
          desc="Divide o valor total em várias vezes"
        />
        {form.usaParcelamento && (
          <Field label="Número de parcelas">
            <Select
              value={form.parcelas || 1}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, parcelas: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}x{n > 1 ? ` de ${formatBRL((Number(form.valor) || 0) / n)}` : ""}</option>
              ))}
            </Select>
          </Field>
        )}
        {!editing && form.usaParcelamento && Number(form.parcelas) > 1 && (
          <p className="field-hint">
            Vai gerar {form.parcelas} lançamentos separados (valor dividido entre eles), no mesmo dia de cada mês seguinte, a partir da data abaixo.
          </p>
        )}

        <ToggleField
          checked={!!form.usaContratoMinimo}
          disabled={!!editing}
          onChange={(e) => setForm({
            ...form,
            usaContratoMinimo: e.target.checked,
            usaParcelamento: e.target.checked ? false : form.usaParcelamento,
            parcelas: e.target.checked ? 1 : form.parcelas,
            mesesContrato: e.target.checked ? (Number(form.mesesContrato) > 1 ? form.mesesContrato : 12) : 1,
          })}
          title="Contrato mínimo"
          desc="Repete o mesmo valor todo mês, sem dividir"
        />
        {form.usaContratoMinimo && (
          <Field label="Duração do contrato">
            <Select
              value={form.mesesContrato || 1}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, mesesContrato: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? "mês" : "meses"}{n > 1 ? ` — ${n}x de ${formatBRL(Number(form.valor) || 0)}` : ""}</option>
              ))}
            </Select>
          </Field>
        )}
        {!editing && form.usaContratoMinimo && Number(form.mesesContrato) > 1 && (
          <p className="field-hint">
            Vai gerar {form.mesesContrato} lançamentos separados de {formatBRL(Number(form.valor) || 0)} cada (valor repetido, não dividido), no mesmo dia de cada mês seguinte, a partir da data abaixo.
          </p>
        )}
        {editing && (form.usaParcelamento || form.usaContratoMinimo) && (
          <p className="field-hint">Alterar isso na edição não recria os lançamentos — isso só acontece ao criar um novo.</p>
        )}
        <Field label={(Number(form.parcelas) > 1 || Number(form.mesesContrato) > 1) && !editing ? "Vencimento do 1º lançamento" : "Vencimento"}>
          <DateInput value={form.vencimento || ""} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={form.status || "Pendente"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.keys(CLIENTE_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar lançamento</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget ? clientDisplayName(deleteTarget) : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      >
        {deleteTarget?.temAgencia && (
          <p className="agency-notice">
            Há um valor a ser repassado à agência "<strong>{resolveAgenciaNome(deleteTarget, clientesItems)}</strong>".{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); onNavigateToClientes?.(); }}
            >
              Ir para Contas a pagar
            </button>
          </p>
        )}
      </ConfirmDialog>

      <CancelPickerDialog
        open={cancelPickerOpen}
        series={cancelableSeries}
        onClose={() => setCancelPickerOpen(false)}
        onConfirm={confirmCancelSeries}
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
          { label: "Descrição do produto", value: viewTarget.descricaoProduto },
          { label: "Agência", value: viewTarget.temAgencia ? resolveAgenciaNome(viewTarget, clientesItems) : "Não" },
          { label: "Valor", value: formatBRL(viewTarget.valor) },
          { label: "Parcela", value: viewTarget.parcela },
          { label: "Vencimento", value: formatDateBR(viewTarget.vencimento) },
          { label: "Status", value: viewTarget.status },
        ] : []}
      />

      <InfoDialog
        open={!!agencyNotice}
        title="Pagamento recebido"
        message={<>Esse lançamento tem agência associada. Um valor deve ser repassado à agência "<strong>{agencyNotice?.nomeAgencia || "—"}</strong>".</>}
        linkLabel="Ir para Contas a pagar"
        onLinkClick={() => { setAgencyNotice(null); onNavigateToClientes?.(); }}
        onClose={() => setAgencyNotice(null)}
      />
    </div>
  );
}

