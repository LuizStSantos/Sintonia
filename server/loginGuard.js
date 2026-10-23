// Proteção contra tentativa de adivinhar senha.
//
// Regras (fáceis de achar e mudar aqui):
//  - 5 senhas erradas seguidas para o MESMO usuário, vindas do MESMO lugar (IP),
//    bloqueiam esse usuário nesse lugar por 15 minutos. Assim quem erra a
//    senha não trava o usuário para os colegas, e quem tenta adivinhar não
//    consegue continuar.
//  - Teto extra por IP (50 erros em 15 min, qualquer usuário) contra quem fica
//    trocando de usuário a cada tentativa.
//  - Acertar a senha zera a contagem. Erros antigos (mais de 15 min sem novo
//    erro) também deixam de contar.
//  - Durante o bloqueio, até a senha CERTA é recusada (senão o bloqueio não
//    serviria de nada).
//  - A contagem fica na memória do servidor: reiniciar o servidor zera tudo.
//
// O IP vem de req.ip. Atrás de proxy (Nginx, Cloudflare...) é preciso definir
// TRUST_PROXY (ver docs/DEPLOY.md); sem isso todo mundo aparece com o IP do proxy.

export const LIMITE = {
  maxFalhas: 5,
  avisarAPartirDe: 3, // a partir da 3ª senha errada a tela diz quantas tentativas restam
  bloqueioMs: 15 * 60 * 1000,
  janelaMs: 15 * 60 * 1000,
  maxFalhasPorIp: 50,
};

const porUsuario = new Map(); // "usuario|ip" -> { falhas, ultima, ate }
const porIp = new Map();      // ip -> { falhas, ultima, ate }

const chaveUsuario = (usuario, ip) => `${String(usuario).trim().toLowerCase()}|${ip}`;

function vivo(reg, agora) {
  if (!reg) return null;
  if (reg.ate && reg.ate > agora) return reg;       // bloqueado
  if (reg.ate && reg.ate <= agora) return null;     // bloqueio acabou: começa do zero
  if (agora - reg.ultima > LIMITE.janelaMs) return null; // erros velhos não contam
  return reg;
}

// { bloqueado, ate (ms) }
export function verificarBloqueio(usuario, ip, agora = Date.now()) {
  for (const [mapa, chave] of [[porUsuario, chaveUsuario(usuario, ip)], [porIp, ip]]) {
    const reg = vivo(mapa.get(chave), agora);
    if (reg?.ate && reg.ate > agora) return { bloqueado: true, ate: reg.ate };
  }
  return { bloqueado: false };
}

function somarFalha(mapa, chave, max, agora) {
  const reg = vivo(mapa.get(chave), agora) || { falhas: 0, ultima: agora, ate: 0 };
  reg.falhas += 1;
  reg.ultima = agora;
  if (reg.falhas >= max) reg.ate = agora + LIMITE.bloqueioMs;
  mapa.set(chave, reg);
  return reg;
}

// Registra uma senha errada. Devolve { bloqueou, ate, restantes, motivo }.
export function registrarFalha(usuario, ip, agora = Date.now()) {
  const u = somarFalha(porUsuario, chaveUsuario(usuario, ip), LIMITE.maxFalhas, agora);
  const i = somarFalha(porIp, ip, LIMITE.maxFalhasPorIp, agora);
  if (u.ate) return { bloqueou: true, ate: u.ate, restantes: 0, motivo: "usuario" };
  if (i.ate) return { bloqueou: true, ate: i.ate, restantes: 0, motivo: "ip" };
  return { bloqueou: false, restantes: LIMITE.maxFalhas - u.falhas };
}

export function registrarSucesso(usuario, ip) {
  porUsuario.delete(chaveUsuario(usuario, ip));
}

// Texto "HH:MM" no fuso do servidor (TZ do docker-compose).
export function horaLocal(ms) {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function mensagemBloqueio(ate, agora = Date.now()) {
  const min = Math.max(1, Math.ceil((ate - agora) / 60000));
  return `Muitas tentativas erradas. Por segurança, o acesso está bloqueado por ${min} ${min === 1 ? "minuto" : "minutos"} (volta às ${horaLocal(ate)}).`;
}

export function mensagemFalha(restantes) {
  if (restantes > LIMITE.maxFalhas - LIMITE.avisarAPartirDe) return "Usuário ou senha inválidos";
  return `Usuário ou senha inválidos. ${restantes === 1 ? "Resta 1 tentativa" : `Restam ${restantes} tentativas`} antes do bloqueio temporário.`;
}

// Limpeza de registros velhos (não deixa o mapa crescer pra sempre).
const faxina = setInterval(() => {
  const agora = Date.now();
  for (const mapa of [porUsuario, porIp]) {
    for (const [k, reg] of mapa) if (!vivo(reg, agora)) mapa.delete(k);
  }
}, 10 * 60 * 1000);
faxina.unref();

// Só pra testes.
export function _zerar() { porUsuario.clear(); porIp.clear(); }
