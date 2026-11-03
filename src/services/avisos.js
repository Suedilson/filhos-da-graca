// Avisos na própria tela, no lugar do alert() do navegador.

const DURACAO_PADRAO = 5000
const ID_CONTAINER = 'avisos-container'

const estilosContainer = {
  position: 'fixed',
  left: '50%',
  bottom: '20px',
  transform: 'translateX(-50%)',
  zIndex: '10000',
  width: 'min(440px, calc(100% - 32px))',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  pointerEvents: 'none',
}

const cores = {
  sucesso: { fundo: '#eaf6df', borda: '#6fbd2a', texto: '#24461a' },
  erro: { fundo: '#fdecec', borda: '#d64545', texto: '#6b1d1d' },
  info: { fundo: '#ffffff', borda: '#17105f', texto: '#17105f' },
}

function detectarTipo(mensagem) {
  const texto = mensagem.toLowerCase()

  if (/erro|não foi possível|falha|inválid|sem permissão/.test(texto)) return 'erro'
  if (/sucesso|salv|enviad|aprovad|removid|excluíd|copiad|atualizad|cadastrad/.test(texto)) {
    return 'sucesso'
  }

  return 'info'
}

function obterContainer() {
  let container = document.getElementById(ID_CONTAINER)

  if (!container) {
    container = document.createElement('div')
    container.id = ID_CONTAINER
    container.setAttribute('aria-live', 'polite')
    Object.assign(container.style, estilosContainer)
    document.body.appendChild(container)
  }

  return container
}

export function mostrarAviso(mensagem, tipo) {
  const texto = String(mensagem ?? '')
  const cor = cores[tipo || detectarTipo(texto)] || cores.info
  const aviso = document.createElement('div')

  aviso.setAttribute('role', 'status')
  aviso.textContent = texto
  Object.assign(aviso.style, {
    padding: '14px 18px',
    background: cor.fundo,
    color: cor.texto,
    borderLeft: `5px solid ${cor.borda}`,
    borderRadius: '10px',
    boxShadow: '0 14px 36px rgba(23, 16, 95, 0.18)',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    fontWeight: '600',
    lineHeight: '1.4',
    whiteSpace: 'pre-line',
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  })

  const fechar = () => {
    aviso.style.opacity = '0'
    aviso.style.transform = 'translateY(8px)'
    setTimeout(() => aviso.remove(), 200)
  }

  aviso.addEventListener('click', fechar)
  const container = obterContainer()
  container.appendChild(aviso)

  // Mostra no máximo três avisos ao mesmo tempo; os mais antigos saem primeiro.
  while (container.children.length > 3) container.firstElementChild.remove()

  requestAnimationFrame(() => {
    aviso.style.opacity = '1'
    aviso.style.transform = 'translateY(0)'
  })

  setTimeout(fechar, Math.max(DURACAO_PADRAO, texto.length * 60))
}
