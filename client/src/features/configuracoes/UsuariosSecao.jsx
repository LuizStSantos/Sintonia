import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Users, ShieldCheck, Camera } from "lucide-react";
import { primeirosDoisNomes } from "../../lib/text.js";
import { summarizePermissions } from "../../lib/permissions.js";
import { onRealtimeMessage } from "../../lib/realtime.js";
import { apiListUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiUploadFotoUsuario, apiRemoverFotoUsuario } from "../../api/users.js";
import { Badge } from "../../components/common/Badge.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { EmptyRow } from "../../components/common/EmptyRow.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { ToggleField } from "../../components/common/ToggleField.jsx";
import { PasswordInput } from "../../components/common/PasswordInput.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { Avatar } from "../../components/common/Avatar.jsx";
import { PermissionsEditor } from "./PermissionsEditor.jsx";
import { useSortable } from "../../lib/sort.js";
import { SortTh } from "../../components/common/SortTh.jsx";

// Como cada coluna é ordenada ao clicar no cabeçalho (ver lib/sort.js).
const SORT_ACESSORES = {
  usuario: (u) => u.username,
  papel: (u) => u.role,
};

export function UsuariosSecao({ currentUser }) {
  const [users, setUsers] = useState(null);
  const { rows: usersRows, sort } = useSortable(users || [], SORT_ACESSORES, { key: "usuario", dir: "asc" });
  const [loadError, setLoadError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const fotoInputRef = useRef(null);

  const load = useCallback(() => {
    apiListUsers()
      .then((list) => {
        setUsers([...list].sort((a, b) => a.username.localeCompare(b.username, "pt-BR")));
        setLoadError("");
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Recarrega a lista sozinho quando outro admin cria/edita/exclui um usuário
  useEffect(() => {
    return onRealtimeMessage((msg) => {
      if (msg.collection === "users") load();
    });
  }, [load]);

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ username: "", password: "", role: "user", permissions: {}, nomeCompleto: "" });
    setFormError("");
    setDrawerOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u.id);
    setForm({ username: u.username, password: "", role: u.role, permissions: u.permissions || {}, nomeCompleto: u.nomeCompleto || "", foto: u.foto || null });
    setFormError("");
    setDrawerOpen(true);
  };

  const escolherFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !editing) return;
    setSalvandoFoto(true);
    setFormError("");
    try {
      const updated = await apiUploadFotoUsuario(editing, arquivo);
      setForm((f) => ({ ...f, foto: updated.foto || null }));
      load();
    } catch (e2) {
      setFormError(e2.message);
    } finally {
      setSalvandoFoto(false);
    }
  };

  const removerFoto = async () => {
    if (!editing) return;
    setSalvandoFoto(true);
    setFormError("");
    try {
      await apiRemoverFotoUsuario(editing);
      setForm((f) => ({ ...f, foto: null }));
      load();
    } catch (e2) {
      setFormError(e2.message);
    } finally {
      setSalvandoFoto(false);
    }
  };

  const save = async () => {
    setFormError("");
    try {
      if (editing) {
        await apiUpdateUser(editing, {
          role: form.role,
          permissions: form.permissions || {},
          password: form.password || undefined,
          nomeCompleto: form.nomeCompleto || "",
        });
      } else {
        if (!form.username?.trim() || !form.password) {
          setFormError("Usuário e senha são obrigatórios");
          return;
        }
        await apiCreateUser({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          permissions: form.permissions || {},
          nomeCompleto: form.nomeCompleto || "",
        });
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      setFormError(e.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await apiDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
      setActionError("");
      load();
    } catch (e) {
      setDeleteTarget(null);
      setActionError(e.message);
    }
  };

  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0 };
    return { total: users.length, admins: users.filter((u) => u.role === "admin").length };
  }, [users]);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total de usuários" value={stats.total} icon={Users} />
        <StatCard label="Administradores" value={stats.admins} tone="blue" icon={ShieldCheck} />
      </div>

      <div className="toolbar">
        <div className="search-wrap" />
        <button className="btn-primary" onClick={openNew}>
          <Plus size={15} strokeWidth={2.4} />
          Novo usuário
        </button>
      </div>

      {loadError && <p className="login-error">{loadError}</p>}
      {actionError && <p className="login-error">{actionError}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh sort={sort} k="usuario">Usuário</SortTh>
              <SortTh sort={sort} k="papel">Papel</SortTh>
              <th>Permissões</th>
              <th className="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {users && users.length === 0 && <EmptyRow colSpan={4} text="Nenhum usuário encontrado." />}
            {!users && <EmptyRow colSpan={4} text="Carregando usuários..." />}
            {users && usersRows.map((u) => (
              <tr key={u.id}>
                <td className="title-cell">
                  <span className="user-nome-cell">
                    <Avatar small nome={u.nomeCompleto || u.username} foto={u.foto} />
                    <span>
                      {u.username}
                      {u.id === currentUser.id && <span className="you-tag"> (você)</span>}
                      {u.nomeCompleto?.trim() && <div className="user-nome-completo">{u.nomeCompleto}</div>}
                    </span>
                  </span>
                </td>
                <td>
                  <Badge label={u.role === "admin" ? "Admin" : "Usuário"} tone={u.role === "admin" ? "blue" : "gray"} />
                </td>
                <td className="permissions-cell">
                  {u.role === "admin" ? "Acesso total a tudo" : summarizePermissions(u.permissions)}
                </td>
                <td className="actions-col">
                  <button className="icon-btn" onClick={() => openEdit(u)} aria-label="Editar"><Pencil size={15} /></button>
                  {u.id !== currentUser.id && (
                    <button className="icon-btn danger" onClick={() => setDeleteTarget(u)} aria-label="Excluir">
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} title={editing ? "Editar usuário" : "Novo usuário"} onClose={pedirFechar}>
        {editing && (
          <div className="chat-grupo-foto-row" style={{ marginBottom: 14 }}>
            <Avatar nome={form.nomeCompleto || form.username} foto={form.foto} />
            <div className="chat-grupo-foto-acoes">
              <button type="button" className="btn-ghost" disabled={salvandoFoto} onClick={() => fotoInputRef.current?.click()}>
                <Camera size={14} /> {form.foto ? "Trocar foto" : "Adicionar foto"}
              </button>
              {form.foto && (
                <button type="button" className="btn-ghost danger" disabled={salvandoFoto} onClick={removerFoto}>
                  Remover foto
                </button>
              )}
              <input ref={fotoInputRef} type="file" accept="image/*" hidden onChange={escolherFoto} />
            </div>
          </div>
        )}
        <Field label="Nome de usuário">
          <input
            value={form.username || ""}
            disabled={!!editing}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="ex: luiz.st.santos"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Nome completo">
          <input
            value={form.nomeCompleto || ""}
            onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
            placeholder="ex: Luiz Stormorwski dos Santos"
          />
        </Field>
        <p className="field-hint">
          Usado no lugar do login em telas como o TO-DO — mostra só os 2 primeiros nomes{form.nomeCompleto?.trim() ? `: "${primeirosDoisNomes(form.nomeCompleto)}"` : ""}. Se deixar em branco, usa o login mesmo.
        </p>
        <Field label={editing ? "Nova senha (deixe em branco para manter)" : "Senha"}>
          <PasswordInput
            value={form.password || ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editing ? "••••••••" : "Mínimo de 4 caracteres"}
          />
        </Field>
        <ToggleField
          checked={form.role === "admin"}
          onChange={(e) => setForm({ ...form, role: e.target.checked ? "admin" : "user" })}
          title="Tornar administrador"
          desc="Acesso e edição total, inclusive esta aba de usuários"
        />
        {form.role !== "admin" && (
          <>
            <ToggleField
              checked={!!form.permissions?.atribuirTarefas}
              onChange={(e) => setForm({ ...form, permissions: { ...form.permissions, atribuirTarefas: e.target.checked } })}
              title="Pode atribuir tarefas de TO-DO a outras pessoas"
              desc="Além das próprias — não inclui atribuir a administradores"
            />
            <Field label="Permissões por aba">
              <PermissionsEditor value={form.permissions || {}} onChange={(p) => setForm({ ...form, permissions: p })} />
            </Field>
          </>
        )}
        {formError && <p className="login-error">{formError}</p>}
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar usuário</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget?.username}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

