import { Video, BookUser, Mic, Clapperboard, Tv2, ScrollText, Building2, Banknote, Wallet, Contact, Link2 } from "lucide-react";

export const TABS = [
  { id: "materias", label: "Matérias", icon: Video },
  { id: "contatos", label: "Contatos", icon: BookUser },
  { id: "entrevistados", label: "Entrevistados", icon: Mic },
  { id: "programas", label: "Programas", icon: Clapperboard },
  { id: "opec", label: "OPEC", icon: Tv2 },
  { id: "espelho", label: "Espelho", icon: ScrollText },
  { id: "clientesFornecedores", label: "Clientes / Fornecedores", icon: Building2 },
  { id: "contasReceber", label: "Contas a receber", icon: Banknote },
  { id: "contasPagar", label: "Contas a pagar", icon: Wallet },
  { id: "colaboradores", label: "Colaboradores", icon: Contact },
  { id: "atalhos", label: "Atalhos", icon: Link2 },
];


export default TABS;
