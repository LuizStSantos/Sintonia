import { useEffect, useMemo, useState } from "react";
import { Globe, Check, AlertTriangle } from "lucide-react";
import { apiGetFuso, apiSetFuso, apiResetFuso } from "../../api/configuracoes.js";
import { Field } from "../../components/common/Field.jsx";
import { Select } from "../../components/common/Select.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { deslocamento } from "../../lib/fuso.js";

const BRASIL = [
  ["America/Sao_Paulo", "Brasília (SP, RJ, MG, GO, DF, sul e sudeste)"],
  ["America/Bahia", "Bahia"],
  ["America/Fortaleza", "Fortaleza (CE, MA, PI, RN, PB, SE)"],
  ["America/Recife", "Recife (PE)"],
  ["America/Belem", "Belém (PA, AP)"],
  ["America/Maceio", "Maceió (AL)"],
  ["America/Araguaina", "Araguaína (TO)"],
  ["America/Cuiaba", "Cuiabá (MT)"],
  ["America/Campo_Grande", "Campo Grande (MS)"],
  ["America/Manaus", "Manaus (AM)"],
  ["America/Porto_Velho", "Porto Velho (RO)"],
  ["America/Boa_Vista", "Boa Vista (RR)"],
  ["America/Rio_Branco", "Rio Branco (AC)"],
  ["America/Noronha", "Fernando de Noronha"],
];

function nomeFuso(z) {
  const br = BRASIL.find(([id]) => id === z);
  return br ? br[1] : z.replace(/_/g, " ");
}

export function GeralSecao() {
  const [cfg, setCfg] = useState(null);
  const [erro, setErro] = useState("");
  const [escolha, setEscolha] = useState("");
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    apiGetFuso().then((c) => { setCfg(c); setEscolha(c.fuso); }).catch((e) => setErro(e.message));
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const opcoes = useMemo(() => {
    const ids = new Set(BRASIL.map(([id]) => id));
    let todos = [];
    try { todos = Intl.supportedValuesOf("timeZone"); } catch { /* navegador antigo */ }
    const outros = ["UTC", ...todos.filter((z) => z !== "UTC" && !ids.has(z))];
    const lista = [...BRASIL.map(([id]) => id), ...outros];
    if (cfg && !lista.includes(cfg.fuso)) lista.unshift(cfg.fuso);
    return lista;
  }, [cfg]);

  const horaNo = (z) => {
    try { return new Intl.DateTimeFormat("pt-BR", { timeZone: z, weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(agora); }
    catch { return "—"; }
  };

  if (erro) return <div className="backup-section"><p className="duplicate-warning">{erro}</p></div>;
  if (!cfg) return <div className="backup-section"><p>Carregando...</p></div>;

  const mudou = escolha !== cfg.fuso;
  const gravar = async () => {
    setConfirmar(false); setSalvando(true); setMsg(null);
    try {
      await apiSetFuso(escolha);
      setMsg({ ok: true, t: "Fuso salvo. A página vai recarregar para todos..." });
      // O servidor avisa os outros por WebSocket; aqui recarrega também.
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setMsg({ ok: false, t: e.message }); setSalvando(false); }
  };
  const restaurar = async () => {
    setMsg(null); setSalvando(true);
    try {
      await apiResetFuso();
      setMsg({ ok: true, t: "Voltou para o padrão. A página vai recarregar para todos..." });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setMsg({ ok: false, t: e.message }); setSalvando(false); }
  };

  return (
    <div className="backup-section">
      <h3><Globe size={16} /> Fuso horário</h3>
      <p>Define a hora do sistema para todo mundo: o que é "hoje", quando as contas e entrevistas vencem, o horário do backup automático, o relógio e os horários do chat, do histórico e dos relatórios. Vale igual para todos, mesmo que o computador de cada um esteja em outro fuso.</p>
      <div className="backup-config-row">
        <Field label="Fuso horário do sistema">
          <Select value={escolha} onChange={(e) => setEscolha(e.target.value)}>
            {opcoes.map((z) => (
              <option key={z} value={z}>{nomeFuso(z)} · {deslocamento(z, agora) || z}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="armaz-legenda">Agora nesse fuso: <strong style={{ textTransform: "capitalize" }}>{horaNo(escolha)}</strong>{mudou ? "" : " (fuso atual)"}</p>
      <p className="armaz-legenda">Padrão do sistema: {nomeFuso(cfg.padrao)}. Mudar o fuso não altera nenhum dado salvo, só a hora que o sistema considera.</p>
      <div className="drawer-actions" style={{ marginTop: 4 }}>
        <button className="btn-ghost" onClick={restaurar} disabled={salvando || cfg.fuso === cfg.padrao}>Voltar ao padrão</button>
        <button className="btn-primary" onClick={() => setConfirmar(true)} disabled={salvando || !mudou}>{salvando ? "Salvando..." : "Salvar fuso"}</button>
      </div>
      {msg && (
        <p className={msg.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
          {msg.ok ? <Check size={13} /> : <AlertTriangle size={15} />} <span>{msg.t}</span>
        </p>
      )}
      <ConfirmDialog
        open={confirmar}
        title="Mudar o fuso horário?"
        message={`O sistema passará a usar ${nomeFuso(escolha)}. Isso muda o que é "hoje", os vencimentos, o horário do backup automático e o relógio. A página recarrega para todos os usuários. Nenhum dado é alterado.`}
        confirmLabel="Mudar fuso"
        cancelLabel="Cancelar"
        onCancel={() => setConfirmar(false)}
        onConfirm={gravar}
      />
    </div>
  );
}
