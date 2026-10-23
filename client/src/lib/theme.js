// Modo de exibição (tema escuro padrão ou tema claro/branco), guardado no
// navegador de cada pessoa — não é algo do banco de dados, então cada
// usuário pode ter sua própria preferência na própria máquina, útil pra
// quem tem dificuldade de enxergar o tema escuro.

const STORAGE_KEY = "sintonia:theme";
const LIGHT_THEME = "claro";

function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === LIGHT_THEME ? LIGHT_THEME : "padrao";
  } catch (e) {
    return "padrao";
  }
}

// Aplica no <html> — chamado bem cedo (antes do React montar, em
// main.jsx) pra já carregar na cor certa, sem dar uma "piscada" no tema
// escuro antes de trocar.
function applyTheme(theme) {
  try {
    if (theme === LIGHT_THEME) {
      document.documentElement.setAttribute("data-theme", LIGHT_THEME);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch (e) {
    /* SSR ou ambiente sem document — ignora */
  }
}

function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    /* navegador sem localStorage (modo privado etc.) — só não persiste */
  }
  applyTheme(theme);
}

function toggleTheme() {
  const next = getTheme() === LIGHT_THEME ? "padrao" : LIGHT_THEME;
  setTheme(next);
  return next;
}

export { LIGHT_THEME, getTheme, applyTheme, setTheme, toggleTheme };
