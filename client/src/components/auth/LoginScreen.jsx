import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { BrandIcon } from "../common/BrandIcon.jsx";
import { authLogin } from "../../api/auth.js";
import { Field } from "../common/Field.jsx";
import { PasswordInput } from "../common/PasswordInput.jsx";
import { ThemeToggle } from "../common/ThemeToggle.jsx";

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Quando o servidor bloqueia por senhas erradas, o botão fica travado até a hora liberada.
  const [bloqueadoAte, setBloqueadoAte] = useState(null);
  const [agora, setAgora] = useState(Date.now());
  const bloqueado = bloqueadoAte !== null && agora < bloqueadoAte;
  useEffect(() => {
    if (bloqueadoAte === null) return undefined;
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= bloqueadoAte) { setBloqueadoAte(null); setError(""); }
    }, 1000);
    return () => clearInterval(t);
  }, [bloqueadoAte]);

  const submit = async () => {
    if (!username.trim() || !password || loading || bloqueado) return;
    setLoading(true);
    setError("");
    try {
      const user = await authLogin(username.trim(), password);
      onLogin(user);
    } catch (e) {
      setError(e.message || "Falha no login");
      if (e.bloqueadoAte) { setAgora(Date.now()); setBloqueadoAte(new Date(e.bloqueadoAte).getTime()); }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="login-shell">
      <ThemeToggle className="login-theme-toggle" />
      <div className="login-card">
        <div className="brand login-brand">
          <BrandIcon size={36} />
          <div className="brand-text">
            <div className="brand-title">Sintonia</div>
            <div className="brand-sub">Entrar no sistema</div>
          </div>
        </div>
        <Field label="Usuário">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Senha">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </Field>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button
          className="btn-primary login-submit"
          onClick={submit}
          disabled={loading || bloqueado}
        >
          <Lock size={15} strokeWidth={2.4} />
          {loading ? "Entrando..." : bloqueado ? "Bloqueado" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

