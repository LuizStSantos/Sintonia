import { DurationInput } from "../../components/common/MaskedInputs.jsx";
import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { ESPELHO_LABELS_PRESET } from "../../lib/espelho.js";
import { Select } from "../../components/common/Select.jsx";

export function EspelhoItemManualModal({ open, onClose, modelos, onConfirm, onSalvarModelo, onRemoverModelo }) {
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [novoLabel, setNovoLabel] = useState(ESPELHO_LABELS_PRESET[0]);
  const [novoLabelOutro, setNovoLabelOutro] = useState("");
  const [novoDuracao, setNovoDuracao] = useState("");
  const [novoTexto, setNovoTexto] = useState("");
  const [salvarComoModeloChecked, setSalvarComoModeloChecked] = useState(false);
  // id do modelo que está sendo editado no formulário "criar item novo" (null
  // = formulário em branco, criando um item do zero). Ver editarModelo() logo
  // abaixo — é o que resolve "preciso editar um modelo antes de adicionar".
  const [editandoModeloId, setEditandoModeloId] = useState(null);

  useEffect(() => {
    if (open) {
      setSelecionados(new Set());
      setNovoLabel(ESPELHO_LABELS_PRESET[0]);
      setNovoLabelOutro("");
      setNovoDuracao("");
      setNovoTexto("");
      setSalvarComoModeloChecked(false);
      setEditandoModeloId(null);
    }
  }, [open]);

  const toggleSelecao = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Carrega um modelo salvo no formulário "criar item novo" pra poder ajustar
  // o texto (ou a retranca/duração) antes de adicionar ao roteiro — sem isso,
  // só dava pra usar o modelo exatamente como foi salvo, ou editar o item
  // depois de já estar no roteiro. Desmarca o modelo da lista de selecionados
  // (ele deixa de ser "adicionar como está" e passa a ser "adicionar a versão
  // editada abaixo"). Se a pessoa deixar "salvar como modelo" marcado, o
  // salvarModelo() do EspelhoTab já atualiza esse mesmo modelo (por ter o
  // mesmo nome) em vez de criar um duplicado.
  const editarModelo = (m) => {
    setSelecionados((prev) => { const next = new Set(prev); next.delete(m.id); return next; });
    const presetMatch = ESPELHO_LABELS_PRESET.includes(m.nome);
    setNovoLabel(presetMatch ? m.nome : "Outro");
    setNovoLabelOutro(presetMatch ? "" : m.nome);
    setNovoDuracao("");
    setNovoTexto(m.texto);
    setSalvarComoModeloChecked(true);
    setEditandoModeloId(m.id);
  };

  const novoLabelFinal = novoLabel === "Outro" ? novoLabelOutro.trim() : novoLabel;
  const temNovoItem = !!(novoLabelFinal && novoTexto.trim());
  const totalSelecionados = selecionados.size + (temNovoItem ? 1 : 0);

  const confirmar = () => {
    const itens = (modelos || [])
      .filter((m) => selecionados.has(m.id))
      .map((m) => ({ retranca: m.nome, duracao: "", texto: m.texto }));
    if (temNovoItem) {
      itens.push({ retranca: novoLabelFinal, duracao: novoDuracao.trim(), texto: novoTexto.trim() });
      if (salvarComoModeloChecked) onSalvarModelo(novoLabelFinal, novoTexto.trim());
    }
    if (itens.length === 0) return;
    onConfirm(itens);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="espelho-modal" onClick={(e) => e.stopPropagation()}>
        <div className="espelho-modal-header">
          <h3>Adicionar item manual</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="espelho-modal-list">
          {(modelos || []).length === 0 ? (
            <p className="empty-row">Nenhum modelo salvo ainda — crie um item novo abaixo e marque "salvar como modelo".</p>
          ) : (
            modelos.map((m) => (
              <label key={m.id} className="espelho-modal-row">
                <input type="checkbox" className="app-checkbox" checked={selecionados.has(m.id)} onChange={() => toggleSelecao(m.id)} />
                <span className="espelho-modal-row-titulo">
                  <strong>{m.nome}</strong>
                  <span className="espelho-itemmanual-preview">{m.texto}</span>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); editarModelo(m); }}
                  aria-label={`Editar modelo ${m.nome}`}
                  title="Editar antes de adicionar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoverModelo(m.id); }}
                  aria-label={`Excluir modelo ${m.nome}`}
                >
                  <Trash2 size={14} />
                </button>
              </label>
            ))
          )}
        </div>

        <div className="espelho-itemmanual-novo">
          {editandoModeloId ? (
            <h4>
              Editando modelo "{novoLabel === "Outro" ? novoLabelOutro : novoLabel}"{" "}
              <button
                type="button"
                className="btn-ghost espelho-itemmanual-cancelar-edicao"
                onClick={() => {
                  setEditandoModeloId(null);
                  setNovoLabel(ESPELHO_LABELS_PRESET[0]);
                  setNovoLabelOutro("");
                  setNovoDuracao("");
                  setNovoTexto("");
                  setSalvarComoModeloChecked(false);
                }}
              >
                Cancelar edição
              </button>
            </h4>
          ) : (
            <h4>Ou criar um item novo</h4>
          )}
          <div className="espelho-custom-row">
            <Select value={novoLabel} onChange={(e) => setNovoLabel(e.target.value)}>
              {ESPELHO_LABELS_PRESET.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="Outro">Outro...</option>
            </Select>
            {novoLabel === "Outro" && (
              <input className="espelho-custom-nome" value={novoLabelOutro} onChange={(e) => setNovoLabelOutro(e.target.value)} placeholder="Nome do item" />
            )}
            <DurationInput className="espelho-custom-duracao" value={novoDuracao} onChange={setNovoDuracao} placeholder="Duração (opcional)" />
          </div>
          <textarea spellCheck lang="pt-BR" value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Texto..." rows={3} />
          <label className="espelho-itemmanual-salvar-check">
            <input type="checkbox" className="app-checkbox" checked={salvarComoModeloChecked} onChange={(e) => setSalvarComoModeloChecked(e.target.checked)} />
            <span>{editandoModeloId ? "Salvar as alterações nesse modelo" : "Salvar como modelo reutilizável"}</span>
          </label>
          {editandoModeloId && !salvarComoModeloChecked && (
            <p className="field-hint">Sem marcar, essa edição vale só pra esse item agora — o modelo salvo continua como estava.</p>
          )}
        </div>

        <div className="espelho-modal-footer">
          <span className="espelho-modal-count">{totalSelecionados} selecionado{totalSelecionados !== 1 ? "s" : ""}</span>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={totalSelecionados === 0}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

