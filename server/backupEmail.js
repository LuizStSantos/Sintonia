import { getFuso } from "./db.js";
// E-mail de backup do Sintonia — HTML "de e-mail" (tabelas + estilos inline,
// porque Gmail/Outlook ignoram <style> e CSS moderno) + versão em texto
// simples. As funções abaixo (tamanho, próxima execução, rótulos) montam os
// dados que o template usa; sendBackupEmail (backup.js) junta tudo.

export const ROTULOS_CONTAGEM = [
  ["materias", "Matérias"], ["contatos", "Contatos"], ["entrevistados", "Entrevistados"],
  ["programas", "Programas"], ["clientesFornecedores", "Clientes / Fornecedores"], ["colaboradores", "Colaboradores"],
  ["contasReceber", "Contas a receber"], ["contasPagar", "Contas a pagar"], ["espelho", "Espelhos"],
  ["atalhos", "Atalhos"], ["opec", "OPEC"],
];

export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const DIAS_FREQ = ["todo domingo", "toda segunda-feira", "toda terça-feira", "toda quarta-feira", "toda quinta-feira", "toda sexta-feira", "todo sábado"];
const DIAS_NOME = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function textoFrequencia(config) {
  if (!config.enabled) return "Backup automático desativado (envio manual de teste)";
  return config.frequencia === "diario"
    ? `Diário — todos os dias às ${config.horario}`
    : `Semanal — ${DIAS_FREQ[config.diaSemana] || "todo domingo"} às ${config.horario}`;
}

// Próximo disparo do agendador (mesma regra de checkAndRunScheduled: no
// horário configurado e, se semanal, no dia da semana configurado).
export function textoProximo(config, agora = new Date()) {
  if (!config.enabled || !config.emailDestino) return "—";
  const [h, m] = String(config.horario || "03:00").split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(agora);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d <= agora) continue;
    if (config.frequencia === "semanal" && d.getDay() !== config.diaSemana) continue;
    const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${DIAS_NOME[d.getDay()]}, ${data} às ${config.horario}`;
  }
  return "—";
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function montarEmailBackup({ geradoEm, arquivo, tamanho, contagens, frequencia, proximo }) {
  const cor = { fundo: "#F1F3F6", card: "#FFFFFF", texto: "#1F2430", suave: "#667085", borda: "#E4E7EC", vermelho: "#E4372B", escuro: "#15171B", verde: "#1E7A45", verdeBg: "#E3F5EA", amareloBg: "#FFF6DD", amareloBorda: "#EBCB7A", amareloTexto: "#7A5200" };
  const dataLonga = geradoEm.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: getFuso() });
  const dataLongaCap = dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1);
  const hora = geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: getFuso() });
  const total = contagens.reduce((a, c) => a + c.n, 0);

  const celula = (c) => `
    <td width="33%" valign="top" style="padding:5px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;border:1px solid ${cor.borda};border-radius:10px;">
        <tr><td style="padding:12px 14px;">
          <div style="font-size:22px;font-weight:700;color:${cor.texto};line-height:1.1;">${c.n}</div>
          <div style="font-size:12.5px;color:${cor.suave};margin-top:3px;">${esc(c.rotulo)}</div>
        </td></tr>
      </table>
    </td>`;
  const linhas = [];
  for (let i = 0; i < contagens.length; i += 3) {
    const grupo = contagens.slice(i, i + 3);
    while (grupo.length < 3) grupo.push(null);
    linhas.push(`<tr>${grupo.map((c) => (c ? celula(c) : `<td width="33%"></td>`)).join("")}</tr>`);
  }

  const passo = (n, titulo, texto) => `
    <tr>
      <td width="34" valign="top" style="padding:6px 0;">
        <div style="width:26px;height:26px;border-radius:13px;background:${cor.escuro};color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">${n}</div>
      </td>
      <td valign="top" style="padding:6px 0 6px 6px;font-size:14px;line-height:1.5;color:${cor.texto};"><strong>${titulo}</strong><br><span style="color:${cor.suave};">${texto}</span></td>
    </tr>`;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Backup Sintonia</title></head>
<body style="margin:0;padding:0;background:${cor.fundo};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Backup concluído: ${total} registros salvos (${esc(tamanho)}). Arquivo em anexo.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cor.fundo};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${cor.card};border-radius:16px;overflow:hidden;border:1px solid ${cor.borda};">

        <!-- Cabeçalho -->
        <tr><td style="background:${cor.escuro};padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="44" valign="middle"><img src="cid:sintonia-logo" width="38" height="38" alt="Sintonia" style="display:block;width:38px;height:38px;border-radius:10px;border:0;background:${cor.vermelho};"></td>
            <td valign="middle" style="padding-left:6px;">
              <div style="font-size:18px;font-weight:700;color:#fff;">Sintonia</div>
              <div style="font-size:12.5px;color:#9AA1AE;">Backup automático</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Status -->
        <tr><td style="padding:28px 28px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${cor.verdeBg};color:${cor.verde};font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;">✓&nbsp; Backup concluído com sucesso</td>
          </tr></table>
          <h1 style="margin:16px 0 4px;font-size:24px;line-height:1.25;color:${cor.texto};">Seus dados estão guardados</h1>
          <div style="font-size:14.5px;color:${cor.suave};">${esc(dataLongaCap)}</div>
          <div style="font-size:14.5px;color:${cor.suave};">às ${hora} (horário de Brasília)</div>
        </td></tr>

        <!-- Detalhes do arquivo -->
        <tr><td style="padding:14px 28px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${cor.borda};border-radius:12px;">
            <tr><td style="padding:14px 16px;border-bottom:1px solid ${cor.borda};font-size:13.5px;color:${cor.suave};" width="38%">📎&nbsp; Arquivo anexo</td><td style="padding:14px 16px;border-bottom:1px solid ${cor.borda};font-size:13.5px;color:${cor.texto};font-weight:600;word-break:break-all;">${esc(arquivo)}</td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid ${cor.borda};font-size:13.5px;color:${cor.suave};">💾&nbsp; Tamanho</td><td style="padding:14px 16px;border-bottom:1px solid ${cor.borda};font-size:13.5px;color:${cor.texto};font-weight:600;">${esc(tamanho)}</td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid ${cor.borda};font-size:13.5px;color:${cor.suave};">🔁&nbsp; Frequência</td><td style="padding:14px 16px;border-bottom:1px solid ${cor.borda};font-size:13.5px;color:${cor.texto};font-weight:600;">${esc(frequencia)}</td></tr>
            <tr><td style="padding:14px 16px;font-size:13.5px;color:${cor.suave};">📅&nbsp; Próximo backup</td><td style="padding:14px 16px;font-size:13.5px;color:${cor.texto};font-weight:600;">${esc(proximo)}</td></tr>
          </table>
        </td></tr>

        <!-- Resumo -->
        <tr><td style="padding:22px 28px 0;">
          <h2 style="margin:0 0 2px;font-size:16px;color:${cor.texto};">O que foi salvo</h2>
          <div style="font-size:13.5px;color:${cor.suave};margin-bottom:8px;">${total} registros no total</div>
        </td></tr>
        <tr><td style="padding:0 23px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas.join("")}</table>
        </td></tr>

        <!-- Como restaurar -->
        <tr><td style="padding:24px 28px 4px;">
          <h2 style="margin:0 0 8px;font-size:16px;color:${cor.texto};">Como restaurar, se precisar</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${passo(1, "Baixe o arquivo anexo", "Salve o arquivo .json no computador.")}
            ${passo(2, "Abra o Sintonia → Configurações → Backup", "Só administradores enxergam essa área.")}
            ${passo(3, "Clique em “Escolher arquivo de backup”", "Confira o resumo do arquivo, clique em “Restaurar este backup” e digite RESTAURAR para confirmar. Isso substitui os dados atuais pelos do arquivo.")}
          </table>
        </td></tr>

        <!-- Aviso -->
        <tr><td style="padding:18px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cor.amareloBg};border:1px solid ${cor.amareloBorda};border-radius:12px;">
            <tr><td style="padding:14px 16px;font-size:13.5px;line-height:1.55;color:${cor.amareloTexto};">
              <strong>🔒 Guarde com cuidado.</strong> O arquivo contém todos os dados do sistema, inclusive os logins dos usuários (com senha protegida). Não encaminhe esse e-mail e apague-o se não for mais necessário.
            </td></tr>
          </table>
        </td></tr>

        <!-- Rodapé -->
        <tr><td style="background:#F8F9FB;border-top:1px solid ${cor.borda};padding:16px 28px;font-size:12px;color:${cor.suave};text-align:center;line-height:1.6;">
          Enviado automaticamente pelo Sintonia<br>
          Para mudar a frequência ou o destinatário, abra Configurações → Backup no sistema.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const texto = [
    "Sintonia — Backup concluído com sucesso",
    `Gerado em ${dataLongaCap} às ${hora}.`,
    "",
    `Arquivo anexo: ${arquivo} (${tamanho})`,
    `Frequência: ${frequencia}`,
    `Próximo backup: ${proximo}`,
    "",
    `O que foi salvo (${total} registros):`,
    ...contagens.map((c) => `  - ${c.rotulo}: ${c.n}`),
    "",
    "Para restaurar: baixe o anexo, abra o Sintonia > Configurações > Backup > \"Escolher arquivo de backup\", confira o resumo, clique em \"Restaurar este backup\" e digite RESTAURAR. Isso substitui os dados atuais.",
    "",
    "Guarde com cuidado: o arquivo contém todos os dados do sistema, inclusive os logins dos usuários (com senha protegida). Não encaminhe este e-mail.",
  ].join("\n");
  return { html, texto };
}
