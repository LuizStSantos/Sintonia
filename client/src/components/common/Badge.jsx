import { TONE } from "../../lib/constants.js";

// As cores ficam no CSS (classes .badge-<tom>) pra o tema claro poder ter as
// suas — antes eram fixas no estilo inline e ficavam escuras no tema branco.
export function Badge({ label, tone = "gray" }) {
  const tom = TONE[tone] ? tone : "gray";
  return <span className={`badge badge-${tom}`}>{label}</span>;
}
