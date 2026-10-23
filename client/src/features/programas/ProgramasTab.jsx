import { useMemo, useState } from "react";
import { Trash2, Pencil, AlertTriangle, Clock3, Eye, Clapperboard } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { WEEKDAYS, formatWeekdays } from "../../lib/dates.js";
import { getHorarios, formatHorarios } from "../../lib/programas.js";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { WeekdayPicker } from "../../components/common/WeekdayPicker.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { HorariosPicker } from "../../components/pickers/HorariosPicker.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";
import { partesAgora } from "../../lib/fuso.js";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  programa: (i) => i.nome,
  sigla: (i) => i.sigla,
  dias: (i) => { const n = WEEKDAYS.findIndex((d) => (i.diasSemana || []).includes(d.key)); return n < 0 ? null : n; },
  horario: (i) => { const h = formatHorarios(i); return h === "—" ? null : h; },
};

export function ProgramasTab({ items, onCreate, onUpdate, onDelete, canEdit = true }) {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", sigla: "", descricao: "", diasSemana: [], horarios: [] });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ ...item, horarios: getHorarios(item) });
    setDrawerOpen(true);
  };

  // Verifica se já existe outro programa com o mesmo nome ou a mesma sigla
  // — evita cadastro duplicado (ex: dois "SUCA" diferentes confundiriam
  // quem usa a sigla noutras telas). Ao editar, ignora o próprio registro.
  const duplicate = useMemo(() => {
    const nome = (form.nome || "").trim().toLowerCase();
    const sigla = (form.sigla || "").trim().toLowerCase();
    if (!nome && !sigla) return null;
    const found = items.find((i) => {
      if (editing && i.id === editing) return false;
      const iNome = (i.nome || "").trim().toLowerCase();
      const iSigla = (i.sigla || "").trim().toLowerCase();
      return (nome && iNome === nome) || (sigla && iSigla === sigla);
    });
    if (!found) return null;
    const motivos = [];
    if (nome && (found.nome || "").trim().toLowerCase() === nome) motivos.push("nome");
    if (sigla && (found.sigla || "").trim().toLowerCase() === sigla) motivos.push("sigla");
    return { item: found, motivos };
  }, [items, form.nome, form.sigla, editing]);

  const save = async () => {
    if (!form.nome?.trim()) return;
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
        const haystack = `${i.nome || ""} ${i.sigla || ""} ${i.descricao || ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  }, [items, search]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, { key: "programa", dir: "asc" });

  const stats = useMemo(() => {
    const total = items.length;
    const hojeKey = WEEKDAYS[partesAgora().diaSemana].key;
    const noArHoje = items.filter((i) => (i.diasSemana || []).includes(hojeKey)).length;
    return { total, noArHoje };
  }, [items]);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total de programas" value={stats.total} icon={Clapperboard} />
        <StatCard label="No ar hoje" value={stats.noArHoje} tone="blue" icon={Clock3} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por nome, sigla ou descrição..."
        onNew={canEdit ? openNew : undefined} newLabel="Novo programa"
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="programa">Programa</SortTh>
              <SortTh sort={sort} k="sigla">Sigla</SortTh>
              <SortTh sort={sort} k="dias">Dias da semana</SortTh>
              <SortTh sort={sort} k="horario" className="mono-col">Horário</SortTh>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={5} text="Nenhum programa encontrado." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="title-cell">{i.nome}</td>
                <td className="mono">{i.sigla || "—"}</td>
                <td>{formatWeekdays(i.diasSemana)}</td>
                <td className="mono-col mono">{formatHorarios(i)}</td>
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

      <Drawer open={drawerOpen} title={editing ? "Editar programa" : "Novo programa"} onClose={pedirFechar}>
        <Field label="Nome do programa">
          <input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Sucesso no Campo" />
        </Field>
        <Field label="Sigla / Nomenclatura">
          <input className="mono" value={form.sigla || ""} onChange={(e) => setForm({ ...form, sigla: e.target.value.toUpperCase() })} placeholder="Ex: SUCA" />
        </Field>
        {duplicate && (
          <p className="duplicate-warning">
            <AlertTriangle size={15} />
            <span>
              Já existe um programa cadastrado com o(a) mesmo(a) {duplicate.motivos.join(" e ")}: <strong>"{duplicate.item.nome}"</strong>.
              Não é possível salvar um programa duplicado.
            </span>
          </p>
        )}
        <Field label="Descrição">
          <textarea spellCheck lang="pt-BR"
            value={form.descricao || ""}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Sobre o que é o programa..."
            rows={3}
          />
        </Field>
        <Field label="Dias da semana (veiculação)">
          <WeekdayPicker value={form.diasSemana || []} onChange={(v) => setForm({ ...form, diasSemana: v })} />
        </Field>
        <Field label="Horário(s)">
          <HorariosPicker value={form.horarios || []} onChange={(v) => setForm({ ...form, horarios: v })} />
        </Field>
        <p className="field-hint">Adicione mais de um horário se o programa reprisa (ex: manhã e à noite).</p>
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={!!duplicate}>Salvar programa</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget?.nome}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />

      <ViewDialog
        open={!!viewTarget}
        title={viewTarget?.nome}
        onClose={() => setViewTarget(null)}
        fields={viewTarget ? [
          { label: "Sigla", value: viewTarget.sigla },
          { label: "Descrição", value: viewTarget.descricao },
          { label: "Dias da semana", value: formatWeekdays(viewTarget.diasSemana) },
          { label: "Horário(s)", value: formatHorarios(viewTarget) },
        ] : []}
      />
    </div>
  );
}

