// Ícone do Sintonia (quadrado vermelho com a antena). É o mesmo desenho do
// favicon (client/public/favicon.svg), do ícone das notificações
// (NOTIFICATION_ICON em lib/realtime.js) e do e-mail de backup
// (server/assets/sintonia-icone.png) — se mudar um, mude os outros.
export function BrandIcon({ size = 36 }) {
  return (
    <svg className="brand-icon" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Sintonia">
      <rect width="64" height="64" rx="14" fill="#E4372B" />
      <g transform="translate(15,15) scale(1.417)" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
        <path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" />
        <circle cx="12" cy="9" r="2" />
        <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47" />
        <path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1" />
        <path d="M9.5 18h5" />
        <path d="m8 22 4-11 4 11" />
      </g>
    </svg>
  );
}
