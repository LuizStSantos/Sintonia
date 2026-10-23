import { useState } from "react";
import { VALIDATOR_CONFIG } from "../../lib/validators.js";

export function ValidatedInput({ type, value, onChange, className = "", ...rest }) {
  const [touched, setTouched] = useState(false);
  const config = VALIDATOR_CONFIG[type];
  const isEmpty = !value || !String(value).trim();
  const isValid = isEmpty || !config || config.validate(value);
  const showError = touched && !isValid;

  const handleChange = (e) => {
    const raw = config?.format ? config.format(e.target.value) : e.target.value;
    onChange(raw);
  };

  return (
    <>
      <input
        {...rest}
        className={`${className} ${showError ? "input-invalid" : ""}`.trim()}
        value={value || ""}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        inputMode={type === "cpf" || type === "cnpj" || type === "phone" ? "numeric" : type === "email" ? "email" : undefined}
      />
      {showError && <span className="field-error-msg">{config.message}</span>}
    </>
  );
}

