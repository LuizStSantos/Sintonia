import { useEffect, useState } from "react";
import { apiGetRedes } from "../../api/configuracoes.js";
import { onRealtimeMessage } from "../../lib/realtime.js";
import { REDES_INICIAIS } from "../../lib/publicacoes.js";

// Lista de redes sociais (Configurações > Geral). Cache + atualização ao vivo ("redes-config").
let cache = null;
export function useRedes() {
  const [redes, setRedes] = useState(cache ?? REDES_INICIAIS);
  useEffect(() => {
    let ativo = true;
    apiGetRedes().then((c) => { cache = c.redes; if (ativo) setRedes(c.redes); }).catch(() => {});
    const sair = onRealtimeMessage((msg) => {
      if (msg.type === "redes-config" && msg.payload?.redes) { cache = msg.payload.redes; if (ativo) setRedes(msg.payload.redes); }
    });
    return () => { ativo = false; sair(); };
  }, []);
  return redes;
}
