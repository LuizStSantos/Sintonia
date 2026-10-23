import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { LIGHT_THEME, getTheme, toggleTheme } from "../../lib/theme.js";

// Botão pra trocar entre o tema escuro (padrão) e o tema claro/branco, pra
// quem tem dificuldade de enxergar o tema escuro. Aparece tanto na tela de
// login quanto dentro do sistema.
export function ThemeToggle({ className = "" }) {
  const [theme, setThemeState] = useState(getTheme());
  const active = theme === LIGHT_THEME;

  const onClick = () => setThemeState(toggleTheme());

  return (
    <button
      type="button"
      className={`btn-ghost theme-toggle-btn ${className}`}
      onClick={onClick}
      aria-pressed={active}
      title={active ? "Voltar pro tema escuro" : "Trocar pro tema claro (fundo branco)"}
    >
      {active ? <Moon size={14} strokeWidth={2.2} /> : <Sun size={14} strokeWidth={2.2} />}
      {active ? "Tema escuro" : "Tema claro"}
    </button>
  );
}
