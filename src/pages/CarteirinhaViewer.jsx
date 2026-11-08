import { useEffect, useRef, useState } from 'react'
import './CarteirinhaViewer.css'

// Transforma as páginas do PDF (frente e verso) em imagens nítidas
async function paginasComoImagens(dadosPdf) {
  const pdfjs = await import('pdfjs-dist')
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  // Cópia dos bytes: o pdf.js consome o buffer que recebe
  const documento = await pdfjs.getDocument({ data: new Uint8Array(dadosPdf).slice() }).promise
  const imagens = []
  for (let n = 1; n <= documento.numPages; n += 1) {
    const pagina = await documento.getPage(n)
    const base = pagina.getViewport({ scale: 1 })
    const viewport = pagina.getViewport({ scale: 1600 / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    imagens.push(canvas.toDataURL('image/png'))
  }
  return imagens
}

const ehCelular = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)').matches

const emPe = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth

export default function CarteirinhaViewer({ dadosPdf, urlPdf, nomeArquivo, titulo, onFechar }) {
  const [imagens, setImagens] = useState([])
  const [erro, setErro] = useState(false)
  const [celular, setCelular] = useState(ehCelular)
  const [girar, setGirar] = useState(() => ehCelular() && emPe())
  const [face, setFace] = useState(0)
  const [arraste, setArraste] = useState(0)
  const inicio = useRef(null)

  useEffect(() => {
    let ativo = true
    paginasComoImagens(dadosPdf)
      .then((lista) => ativo && setImagens(lista))
      .catch((error) => {
        console.error('Erro ao montar a carteirinha.', error)
        if (ativo) setErro(true)
      })
    return () => {
      ativo = false
    }
  }, [dadosPdf])

  // Acompanha o giro do celular e o tamanho da tela
  useEffect(() => {
    const atualizar = () => {
      const mobile = ehCelular()
      setCelular(mobile)
      setGirar(mobile && emPe())
      document.documentElement.style.setProperty('--cv-w', `${window.innerWidth}px`)
      document.documentElement.style.setProperty('--cv-h', `${window.innerHeight}px`)
    }
    atualizar()
    window.addEventListener('resize', atualizar)
    window.addEventListener('orientationchange', atualizar)
    const teclado = (e) => {
      if (e.key === 'Escape') onFechar()
      if (e.key === 'ArrowRight') setFace(1)
      if (e.key === 'ArrowLeft') setFace(0)
    }
    window.addEventListener('keydown', teclado)
    const rolagemAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', atualizar)
      window.removeEventListener('orientationchange', atualizar)
      window.removeEventListener('keydown', teclado)
      document.body.style.overflow = rolagemAnterior
    }
  }, [onFechar])

  const total = imagens.length || 2

  // Arrastar: com a tela girada, o "lado" da carteirinha é o eixo vertical do celular
  const deslocamento = (e) => {
    if (!inicio.current) return 0
    return girar ? e.clientY - inicio.current.y : e.clientX - inicio.current.x
  }
  const aoTocar = (e) => {
    inicio.current = { x: e.clientX, y: e.clientY }
  }
  const aoMover = (e) => {
    if (inicio.current) setArraste(deslocamento(e))
  }
  const aoSoltar = (e) => {
    const d = deslocamento(e)
    inicio.current = null
    setArraste(0)
    if (d < -40) setFace((f) => Math.min(total - 1, f + 1))
    if (d > 40) setFace((f) => Math.max(0, f - 1))
  }

  const conteudoCarregando = (
    <div className="cv-loading">{erro ? 'Não foi possível abrir a carteirinha.' : 'Abrindo a carteirinha...'}</div>
  )

  if (!celular) {
    return (
      <div className="cv-desktop-backdrop" onClick={onFechar}>
        <section className="cv-desktop" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
          <header className="cv-desktop-head">
            <div>
              <span>Carteirinha de membro</span>
              <h2>{titulo}</h2>
            </div>
            <button type="button" className="cv-close" onClick={onFechar} aria-label="Fechar">×</button>
          </header>
          <div className="cv-desktop-cards">
            {imagens.length
              ? imagens.map((src, i) => (
                  <img key={src.length + i} src={src} alt={i === 0 ? 'Frente da carteirinha' : 'Verso da carteirinha'} />
                ))
              : conteudoCarregando}
          </div>
          <footer className="cv-desktop-foot">
            <a href={urlPdf} download={nomeArquivo} className="cv-download">↓ Baixar PDF</a>
            <small>Para imprimir, use “Tamanho real / 100%”.</small>
          </footer>
        </section>
      </div>
    )
  }

  return (
    <div className="cv-mobile" role="dialog" aria-label={titulo}>
      <div
        className={`cv-stage ${girar ? 'cv-rotated' : ''}`}
        onPointerDown={aoTocar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={() => {
          inicio.current = null
          setArraste(0)
        }}
      >
        {imagens.length ? (
          <div
            className="cv-track"
            style={{
              transform: `translateX(calc(${-face * 100}% + ${arraste}px))`,
              transition: arraste ? 'none' : 'transform 0.3s ease',
            }}
          >
            {imagens.map((src, i) => (
              <div className="cv-slide" key={src.length + i}>
                <img src={src} alt={i === 0 ? 'Frente da carteirinha' : 'Verso da carteirinha'} draggable="false" />
              </div>
            ))}
          </div>
        ) : (
          conteudoCarregando
        )}

        <button type="button" className="cv-close cv-close-mobile" onClick={onFechar} aria-label="Fechar">×</button>

        <div className="cv-bar">
          <div className="cv-dots">
            {['Frente', 'Verso'].slice(0, total).map((nome, i) => (
              <button
                type="button"
                key={nome}
                className={face === i ? 'on' : ''}
                onClick={() => setFace(i)}
              >
                {nome}
              </button>
            ))}
          </div>
          <a href={urlPdf} download={nomeArquivo} className="cv-download cv-download-mobile">↓ PDF</a>
          {face === 0 && imagens.length > 1 && <span className="cv-hint">Arraste para ver o verso ›</span>}
        </div>
      </div>
    </div>
  )
}
