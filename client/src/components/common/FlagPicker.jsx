import { TONE, FLAG_META } from "../../lib/constants.js";

export function FlagPicker({ value = [], onChange }) {
  const toggle = (key) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else onChange([...value, key]);
  };
  return (
    <div className="weekday-picker">
      {FLAG_META.map((f) => {
        const active = value.includes(f.key);
        const t = TONE[f.tone];
        return (
          <button
            type="button"
            key={f.key}
            className="weekday-chip flag-chip"
            style={active ? { background: t.text, borderColor: t.text, color: "#14161A" } : undefined}
            onClick={() => toggle(f.key)}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

