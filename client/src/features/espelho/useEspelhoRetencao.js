import { useEffect, useState } from "react";
import { apiGetEspelhoConfig } from "../../api/configuracoes.js";
import { onRealtimeMessage } from "../../lib/realtime.js";

// Quantos dias um espelho fica salvo (Configurações > Espelho). Fica em cache
// pra abrir rápido, é buscado de novo ao abrir a aba e atualiza na hora
// quando o admin muda o prazo ("espelho-config").
let cache = null;
export function useEspelhoRetencao() {
  const [dias, setDias] = useState(cache ?? 30);
  useEffect(() => {
    let ativo = true;
    apiGetEspelhoConfig().then((c) => { cache = c.retencaoDias; if (ativo) setDias(c.retencaoDias); }).catch(() => {});
    const sair = onRealtimeMessage((msg) => {
      if (msg.type === "espelho-config" && msg.payload) {
        cache = msg.payload.retencaoDias;
        if (ativo) setDias(msg.payload.retencaoDias);
      }
    });
    return () => { ativo = false; sair(); };
  }, []);
  return dias;
}
