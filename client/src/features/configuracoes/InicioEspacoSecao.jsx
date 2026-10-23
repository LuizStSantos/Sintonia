import { useEffect, useState } from "react";
import { HardDrive, Check, AlertTriangle } from "lucide-react";
import { apiGetInicioEspaco, apiSetInicioEspaco, apiResetInicioEspaco } from "../../api/configuracoes.js";
import { Field } from "../../components/common/Field.jsx";
import { formatarBytes } from "../inicio/EditorCartao.jsx";

export function InicioEspacoSecao() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [v, setV] = useState("");
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const aplicar = (r) => { setD(r); setV(String(r.quotaGB).replace(".", ",")); };
  useEffect(() => { apiGetInicioEspaco().then(aplicar).catch((e) => setErro(e.message)); }, []);

  const acao = async (fn, texto) => {
    setSalvando(true); setMsg(null);
    try { aplicar(await fn()); setMsg({ ok: true, t: texto }); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
    setSalvando(false);
  };

  if (erro) return <div className="backup-section"><p className="duplicate-warning">{erro}</p></div>;
  if (!d) return <div className="backup-section"><p>Carregando...</p></div>;
  const [min, max] = d.faixa;
  const fmtGb = (n) => String(n).replace(".", ",");
  return (
    <div className="backup-section">
      <h3><HardDrive size={16} /> Espaço para fotos e vídeos no Início</h3>
      <p>Define quantos GB cada usuário pode guardar com fotos e vídeos enviados nos cartões do Início. Quem encher o espaço não consegue enviar mais até apagar algum cartão; colar um link não gasta espaço. O limite vale para cada pessoa, separadamente.</p>
      <div className="backup-config-row">
        <Field label="Espaço por usuário (GB)">
          <input value={v} inputMode="decimal" maxLength={7} onChange={(e) => setV(e.target.value.replace(/[^0-9,.]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") acao(() => apiSetInicioEspaco(v), "Limite salvo."); }} />
        </Field>
      </div>
      <p className="armaz-legenda">Padrão do sistema: {fmtGb(d.padrao)} GB. Pode ser de {fmtGb(min)} a {max} GB. Diminuir o limite não apaga nada que já foi enviado: só impede novos envios de quem já passou dele.</p>
      <p className="armaz-legenda">Total usado por todos: <strong>{formatarBytes(d.totalBytes)}</strong>.</p>
      {d.usuarios.length > 0 && (
        <div className="inicio-espaco-lista">
          {d.usuarios.map((u) => {
            const pct = Math.min(100, (u.bytes / (d.quotaGB * 1024 ** 3)) * 100);
            return (
              <div key={u.usuario} className="inicio-espaco-linha">
                <span className="inicio-espaco-nome">{u.usuario}</span>
                <div className="armaz-barra"><div className={`armaz-barra-cheia${pct >= 90 ? " alerta" : ""}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                <span className="inicio-espaco-uso">{formatarBytes(u.bytes)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="drawer-actions" style={{ marginTop: 4 }}>
        <button className="btn-ghost" disabled={salvando || d.quotaGB === d.padrao} onClick={() => acao(apiResetInicioEspaco, "Voltou para o padrão.")}>Voltar ao padrão</button>
        <button className="btn-primary" disabled={salvando || Number(v.replace(",", ".")) === d.quotaGB} onClick={() => acao(() => apiSetInicioEspaco(v), "Limite salvo.")}>{salvando ? "Salvando..." : "Salvar limite"}</button>
      </div>
      {msg && (
        <p className={msg.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={15} />} <span>{msg.t}</span>
        </p>
      )}
    </div>
  );
}
