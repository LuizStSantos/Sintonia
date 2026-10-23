import { useEffect, useMemo, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { formatDateBR, MONTHS, todayISO } from "../../lib/dates.js";
import { Badge } from "../../components/common/Badge.jsx";
import { Select } from "../../components/common/Select.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";

export function EspelhoEntrevistadosModal({ open, onClose, entrevistadosItems, idsJaAdicionados, programaSigla, dataEspelho, onConfirm }) {
  const [search, setSearch] = useState("");
  const [modalidadeFilter, setModalidadeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [confirmRepeticao, setConfirmRepeticao] = useState(null); // entrevistados já veiculados nesse programa, ou null

  useEffect(() => {
    if (open) {
      setSelecionadas(new Set());
      setSearch("");
      setModalidadeFilter("");
      setYearFilter("");
      setMonthFilter("");
      setConfirmRepeticao(null);
    }
  }, [open]);

  // Datas em que esse entrevistado já foi veiculado nesse mesmo programa (as
  // marcadas na ficha dele ou gravadas por espelhos anteriores), menos o dia
  // deste próprio espelho — usado pra avisar de repetição, igual às matérias.
  const veiculacoesNoPrograma = (v) => {
    if (!programaSigla) return [];
    return (v.datasVeiculacao || [])
      .filter((dv) => dv.local === programaSigla && dv.data !== dataEspelho)
      .map((dv) => dv.data)
      .sort();
  };

  const disponiveis = useMemo(() => (entrevistadosItems || []).filter((v) => !idsJaAdicionados.has(v.id)), [entrevistadosItems, idsJaAdicionados]);

  const yearOptions = useMemo(() => {
    const years = new Set(disponiveis.map((v) => (v.data || "").slice(0, 4)).filter(Boolean));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [disponiveis]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hojeISO = todayISO();
    // Mais recente primeiro (datas futuras no topo); no mesmo dia, pelo horário
    // (do mais cedo pro mais tarde); sem data vai pro final.
    const ordenada = [...disponiveis].sort((a, b) => {
      if (!a.data && !b.data) return (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "", "pt-BR");
      if (!a.data) return 1;
      if (!b.data) return -1;
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return (a.horario || "").localeCompare(b.horario || "");
    });
    return ordenada.filter((v) => {
      const haystack = `${v.nomeCompleto || ""} ${v.funcao || ""}`.toLowerCase();
      const matchSearch = !q || haystack.includes(q);
      const matchModalidade = !modalidadeFilter || v.modalidade === modalidadeFilter;
      const matchYear = !yearFilter || (v.data || "").slice(0, 4) === yearFilter;
      const matchMonth = !monthFilter || (v.data || "").slice(5, 7) === monthFilter;
      return matchSearch && matchModalidade && matchYear && matchMonth;
    });
  }, [disponiveis, search, modalidadeFilter, yearFilter, monthFilter]);
  const hoje = todayISO();

  const toggleSelecao = (id) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const executarConfirmacao = (escolhidos) => {
    onConfirm(escolhidos);
    onClose();
  };

  const confirmar = () => {
    const escolhidos = disponiveis.filter((v) => selecionadas.has(v.id));
    const repetidos = escolhidos.filter((v) => veiculacoesNoPrograma(v).length > 0);
    if (repetidos.length > 0) {
      setConfirmRepeticao({ escolhidos, repetidos });
      return;
    }
    executarConfirmacao(escolhidos);
  };

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="espelho-modal" onClick={(e) => e.stopPropagation()}>
        <div className="espelho-modal-header">
          <h3>Adicionar entrevistados</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="espelho-modal-filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou função..."
            autoFocus
          />
          <Select value={modalidadeFilter} onChange={(e) => setModalidadeFilter(e.target.value)}>
            <option value="">Todas as modalidades</option>
            <option value="Presencial">Presencial</option>
            <option value="Online">Online</option>
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
          {filtradas.length === 0 && <p className="empty-row">Nenhum entrevistado encontrado.</p>}
          {filtradas.map((v) => {
            const repeticoes = veiculacoesNoPrograma(v);
            return (
            <label key={v.id} className={`espelho-modal-row${v.data === hoje ? " espelho-modal-row-hoje" : ""}`}>
              <input type="checkbox" className="app-checkbox" checked={selecionadas.has(v.id)} onChange={() => toggleSelecao(v.id)} />
              <span className="espelho-modal-row-titulo">
                {v.nomeCompleto}{v.funcao ? ` — ${v.funcao}` : ""}
                {repeticoes.length > 0 && (
                  <span className="espelho-modal-row-repetida" title={`Já veiculado nesse programa em: ${repeticoes.map(formatDateBR).join(", ")}`}>
                    <AlertTriangle size={12} /> já veiculado em {repeticoes.map(formatDateBR).join(", ")}
                  </span>
                )}
              </span>
              <Badge label={v.modalidade || "Presencial"} tone={v.modalidade === "Online" ? "blue" : "gray"} />
              {v.data === hoje && <Badge label="HOJE" tone="red" />}
              <span className="espelho-modal-row-duracao">{v.data ? formatDateBR(v.data) : "—"}{v.horario ? ` ${v.horario}` : ""}{v.duracao ? ` · ${v.duracao}` : ""}</span>
            </label>
            );
          })}
        </div>
        <div className="espelho-modal-footer">
          <span className="espelho-modal-count">{selecionadas.size} selecionado{selecionadas.size !== 1 ? "s" : ""}</span>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={selecionadas.size === 0}>
            Adicionar selecionados
          </button>
        </div>
      </div>

      {confirmRepeticao && (
        <ConfirmDialog
          open={!!confirmRepeticao}
          title="Entrevistado já veiculado nesse programa"
          message={
            <>
              {confirmRepeticao.repetidos.length === 1 ? "Este entrevistado já foi veiculado" : "Estes entrevistados já foram veiculados"} nesse
              programa antes:
              <ul className="espelho-repeticao-lista">
                {confirmRepeticao.repetidos.map((v) => (
                  <li key={v.id}>
                    <strong>{v.nomeCompleto}</strong> — {veiculacoesNoPrograma(v).map(formatDateBR).join(", ")}
                  </li>
                ))}
              </ul>
              Quer adicionar mesmo assim?
            </>
          }
          confirmLabel="Adicionar mesmo assim"
          onCancel={() => setConfirmRepeticao(null)}
          onConfirm={() => {
            executarConfirmacao(confirmRepeticao.escolhidos);
            setConfirmRepeticao(null);
          }}
        />
      )}
    </div>
  );
}

// Popup do item manual — mostra os modelos salvos (com checkbox pra marcar
// vários de uma vez) e, junto, uma seção pra criar um item novo na hora
// (que também pode ser salvo como modelo pra próxima vez).
