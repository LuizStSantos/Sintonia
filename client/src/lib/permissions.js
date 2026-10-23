const TAB_PERMISSION_META = [
  { key: "materias", label: "Matérias" },
  { key: "contatos", label: "Contatos" },
  { key: "entrevistados", label: "Entrevistados" },
  { key: "programas", label: "Programas" },
  { key: "opec", label: "OPEC" },
  { key: "espelho", label: "Espelho" },
  { key: "clientesFornecedores", label: "Clientes / Fornecedores" },
  { key: "contasReceber", label: "Contas a receber" },
  { key: "contasPagar", label: "Contas a pagar" },
  { key: "colaboradores", label: "Colaboradores" },
  { key: "atalhos", label: "Atalhos" },
];

const permissionLabel = (level) =>
  level === "edit" ? "Editar" : level === "view" ? "Visualizar" : "Sem acesso";

function summarizePermissions(perms) {
  const entries = TAB_PERMISSION_META.filter((t) => (perms?.[t.key] || "none") !== "none");
  if (entries.length === 0) return "Nenhum acesso";
  return entries.map((t) => `${t.label}: ${permissionLabel(perms[t.key])}`).join(" · ");
}


export { TAB_PERMISSION_META, permissionLabel, summarizePermissions };
