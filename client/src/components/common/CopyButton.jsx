import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ label, getValue }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const text = (getValue() || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="btn-ghost copy-btn" onClick={handleCopy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copiado!" : label}
    </button>
  );
}

