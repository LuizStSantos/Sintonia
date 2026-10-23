import { Youtube, Instagram, Facebook, Globe, Twitter } from "lucide-react";

// Ícone de cada rede social (pelo nome). Redes cadastradas pelo admin que não
// têm ícone próprio aparecem como um círculo com a inicial.
const norm = (s) => String(s || "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
const COR = { youtube: "#ef4444", instagram: "#ec4899", facebook: "#3b82f6", tiktok: "#22d3ee", whatsapp: "#22c55e", site: "#60a5fa", portal: "#60a5fa", x: "#9ca3af", twitter: "#38bdf8" };

function Tiktok({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>;
}
function Whatsapp({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>;
}

export function IconeRede({ rede, size = 16 }) {
  const k = norm(rede);
  const cor = COR[k];
  let icone;
  if (k === "youtube") icone = <Youtube size={size} />;
  else if (k === "instagram") icone = <Instagram size={size} />;
  else if (k === "facebook") icone = <Facebook size={size} />;
  else if (k === "tiktok") icone = <Tiktok size={size} />;
  else if (k === "whatsapp") icone = <Whatsapp size={size} />;
  else if (k === "site" || k === "portal") icone = <Globe size={size} />;
  else if (k === "x" || k === "twitter") icone = <Twitter size={size} />;
  else icone = <span className="rede-inicial" style={{ width: size, height: size, fontSize: Math.round(size * 0.65) }}>{String(rede || "?").trim().charAt(0).toLocaleUpperCase("pt-BR")}</span>;
  return <span className="rede-icone" style={cor ? { color: cor } : undefined} title={rede} role="img" aria-label={rede}>{icone}</span>;
}
