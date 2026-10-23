import { useMemo, useState } from "react";
import { ExternalLink, Link2, Hash, Copy, Check, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { uid } from "../../lib/validators.js";
import { Toolbar } from "../../components/common/Toolbar.jsx";
import { Drawer } from "../../components/common/Drawer.jsx";
import { useAvisoNaoSalvo } from "../../components/common/useAvisoNaoSalvo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.jsx";
import { Select } from "../../components/common/Select.jsx";

// Se a pessoa digitar só "canva.com/..." sem http(s), o navegador trataria
// como link relativo dentro do próprio site — então garante o protocolo
// antes de abrir.
const normalizeUrl = (url) => {
  const v = String(url || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
};

// Cadastros feitos antes do tipo "Texto" existir não têm o campo "tipo"
// salvo — trata como "link" (comportamento de sempre) pra não quebrar nada.
const tipoDoItem = (item) => item.tipo === "texto" ? "texto" : "link";

// Nome do componente e do arquivo acompanham o rótulo mostrado no menu
// ("Atalhos") e, desde a migração de ids (ver RENAME_DE_COLECAO em
// server/db.js), também a coleção no banco/permissões, que se chama
// "atalhos".
export function AtalhosTab({ items, onCreate, onUpdate, onDelete, canEdit = true }) {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos"); // todos | link | texto
  const [abertos, setAbertos] = useState(() => new Set()); // textos expandidos
  const alternarAberto = (id) => setAbertos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const { pedirFechar, aviso: avisoNaoSalvo } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });

  const openNew = () => {
    setEditing(null);
    setForm({ tipo: "link", nome: "", descricao: "", url: "", texto: "" });
    setDrawerOpen(true);
  };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ tipo: tipoDoItem(item), ...item });
    setDrawerOpen(true);
  };
  const save = async () => {
    if (!form.nome?.trim()) return;
    if (form.tipo === "texto") {
      if (!form.texto?.trim()) return;
    } else if (!form.url?.trim()) {
      return;
    }
    const payload = form.tipo === "texto"
      ? { ...form, url: "" }
      : { ...form, url: normalizeUrl(form.url), texto: "" };
    if (editing) {
      await onUpdate({ ...payload, id: editing });
    } else {
      await onCreate({ ...payload, id: uid() });
    }
    setDrawerOpen(false);
  };

  const copiarTexto = async (item) => {
    try {
      await navigator.clipboard.writeText(item.texto || "");
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1800);
    } catch (e) {
      /* clipboard pode falhar sem permissão/contexto seguro — sem aviso
         intrusivo, o botão simplesmente não mostra o "Copiado!" */
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter((i) => `${i.nome || ""} ${i.descricao || ""} ${i.texto || ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  }, [items, search]);

  const links = useMemo(() => filtered.filter((i) => tipoDoItem(i) === "link"), [filtered]);
  const textos = useMemo(() => filtered.filter((i) => tipoDoItem(i) === "texto"), [filtered]);

  return (
    <div>
      <Toolbar
        search={search} setSearch={setSearch}
        placeholder="Buscar por nome, descrição ou texto..."
        onNew={canEdit ? openNew : undefined} newLabel="Novo atalho"
      />

      <div className="atalhos-filtro" role="tablist" aria-label="Tipo de atalho">
        {[["todos", "Todos", filtered.length], ["link", "Links", links.length], ["texto", "Textos para copiar", textos.length]].map(([k, rotulo, n]) => (
          <button key={k} type="button" role="tab" aria-selected={filtroTipo === k} className={`atalhos-filtro-btn ${filtroTipo === k ? "ativo" : ""}`} onClick={() => setFiltroTipo(k)}>
            {rotulo} <span className="atalhos-filtro-n">{n}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty-row">Nenhum atalho cadastrado ainda.</p>
      ) : (
        <>
          {filtroTipo !== "texto" && links.length > 0 && (
            <section className="atalhos-secao">
              <h3 className="atalhos-secao-titulo"><Link2 size={15} /> Links <span className="atalhos-secao-dica">abrem em outra aba</span></h3>
              <div className="links-grid">
                {links.map((i) => (
                  <div key={i.id} className="link-card">
                    <a
                      className="link-card-open"
                      href={normalizeUrl(i.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Abrir ${i.nome} em uma nova aba`}
                    >
                      <div className="link-card-icon"><Link2 size={18} /></div>
                      <div className="link-card-body">
                        <div className="link-card-nome">{i.nome}</div>
                        {i.descricao && <div className="link-card-desc">{i.descricao}</div>}
                      </div>
                      <ExternalLink size={15} className="link-card-external" />
                    </a>
                    {canEdit && (
                      <div className="link-card-actions">
                        <button className="icon-btn" onClick={() => openEdit(i)} aria-label="Editar"><Pencil size={14} /></button>
                        <button className="icon-btn danger" onClick={() => setDeleteTarget(i)} aria-label="Excluir"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {filtroTipo !== "link" && textos.length > 0 && (
            <section className="atalhos-secao">
              <h3 className="atalhos-secao-titulo"><Hash size={15} /> Textos para copiar <span className="atalhos-secao-dica">hashtags, legendas, e-mails prontos</span></h3>
              <div className="textos-grid">
                {textos.map((i) => {
                  const longo = (i.texto || "").length > 150 || (i.texto || "").split("\n").length > 4;
                  const aberto = abertos.has(i.id);
                  return (
                    <div key={i.id} className="texto-card">
                      <div className="texto-card-topo">
                        <div className="link-card-icon tipo-texto"><Hash size={18} /></div>
                        <div className="texto-card-titulo">
                          <div className="link-card-nome">{i.nome}</div>
                          {i.descricao && <div className="link-card-desc">{i.descricao}</div>}
                        </div>
                        {canEdit && (
                          <div className="texto-card-acoes">
                            <button className="icon-btn" onClick={() => openEdit(i)} aria-label="Editar"><Pencil size={14} /></button>
                            <button className="icon-btn danger" onClick={() => setDeleteTarget(i)} aria-label="Excluir"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                      <div className={`texto-card-caixa ${aberto || !longo ? "aberto" : ""}`}>{i.texto}</div>
                      <div className="texto-card-rodape">
                        {longo ? (
                          <button type="button" className="texto-card-mais" onClick={() => alternarAberto(i.id)}>
                            {aberto ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Mostrar tudo</>}
                          </button>
                        ) : <span />}
                        <button type="button" className={`texto-card-copiar ${copiedId === i.id ? "copiado" : ""}`} onClick={() => copiarTexto(i)}>
                          {copiedId === i.id ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar texto</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <Drawer open={drawerOpen} title={editing ? "Editar atalho" : "Novo atalho"} onClose={pedirFechar}>
        <Field label="Tipo">
          <Select value={form.tipo || "link"} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="link">Link (abre em outra aba)</option>
            <option value="texto">Texto para copiar (hashtags, legendas prontas...)</option>
          </Select>
        </Field>
        <Field label="Nome">
          <input
            value={form.nome || ""}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder={form.tipo === "texto" ? "Ex: Hashtags — Futebol de domingo" : "Ex: Arte Canva — Escalada do dia"}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <input value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Usar nas postagens de esporte" />
        </Field>
        {form.tipo === "texto" ? (
          <Field label="Texto para copiar">
            <textarea spellCheck lang="pt-BR"
              rows={5}
              value={form.texto || ""}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              placeholder={"#futebol #esporte #domingo"}
            />
          </Field>
        ) : (
          <Field label="Link">
            <input value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          </Field>
        )}
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={pedirFechar}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar atalho</button>
        </div>
      </Drawer>
      {avisoNaoSalvo}

      <ConfirmDialog
        open={!!deleteTarget}
        itemLabel={deleteTarget ? deleteTarget.nome : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />
    </div>
  );
}
