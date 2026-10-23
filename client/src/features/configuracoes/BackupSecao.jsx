import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle, FileDown, Mail, Upload, Send } from "lucide-react";
import { DIAS_SEMANA_BACKUP } from "../../lib/constants.js";
import { API_BASE } from "../../api/client.js";
import { apiGetBackupConfig, apiSetBackupConfig, apiSendTestBackup, apiRestoreBackup, apiGetBackupResumo } from "../../api/backup.js";
import { Field } from "../../components/common/Field.jsx";
import { ToggleField } from "../../components/common/ToggleField.jsx";
import { SmtpCard } from "../configuracoes/SmtpCard.jsx";
import { Select } from "../../components/common/Select.jsx";
import { formatDataHora } from "../../lib/fuso.js";

const fmtDataHora = (iso) => (iso ? formatDataHora(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const ROTULOS_DADOS = ["Matérias", "Contatos", "Entrevistados", "Programas", "Clientes / Fornecedores", "Colaboradores", "Contas a receber", "Contas a pagar", "Espelhos", "Atalhos", "OPEC", "Usuários", "Tarefas (TO-DO)"];
const COLS_BACKUP = { Matérias: "materias", Contatos: "contatos", Entrevistados: "entrevistados", Programas: "programas", "Clientes / Fornecedores": "clientesFornecedores", Colaboradores: "colaboradores", "Contas a receber": "contasReceber", "Contas a pagar": "contasPagar", Espelhos: "espelho", Atalhos: "atalhos", OPEC: "opec" };

// Conta o que tem dentro do arquivo escolhido (mesmas categorias do e-mail)
function contarArquivo(parsed) {
  return ROTULOS_DADOS.map((rotulo) => ({
    rotulo,
    n: rotulo === "Clientes / Fornecedores" ? (parsed.data?.clientesFornecedores || (parsed.data?.contasPagar !== undefined ? parsed.data?.clientes : null) || []).length : rotulo === "Usuários" ? (parsed.users || []).length : rotulo === "Tarefas (TO-DO)" ? (parsed.todos || []).length : (parsed.data?.[COLS_BACKUP[rotulo]] || (rotulo === "Espelhos" ? parsed.data?.espelhos : null) || []).length,
  }));
}

export function BackupSecao({ onRestore }) {
  const arquivoRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreError, setRestoreError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreErrorFinal, setRestoreErrorFinal] = useState("");
  const [resumoAtual, setResumoAtual] = useState(null);
  const [digitado, setDigitado] = useState("");

  useEffect(() => {
    apiGetBackupConfig()
      .then((c) => setConfig(c))
      .catch(() => setConfig({ enabled: false, frequencia: "semanal", diaSemana: 0, horario: "03:00", emailDestino: "", smtpConfigured: false }))
      .finally(() => setLoadingConfig(false));
  }, []);

  const menores = restoreFile && resumoAtual
    ? restoreFile.contagens
        .map((c) => ({ rotulo: c.rotulo, arquivo: c.n, atual: resumoAtual.find((r) => r.rotulo === c.rotulo)?.n ?? 0 }))
        .filter((c) => c.arquivo < c.atual)
    : [];

  const recarregarConfig = () => {
    apiGetBackupConfig().then((n) => setConfig((c) => (c ? { ...c, smtpConfigured: n.smtpConfigured } : n))).catch(() => {});
  };

  const baixarBackup = () => {
    window.location.href = `${API_BASE}/backup/export`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setRestoreError("");
    setRestoreErrorFinal("");
    setRestoreFile(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !parsed.data) {
          setRestoreError("Esse arquivo não parece ser um backup válido.");
          return;
        }
        setRestoreFile({ fileName: file.name, parsed, contagens: contarArquivo(parsed) });
        apiGetBackupResumo().then((r) => setResumoAtual(r.contagens)).catch(() => setResumoAtual(null));
      } catch (err) {
        setRestoreError("Não foi possível ler esse arquivo. Confira se é o .json gerado pelo backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmarRestauracao = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    setRestoreErrorFinal("");
    try {
      await apiRestoreBackup(restoreFile.parsed);
      onRestore();
    } catch (err) {
      setRestoreErrorFinal(err.message || "Não foi possível restaurar o backup.");
      setRestoring(false);
    }
  };

  const salvarConfig = async () => {
    setSavingConfig(true);
    setSaveMsg("");
    try {
      const updated = await apiSetBackupConfig(config);
      setConfig(updated);
      setSaveMsg("Configuração salva.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg(err.message || "Falha ao salvar.");
    } finally {
      setSavingConfig(false);
    }
  };

  const enviarTeste = async () => {
    if (!config?.emailDestino) return;
    setTestSending(true);
    setTestResult(null);
    try {
      await apiSendTestBackup(config.emailDestino);
      setTestResult({ ok: true, message: `E-mail de teste enviado para ${config.emailDestino}.` });
    } catch (err) {
      setTestResult({ ok: false, message: err.message || "Falha ao enviar o e-mail de teste." });
    } finally {
      apiGetBackupConfig().then((n) => setConfig((c) => (c ? { ...c, historico: n.historico, ultimoErro: n.ultimoErro, ultimoErroEm: n.ultimoErroEm } : n))).catch(() => {});
      setTestSending(false);
    }
  };

  const hist = config?.historico || [];
  const ultimoOk = hist.find((h) => h.ok && h.origem === "auto") || hist.find((h) => h.ok);
  const ultimaFalha = hist[0] && !hist[0].ok ? hist[0] : null;

  return (
    <div>
      {config && (
        <div className="backup-situacao">
          <div>
            <small>Último backup por e-mail</small>
            <b className={ultimoOk ? "ok" : ""}>{ultimoOk ? `✅ ${fmtDataHora(ultimoOk.em)}` : "Nenhum ainda"}</b>
            <span>{ultimoOk ? `${ultimoOk.tamanho || ""} · enviado para ${ultimoOk.destino}` : "Ative o backup automático abaixo"}</span>
          </div>
          <div>
            <small>Próximo backup</small>
            <b>{config.enabled && config.proximo && config.proximo !== "—" ? config.proximo : "Desativado"}</b>
            <span>{config.enabled ? (config.frequencia === "diario" ? "Diário" : "Semanal") : "Backup automático desligado"}</span>
          </div>
          <div>
            <small>Situação do e-mail</small>
            <b className={!config.smtpConfigured || ultimaFalha ? "warn" : "ok"}>
              {!config.smtpConfigured ? "⚠ Não configurado" : ultimaFalha ? "⚠ Último envio falhou" : "✅ Funcionando"}
            </b>
            <span>{!config.smtpConfigured ? "Preencha o Servidor de e-mail abaixo" : ultimaFalha ? ultimaFalha.erro : "Pronto para enviar"}</span>
          </div>
        </div>
      )}

      <div className="backup-section">
        <h3><Upload size={16} style={{ transform: "rotate(180deg)" }} /> Baixar backup</h3>
        <p>Gera um arquivo .json com todos os dados do sistema (matérias, contatos, entrevistados, OPEC, clientes e fornecedores, contas a pagar e a receber, colaboradores e usuários). Guarde esse arquivo em local seguro.</p>
        <button className="btn-primary" onClick={baixarBackup}><FileDown size={16} /> Baixar backup agora</button>
      </div>

      <div className="backup-section">
        <h3><Upload size={16} /> Restaurar backup</h3>
        <p>Selecione um arquivo de backup (.json) gerado anteriormente. <strong>Isso substitui todos os dados atuais do servidor</strong> pelos do arquivo selecionado, incluindo usuários — você pode precisar entrar de novo depois.</p>
        <input ref={arquivoRef} type="file" accept=".json,application/json" onChange={handleFileChange} hidden />
        <div className="backup-file-linha">
          <button type="button" className="btn-ghost" onClick={() => arquivoRef.current?.click()}><Upload size={15} /> Escolher arquivo de backup</button>
          <span className="backup-file-nome">{restoreFile ? restoreFile.fileName : "Nenhum arquivo escolhido"}</span>
        </div>
        {restoreError && (
          <p className="duplicate-warning"><AlertTriangle size={15} /> {restoreError}</p>
        )}
        {restoreFile && (
          <div className="backup-restore-resumo">
            <div className="backup-restore-titulo">
              Arquivo <strong>{restoreFile.fileName}</strong>
              {restoreFile.parsed.exportedAt ? <> — gerado em <strong>{fmtDataHora(restoreFile.parsed.exportedAt)}</strong></> : null}. Contém:
            </div>
            <div className="backup-contagens">
              {restoreFile.contagens.map((c) => (
                <div key={c.rotulo} className="backup-contagem"><b>{c.n}</b><span>{c.rotulo}</span></div>
              ))}
            </div>
            {menores.length > 0 && (
              <p className="duplicate-warning">
                <AlertTriangle size={15} /> <span>O arquivo tem <strong>menos</strong> dados do que o sistema tem hoje:{" "}
                {menores.map((m) => `${m.rotulo} (${m.arquivo} no arquivo, ${m.atual} hoje)`).join(", ")}. O que foi criado depois desse backup será perdido.</span>
              </p>
            )}
            <button className="btn-primary danger-btn" onClick={() => { setDigitado(""); setConfirmOpen(true); }}>Restaurar este backup</button>
          </div>
        )}
        {restoreErrorFinal && (
          <p className="duplicate-warning" style={{ marginTop: 10 }}><AlertTriangle size={15} /> {restoreErrorFinal}</p>
        )}
      </div>

      <SmtpCard onChange={recarregarConfig} />

      <div className="backup-section">
        <h3><Mail size={16} /> Backup automático por e-mail</h3>
        {loadingConfig ? (
          <p>Carregando configuração...</p>
        ) : (
          <>
            <p>
              Envia um backup completo por e-mail automaticamente, no dia e horário configurados abaixo.{" "}
              {config.smtpConfigured ? (
                <span className="backup-status-pill ok"><Check size={12} /> SMTP configurado</span>
              ) : (
                <span className="backup-status-pill off"><AlertTriangle size={12} /> SMTP não configurado no servidor</span>
              )}
            </p>
            {!config.smtpConfigured && (
              <p>Pra habilitar o envio, preencha o <strong>Servidor de e-mail</strong> logo acima (e-mail e senha de app).</p>
            )}

            <ToggleField
              checked={!!config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              title="Ativar backup automático"
            />

            <div className="backup-config-row">
              <Field label="Frequência">
                <Select value={config.frequencia} onChange={(e) => setConfig({ ...config, frequencia: e.target.value })}>
                  <option value="semanal">Semanal</option>
                  <option value="diario">Diário</option>
                </Select>
              </Field>
              {config.frequencia === "semanal" && (
                <Field label="Dia da semana">
                  <Select value={config.diaSemana} onChange={(e) => setConfig({ ...config, diaSemana: Number(e.target.value) })}>
                    {DIAS_SEMANA_BACKUP.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Horário">
                <input type="time" value={config.horario} onChange={(e) => setConfig({ ...config, horario: e.target.value })} />
              </Field>
            </div>

            <Field label="E-mail de destino">
              <input type="email" value={config.emailDestino} onChange={(e) => setConfig({ ...config, emailDestino: e.target.value })} placeholder="backup@suaempresa.com" />
            </Field>

            {config.ultimoEnvio && (
              <p>Último envio automático: {formatDataHora(new Date(config.ultimoEnvio))}</p>
            )}

            {config.ultimoErro && (
              <p className="duplicate-warning">
                <AlertTriangle size={15} /> <span>O último envio automático falhou
                {config.ultimoErroEm ? ` (${formatDataHora(new Date(config.ultimoErroEm))})` : ""}: {config.ultimoErro}</span>
              </p>
            )}

            <div className="drawer-actions" style={{ marginTop: 4 }}>
              <button className="btn-ghost" onClick={enviarTeste} disabled={testSending || !config.emailDestino}>
                <Send size={15} /> {testSending ? "Enviando..." : "Enviar teste agora"}
              </button>
              <button className="btn-primary" onClick={salvarConfig} disabled={savingConfig}>
                {savingConfig ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
            {saveMsg && <p className="picker-confirm" style={{ marginTop: 10 }}><Check size={13} /> {saveMsg}</p>}
            {testResult && (
              <p className={testResult.ok ? "picker-confirm" : "duplicate-warning"} style={{ marginTop: 10 }}>
                {testResult.ok ? <Check size={13} /> : <AlertTriangle size={15} />} {testResult.message}
              </p>
            )}
          </>
        )}
      </div>

      {hist.length > 0 && (
        <div className="backup-section">
          <h3><Mail size={16} /> Histórico de envios</h3>
          <div className="backup-hist">
            <table>
              <thead><tr><th>Data</th><th>Resultado</th><th>Tamanho</th><th>Destino</th></tr></thead>
              <tbody>
                {hist.map((h, i) => (
                  <tr key={i}>
                    <td data-label="Data">{fmtDataHora(h.em)}{h.origem === "teste" ? " (teste)" : ""}</td>
                    <td data-label="Resultado" className={h.ok ? "ok" : "warn"}>{h.ok ? "✅ Enviado" : `⚠ Falhou — ${h.erro || "erro"}`}</td>
                    <td data-label="Tamanho">{h.tamanho || "—"}</td>
                    <td data-label="Destino">{h.destino}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="confirm-overlay" onClick={() => !restoring && setConfirmOpen(false)}>
          <div className="confirm-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Restaurar backup</h3>
            <p>
              Isso vai <strong>substituir todos os dados do servidor</strong> pelos do arquivo "{restoreFile?.fileName}",
              incluindo os usuários cadastrados. Os dados atuais serão perdidos. Essa ação não pode ser desfeita.
            </p>
            <Field label="Para confirmar, digite RESTAURAR">
              <input value={digitado} onChange={(e) => setDigitado(e.target.value)} disabled={restoring} placeholder="RESTAURAR" autoFocus />
            </Field>
            <div className="drawer-actions">
              <button className="btn-ghost" onClick={() => { setConfirmOpen(false); setDigitado(""); }} disabled={restoring}>Cancelar</button>
              <button className="btn-primary" disabled={digitado.trim().toUpperCase() !== "RESTAURAR" || restoring} onClick={confirmarRestauracao}>
                {restoring ? "Restaurando..." : "Confirmar restauração"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

