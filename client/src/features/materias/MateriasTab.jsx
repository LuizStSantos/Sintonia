import { useMemo, useState } from "react";
import { Video, Trash2, Pencil, Check, Clock3, Eye } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { formatDateBR, todayISO, MONTHS } from "../../lib/dates.js";
import { formatDuracaoAspas } from "../../lib/duration.js";
import { formatVeiculacaoSummary, formatVeiculacaoFull } from "../../lib/veiculacao.js";
import { TONE, FLAG_META, VIDEO_STATUS } from "../../lib/constants.js";
import { Badge } from "../../components/common/Badge.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { DurationInput } from "../../components/common/MaskedInputs.jsx";
import { FlagPicker } from "../../components/common/FlagPicker.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { VeiculacaoPicker } from "../../components/pickers/VeiculacaoPicker.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";
import { PublicacoesRedes, ChipsRedes } from "../../components/pickers/PublicacoesRedes.jsx";
import { textoPublicacoes } from "../../lib/publicacoes.js";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  retranca: (i) => i.titulo,
  reporter: (i) => i.reporter,
  tipo: (i) => i.tipo,
  duracao: (i) => { const p = String(i.duracao || "").split(":").map(Number); return p.some(Number.isNaN) || !i.duracao ? null : p.reduce((t, n) => t * 60 + n, 0); },
  entrada: (i) => i.entrada,
  veiculacao: (i) => (i.datasVeiculacao || []).map((v) => (typeof v === "string" ? v : v?.data || "")).filter(Boolean).sort()[0] || null,
  status: (i) => Object.keys(VIDEO_STATUS).indexOf(i.status),
};

export function MateriasTab({ items, onCreate, onUpdate, onDelete, canEdit = true, programasItems }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(todayISO().slice(0, 4));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ titulo: "", cabeca: "", reporter: "", tipo: "VT Completo", duracao: "", status: "Redação", entrada: todayISO(), datasVeiculacao: [], publicacoes: [], sinalizadores: [] });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm(item);
    setDrawerOpen(true);
  };
  const save = async () => {
    if (!form.titulo?.trim()) return;
    if (editing) {
      await onUpdate({ ...form, id: editing });
    } else {
      await onCreate({ ...form, id: uid() });
    }
    setDrawerOpen(false);
  };

  const yearOptions = useMemo(() => {
    const years = new Set(items.map((i) => (i.entrada || "").slice(0, 4)).filter(Boolean));
    years.add(todayISO().slice(0, 4));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const flagLabels = (i.sinalizadores || []).map((key) => FLAG_META.find((f) => f.key === key)?.label || "").join(" ");
      const matchSearch = `${i.titulo} ${i.tipo} ${i.reporter || ""} ${flagLabels}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || i.status === statusFilter;
      const matchYear = !yearFilter || (i.entrada || "").slice(0, 4) === yearFilter;
      const matchMonth = !monthFilter || (i.entrada || "").slice(5, 7) === monthFilter;
      return matchSearch && matchStatus && matchYear && matchMonth;
    });
  }, [items, search, statusFilter, yearFilter, monthFilter]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, null);

  const counts = useMemo(() => {
    const c = { total: items.length, redacao: 0, edicao: 0, pronto: 0 };
    items.forEach((i) => {
      if (i.status === "Redação") c.redacao++;
      if (i.status === "Edição") c.edicao++;
      if (i.status === "Pronto") c.pronto++;
    });
    return c;
  }, [items]);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total de matérias" value={counts.total} icon={Video} />
        <StatCard label="Em redação" value={counts.redacao} tone="amber" icon={Clock3} />
        <StatCard label="Em edição" value={counts.edicao} tone="blue" icon={Pencil} />
        <StatCard label="Prontos" value={counts.pronto} tone="green" icon={Check} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por título, tipo, repórter ou sinalizador..."
        statusOptions={Object.keys(VIDEO_STATUS)}
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
        onNew={canEdit ? openNew : undefined} newLabel="Nova matéria"
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="retranca">Retranca</SortTh>
              <SortTh sort={sort} k="reporter">Repórter</SortTh>
              <SortTh sort={sort} k="tipo">Tipo</SortTh>
              <SortTh sort={sort} k="duracao" className="mono-col">Duração</SortTh>
              <SortTh sort={sort} k="entrada">Entrada</SortTh>
              <SortTh sort={sort} k="veiculacao">Veiculação</SortTh>
              <SortTh sort={sort} k="status">Status</SortTh>
              <th>Redes</th>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={9} text="Nenhum vídeo encontrado." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="title-cell">
                  {(i.sinalizadores || []).map((key) => {
                    const f = FLAG_META.find((x) => x.key === key);
                    if (!f) return null;
                    return <span key={key} className="flag-dot" style={{ background: TONE[f.tone].text }} title={f.label} />;
                  })}
                  {i.titulo}
                </td>
                <td>{i.reporter || "—"}</td>
                <td>{i.tipo}</td>
                <td className="mono-col mono">{i.duracao || "—"}</td>
                <td>{formatDateBR(i.entrada)}</td>
                <td>{formatVeiculacaoSummary(i.datasVeiculacao)}</td>
                <td><Badge label={i.status} tone={VIDEO_STATUS[i.status] || "gray"} /></td>
                <td><ChipsRedes value={i.publicacoes} /></td>
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

      <Drawer open={drawerOpen} title={editing ? "Editar matéria" : "Nova matéria"} onClose={pedirFechar}>
        <Field label="Retranca">
          <input spellCheck lang="pt-BR" value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: VT — Campanha outubro rosa" />
        </Field>
        <Field label="Sinalizadores">
          <FlagPicker value={form.sinalizadores || []} onChange={(v) => setForm({ ...form, sinalizadores: v })} />
        </Field>
        <Field label="Repórter">
          <input value={form.reporter || ""} onChange={(e) => setForm({ ...form, reporter: e.target.value })} placeholder="Nome do repórter responsável" />
        </Field>
        <Field label="Cabeça">
          <textarea spellCheck lang="pt-BR"
            value={form.cabeca || ""}
            onChange={(e) => setForm({ ...form, cabeca: e.target.value })}
            placeholder="Texto de apresentação lido pelo apresentador antes de entrar o vídeo..."
            rows={4}
          />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo || "VT Completo"} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="VT">VT</option>
            <option value="VT Completo">VT Completo</option>
            <option value="Stand Up">Stand Up</option>
            <option value="Sonora">Sonora</option>
            <option value="NC">NC</option>
            <option value="PG">PG</option>
          </Select>
        </Field>
        <Field label="Duração (mm:ss)">
          <DurationInput className="mono" value={form.duracao || ""} onChange={(v) => setForm({ ...form, duracao: v })} placeholder="0:30" />
        </Field>
        <Field label="Data de entrada">
          <DateInput value={form.entrada || ""} onChange={(e) => setForm({ ...form, entrada: e.target.value })} />
        </Field>
        <Field label="Datas de veiculação">
          <VeiculacaoPicker value={form.datasVeiculacao || []} onChange={(v) => setForm({ ...form, datasVeiculacao: v })} programasItems={programasItems} />
        </Field>
        <Field label="Publicado nas redes">
          <PublicacoesRedes value={form.publicacoes || []} onChange={(v) => setForm({ ...form, publicacoes: v })} />
        </Field>
        <Field label="Status">
          <Select value={form.status || "Redação"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.keys(VIDEO_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar matéria</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget?.titulo}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />

      <ViewDialog
        open={!!viewTarget}
        title={viewTarget?.titulo}
        onClose={() => setViewTarget(null)}
        fields={viewTarget ? [
          { label: "Repórter", value: viewTarget.reporter },
          { label: "Cabeça", value: viewTarget.cabeca },
          { label: "Tipo", value: viewTarget.tipo },
          { label: "Duração", value: viewTarget.duracao },
          { label: "Data de entrada", value: formatDateBR(viewTarget.entrada) },
          { label: "Veiculação", value: formatVeiculacaoFull(viewTarget.datasVeiculacao) },
          { label: "Redes sociais", value: textoPublicacoes(viewTarget.publicacoes) },
          { label: "Sinalizadores", value: (viewTarget.sinalizadores || []).map((k) => FLAG_META.find((f) => f.key === k)?.label).filter(Boolean).join(", ") },
          { label: "Status", value: viewTarget.status },
        ] : []}
        extraButtons={viewTarget ? [
          {
            label: "Copiar retranca + tempo",
            getValue: () => {
              const tempo = formatDuracaoAspas(viewTarget.duracao);
              return tempo ? `${tempo} ${viewTarget.titulo || ""}` : (viewTarget.titulo || "");
            },
          },
          { label: "Copiar cabeça", getValue: () => viewTarget.cabeca || "" },
        ] : []}
      />
    </div>
  );
}

