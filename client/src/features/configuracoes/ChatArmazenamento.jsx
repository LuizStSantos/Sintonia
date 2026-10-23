import { useEffect, useState } from "react";
import { MessageCircle, Check, AlertTriangle } from "lucide-react";
import { apiGetChatArmazenamento, apiSetChatLimites, apiResetChatLimites } from "../../api/configuracoes.js";
import { Field } from "../../components/common/Field.jsx";

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

export function ChatArmazenamento() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ maxMB: "", retencaoDias: "", quotaGB: "" });
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const aplicar = (r) => {
    setD(r);
    setF({ maxMB: String(r.maxMB), retencaoDias: String(r.retencaoDias), quotaGB: String(r.quotaGB) });
  };
  useEffect(() => {
    apiGetChatArmazenamento().then(aplicar).catch((e) => setErro(e.message));
  }, []);

  const salvar = async () => {
    const diminuiu = Number(f.retencaoDias) < d.retencaoDias || Number(f.quotaGB) < d.quotaGB;
    if (diminuiu && !window.confirm("Você diminuiu o prazo ou o limite. Anexos que já passaram do novo prazo/limite serão APAGADOS agora e não voltam. Continuar?")) return;
    setSalvando(true); setMsg(null);
    try {
      aplicar(await apiSetChatLimites(f));
      setMsg({ ok: true, t: "Regras salvas. Já valem para novos envios e para a limpeza automática." });
    } catch (e) { setMsg({ ok: false, t: e.message }); }
    setSalvando(false);
  };
  const restaurar = async () => {
    setMsg(null);
    try { aplicar(await apiResetChatLimites()); setMsg({ ok: true, t: "Voltou para as regras padrão." }); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
  };

  if (erro) return <div className="backup-section"><p className="duplicate-warning">{erro}</p></div>;
  if (!d) return <div className="backup-section"><p>Carregando...</p></div>;

  const teto = d.quotaGB * 1024 ** 3;
  const pct = Math.min(100, Math.round((d.anexosBytes / teto) * 100));
  return (
    <>
      <div className="backup-section">
        <h3><MessageCircle size={16} /> Espaço ocupado pelo chat</h3>
        <p>Anexos (fotos, vídeos, áudios e arquivos enviados no chat) ocupam espaço no servidor. Eles são apagados automaticamente depois de {d.retencaoDias} dias e, se a pasta passar do limite, os mais antigos saem primeiro. As mensagens de texto continuam.</p>
        <div className="armaz-barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`armaz-barra-cheia${pct >= 90 ? " alerta" : ""}`} style={{ width: `${Math.max(pct, d.anexosBytes ? 2 : 0)}%` }} />
        </div>
        <p className="armaz-legenda"><strong>{fmt(d.anexosBytes)}</strong> de {d.quotaGB} GB usados pelos anexos ({pct}%)</p>
        <div className="backup-contagens">
          <div className="backup-contagem"><b>{d.mensagens}</b><span>Mensagens</span></div>
          <div className="backup-contagem"><b>{d.conversas}</b><span>Conversas</span></div>
          <div className="backup-contagem"><b>{d.anexosArquivos}</b><span>Anexos guardados</span></div>
          <div className="backup-contagem"><b>{fmt(d.anexosBytes)}</b><span>Tamanho dos anexos</span></div>
          <div className="backup-contagem"><b>{fmt(d.bancoBytes)}</b><span>Banco de dados (tudo)</span></div>
        </div>
      </div>
      <div className="backup-section">
        <h3>Regras dos anexos</h3>
        <p>Você pode ajustar aqui. Vale na hora para os próximos envios e para a limpeza automática (que roda a cada hora e também ao salvar). Se diminuir o prazo ou o limite, anexos mais antigos serão apagados.</p>
        <div className="backup-config-row">
          <Field label="Tamanho máximo de cada anexo (MB)"><input type="number" min="1" max="1000" value={f.maxMB} onChange={(e) => setF({ ...f, maxMB: e.target.value })} /></Field>
          <Field label="Guardar anexos por (dias)"><input type="number" min="1" max="365" value={f.retencaoDias} onChange={(e) => setF({ ...f, retencaoDias: e.target.value })} /></Field>
          <Field label="Limite total de anexos (GB)"><input type="number" min="1" max="2000" value={f.quotaGB} onChange={(e) => setF({ ...f, quotaGB: e.target.value })} /></Field>
        </div>
        <p className="armaz-legenda">Padrão do sistema: {d.padroes.maxMB} MB · {d.padroes.retencaoDias} dias · {d.padroes.quotaGB} GB. Mensagens de texto nunca são apagadas por essas regras. Atenção: se o servidor estiver atrás de um proxy (Nginx, Cloudflare), ele pode ter o próprio limite de envio, menor que o daqui.</p>
        <div className="drawer-actions" style={{ marginTop: 4 }}>
          <button className="btn-ghost" onClick={restaurar}>Voltar ao padrão</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar regras"}</button>
        </div>
        {msg && (
          <p className={msg.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
            {msg.ok ? <Check size={13} /> : <AlertTriangle size={15} />} <span>{msg.t}</span>
          </p>
        )}
      </div>
    </>
  );
}
