// Botões das redes sociais da igreja (Instagram e YouTube).
// Os links vêm de configuracoes/redesSociais (editáveis no painel → Vídeos).

const YOUTUBE_PADRAO = 'https://www.youtube.com/channel/UCrAKS6wvm3Zx6cnf25xQL4w'

function IconeInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconeYoutube() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9L15.3 12l-5.6 3.1Z" />
    </svg>
  )
}

export default function RedesSociais({ redes, variante = 'topo' }) {
  const instagram = redes?.instagram || ''
  const youtube = redes?.youtube || YOUTUBE_PADRAO
  if (!instagram && !youtube) return null
  return (
    <div className={`social-links social-links-${variante}`}>
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" className="social-link social-instagram" aria-label="Instagram da igreja">
          <IconeInstagram />
          {variante !== 'topo' && <span>Instagram</span>}
        </a>
      )}
      {youtube && (
        <a href={youtube} target="_blank" rel="noopener noreferrer" className="social-link social-youtube" aria-label="YouTube da igreja">
          <IconeYoutube />
          {variante !== 'topo' && <span>YouTube</span>}
        </a>
      )}
    </div>
  )
}
