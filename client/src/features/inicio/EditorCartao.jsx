import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, AlertTriangle, Search } from "lucide-react";
import { buscarCidades } from "./CartaoTempo.jsx";
import { Field } from "../../components/common/Field.jsx";
import { Select } from "../../components/common/Select.jsx";
import { apiEnviarArquivoInicio, apiGetInicioEspaco } from "../../api/inicio.js";
import { normalizarUrl, urlValida, ehArquivoProprio } from "../../lib/inicioLayout.js";

export function formatarBytes(b) {
  if (b < 1024 ** 2) return `${Math.max(0, Math.round(b / 1024))} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(b / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

const TITULO = { links: "Links do cartão", imagem: "Foto ou imagem", video: "Vídeo", tempo: "Tempo", site: "Site no cartão" };

// Janela para editar o conteúdo de um cartão de links, foto ou vídeo.
export function EditorCartao({ cartao, onSalvar, onCancelar }) {
  const midia = cartao.tipo === "imagem" || cartao.tipo === "video";
  const [f, setF] = useState(() => ({ ...cartao, itens: (cartao.itens || []).map((i) => ({ ...i })) }));
  const [modo, setModo] = useState(cartao.src && !ehArquivoProprio(cartao.src) ? "link" : "arquivo");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);
  const [espaco, setEspaco] = useState(null);
  const carregarEspaco = () => apiGetInicioEspaco().then(setEspaco).catch(() => {});
  useEffect(() => { if (midia) carregarEspaco(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const escolherArquivo = async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    if (cartao.tipo === "imagem" && !arq.type.startsWith("image/")) { setErro("Escolha uma imagem (JPG, PNG, GIF ou WEBP)."); return; }
    if (cartao.tipo === "video" && !arq.type.startsWith("video/")) { setErro("Escolha um vídeo (MP4, WEBM ou MOV)."); return; }
    setErro(""); setEnviando(true);
    try {
      const r = await apiEnviarArquivoInicio(arq);
      setF((x) => ({ ...x, src: r.url, nomeArquivo: arq.name }));
    } catch (err) { setErro(err.message); }
    carregarEspaco();
    setEnviando(false);
  };

  // Tempo: busca da cidade
  const [busca, setBusca] = useState("");
  const [achadas, setAchadas] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const procurar = async () => {
    const t = busca.trim();
    if (t.length < 2) return;
    setErro(""); setBuscando(true);
    try { setAchadas(await buscarCidades(t)); }
    catch { setErro("Não foi possível buscar a cidade agora. Confira a internet e tente de novo."); }
    setBuscando(false);
  };

  const salvar = () => {
    setErro("");
    if (cartao.tipo === "tempo") {
      if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) { setErro("Busque e escolha a sua cidade."); return; }
      onSalvar({ cidade: f.cidade, lat: f.lat, lon: f.lon });
      return;
    }
    if (cartao.tipo === "site") {
      const url = normalizarUrl(f.url);
      if (!url || !urlValida(url)) { setErro("Esse endereço não parece válido."); return; }
      onSalvar({ titulo: (f.titulo || "").trim(), url });
      return;
    }
    if (cartao.tipo === "links") {
      const itens = f.itens.map((i) => ({ nome: (i.nome || "").trim(), url: normalizarUrl(i.url) })).filter((i) => i.url);
      const ruim = itens.find((i) => !urlValida(i.url));
      if (ruim) { setErro(`O endereço "${ruim.url}" não parece um link válido.`); return; }
      onSalvar({ titulo: (f.titulo || "").trim(), itens });
      return;
    }
    const src = f.src && ehArquivoProprio(f.src) ? f.src : normalizarUrl(f.src);
    if (!src) { setErro(modo === "arquivo" ? "Envie um arquivo ou use a aba de link." : "Cole o link."); return; }
    if (!ehArquivoProprio(src) && !urlValida(src)) { setErro("Esse link não parece válido."); return; }
    const { nomeArquivo, ...resto } = f;
    onSalvar({ src, legenda: (f.legenda || "").trim(), ...(cartao.tipo === "imagem" ? { ajuste: f.ajuste } : {}) });
  };

  return (
    <div className="confirm-overlay" onClick={onCancelar}>
      <div className="confirm-panel ini-editor" onClick={(e) => e.stopPropagation()}>
        <h3>{TITULO[cartao.tipo]}</h3>

        {cartao.tipo === "tempo" && (
          <>
            <Field label="Cidade">
              <div className="date-add-row">
                <input value={busca} maxLength={80} placeholder="Ex.: Goiânia" onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") procurar(); }} />
                <button type="button" className="btn-ghost" onClick={procurar} disabled={buscando || busca.trim().length < 2}><Search size={14} /> {buscando ? "Buscando..." : "Buscar"}</button>
              </div>
            </Field>
            {achadas && achadas.length === 0 && <p className="armaz-legenda">Nenhuma cidade encontrada com esse nome.</p>}
            {achadas && achadas.length > 0 && (
              <div className="ini-cidades">
                {achadas.map((c, i) => (
                  <button key={i} type="button" className={`ini-cidade${f.lat === c.lat && f.lon === c.lon ? " ativa" : ""}`} onClick={() => setF({ ...f, cidade: c.nome, lat: c.lat, lon: c.lon })}>{c.nome}</button>
                ))}
              </div>
            )}
            <p className="armaz-legenda">{Number.isFinite(f.lat) ? `Cidade escolhida: ${f.cidade}.` : "Digite o nome da cidade e escolha na lista."} Previsão do Open-Meteo, atualizada a cada 10 minutos.</p>
          </>
        )}

        {cartao.tipo === "site" && (
          <>
            <Field label="Endereço do site">
              <input value={f.url || ""} maxLength={1000} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="www.site.com.br" onChange={(e) => setF({ ...f, url: e.target.value })} />
            </Field>
            <Field label="Nome (opcional)">
              <input value={f.titulo || ""} maxLength={60} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
            </Field>
            <p className="armaz-legenda">O site aparece dentro do cartão, como um navegador pequeno. Alguns sites (bancos, Google, redes sociais) não permitem ser mostrados assim: nesses, use o botão <b>Abrir</b> do cartão, que abre o site em outra aba.</p>
          </>
        )}

        {cartao.tipo === "links" && (
          <>
            <Field label="Título do cartão">
              <input value={f.titulo || ""} maxLength={60} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Sites que eu uso" />
            </Field>
            <div className="ini-editor-links">
              {f.itens.map((it, i) => (
                <div className="ini-editor-link" key={i}>
                  <input value={it.nome} maxLength={80} placeholder="Nome" onChange={(e) => setF({ ...f, itens: f.itens.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
                  <input value={it.url} maxLength={500} placeholder="www.site.com.br" inputMode="url" autoCapitalize="none" spellCheck={false} onChange={(e) => setF({ ...f, itens: f.itens.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                  <button type="button" className="icon-btn danger" aria-label="Remover link" onClick={() => setF({ ...f, itens: f.itens.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost" disabled={f.itens.length >= 40} onClick={() => setF({ ...f, itens: [...f.itens, { nome: "", url: "" }] })}><Plus size={14} /> Adicionar link</button>
          </>
        )}

        {midia && (
          <>
            <div className="ini-abas" role="tablist">
              <button type="button" role="tab" aria-selected={modo === "arquivo"} className={modo === "arquivo" ? "ativa" : ""} onClick={() => setModo("arquivo")}>Enviar arquivo</button>
              <button type="button" role="tab" aria-selected={modo === "link"} className={modo === "link" ? "ativa" : ""} onClick={() => setModo("link")}>Colar link</button>
            </div>
            {modo === "arquivo" ? (
              <div className="ini-envio">
                <input ref={inputRef} type="file" hidden accept={cartao.tipo === "imagem" ? "image/jpeg,image/png,image/gif,image/webp" : "video/mp4,video/webm,video/quicktime"} onChange={escolherArquivo} />
                <button type="button" className="btn-ghost" disabled={enviando} onClick={() => inputRef.current?.click()}><Upload size={15} /> {enviando ? "Enviando..." : f.src && ehArquivoProprio(f.src) ? "Trocar arquivo" : "Escolher arquivo"}</button>
                {espaco && (
                  <>
                    <div className="armaz-barra" role="progressbar" aria-valuenow={Math.round(Math.min(100, espaco.usadoBytes / espaco.quotaBytes * 100))} aria-valuemin={0} aria-valuemax={100}>
                      <div className={`armaz-barra-cheia${espaco.usadoBytes / espaco.quotaBytes >= 0.9 ? " alerta" : ""}`} style={{ width: `${Math.max(Math.min(100, espaco.usadoBytes / espaco.quotaBytes * 100), espaco.usadoBytes ? 2 : 0)}%` }} />
                    </div>
                    <p className="armaz-legenda">Seu espaço: {formatarBytes(espaco.usadoBytes)} de {formatarBytes(espaco.quotaBytes)} usados.</p>
                  </>
                )}
                <p className="armaz-legenda">{f.src && ehArquivoProprio(f.src) ? `Arquivo enviado${f.nomeArquivo ? `: ${f.nomeArquivo}` : ""}.` : cartao.tipo === "imagem" ? "JPG, PNG, GIF ou WEBP, até 15 MB." : "MP4, WEBM ou MOV, até 150 MB."}</p>
              </div>
            ) : (
              <Field label={cartao.tipo === "imagem" ? "Endereço da imagem" : "Endereço do vídeo (YouTube ou arquivo .mp4)"}>
                <input value={ehArquivoProprio(f.src) ? "" : f.src || ""} maxLength={1000} inputMode="url" autoCapitalize="none" spellCheck={false}
                  placeholder={cartao.tipo === "imagem" ? "https://..." : "https://www.youtube.com/watch?v=..."} onChange={(e) => setF({ ...f, src: e.target.value })} />
              </Field>
            )}
            <Field label="Legenda (opcional)">
              <input value={f.legenda || ""} maxLength={120} onChange={(e) => setF({ ...f, legenda: e.target.value })} />
            </Field>
            {cartao.tipo === "imagem" && (
              <Field label="Como mostrar">
                <Select value={f.ajuste || "cobrir"} onChange={(e) => setF({ ...f, ajuste: e.target.value })}>
                  <option value="cobrir">Preencher o cartão (pode cortar as bordas)</option>
                  <option value="conter">Mostrar a imagem inteira</option>
                </Select>
              </Field>
            )}
          </>
        )}

        {erro && <p className="duplicate-warning" role="alert"><AlertTriangle size={15} /> <span>{erro}</span></p>}
        <div className="drawer-actions">
          <button className="btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={enviando}>Pronto</button>
        </div>
      </div>
    </div>
  );
}
