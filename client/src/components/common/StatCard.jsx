import { TONE } from "../../lib/constants.js";

export function StatCard({ label, value, tone = "gray", icon: Icon }) {
  const t = TONE[tone] || TONE.gray;
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span style={{ color: t.text }}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="stat-value" style={{ color: t.text !== TONE.gray.text ? "var(--text)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

