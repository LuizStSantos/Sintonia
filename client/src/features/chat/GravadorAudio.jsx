import { useEffect, useRef, useState } from "react";

// Gravação de voz pelo microfone (MediaRecorder do navegador). Só funciona em
// endereço seguro (https ou localhost) — o navegador bloqueia o microfone em
// http puro; nesse caso `onErro` recebe { tipo: "inseguro" } e a tela explica.
const EXT_POR_TIPO = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3" };
const MIN_SEG = 1;
export const MAX_GRAVACAO_SEG = 10 * 60;

export function formatarTempo(seg) {
  const s = Math.max(0, Math.round(seg || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useGravadorAudio({ onPronto, onErro }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const inicioRef = useRef(0);
  const canceladoRef = useRef(false);
  // Sempre a versão mais recente dos callbacks (a tela re-renderiza durante a gravação).
  const cbRef = useRef({ onPronto, onErro });
  cbRef.current = { onPronto, onErro };

  const limpar = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setGravando(false);
    setSegundos(0);
  };

  // Se sair da conversa no meio da gravação, descarta e solta o microfone.
  useEffect(() => () => {
    canceladoRef.current = true;
    try { recRef.current?.state === "recording" && recRef.current.stop(); } catch {}
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const iniciar = async () => {
    const suportado = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    if (!window.isSecureContext) { cbRef.current.onErro({ tipo: "inseguro" }); return; }
    if (!suportado) { cbRef.current.onErro({ tipo: "sem-suporte" }); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const tipo = e.name === "NotAllowedError" || e.name === "SecurityError" ? "negado" : e.name === "NotFoundError" ? "sem-microfone" : "outro";
      cbRef.current.onErro({ tipo, detalhe: e.message });
      return;
    }
    streamRef.current = stream;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t));
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch (e) {
      limpar();
      cbRef.current.onErro({ tipo: "sem-suporte", detalhe: e.message });
      return;
    }
    chunksRef.current = [];
    canceladoRef.current = false;
    rec.ondataavailable = (ev) => { if (ev.data?.size) chunksRef.current.push(ev.data); };
    rec.onstop = () => {
      const duracao = (Date.now() - inicioRef.current) / 1000;
      const cancelado = canceladoRef.current || duracao < MIN_SEG;
      const tipoBruto = rec.mimeType || mime || "audio/webm";
      const chunks = chunksRef.current;
      limpar();
      if (cancelado || chunks.length === 0) return;
      const tipo = tipoBruto.split(";")[0];
      const agora = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const nome = `audio-${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}-${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}.${EXT_POR_TIPO[tipo] || "webm"}`;
      cbRef.current.onPronto(new File(chunks, nome, { type: tipo }), Math.round(duracao));
    };
    recRef.current = rec;
    inicioRef.current = Date.now();
    rec.start();
    setGravando(true);
    setSegundos(0);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - inicioRef.current) / 1000;
      setSegundos(s);
      if (s >= MAX_GRAVACAO_SEG) enviar();
    }, 250);
  };

  const enviar = () => {
    canceladoRef.current = false;
    if (recRef.current?.state === "recording") recRef.current.stop();
  };
  const cancelar = () => {
    canceladoRef.current = true;
    if (recRef.current?.state === "recording") recRef.current.stop();
    else limpar();
  };

  return { gravando, segundos, iniciar, enviar, cancelar };
}
