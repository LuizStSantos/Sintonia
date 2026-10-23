import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { formatarTempo } from "./GravadorAudio.jsx";

// Player de áudio do balão: play/pause, barra de progresso clicável, tempo e
// velocidade (1x → 1,5x → 2x). Só um áudio toca por vez.
const VELOCIDADES = [1, 1.5, 2];

export function AudioPlayer({ src, duracaoSeg, nome }) {
  const ref = useRef(null);
  const ajustandoRef = useRef(false);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [dur, setDur] = useState(duracaoSeg || 0);
  const [vel, setVel] = useState(1);

  const alternar = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      document.querySelectorAll("audio").forEach((o) => { if (o !== a) o.pause(); });
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  // Gravações do navegador (webm) costumam vir sem duração no cabeçalho
  // (duration = Infinity) e não deixam "pular" na barra. O truque de ir pro
  // fim força o navegador a calcular a duração e liberar o seek.
  const aoCarregar = () => {
    const a = ref.current;
    if (a.duration === Infinity || Number.isNaN(a.duration)) {
      ajustandoRef.current = true;
      a.currentTime = 1e101;
    } else {
      setDur(a.duration);
    }
  };
  const aoTempo = () => {
    const a = ref.current;
    if (ajustandoRef.current) {
      if (Number.isFinite(a.duration)) {
        setDur(a.duration);
        ajustandoRef.current = false;
        a.currentTime = 0;
      }
      return;
    }
    setAtual(a.currentTime);
  };

  const pular = (e) => {
    const a = ref.current;
    const total = dur || duracaoSeg || 0;
    if (!a || !total) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    a.currentTime = frac * total;
    setAtual(a.currentTime);
  };

  const trocarVelocidade = () => {
    const prox = VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length];
    setVel(prox);
    if (ref.current) ref.current.playbackRate = prox;
  };

  const total = dur || duracaoSeg || 0;
  const pct = total ? Math.min(100, (atual / total) * 100) : 0;

  return (
    <div className="chat-audio" aria-label={nome ? `Áudio ${nome}` : "Áudio"}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={aoCarregar}
        onTimeUpdate={aoTempo}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => { setTocando(false); setAtual(0); }}
      />
      <button type="button" className="chat-audio-play" aria-label={tocando ? "Pausar" : "Tocar"} onClick={alternar}>
        {tocando ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="chat-audio-meio">
        <div className="chat-audio-barra" onClick={pular} role="slider" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(atual)}>
          <div className="chat-audio-progresso" style={{ width: `${pct}%` }} />
          <div className="chat-audio-bolinha" style={{ left: `${pct}%` }} />
        </div>
        <span className="chat-audio-tempo">{formatarTempo(tocando || atual > 0 ? atual : total)}{total && (tocando || atual > 0) ? ` / ${formatarTempo(total)}` : ""}</span>
      </div>
      <button type="button" className="chat-audio-vel" aria-label="Velocidade" onClick={trocarVelocidade}>{vel === 1 ? "1x" : `${String(vel).replace(".", ",")}x`}</button>
    </div>
  );
}
