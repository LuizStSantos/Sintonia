import { useMemo, useState } from "react";
import { Trash2, Pencil, Clock3, Eye, Mic, RotateCcw, Archive } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { formatDateBR, todayISO } from "../../lib/dates.js";
import { MODALIDADE_TONE } from "../../lib/constants.js";
import { Badge } from "../../components/common/Badge.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { ViewDialog } from "../../components/common/ViewDialog.jsx";
import { ValidatedInput } from "../../components/common/ValidatedInput.jsx";
import { ExtrasEntrevistadoPicker } from "../../components/pickers/ExtrasEntrevistadoPicker.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";
import { DurationInput } from "../../components/common/MaskedInputs.jsx";
import { VeiculacaoPicker } from "../../components/pickers/VeiculacaoPicker.jsx";
import { formatVeiculacaoFull } from "../../lib/veiculacao.js";
import { PublicacoesRedes, ChipsRedes } from "../../components/pickers/PublicacoesRedes.jsx";
import { textoPublicacoes } from "../../lib/publicacoes.js";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  nome: (i) => i.nomeCompleto,
  funcao: (i) => i.funcao,
  programa: (i) => i.programa,
  data: (i) => (i.data ? `${i.data} ${i.horario || ""}` : null),
  horario: (i) => i.horario,
  duracao: (i) => { const p = String(i.duracao || "").split(":").map(Number); return p.some(Number.isNaN) || !i.duracao ? null : p.reduce((t, n) => t * 60 + n, 0); },
  modalidade: (i) => i.modalidade || "Presencial",
};

export function EntrevistadosTab({ items, onCreate, onUpdate, onDelete, canEdit = true, programasItems }) {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [reativarVencidoTarget, setReativarVencidoTarget] = useState(null);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ nomeCompleto: "", funcao: "", celular: "", linhaFina: "", programa: "", data: todayISO(), horario: "", duracao: "", datasVeiculacao: [], publicacoes: [], modalidade: "Presencial", cabeca: "", observacoes: "", extras: [], inativo: false });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm(item);
    setDrawerOpen(true);
  };
  const save = async () => {
    if (!form.nomeCompleto?.trim() || !form.data) return;
    if (editing) {
      await onUpdate({ ...form, id: editing });
    } else {
      await onCreate({ ...form, id: uid() });
    }
    setDrawerOpen(false);
  };

  // "Excluir" aqui não apaga o registro — só marca como inativo, pra sumir
  // da lista principal sem perder o histórico pra eventual consulta depois.
  // Fica escondido por padrão; "Mostrar inativos" traz de volta pra tela,
  // e dá pra reativar a qualquer momento.
  const arquivar = async (item) => { await onUpdate({ ...item, inativo: true }); };
  const reativar = async (item) => { await onUpdate({ ...item, inativo: false }); };

  // Se a data já passou, o servidor vai marcar como inativa de novo
  // sozinho na próxima checagem automática (a cada consulta ou a cada 30
  // min) — reativar sem trocar a data não "gruda". Avisa antes, em vez de
  // deixar a pessoa achando que reativou e ver sumir de novo sem explicação.
  const clicarReativar = (item) => {
    if (item.data && item.data < todayISO()) {
      setReativarVencidoTarget(item);
    } else {
      reativar(item);
    }
  };

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        if (!mostrarInativos && i.inativo) return false;
        const extrasText = (i.extras || []).map((e) => `${e.nomeCompleto} ${e.funcao}`).join(" ");
        const haystack = `${i.nomeCompleto || ""} ${i.funcao || ""} ${i.linhaFina || ""} ${extrasText}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .sort((a, b) => (a.data || "").localeCompare(b.data || "") || (a.horario || "").localeCompare(b.horario || ""));
  }, [items, search, mostrarInativos]);
  const { rows, sort } = useSortable(filtered, SORT_ACESSORES, { key: "data", dir: "asc" });

  const stats = useMemo(() => {
    const today = todayISO();
    const ativos = items.filter((i) => !i.inativo);
    return {
      total: ativos.length,
      hoje: ativos.filter((i) => i.data === today).length,
      inativos: items.length - ativos.length,
    };
  }, [items]);

  const today = todayISO();

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total agendadas" value={stats.total} icon={Mic} />
        <StatCard label="Hoje" value={stats.hoje} tone="red" icon={Clock3} />
        <StatCard label="Inativas (histórico)" value={stats.inativos} tone="gray" icon={Archive} />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por nome, função ou linha fina..."
        extraFilter={
          <label className="checkbox-field checkbox-inline">
            <input type="checkbox" className="app-checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
            <span>Mostrar inativos</span>
          </label>
        }
        onNew={canEdit ? openNew : undefined} newLabel="Nova entrevista"
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="nome">Nome</SortTh>
              <SortTh sort={sort} k="funcao">Função</SortTh>
              <SortTh sort={sort} k="programa">Programa</SortTh>
              <SortTh sort={sort} k="data">Data</SortTh>
              <SortTh sort={sort} k="horario" className="mono-col">Horário</SortTh>
              <SortTh sort={sort} k="duracao" className="mono-col">Duração</SortTh>
              <SortTh sort={sort} k="modalidade">Modalidade</SortTh>
              <th>Redes</th>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={9} text="Nenhuma entrevista agendada." />}
            {rows.map((i) => (
              <tr key={i.id} className={`${i.data === today ? "today-row" : ""}${i.inativo ? " row-inativo" : ""}`}>
                <td className="title-cell">
                  {i.nomeCompleto}
                  {(i.extras || []).length > 0 && <span className="extras-badge"> +{i.extras.length}</span>}
                  {i.inativo && <span className="fixa-badge" title="Inativa — some da lista padrão, mas continua salva pra consulta"><Archive size={11} /> Inativa</span>}
                </td>
                <td>{i.funcao || "—"}</td>
                <td>{i.programa || "—"}</td>
                <td className={i.data === today ? "today-text" : ""}>{formatDateBR(i.data)}</td>
                <td className="mono-col mono">{i.horario || "—"}</td>
                <td className="mono-col mono">{i.duracao || "—"}</td>
                <td><Badge label={i.modalidade || "Presencial"} tone={MODALIDADE_TONE[i.modalidade] || "green"} /></td>
                <td><ChipsRedes value={i.publicacoes} /></td>
                <td className="actions-col">
                  <button className="icon-btn" onClick={() => setViewTarget(i)} aria-label="Visualizar"><Eye size={15} /></button>
                  {canEdit && (
                    <>
                      <button className="icon-btn" onClick={() => openEdit(i)} aria-label="Editar"><Pencil size={15} /></button>
                      {i.inativo ? (
                        <button className="icon-btn" onClick={() => clicarReativar(i)} aria-label="Reativar"><RotateCcw size={15} /></button>
                      ) : (
                        <button className="icon-btn danger" onClick={() => setDeleteTarget(i)} aria-label="Tornar inativa"><Trash2 size={15} /></button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} title={editing ? "Editar entrevista" : "Nova entrevista"} onClose={pedirFechar}>
        <Field label="Nome completo">
          <input value={form.nomeCompleto || ""} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} placeholder="Nome completo do entrevistado" />
        </Field>
        <Field label="Função">
          <input value={form.funcao || ""} onChange={(e) => setForm({ ...form, funcao: e.target.value })} placeholder="Ex: Secretário, Produtor rural..." />
        </Field>
        <Field label="Mais entrevistados neste mesmo bloco (opcional)">
          <ExtrasEntrevistadoPicker value={form.extras || []} onChange={(v) => setForm({ ...form, extras: v })} />
        </Field>
        <Field label="Linha fina">
          <input value={form.linhaFina || ""} onChange={(e) => setForm({ ...form, linhaFina: e.target.value })} placeholder="Sobre o que ele vai falar" />
        </Field>
        <Field label="Cabeça">
          <textarea spellCheck lang="pt-BR"
            value={form.cabeca || ""}
            onChange={(e) => setForm({ ...form, cabeca: e.target.value })}
            placeholder="Texto de apresentação lido pelo apresentador..."
            rows={3}
          />
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
        <Field label="Data">
          <DateInput value={form.data || ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </Field>
        <Field label="Horário">
          <input className="mono" type="time" value={form.horario || ""} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
        </Field>
        <Field label="Duração (opcional)">
          <DurationInput className="mono" value={form.duracao || ""} onChange={(v) => setForm({ ...form, duracao: v })} placeholder="3:00" />
        </Field>
        <Field label="Datas de veiculação (opcional)">
          <VeiculacaoPicker value={form.datasVeiculacao || []} onChange={(v) => setForm({ ...form, datasVeiculacao: v })} programasItems={programasItems} />
        </Field>
        <Field label="Publicado nas redes (opcional)">
          <PublicacoesRedes value={form.publicacoes || []} onChange={(v) => setForm({ ...form, publicacoes: v })} />
        </Field>
        <Field label="Modalidade">
          <Select value={form.modalidade || "Presencial"} onChange={(e) => setForm({ ...form, modalidade: e.target.value })}>
            <option value="Presencial">Presencial</option>
            <option value="Online">Online</option>
            <option value="Gravado">Gravado</option>
          </Select>
        </Field>
        <Field label="Celular">
          <ValidatedInput type="phone" value={form.celular || ""} onChange={(v) => setForm({ ...form, celular: v })} placeholder="(00) 00000-0000" />
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
          <button className="btn-primary" onClick={save}>Salvar entrevista</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Tornar inativa"
        message={<>Isso não apaga o registro — <strong>"{deleteTarget?.nomeCompleto}"</strong> vai só sumir da lista padrão, ficando salvo pra consulta. Você pode reativar quando quiser marcando "Mostrar inativos".</>}
        confirmLabel="Tornar inativa"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { arquivar(deleteTarget); setDeleteTarget(null); }}
      />

      <ConfirmDialog
        open={!!reativarVencidoTarget}
        title="Data dessa entrevista já passou"
        message={<>A data de <strong>"{reativarVencidoTarget?.nomeCompleto}"</strong> ({formatDateBR(reativarVencidoTarget?.data)}) já passou — se reativar sem trocar a data, ela volta a ficar inativa sozinha em pouco tempo. Edite a data se quiser que ela continue aparecendo na lista normal.</>}
        confirmLabel="Reativar mesmo assim"
        onCancel={() => setReativarVencidoTarget(null)}
        onConfirm={() => { reativar(reativarVencidoTarget); setReativarVencidoTarget(null); }}
        extraAction={{ label: "Editar data", onClick: () => { openEdit(reativarVencidoTarget); setReativarVencidoTarget(null); } }}
      />

      <ViewDialog
        open={!!viewTarget}
        title={viewTarget?.nomeCompleto}
        onClose={() => setViewTarget(null)}
        fields={viewTarget ? [
          { label: "Função", value: viewTarget.funcao },
          { label: "Outros entrevistados neste bloco", value: (viewTarget.extras || []).map((e) => `${e.nomeCompleto}${e.funcao ? ` (${e.funcao})` : ""}`).join(", ") },
          { label: "Linha fina", value: viewTarget.linhaFina },
          { label: "Cabeça", value: viewTarget.cabeca },
          { label: "Programa", value: viewTarget.programa },
          { label: "Data", value: formatDateBR(viewTarget.data) },
          { label: "Horário", value: viewTarget.horario },
          { label: "Duração", value: viewTarget.duracao },
          { label: "Veiculação", value: formatVeiculacaoFull(viewTarget.datasVeiculacao) },
          { label: "Redes sociais", value: textoPublicacoes(viewTarget.publicacoes) },
          { label: "Modalidade", value: viewTarget.modalidade || "Presencial" },
          { label: "Celular", value: viewTarget.celular },
          { label: "Observações", value: viewTarget.observacoes },
        ] : []}
      />
    </div>
  );
}

