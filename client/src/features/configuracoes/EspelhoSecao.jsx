import { useEffect, useState } from "react";
import { ScrollText, Check, AlertTriangle } from "lucide-react";
import { apiGetEspelhoConfig, apiSimularEspelhoConfig, apiSetEspelhoConfig, apiResetEspelhoConfig } from "../../api/configuracoes.js";
import { Field } from "../../components/common/Field.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function EspelhoSecao() {
  const [cfg, setCfg] = useState(null);
  const [erro, setErro] = useState("");
  const [dias, setDias] = useState("");
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null); // { dias, apagariam } — confirmação antes de diminuir o prazo

  const aplicar = (c) => { setCfg(c); setDias(String(c.retencaoDias)); };
  useEffect(() => {
    apiGetEspelhoConfig().then(aplicar).catch((e) => setErro(e.message));
  }, []);

  const [min, max] = cfg?.faixa || [1, 365];
  const n = Number(dias);
  const valido = Number.isInteger(n) && n >= min && n <= max;
  const mudou = cfg && valido && n !== cfg.retencaoDias;

  const gravar = async (valor) => {
    setSalvando(true); setMsg(null);
    try {
      const r = await apiSetEspelhoConfig(valor);
      aplicar(r);
      setMsg({ ok: true, t: r.apagados ? `Prazo salvo. ${plural(r.apagados, "espelho que já passou", "espelhos que já passaram")} do novo prazo ${r.apagados === 1 ? "foi apagado" : "foram apagados"}.` : "Prazo salvo. Já vale para todos os espelhos." });
    } catch (e) { setMsg({ ok: false, t: e.message }); }
    setSalvando(false);
  };

  const salvar = async () => {
    setMsg(null);
    if (!valido) { setMsg({ ok: false, t: `Informe um número inteiro de dias entre ${min} e ${max}.` }); return; }
    if (n < cfg.retencaoDias) {
      // Diminuiu o prazo: pode apagar espelhos que hoje ainda estão valendo. Avisa quantos.
      try {
        const r = await apiSimularEspelhoConfig(n);
        if (r.apagariam > 0) { setAviso(r); return; }
      } catch (e) { setMsg({ ok: false, t: e.message }); return; }
    }
    gravar(n);
  };

  const restaurar = async () => {
    setMsg(null);
    try {
      const r = await apiResetEspelhoConfig();
      aplicar(r);
      setMsg({ ok: true, t: `Voltou para o padrão (${r.padrao} dias).` });
    } catch (e) { setMsg({ ok: false, t: e.message }); }
  };

  if (erro) return <div className="backup-section"><p className="duplicate-warning">{erro}</p></div>;
  if (!cfg) return <div className="backup-section"><p>Carregando...</p></div>;

  return (
    <div className="backup-section">
      <h3><ScrollText size={16} /> Validade do Espelho</h3>
      <p>Cada espelho salvo some sozinho depois de {plural(cfg.retencaoDias, "dia", "dias")}. A contagem começa no dia em que o espelho foi <strong>criado</strong> (não na data de veiculação) e editar o espelho não renova o prazo.</p>
      <div className="backup-config-row">
        <Field label="Guardar cada espelho por (dias)">
          <input type="number" min={min} max={max} step="1" value={dias} onChange={(e) => setDias(e.target.value)} />
        </Field>
      </div>
      {!valido && (
        <p className="duplicate-warning" role="alert"><AlertTriangle size={15} /> <span>Informe um número inteiro de dias entre {min} e {max}.</span></p>
      )}
      <p className="armaz-legenda">Padrão do sistema: {cfg.padrao} dias. Pode ser de {min} a {max} dias. Se diminuir o prazo, os espelhos que já passaram dele são apagados na hora e não voltam.</p>
      <div className="drawer-actions" style={{ marginTop: 4 }}>
        <button className="btn-ghost" onClick={restaurar} disabled={salvando}>Voltar ao padrão</button>
        <button className="btn-primary" onClick={salvar} disabled={salvando || !mudou}>{salvando ? "Salvando..." : "Salvar prazo"}</button>
      </div>
      {msg && (
        <p className={msg.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={15} />} <span>{msg.t}</span>
        </p>
      )}
      <ConfirmDialog
        open={!!aviso}
        title="Diminuir o prazo?"
        message={aviso && `Com ${plural(aviso.dias, "dia", "dias")}, ${plural(aviso.apagariam, "espelho salvo que já passou", "espelhos salvos que já passaram")} do prazo ${aviso.apagariam === 1 ? "será apagado" : "serão apagados"} agora e não ${aviso.apagariam === 1 ? "volta" : "voltam"}.`}
        confirmLabel="Diminuir e apagar"
        cancelLabel="Cancelar"
        onCancel={() => setAviso(null)}
        onConfirm={() => { const d = aviso.dias; setAviso(null); gravar(d); }}
      />
    </div>
  );
}
