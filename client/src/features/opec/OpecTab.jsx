import { useMemo, useState } from "react";
import { RelatorioBotao } from "../relatorios/RelatorioBotao.jsx";
import { Tv2, Trash2, Pencil, Clock3, Eye, CalendarX, Repeat } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { formatDateBR, todayISO, isOverdue, WEEKDAYS, WEEKDAY_KEYS_BY_INDEX, diaSemanaExtenso, formatWeekdays } from "../../lib/dates.js";
import { clientDisplayName } from "../../lib/financeiro.js";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { noArNoDia } from "../../lib/opec.js";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { IntegerInput } from "../../components/common/MaskedInputs.jsx";
import { ToggleField } from "../../components/common/ToggleField.jsx";
import { WeekdayPicker } from "../../components/common/WeekdayPicker.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { ClientePicker } from "../../components/pickers/ClientePicker.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { useSortable, comparaVencimento } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  nome: (i) => i.nomeVT,
  programa: (i) => i.programa,
  cliente: (i) => i.cliente,
  dias: (i) => { const n = WEEKDAYS.findIndex((d) => (i.diasSemana || []).includes(d.key)); return n < 0 ? null : n; },
  duracao: (i) => Number(i.duracao) || null,
  quantidade: (i) => Number(i.quantidade) || 1,
  vencimento: { get: (i) => (i.naoVence ? null : i.vencimento), cmp: comparaVencimento },
};

// Nome do componente/arquivo acompanha o rótulo do menu ("OPEC") e, desde
// a migração de ids (ver RENAME_DE_COLECAO em server/db.js), também a
// coleção no banco/permissões, que se chama "opec".
export function OpecTab({ items, onCreate, onUpdate, onDelete, canEdit = true, clientesCadastroItems, programasItems }) {
  const [search, setSearch] = useState("");
  const [weekdayFilter, setWeekdayFilter] = useState("");
  const [programaFilter, setProgramaFilter] = useState("");
  const [mostrarVencidos, setMostrarVencidos] = useState(false);
  // "Ver para o dia": simula a grade de um dia futuro (ex.: montar a OPEC de
  // segunda na quinta) — só mostra o que estará no ar NAQUELE dia.
  const [diaRef, setDiaRef] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ nomeVT: "", programa: "", cliente: "", diasSemana: [], duracao: "30", quantidade: 1, inicio: todayISO(), vencimento: "", naoVence: false });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm(item);
    setDrawerOpen(true);
  };
  const save = async () => {
    if (!form.nomeVT?.trim() || !form.programa?.trim() || !form.cliente?.trim()) return;
    if (editing) {
      await onUpdate({ ...form, id: editing });
    } else {
      await onCreate({ ...form, id: uid() });
    }
    setDrawerOpen(false);
  };

  // Aviso: VTs que HOJE ainda estão no ar nesse dia da semana, mas vencem antes
  // do dia escolhido — ficam de fora da OPEC desse dia.
  const caemAntes = useMemo(() => {
    if (!diaRef) return [];
    const chave = WEEKDAY_KEYS_BY_INDEX[new Date(diaRef + "T00:00:00").getDay()];
    return items
      .filter((i) => !i.naoVence && i.vencimento && i.vencimento < diaRef && i.vencimento >= todayISO() && (i.diasSemana || []).includes(chave))
      .filter((i) => !programaFilter || i.programa === programaFilter)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [items, diaRef, programaFilter]);

  const insercoesQueCaem = caemAntes.reduce((s, i) => s + (Number(i.quantidade) || 1), 0);

  const resumoDia = useMemo(() => {
    if (!diaRef) return null;
    const noAr = items.filter((i) => noArNoDia(i, diaRef) && (!programaFilter || i.programa === programaFilter));
    return { vts: noAr.length, insercoes: noAr.reduce((s, i) => s + (Number(i.quantidade) || 1), 0) };
  }, [items, diaRef, programaFilter]);

  const isExpired = (i) => !i.naoVence && i.vencimento && i.vencimento < todayISO();

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        const matchSearch = `${i.nomeVT || ""} ${i.programa} ${i.cliente}`.toLowerCase().includes(search.toLowerCase());
        const matchWeekday = !weekdayFilter || (i.diasSemana || []).includes(weekdayFilter);
        const matchPrograma = !programaFilter || i.programa === programaFilter;
        const matchVencido = mostrarVencidos || !isExpired(i);
        if (diaRef) return matchSearch && matchPrograma && noArNoDia(i, diaRef);
        return matchSearch && matchWeekday && matchPrograma && matchVencido;
      })
      .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  }, [items, search, weekdayFilter, programaFilter, mostrarVencidos, diaRef]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, { key: "vencimento", dir: "asc" });

  const stats = useMemo(() => {
    const ativos = items.filter((i) => !isExpired(i));
    const naoVencem = items.filter((i) => i.naoVence).length;
    const vencidos = items.length - ativos.length;
    return { total: ativos.length, naoVencem, vencidos };
  }, [items]);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total de inserções ativas" value={stats.total} icon={Tv2} />
        <StatCard label="Não vencem" value={stats.naoVencem} tone="blue" icon={Clock3} />
        <StatCard label="Vencidas (histórico)" value={stats.vencidos} tone="gray" icon={CalendarX} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por nome do VT, programa ou cliente..."
        extraActions={<RelatorioBotao tipo="break" items={items} />}
        extraFilter={
          <>
            <Select className="select-filter" value={weekdayFilter} onChange={(e) => setWeekdayFilter(e.target.value)}>
              <option value="">Todos os dias</option>
              {WEEKDAYS.map((d) => <option key={d.key} value={d.key}>{d.full}</option>)}
            </Select>
            <Select className="select-filter" value={programaFilter} onChange={(e) => setProgramaFilter(e.target.value)}>
              <option value="">Todos os programas</option>
              {(programasItems || []).map((p) => (
                <option key={p.id} value={p.sigla || p.nome}>{p.sigla || p.nome}</option>
              ))}
            </Select>
            <label className="opec-dia-ref" title="Veja só o que estará no ar em um dia futuro (ex.: montar a OPEC de segunda na quinta)">
              <span>Ver para o dia</span>
              <DateInput value={diaRef} onChange={(e) => setDiaRef(e.target.value)} />
              {diaRef && <button type="button" className="btn-ghost" onClick={() => setDiaRef("")}>Limpar</button>}
            </label>
            <label className="checkbox-field checkbox-inline">
              <input type="checkbox" className="app-checkbox" checked={mostrarVencidos} onChange={(e) => setMostrarVencidos(e.target.checked)} />
              <span>Mostrar vencidos</span>
            </label>
          </>
        }
        onNew={canEdit ? openNew : undefined} newLabel="Nova inserção"
      />

      {diaRef && (
        <div className="opec-dia-aviso">
          <strong>
            OPEC de {diaSemanaExtenso(diaRef).toLowerCase()}, {formatDateBR(diaRef)}: {resumoDia.insercoes} inserção(ões)
          </strong>
          {caemAntes.length > 0 ? (
            <div className="opec-dia-aviso-alerta">
              Atenção — {insercoesQueCaem} inserção(ões) estão no ar hoje, mas <b>vencem antes desse dia</b> e NÃO entram:
              <ul>
                {caemAntes.map((i) => (
                  <li key={i.id}>{i.nomeVT || i.cliente} ({i.programa}) — vence {diaSemanaExtenso(i.vencimento).toLowerCase()}, {formatDateBR(i.vencimento)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="opec-dia-aviso-ok">Nenhum VT vence antes desse dia.</div>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="nome">Nome do VT</SortTh>
              <SortTh sort={sort} k="programa">Programa</SortTh>
              <SortTh sort={sort} k="cliente">Cliente</SortTh>
              <SortTh sort={sort} k="dias">Dias da semana</SortTh>
              <SortTh sort={sort} k="duracao" className="mono-col">Duração</SortTh>
              <SortTh sort={sort} k="quantidade" className="mono-col">Qtd/break</SortTh>
              <SortTh sort={sort} k="vencimento">Vencimento</SortTh>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={8} text="Nenhuma inserção encontrada." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="title-cell">
                  {i.nomeVT || "—"}
                  {Number(i.quantidade) > 1 && <span className="fixa-badge" title="Repete várias vezes dentro do mesmo break"><Repeat size={11} /> {i.quantidade}x</span>}
                </td>
                <td>{i.programa}</td>
                <td>{i.cliente}</td>
                <td>{formatWeekdays(i.diasSemana)}</td>
                <td className="mono-col mono">{i.duracao}s</td>
                <td className="mono-col mono">{Number(i.quantidade) || 1}x</td>
                <td className={!i.naoVence && isOverdue(i.vencimento) ? "overdue" : ""}>
                  {i.naoVence ? "Não vence" : formatDateBR(i.vencimento)}
                </td>
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

      <Drawer open={drawerOpen} title={editing ? "Editar inserção" : "Nova inserção"} onClose={pedirFechar}>
        <Field label="Nome do VT">
          <input value={form.nomeVT || ""} onChange={(e) => setForm({ ...form, nomeVT: e.target.value })} placeholder="Ex: Supermercado Bom Preço — Ofertas 30s" />
        </Field>
        <Field label="Programa">
          <Select value={form.programa || ""} onChange={(e) => setForm({ ...form, programa: e.target.value })}>
            <option value="">Selecione um programa...</option>
            {form.programa && !(programasItems || []).some((p) => (p.sigla || p.nome) === form.programa) && (
              <option value={form.programa}>{form.programa} (não cadastrado em Programas)</option>
            )}
            {(programasItems || []).map((p) => (
              <option key={p.id} value={p.sigla || p.nome}>{p.nome}{p.sigla ? ` (${p.sigla})` : ""}</option>
            ))}
          </Select>
        </Field>
        {(programasItems || []).length === 0 && (
          <p className="field-hint">Nenhum programa cadastrado ainda — cadastre um na aba Programas primeiro.</p>
        )}
        <Field label="Buscar cliente cadastrado (opcional)">
          <ClientePicker
            clientesCadastro={clientesCadastroItems}
            onSelect={(c) => setForm({ ...form, cliente: clientDisplayName(c) })}
          />
        </Field>
        <Field label="Cliente">
          <input value={form.cliente || ""} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nome do anunciante" />
        </Field>
        <Field label="Dias da semana">
          <WeekdayPicker value={form.diasSemana || []} onChange={(v) => setForm({ ...form, diasSemana: v })} />
        </Field>
        <Field label="Início da veiculação">
          <DateInput value={form.inicio || ""} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
        </Field>
        <p className="field-hint">Usado nos relatórios — pra não contar dias antes de o VT começar a rodar.</p>
        <Field label="Duração (segundos)">
          <IntegerInput className="mono" max={5} value={form.duracao || ""} onChange={(v) => setForm({ ...form, duracao: v })} placeholder="30" />
        </Field>
        <Field label="Quantas vezes dentro do mesmo break">
          <IntegerInput className="mono" max={3} value={form.quantidade ?? 1} onChange={(v) => setForm({ ...form, quantidade: v })} placeholder="1" />
        </Field>
        <p className="field-hint">Ex: se o VT da farmácia precisa ir 3 vezes dentro do mesmo break, coloque 3 — sem precisar cadastrar 3 lançamentos separados.</p>
        <Field label="Vencimento">
          <DateInput
           
            value={form.vencimento || ""}
            disabled={!!form.naoVence}
            onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
          />
        </Field>
        <ToggleField
          checked={!!form.naoVence}
          onChange={(e) => setForm({ ...form, naoVence: e.target.checked, vencimento: e.target.checked ? "" : form.vencimento })}
          title="Este VT não vence"
          desc="Sem data de expiração — não será apagado automaticamente"
        />
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar inserção</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget ? (deleteTarget.nomeVT || `${deleteTarget.programa} — ${deleteTarget.cliente}`) : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />

      <ViewDialog
        open={!!viewTarget}
        title={viewTarget ? (viewTarget.nomeVT || `${viewTarget.programa} — ${viewTarget.cliente}`) : ""}
        onClose={() => setViewTarget(null)}
        fields={viewTarget ? [
          { label: "Programa", value: viewTarget.programa },
          { label: "Cliente", value: viewTarget.cliente },
          { label: "Dias da semana", value: formatWeekdays(viewTarget.diasSemana) },
          { label: "Início da veiculação", value: viewTarget.inicio ? formatDateBR(viewTarget.inicio) : "—" },
          { label: "Duração", value: viewTarget.duracao ? `${viewTarget.duracao}s` : "" },
          { label: "Quantas vezes por break", value: `${Number(viewTarget.quantidade) || 1}x` },
          { label: "Vencimento", value: viewTarget.naoVence ? "Não vence" : formatDateBR(viewTarget.vencimento) },
        ] : []}
      />
    </div>
  );
}

