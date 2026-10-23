import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Moon, Sun, Wind } from "lucide-react";

// Cartão "Tempo": previsão do Open-Meteo (gratuito, sem cadastro) para a cidade escolhida.

const CODIGOS = [
  [[0], "Céu limpo", "sol"],
  [[1], "Poucas nuvens", "solnuvem"],
  [[2], "Parcialmente nublado", "solnuvem"],
  [[3], "Nublado", "nuvem"],
  [[45, 48], "Neblina", "neblina"],
  [[51, 53, 55, 56, 57], "Garoa", "garoa"],
  [[61, 63, 65, 66, 67], "Chuva", "chuva"],
  [[71, 73, 75, 77, 85, 86], "Neve", "neve"],
  [[80, 81, 82], "Pancadas de chuva", "chuva"],
  [[95, 96, 99], "Tempestade", "raio"],
];
export function descreverTempo(codigo) {
  const r = CODIGOS.find(([cs]) => cs.includes(codigo));
  return r ? { texto: r[1], icone: r[2] } : { texto: "—", icone: "nuvem" };
}
export function IconeTempo({ tipo, noite, size = 28 }) {
  const P = { size, strokeWidth: 1.7 };
  if (tipo === "sol") return noite ? <Moon {...P} /> : <Sun {...P} />;
  if (tipo === "solnuvem") return noite ? <CloudMoon {...P} /> : <CloudSun {...P} />;
  if (tipo === "neblina") return <CloudFog {...P} />;
  if (tipo === "garoa") return <CloudDrizzle {...P} />;
  if (tipo === "chuva") return <CloudRain {...P} />;
  if (tipo === "neve") return <CloudSnow {...P} />;
  if (tipo === "raio") return <CloudLightning {...P} />;
  return <Cloud {...P} />;
}

export async function buscarCidades(nome) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=6&language=pt&format=json`);
  if (!r.ok) throw new Error("busca");
  const j = await r.json();
  return (j.results || []).map((c) => ({
    nome: [c.name, c.admin1, c.country].filter(Boolean).join(", "),
    curto: c.name,
    lat: c.latitude,
    lon: c.longitude,
  }));
}

const cache = new Map(); // "lat,lon" -> { t, dados }
const VALIDADE = 10 * 60 * 1000;
async function carregar(lat, lon) {
  const k = `${lat},${lon}`;
  const c = cache.get(k);
  if (c && Date.now() - c.t < VALIDADE) return c.dados;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("previsão");
  const dados = await r.json();
  cache.set(k, { t: Date.now(), dados });
  return dados;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const graus = (n) => `${Math.round(n)}°`;

export function Tempo({ cartao, editando }) {
  const { lat, lon, cidade } = cartao;
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const temLocal = Number.isFinite(lat) && Number.isFinite(lon);

  useEffect(() => {
    if (!temLocal) return undefined;
    let ativo = true;
    const buscar = () => carregar(lat, lon).then((d) => { if (ativo) { setDados(d); setErro(false); } }).catch(() => { if (ativo) setErro(true); });
    setDados(null);
    buscar();
    const t = setInterval(buscar, VALIDADE);
    return () => { ativo = false; clearInterval(t); };
  }, [lat, lon, temLocal]);

  if (!temLocal) return <div className="ini-midia-vazia"><CloudSun size={26} /><span>{editando ? "Use o lápis para escolher a cidade." : "Sem cidade escolhida"}</span></div>;
  if (!dados) return <div className="ini-midia-vazia"><CloudSun size={26} /><span>{erro ? "Não foi possível carregar o tempo agora." : "Carregando o tempo..."}</span></div>;

  const c = dados.current;
  const atual = descreverTempo(c.weather_code);
  const d = dados.daily;
  return (
    <div className="ini-tempo">
      <div className="ini-tempo-cidade"><MapPin size={13} /> <span>{cidade || "Tempo"}</span></div>
      <div className="ini-tempo-agora">
        <span className="ini-tempo-icone"><IconeTempo tipo={atual.icone} noite={c.is_day === 0} size={44} /></span>
        <span className="ini-tempo-temp">{graus(c.temperature_2m)}</span>
        <span className="ini-tempo-desc">{atual.texto}</span>
      </div>
      <div className="ini-tempo-detalhes">
        <span title="Sensação térmica">Sensação {graus(c.apparent_temperature)}</span>
        <span title="Umidade"><Droplets size={12} /> {Math.round(c.relative_humidity_2m)}%</span>
        <span title="Vento"><Wind size={12} /> {Math.round(c.wind_speed_10m)} km/h</span>
      </div>
      <div className="ini-tempo-prev">
        {d.time.map((dia, i) => {
          const info = descreverTempo(d.weather_code[i]);
          const chuva = d.precipitation_probability_max?.[i];
          return (
            <div key={dia} className="ini-tempo-dia" title={`${info.texto}${chuva != null ? ` · chuva ${chuva}%` : ""}`}>
              <span className="ini-tempo-dia-nome">{i === 0 ? "Hoje" : DIAS[new Date(`${dia}T12:00:00`).getDay()]}</span>
              <IconeTempo tipo={info.icone} size={20} />
              <span className="ini-tempo-dia-temp"><b>{graus(d.temperature_2m_max[i])}</b> <small>{graus(d.temperature_2m_min[i])}</small></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
