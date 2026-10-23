import { useEffect, useState } from "react";
import { Mail, Check, AlertTriangle } from "lucide-react";
import { apiGetSmtp, apiSetSmtp, apiClearSmtp } from "../../api/configuracoes.js";
import { Field } from "../../components/common/Field.jsx";

const PRESETS = {
  gmail: { host: "smtp.gmail.com", port: 587, label: "Gmail" },
  outlook: { host: "smtp-mail.outlook.com", port: 587, label: "Outlook / Hotmail" },
  outro: { host: "", port: 587, label: "Outro" },
};

export function SmtpCard({ onChange }) {
  const [f, setF] = useState({ host: "", port: 587, usuario: "", senha: "", remetente: "" });
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const aplicar = (s) => {
    setInfo(s);
    setF({ host: s.host || "", port: s.port || 587, usuario: s.usuario || "", senha: "", remetente: s.remetente || "" });
  };
  useEffect(() => { apiGetSmtp().then(aplicar).catch(() => {}); }, []);

  const salvar = async () => {
    setSalvando(true); setMsg(null);
    try {
      aplicar(await apiSetSmtp(f));
      setMsg({ ok: true, t: "Dados do e-mail salvos. Agora use \"Enviar teste agora\" mais abaixo para conferir." });
      onChange?.();
    } catch (e) { setMsg({ ok: false, t: e.message }); }
    setSalvando(false);
  };
  const remover = async () => {
    setMsg(null);
    try { aplicar(await apiClearSmtp()); setMsg({ ok: true, t: "Dados do e-mail removidos." }); onChange?.(); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
  };
  const preset = (k) => setF((x) => ({ ...x, host: PRESETS[k].host || x.host, port: PRESETS[k].port }));

  return (
    <div className="backup-section">
      <h3><Mail size={16} /> Servidor de e-mail (quem envia o backup)</h3>
      <p>
        Informe o e-mail que vai <strong>enviar</strong> o backup. Para Gmail, crie uma <em>senha de app</em> (Conta Google → Segurança → Verificação em duas etapas → Senhas de app) e use ela aqui — não a senha normal.
        A senha é guardada cifrada no servidor e não aparece mais depois de salva.
        {info?.origemAtiva === "servidor" && " Hoje o envio está usando os dados do docker-compose.yml; o que você salvar aqui passa a valer no lugar."}
      </p>
      <div className="backup-presets">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} type="button" className="btn-ghost" onClick={() => preset(k)}>{p.label}</button>
        ))}
      </div>
      <div className="backup-config-row">
        <Field label="Servidor (SMTP)"><input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="smtp.gmail.com" /></Field>
        <Field label="Porta"><input type="number" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} /></Field>
      </div>
      <div className="backup-config-row">
        <Field label="E-mail que envia (usuário)"><input value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} placeholder="seuemail@gmail.com" autoComplete="off" /></Field>
        <Field label={info?.senhaDefinida ? "Senha de app (deixe vazio para manter a atual)" : "Senha de app"}>
          <input type="password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} placeholder={info?.senhaDefinida ? "••••••••••••" : "xxxx xxxx xxxx xxxx"} autoComplete="new-password" />
        </Field>
      </div>
      <Field label="Nome/e-mail que aparece como remetente (opcional)">
        <input value={f.remetente} onChange={(e) => setF({ ...f, remetente: e.target.value })} placeholder="Sintonia <seuemail@gmail.com>" />
      </Field>
      <div className="drawer-actions" style={{ marginTop: 4 }}>
        {info?.senhaDefinida && <button className="btn-ghost" onClick={remover}>Remover dados salvos</button>}
        <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar e-mail"}</button>
      </div>
      {msg && (
        <p className={msg.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={15} />} <span>{msg.t}</span>
        </p>
      )}
    </div>
  );
}
