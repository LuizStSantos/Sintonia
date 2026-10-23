import "./styles/index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { GlobalTooltip } from "./components/common/GlobalTooltip.jsx";
import { MobileTables } from "./components/common/MobileTables.jsx";
import { applyTheme, getTheme } from "./lib/theme.js";

// Aplica o tema salvo (padrão ou alto contraste) antes do React montar a
// árvore, pra não dar uma "piscada" no tema padrão antes de trocar.
applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <GlobalTooltip />
    <MobileTables />
  </React.StrictMode>
);
