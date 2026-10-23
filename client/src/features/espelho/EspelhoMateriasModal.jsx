import { useEffect, useMemo, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { MONTHS, formatDateBR } from "../../lib/dates.js";
import { VIDEO_STATUS } from "../../lib/constants.js";
import { Badge } from "../../components/common/Badge.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { Select } from "../../components/common/Select.jsx";

export function EspelhoMateriasModal({ open, onClose, videosItems, idsJaAdicionados, programaSigla, onConfirm }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [confirmRepeticao, setConfirmRepeticao] = useState(null); // lista de matérias repetidas, ou null

  useEffect(() => {
    if (open) {
      setSelecionadas(new Set());
      setSearch("");
      setStatusFilter("");
      setYearFilter("");
      setMonthFilter("");
      setConfirmRepeticao(null);
    }
  }, [open]);

  // Datas em que essa matéria já foi veiculada nesse mesmo programa antes
  // (em qualquer dia, não só hoje) — usado pra avisar de repetição antes de
  // adicionar de novo.
  const veiculacoesNoPrograma = (v) => {
    if (!programaSigla) return [];
    return (v.datasVeiculacao || [])
      .filter((dv) => dv.local === programaSigla)
      .map((dv) => dv.data)
      .sort();
  };

  const disponiveis = useMemo(() => (videosItems || []).filter((v) => !idsJaAdicionados.has(v.id)), [videosItems, idsJaAdicionados]);

  const yearOptions = useMemo(() => {
    const years = new Set(disponiveis.map((v) => (v.entrada || "").slice(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [disponiveis]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return disponiveis.filter((v) => {
      const matchSearch = !q || v.titulo?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || v.status === statusFilter;
      const matchYear = !yearFilter || (v.entrada || "").slice(0, 4) === yearFilter;
      const matchMonth = !monthFilter || (v.entrada || "").slice(5, 7) === monthFilter;
      return matchSearch && matchStatus && matchYear && matchMonth;
    });
  }, [disponiveis, search, statusFilter, yearFilter, monthFilter]);

  const toggleSelecao = (id) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const executarConfirmacao = (escolhidas) => {
    onConfirm(escolhidas);
    onClose();
  };

  const confirmar = () => {
    const escolhidas = disponiveis.filter((v) => selecionadas.has(v.id));
    const repetidas = escolhidas.filter((v) => veiculacoesNoPrograma(v).length > 0);
    if (repetidas.length > 0) {
      setConfirmRepeticao({ escolhidas, repetidas });
      return;
    }
    executarConfirmacao(escolhidas);
  };

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="espelho-modal" onClick={(e) => e.stopPropagation()}>
        <div className="espelho-modal-header">
          <h3>Adicionar matérias</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="espelho-modal-filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            autoFocus
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.keys(VIDEO_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">Todos os anos</option>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">Todos os meses</option>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </div>
        <div className="espelho-modal-list">
          {filtradas.length === 0 && <p className="empty-row">Nenhuma matéria encontrada.</p>}
          {filtradas.map((v) => {
            const repeticoes = veiculacoesNoPrograma(v);
            return (
              <label key={v.id} className="espelho-modal-row">
                <input type="checkbox" className="app-checkbox" checked={selecionadas.has(v.id)} onChange={() => toggleSelecao(v.id)} />
                <span className="espelho-modal-row-titulo">
                  {v.titulo}
                  {repeticoes.length > 0 && (
                    <span className="espelho-modal-row-repetida" title={`Já veiculada nesse programa em: ${repeticoes.map(formatDateBR).join(", ")}`}>
                      <AlertTriangle size={12} /> já veiculada em {repeticoes.map(formatDateBR).join(", ")}
                    </span>
                  )}
                </span>
                <Badge label={v.status} tone={VIDEO_STATUS[v.status] || "gray"} />
                <span className="espelho-modal-row-duracao">{v.duracao || "—"}</span>
              </label>
            );
          })}
        </div>
        <div className="espelho-modal-footer">
          <span className="espelho-modal-count">{selecionadas.size} selecionada{selecionadas.size !== 1 ? "s" : ""}</span>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={selecionadas.size === 0}>
            Adicionar selecionadas
          </button>
        </div>
      </div>

      {confirmRepeticao && (
        <ConfirmDialog
          open={!!confirmRepeticao}
          title="Matéria já veiculada nesse programa"
          message={
            <>
              {confirmRepeticao.repetidas.length === 1 ? "Esta matéria já foi veiculada" : "Estas matérias já foram veiculadas"} nesse
              programa antes:
              <ul className="espelho-repeticao-lista">
                {confirmRepeticao.repetidas.map((v) => (
                  <li key={v.id}>
                    <strong>{v.titulo}</strong> — {veiculacoesNoPrograma(v).map(formatDateBR).join(", ")}
                  </li>
                ))}
              </ul>
              Quer adicionar mesmo assim?
            </>
          }
          confirmLabel="Adicionar mesmo assim"
          onCancel={() => setConfirmRepeticao(null)}
          onConfirm={() => {
            executarConfirmacao(confirmRepeticao.escolhidas);
            setConfirmRepeticao(null);
          }}
        />
      )}
    </div>
  );
}

// Mesma ideia do modal de matérias, mas pros Entrevistados: busca por nome
// ou função, filtro por modalidade, ano e mês (baseado na data da
// entrevista), com seleção múltipla.
