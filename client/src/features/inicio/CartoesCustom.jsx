import { ExternalLink, Globe, ImageOff, Link2, Video } from "lucide-react";
import { youtubeEmbed, CORES_POSTIT } from "../../lib/inicioLayout.js";

// Conteúdo dos cartões que a pessoa cria (post-it, links, foto, vídeo).

// O texto do post-it se edita direto no cartão (sem "Personalizar"); a cor
// aparece ao passar o mouse. Quem salva é o InicioTab (`onChange`).
export function PostIt({ cartao, editando, onChange, pilha }) {
  return (
    <div className={`ini-postit cor-${cartao.cor}`}>
      <textarea
        className="ini-postit-texto"
        value={cartao.texto}
        maxLength={3000}
        placeholder="Escreva aqui…"
        spellCheck
        lang="pt-BR"
        aria-label="Texto do post-it"
        onChange={(e) => onChange({ texto: e.target.value })}
      />
      {!editando && (
        <div className="ini-postit-cores" aria-label="Cor do post-it">
          {CORES_POSTIT.map((cor) => (
            <button key={cor} type="button" className={`ini-cor cor-${cor}${cartao.cor === cor ? " ativa" : ""}`} aria-label={`Cor ${cor}`} onClick={() => onChange({ cor })} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Links({ cartao, editando }) {
  const itens = cartao.itens || [];
  return (
    <div className="ini-links">
      <div className="ini-cab"><Link2 size={15} /> <h3>{cartao.titulo || "Links"}</h3></div>
      {itens.length === 0 && <p className="inicio-vazio">{editando ? "Use o lápis para adicionar links." : "Nenhum link ainda."}</p>}
      <div className="ini-links-lista">
        {itens.map((l, i) => (
          <a key={i} className="ini-link" href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (editando) e.preventDefault(); }}>
            <span className="ini-link-nome">{l.nome || l.url.replace(/^https?:\/\//, "")}</span>
            <ExternalLink size={13} />
          </a>
        ))}
      </div>
    </div>
  );
}

export function Imagem({ cartao, editando }) {
  if (!cartao.src) return <div className="ini-midia-vazia"><ImageOff size={26} /><span>{editando ? "Use o lápis para escolher a foto." : "Sem foto"}</span></div>;
  return (
    <figure className="ini-midia">
      <img src={cartao.src} alt={cartao.legenda || "Imagem do Início"} className={cartao.ajuste === "conter" ? "conter" : "cobrir"} draggable={false} />
      {cartao.legenda && <figcaption>{cartao.legenda}</figcaption>}
    </figure>
  );
}

export function VideoCartao({ cartao, editando }) {
  const src = cartao.src;
  if (!src) return <div className="ini-midia-vazia"><Video size={26} /><span>{editando ? "Use o lápis para escolher o vídeo." : "Sem vídeo"}</span></div>;
  const yt = youtubeEmbed(src);
  const proprio = /^\/api\/inicio\/arquivos\//.test(src) || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(src);
  return (
    <figure className={`ini-midia${editando ? " sem-toque" : ""}`}>
      {yt ? (
        <iframe src={yt} title={cartao.legenda || "Vídeo"} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      ) : proprio ? (
        <video src={src} controls preload="metadata" playsInline />
      ) : (
        <a className="ini-link" href={src} target="_blank" rel="noopener noreferrer"><span className="ini-link-nome">Abrir vídeo</span><ExternalLink size={13} /></a>
      )}
      {cartao.legenda && <figcaption>{cartao.legenda}</figcaption>}
    </figure>
  );
}

// Site dentro do cartão (como um navegador pequeno). Alguns sites não deixam
// ser exibidos assim; por isso há sempre o botão de abrir em outra aba.
export function Site({ cartao, editando }) {
  if (!cartao.url) return <div className="ini-midia-vazia"><Globe size={26} /><span>{editando ? "Use o lápis para colocar o endereço." : "Sem site"}</span></div>;
  const nome = cartao.titulo || cartao.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="ini-site">
      <div className="ini-site-barra">
        <Globe size={14} />
        <span className="ini-site-nome" title={cartao.url}>{nome}</span>
        <a className="ini-site-abrir" href={cartao.url} target="_blank" rel="noopener noreferrer" title="Abrir em outra aba" onClick={(e) => { if (editando) e.preventDefault(); }}>
          <ExternalLink size={14} /> <span>Abrir</span>
        </a>
      </div>
      <div className={`ini-site-quadro${editando ? " sem-toque" : ""}`}>
        <iframe src={cartao.url} title={nome} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" />
      </div>
    </div>
  );
}
