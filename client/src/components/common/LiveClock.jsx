import { useEffect, useState } from "react";
import { formatHora, formatData } from "../../lib/fuso.js";

export function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = formatHora(now, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const date = formatData(now, { weekday: "short", day: "2-digit", month: "short" });
  return (
    <div className="clock-block">
      <div className="on-air">
        <span className="on-air-dot" />
        NO AR
      </div>
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  );
}

