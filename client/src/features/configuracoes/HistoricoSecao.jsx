import { useCallback, useEffect, useState } from "react";
import { History, PlusCircle, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { apiListHistorico } from "../../api/historico.js";
import { apiListUsers } from "../../api/users.js";
import { onRealtimeMessage } from "../../lib/realtime.js";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { DateInput } from "../../components/common/DateInput.jsx";
import { Select } from "../../components/common/Select.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";
import { formatDataHora as formatDataHoraFuso } from "../../lib/fuso.js";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
// Sem ordem escolhida, vale a do servidor (mais recente primeiro).
const SORT_ACESSORES = {
  quando: (e) => e.timestamp,
  usuario: (e) => e.userName,
  acao: (e) => e.action,
  aba: (e) => COLLECTION_LABELS[e.collection] || e.collection,
  descricao: (e) => e.description,
};

// Rótulo amigável de cada coleção pro filtro de "aba" — inclui "usuarios",
// que não é uma coleção genérica (mora em /api/users), mas também gera
// eventos de histórico.
const COLLECTION_LABELS = {
  materias: "Matérias",
  contatos: "Contatos",
  entrevistados: "Entrevistados",
  programas: "Programas",
  opec: "OPEC",
  espelho: "Espelho",
  clientesFornecedores: "Clientes / Fornecedores",
  contasReceber: "Contas a receber",
  contasPagar: "Contas a pagar",
  colaboradores: "Colaboradores",
  atalhos: "Atalhos",
  usuarios: "Usuários",
};

const ACTION_META = {
  create: { label: "Criou", tone: "green", icon: PlusCircle },
  update: { label: "Editou", tone: "blue", icon: Pencil },
  delete: { label: "Apagou", tone: "red", icon: Trash2 },
  seguranca: { label: "Segurança", tone: "amber", icon: ShieldAlert },
};

function formatDataHora(iso) {
  if (!iso) return "—";
  try {
    return formatDataHoraFuso(new Date(iso), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}

export function HistoricoSecao() {
  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [users, setUsers] = useState([]);
  const { rows: entradas, sort } = useSortable(entries || [], SORT_ACESSORES, null);
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    apiListUsers()
      .then((list) => setUsers([...list].sort((a, b) => a.username.localeCompare(b.username, "pt-BR"))))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    apiListHistorico({ search, collection: collectionFilter, userId: userFilter, dataInicio, dataFim })
      .then((list) => {
        setEntries(list);
        setLoadError("");
      })
      .catch((e) => setLoadError(e.message));
  }, [search, collectionFilter, userFilter, dataInicio, dataFim]);

  useEffect(() => {
    load();
  }, [load]);

  // Atualiza sozinho quando alguém (qualquer usuário) faz uma ação nova —
  // o servidor avisa os admins conectados via WebSocket a cada gravação.
  useEffect(() => {
    return onRealtimeMessage((msg) => {
      if (msg.type === "historico-created") load();
    });
  }, [load]);

  return (
    <div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Buscar na descrição, usuário ou item..."
        extraFilter={
          <>
            <Select className="select-filter" value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
              <option value="">Todas as abas</option>
              {Object.entries(COLLECTION_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
            <Select className="select-filter" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">Todos os usuários</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </Select>
            <DateInput
             
              className="select-filter"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              aria-label="Data início"
            />
            <DateInput
             
              className="select-filter"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              aria-label="Data fim"
            />
          </>
        }
      />

      {loadError && <p className="login-error">{loadError}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="quando">Data/hora</SortTh>
              <SortTh sort={sort} k="usuario">Usuário</SortTh>
              <SortTh sort={sort} k="acao">Ação</SortTh>
              <SortTh sort={sort} k="aba">Aba</SortTh>
              <SortTh sort={sort} k="descricao">Descrição</SortTh>
            </tr>
          </thead>
          <tbody>
            {entries && entries.length === 0 && <EmptyRow colSpan={5} text="Nenhum evento encontrado." />}
            {!entries && <EmptyRow colSpan={5} text="Carregando histórico..." />}
            {entries && entradas.map((e) => {
              const meta = ACTION_META[e.action] || { label: e.action, tone: "gray", icon: History };
              const Icon = meta.icon;
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDataHora(e.timestamp)}</td>
                  <td>{e.userName || "—"}</td>
                  <td>
                    <Badge
                      label={
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon size={12} /> {meta.label}
                        </span>
                      }
                      tone={meta.tone}
                    />
                  </td>
                  <td>{COLLECTION_LABELS[e.collection] || e.collection}</td>
                  <td>{e.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
