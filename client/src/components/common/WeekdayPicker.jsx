import { WEEKDAYS } from "../../lib/dates.js";

export function WeekdayPicker({ value = [], onChange }) {
  const toggle = (key) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else onChange([...value, key]);
  };
  return (
    <div className="weekday-picker">
      {WEEKDAYS.map((d) => (
        <button
          type="button"
          key={d.key}
          className={`weekday-chip ${value.includes(d.key) ? "active" : ""}`}
          onClick={() => toggle(d.key)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

