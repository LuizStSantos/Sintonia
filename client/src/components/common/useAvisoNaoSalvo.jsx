import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog.jsx";

// Aviso de "alterações não salvas" para os formulários laterais (Drawer).
//
// Ao ABRIR o formulário o gancho guarda uma foto dos valores; ao tentar FECHAR
// (X, "Cancelar" ou clique fora) compara com a foto: se nada mudou, fecha direto;
// se mudou, pergunta antes — assim ninguém perde o que digitou por um clique
// sem querer. Salvar fecha o formulário normalmente (sem pergunta), porque quem
// salva chama o `fechar` por conta própria.
//
//   const { pedirFechar, aviso } = useAvisoNaoSalvo({ aberto: drawerOpen, valores: form, fechar: () => setDrawerOpen(false) });
//   <Drawer onClose={pedirFechar}> ... <button onClick={pedirFechar}>Cancelar</button> </Drawer>
//   {aviso}
//
// Também avisa o navegador (recarregar/fechar a aba do navegador) enquanto há alteração.
export function useAvisoNaoSalvo({ aberto, valores, fechar }) {
  const inicial = useRef(null);
  const [perguntando, setPerguntando] = useState(false);

  // A foto é tirada logo depois da renderização em que o formulário abriu — nesse
  // momento `valores` já são os do formulário novo (ou do item que vai ser editado).
  useEffect(() => {
    inicial.current = aberto ? JSON.stringify(valores) : null;
    if (!aberto) setPerguntando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const sujo = aberto && inicial.current !== null && JSON.stringify(valores) !== inicial.current;

  useEffect(() => {
    if (!sujo) return undefined;
    const aoSair = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [sujo]);

  const pedirFechar = () => { if (sujo) setPerguntando(true); else fechar(); };

  const aviso = (
    <ConfirmDialog
      open={perguntando}
      title="Sair sem salvar?"
      message="Você tem alterações que ainda não foram salvas. Se fechar agora, tudo que foi digitado será perdido."
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      onCancel={() => setPerguntando(false)}
      onConfirm={() => { setPerguntando(false); fechar(); }}
    />
  );

  return { pedirFechar, aviso, sujo };
}
