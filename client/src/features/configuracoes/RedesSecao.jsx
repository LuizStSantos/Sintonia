import { useEffect, useState } from "react";
import { Share2, Check, AlertTriangle, X } from "lucide-react";
import { apiGetRedes, apiSetRedes, apiResetRedes } from "../../api/configuracoes.js";

export function RedesSecao() {
  const [cfg, setCfg] = useState(null);
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { apiGetRedes().then(setCfg).catch((e) => setErro(e.message)); }, []);

  const gravar = async (lista, texto) => {
    setMsg(null);
    try { setCfg(await apiSetRedes(lista)); setMsg({ ok: true, t: texto }); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
  };
  const adicionar = () => {
    const n = nova.trim();
    if (!n) return;
    if (cfg.redes.some((r) => r.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"))) { setMsg({ ok: false, t: "Essa rede já está na lista." }); return; }
    gravar([...cfg.redes, n], `${n} adicionada.`).then(() => setNova(""));
  };
  const remover = (r) => {
    if (cfg.redes.length <= 1) { setMsg({ ok: false, t: "Deixe pelo menos uma rede na lista." }); return; }
    gravar(cfg.redes.filter((x) => x !== r), `${r} removida da lista. Quem já foi marcado com ela continua marcado.`);
  };
  const restaurar = async () => {
    setMsg(null);
    try { setCfg(await apiResetRedes()); setMsg({ ok: true, t: "Voltou para a lista padrão." }); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
  };

  if (erro) return <div className="backup-section"><p className="duplicate-warning">{erro}</p></div>;
  if (!cfg) return <div className="backup-section"><p>Carregando...</p></div>;
  return (
    <div className="backup-section">
      <h3><Share2 size={16} /> Redes sociais</h3>
      <p>Estas são as redes que aparecem como botões em Matérias e Entrevistados, para marcar onde e quando foi publicado. Você pode acrescentar outras ou tirar as que não usa.</p>
      <div className="redes-edit-lista">
        {cfg.redes.map((r) => (
          <span key={r} className="date-chip">{r}
            <button type="button" onClick={() => remover(r)} aria-label={`Remover ${r}`}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="date-add-row redes-add-row">
        <input value={nova} maxLength={30} placeholder="Nova rede (ex.: Threads)" onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} />
        <button type="button" className="btn-primary" onClick={adicionar} disabled={!nova.trim()}>Adicionar</button>
        <button type="button" className="btn-ghost" onClick={restaurar}>Voltar ao padrão</button>
      </div>
      {msg && (
        <p className={msg.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={15} />} <span>{msg.t}</span>
        </p>
      )}
    </div>
  );
}
