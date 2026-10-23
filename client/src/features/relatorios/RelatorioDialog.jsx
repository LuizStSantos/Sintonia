import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Tv2, Check, AlertTriangle, Clock3, FileBarChart, FileDown, X } from "lucide-react";
import { formatBRL } from "../../lib/validators.js";
import { formatDateBR, todayISO, addDaysISO, MONTHS, formatWeekdays, countOcorrenciasNoPeriodo, WEEKDAY_KEYS_BY_INDEX } from "../../lib/dates.js";
import { clientDisplayName } from "../../lib/financeiro.js";
import { CLIENTE_STATUS } from "../../lib/constants.js";
import { Badge } from "../../components/common/Badge.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Field } from "../../components/common/Field.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { formatDataHora } from "../../lib/fuso.js";

const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Pop-up de relatório aberto pelo botão "Relatório" das páginas Contas a
// receber, Contas a pagar e OPEC. `tipo`: "receber" | "pagar" | "break";
// `items`: a lista completa daquela página.
export function RelatorioDialog({ tipo, items: itensDaPagina, onClose }) {
  const hoje = todayISO();
  const anoAtual = hoje.slice(0, 4);
  const mesAtual = hoje.slice(5, 7);

  const [deAno, setDeAno] = useState(anoAtual);
  const [deMes, setDeMes] = useState(mesAtual);
  const [ateAno, setAteAno] = useState(anoAtual);
  const [ateMes, setAteMes] = useState(mesAtual);
  const [breakDe, setBreakDe] = useState(`${anoAtual}-${mesAtual}-01`);
  const [breakAte, setBreakAte] = useState(hoje);
  const [cliente, setCliente] = useState(""); // "" = todos os clientes
  const [programa, setPrograma] = useState(""); // OPEC: "" = todos os programas
  const [visao, setVisao] = useState("resumo"); // OPEC: "resumo" | "dia"

  const items = itensDaPagina || [];
  const breaksItems = itensDaPagina || [];
  const rotuloPago = tipo === "pagar" ? "Pago" : "Recebido";
  const tituloTipo = tipo === "pagar" ? "Contas a pagar" : tipo === "break" ? "OPEC" : "Contas a receber";

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const yearOptions = useMemo(() => {
    const years = new Set(items.map((i) => (i.vencimento || "").slice(0, 4)).filter(Boolean));
    years.add(anoAtual);
    return Array.from(years).sort((a, b) => a.localeCompare(b));
  }, [items, anoAtual]);

  // Lista de clientes pra escolher no filtro — monta a partir de TODOS os
  // lançamentos do relatório atual (não só os do período selecionado), pra
  // não sumir uma opção da lista só porque o período mudou. Contas a
  // Receber/Pagar identificam o cliente pelo mesmo critério já usado na
  // tabela (clientDisplayName); OPEC tem o campo `cliente` direto.
  const clienteOptions = useMemo(() => {
    if (tipo === "break") {
      const nomes = new Set((breaksItems || []).map((b) => (b.cliente || "").trim()).filter(Boolean));
      return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    const nomes = new Set(items.map((i) => clientDisplayName(i)).filter((n) => n && n !== "—"));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tipo, items, breaksItems]);

  const programaOptions = useMemo(() => {
    const nomes = new Set((breaksItems || []).map((b) => (b.programa || "").trim()).filter(Boolean));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [breaksItems]);

  const periodo = useMemo(() => {
    const de = `${deAno}-${deMes}`;
    const ate = `${ateAno}-${ateMes}`;
    const [ini, fim] = de <= ate ? [de, ate] : [ate, de];
    return items.filter((i) => {
      const ym = (i.vencimento || "").slice(0, 7);
      if (!ym || ym < ini || ym > fim) return false;
      if (cliente && clientDisplayName(i) !== cliente) return false;
      return true;
    });
  }, [items, deAno, deMes, ateAno, ateMes, cliente]);

  const totals = useMemo(() => {
    let total = 0, pago = 0, pendente = 0, atrasado = 0;
    periodo.forEach((i) => {
      const v = Number(i.valor) || 0;
      total += v;
      if (i.status === "Pago") pago += v;
      if (i.status === "Pendente") pendente += v;
      if (i.status === "Atrasado") atrasado += v;
    });
    return { total, pago, pendente, atrasado };
  }, [periodo]);

  const porMes = useMemo(() => {
    const map = new Map();
    periodo.forEach((i) => {
      const ym = (i.vencimento || "").slice(0, 7);
      if (!map.has(ym)) map.set(ym, { total: 0, pago: 0, pendente: 0, atrasado: 0, count: 0 });
      const bucket = map.get(ym);
      const v = Number(i.valor) || 0;
      bucket.total += v;
      bucket.count += 1;
      if (i.status === "Pago") bucket.pago += v;
      if (i.status === "Pendente") bucket.pendente += v;
      if (i.status === "Atrasado") bucket.atrasado += v;
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, vals]) => ({ ym, ...vals }));
  }, [periodo]);

  const detalhado = useMemo(() => {
    return [...periodo].sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  }, [periodo]);

  // OPEC não tem "vencimento" por mês — tem uma recorrência
  // semanal (dias da semana) que pode ou não ter data de fim. Pra cada VT,
  // calcula quantas vezes ele realmente vai ao ar dentro do período.
  const breaksReport = useMemo(() => {
    const [ini, fim] = breakDe <= breakAte ? [breakDe, breakAte] : [breakAte, breakDe];
    const fonte = (breaksItems || []).filter((b) => (!cliente || (b.cliente || "").trim() === cliente) && (!programa || (b.programa || "").trim() === programa));
    const linhas = fonte.map((b) => {
      // Início efetivo: se o VT tem uma data de início cadastrada e ela é
      // depois do começo do período, não conta os dias antes disso (senão
      // um VT criado ontem apareceria como se já estivesse no ar há meses).
      // Itens antigos sem "início" cadastrado continuam sem esse limite.
      let inicioEfetivo = ini;
      if (b.inicio && b.inicio > inicioEfetivo) inicioEfetivo = b.inicio;
      let fimEfetivo = fim;
      if (!b.naoVence && b.vencimento) {
        if (b.vencimento < ini) return { ...b, ocorrencias: 0 };
        if (b.vencimento < fimEfetivo) fimEfetivo = b.vencimento;
      }
      if (inicioEfetivo > fimEfetivo) return { ...b, ocorrencias: 0 };
      const dias = countOcorrenciasNoPeriodo(b.diasSemana, inicioEfetivo, fimEfetivo);
      return { ...b, ocorrencias: dias * (Number(b.quantidade) || 1) };
    });
    const comOcorrencia = linhas
      .filter((b) => b.ocorrencias > 0)
      .sort((a, b) => b.ocorrencias - a.ocorrencias || (a.nomeVT || "").localeCompare(b.nomeVT || "", "pt-BR"));
    const totalInsercoes = comOcorrencia.reduce((s, b) => s + b.ocorrencias, 0);
    const vencendoNoPeriodo = fonte.filter((b) => !b.naoVence && b.vencimento && b.vencimento >= ini && b.vencimento <= fim).length;
    const naoVencem = fonte.filter((b) => b.naoVence).length;
    return { linhas: comOcorrencia, totalInsercoes, vtsDistintos: comOcorrencia.length, vencendoNoPeriodo, naoVencem };
  }, [breaksItems, breakDe, breakAte, cliente, programa]);

  // Visão "Dia a dia": para cada data do período, soma as inserções de tudo que
  // estava no ar naquele dia (dia da semana marcado, entre início e vencimento).
  // Dias sem nenhuma inserção não entram na lista.
  const diaADia = useMemo(() => {
    const [ini, fim] = breakDe <= breakAte ? [breakDe, breakAte] : [breakAte, breakDe];
    const fonte = (breaksItems || []).filter((b) => (!cliente || (b.cliente || "").trim() === cliente) && (!programa || (b.programa || "").trim() === programa));
    const dias = [];
    let total = 0;
    for (let d = ini, guarda = 0; d <= fim && guarda < 1100; d = addDaysISO(d, 1), guarda++) {
      const chave = WEEKDAY_KEYS_BY_INDEX[new Date(d + "T00:00:00").getDay()];
      let n = 0;
      for (const b of fonte) {
        if (!(b.diasSemana || []).includes(chave)) continue;
        if (b.inicio && b.inicio > d) continue;
        if (!b.naoVence && b.vencimento && b.vencimento < d) continue;
        n += Number(b.quantidade) || 1;
      }
      if (n > 0) { dias.push({ data: d, dia: DIAS_ABREV[new Date(d + "T00:00:00").getDay()], n }); total += n; }
    }
    return { dias, total };
  }, [breaksItems, breakDe, breakAte, cliente, programa]);

  const formatMesAno = (ym) => {
    const [y, m] = ym.split("-");
    const nomeMes = MONTHS.find((mo) => mo.value === m)?.label || m;
    return `${nomeMes}/${y}`;
  };

  // O conteúdo do relatório (cabeçalho só de impressão + totais + tabelas).
  // É mostrado dentro do pop-up e também numa cópia só de impressão, fora do
  // app, para o PDF sair limpo (ver `.report-print-root` no index.css).
  const conteudo = (
    <>
      <div className="print-only report-print-header">
        <div className="report-print-brand">Sintonia</div>
        <h2>Relatório de {tipo === "pagar" ? "Contas a pagar" : tipo === "break" ? "OPEC" : "Contas a receber"}{tipo === "break" && visao === "dia" ? " — dia a dia" : ""}</h2>
        <p>
          Período: {tipo === "break"
            ? `${formatDateBR(breakDe)} a ${formatDateBR(breakAte)}`
            : `${formatMesAno(`${deAno}-${deMes}`)} a ${formatMesAno(`${ateAno}-${ateMes}`)}`}
          {cliente ? ` — Cliente: ${cliente}` : ""}
          {tipo === "break" && programa ? ` — Programa: ${programa}` : ""}
        </p>
        <p className="report-print-meta">Gerado em {formatDataHora(new Date())}</p>
      </div>

      {tipo === "break" && visao === "dia" ? (
        <>
          <div className="stat-grid">
            <StatCard label="Total de inserções no período" value={diaADia.total} icon={Tv2} />
            <StatCard label="Dias com inserção" value={diaADia.dias.length} tone="blue" icon={FileBarChart} />
          </div>
          <h3 className="report-section-title">Inserções dia a dia</h3>
          <div className="table-wrap">
            <table className="report-dia">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "36%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Dia da semana</th>
                  <th className="mono-col">Inserções</th>
                </tr>
              </thead>
              <tbody>
                {diaADia.dias.length === 0 && <EmptyRow colSpan={3} text="Nenhuma inserção no período selecionado." />}
                {diaADia.dias.map((d) => (
                  <tr key={d.data}>
                    <td>{formatDateBR(d.data)}</td>
                    <td>{d.dia}</td>
                    <td className="mono-col mono">{d.n}</td>
                  </tr>
                ))}
                {diaADia.dias.length > 0 && (
                  <tr className="report-total-row">
                    <td colSpan={2}><strong>Total do período</strong></td>
                    <td className="mono-col mono"><strong>{diaADia.total}</strong></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : tipo === "break" ? (
        <>
          <div className="stat-grid">
            <StatCard label="Total de inserções no período" value={breaksReport.totalInsercoes} icon={Tv2} />
            <StatCard label="VTs no ar" value={breaksReport.vtsDistintos} tone="blue" icon={FileBarChart} />
            <StatCard label="Vencendo no período" value={breaksReport.vencendoNoPeriodo} tone="amber" icon={AlertTriangle} />
            <StatCard label="Não vencem" value={breaksReport.naoVencem} tone="green" icon={Check} />
          </div>

          <h3 className="report-section-title">Inserções por VT no período</h3>
          <div className="table-wrap">
            <table>
              {/* Larguras fixas (em %, somando 100%) só pra impressão — ver
                  comentário em `table-layout:fixed` dentro de `@media print`
                  no index.css. Sem isso, com 8 colunas, ou a tabela estoura
                  a largura da página de verdade (impressa pelo navegador) e
                  corta as últimas colunas fora da folha, ou (se forçar tudo
                  igual) os cabeçalhos longos quebram no meio da palavra. */}
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>VT</th>
                  <th>Programa</th>
                  <th>Cliente</th>
                  <th>Dias da semana</th>
                  <th className="mono-col">Qtd/break</th>
                  <th className="mono-col">Inserções</th>
                  <th>Início</th>
                  <th>Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {breaksReport.linhas.length === 0 && <EmptyRow colSpan={8} text="Nenhuma inserção no período selecionado." />}
                {breaksReport.linhas.map((b) => (
                  <tr key={b.id}>
                    <td className="title-cell">{b.nomeVT}</td>
                    <td>{b.programa}</td>
                    <td>{b.cliente}</td>
                    <td>{formatWeekdays(b.diasSemana)}</td>
                    <td className="mono-col mono">{Number(b.quantidade) || 1}x</td>
                    <td className="mono-col mono">{b.ocorrencias}</td>
                    <td>{b.inicio ? formatDateBR(b.inicio) : "—"}</td>
                    <td>{b.naoVence ? "Não vence" : formatDateBR(b.vencimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Total do período" value={formatBRL(totals.total)} icon={FileBarChart} />
            <StatCard label={rotuloPago} value={formatBRL(totals.pago)} tone="green" icon={Check} />
            <StatCard label="Pendente" value={formatBRL(totals.pendente)} tone="amber" icon={Clock3} />
            <StatCard label="Em atraso" value={formatBRL(totals.atrasado)} tone="red" icon={AlertTriangle} />
          </div>

          <h3 className="report-section-title">Por mês</h3>
          <div className="table-wrap">
            <table>
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Lançamentos</th>
                  <th>Total</th>
                  <th>{rotuloPago}</th>
                  <th>Pendente</th>
                  <th>Em atraso</th>
                </tr>
              </thead>
              <tbody>
                {porMes.length === 0 && <EmptyRow colSpan={6} text="Nenhum lançamento no período selecionado." />}
                {porMes.map((m) => (
                  <tr key={m.ym}>
                    <td>{formatMesAno(m.ym)}</td>
                    <td>{m.count}</td>
                    <td className="mono">{formatBRL(m.total)}</td>
                    <td className="mono">{formatBRL(m.pago)}</td>
                    <td className="mono">{formatBRL(m.pendente)}</td>
                    <td className="mono">{formatBRL(m.atrasado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="report-section-title">Lançamentos detalhados</h3>
          <div className="table-wrap">
            <table>
              <colgroup>
                <col style={{ width: "42%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detalhado.length === 0 && <EmptyRow colSpan={4} text="Nenhum lançamento no período selecionado." />}
                {detalhado.map((i) => (
                  <tr key={i.id}>
                    <td className="title-cell">{clientDisplayName(i)}</td>
                    <td className="mono">{formatBRL(i.valor)}</td>
                    <td>{formatDateBR(i.vencimento)}</td>
                    <td><Badge label={i.status} tone={CLIENTE_STATUS[i.status] || "gray"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      <div className="confirm-overlay" onClick={onClose}>
        <div className="confirm-panel relatorio-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Relatório de ${tituloTipo}`}>
          <div className="relatorio-topo">
            <h3>Relatório de {tituloTipo}</h3>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
          <div className="relatorio-corpo">
            <div className="report-controls">
              {tipo === "break" ? (
                <>
                  <Field label="De">
                    <DateInput value={breakDe} onChange={(e) => setBreakDe(e.target.value)} />
                  </Field>
                  <Field label="Até">
                    <DateInput value={breakAte} onChange={(e) => setBreakAte(e.target.value)} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="De">
                    <div className="report-period-row">
                      <Select value={deMes} onChange={(e) => setDeMes(e.target.value)}>
                        {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </Select>
                      <Select value={deAno} onChange={(e) => setDeAno(e.target.value)}>
                        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                      </Select>
                    </div>
                  </Field>
                  <Field label="Até">
                    <div className="report-period-row">
                      <Select value={ateMes} onChange={(e) => setAteMes(e.target.value)}>
                        {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </Select>
                      <Select value={ateAno} onChange={(e) => setAteAno(e.target.value)}>
                        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                      </Select>
                    </div>
                  </Field>
                </>
              )}
              <Field label="Cliente">
                <Select value={cliente} onChange={(e) => setCliente(e.target.value)}>
                  <option value="">Todos os clientes</option>
                  {clienteOptions.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                </Select>
              </Field>
              {tipo === "break" && (
                <>
                  <Field label="Programa">
                    <Select value={programa} onChange={(e) => setPrograma(e.target.value)}>
                      <option value="">Todos os programas</option>
                      {programaOptions.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                    </Select>
                  </Field>
                  <Field label="Visão">
                    <div className="rel-seg" role="group" aria-label="Visão do relatório">
                      <button type="button" className={visao === "resumo" ? "on" : ""} aria-pressed={visao === "resumo"} onClick={() => setVisao("resumo")}>Resumo</button>
                      <button type="button" className={visao === "dia" ? "on" : ""} aria-pressed={visao === "dia"} onClick={() => setVisao("dia")}>Dia a dia</button>
                    </div>
                  </Field>
                </>
              )}
            </div>
            {conteudo}
          </div>
          <div className="drawer-actions relatorio-rodape">
            <button type="button" className="btn-ghost" onClick={onClose}>Fechar</button>
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              <FileDown size={16} /> Baixar PDF
            </button>
          </div>
        </div>
      </div>
      {createPortal(<div className="report-print-root print-only">{conteudo}</div>, document.body)}
    </>
  );
}
