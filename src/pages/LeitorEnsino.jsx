import { useEffect, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import './LeitorEnsino.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

function LeitorEnsino() {
  const flipBookRef = useRef(null)
  const palcoRef = useRef(null)

  const [material, setMaterial] = useState(null)
  const [paginasPdf, setPaginasPdf] = useState([])
  const [paginaAtual, setPaginaAtual] = useState(0)
  const [carregandoMaterial, setCarregandoMaterial] = useState(true)
  const [carregandoPdf, setCarregandoPdf] = useState(false)
  const [progressoPdf, setProgressoPdf] = useState('')
  const [erro, setErro] = useState('')
  const [larguraJanela, setLarguraJanela] = useState(window.innerWidth)
  const [alturaJanela, setAlturaJanela] = useState(window.innerHeight)
  const [zoom, setZoom] = useState(1)
  const [telaCheia, setTelaCheia] = useState(false)
  const [marcaTextoAtivo, setMarcaTextoAtivo] = useState(false)
  const [marcacoes, setMarcacoes] = useState({})
  const [inicioMarcacao, setInicioMarcacao] = useState(null)
  const [marcacaoTemporaria, setMarcacaoTemporaria] = useState(null)
  const [lupaAtiva, setLupaAtiva] = useState(false)
  const [lupaAberta, setLupaAberta] = useState(null)
  const [zoomLupa, setZoomLupa] = useState(2.2)
  const [arrastandoLupa, setArrastandoLupa] = useState(false)
  const [inicioArrasteLupa, setInicioArrasteLupa] = useState(null)
  const [posicaoLupa, setPosicaoLupa] = useState({ x: 50, y: 50 })

  const materialId = window.location.pathname.split('/ensino/')[1]
  const leitorMobile = larguraJanela <= 760

 const larguraBase = leitorMobile
  ? Math.min(larguraJanela - 42, 390)
  : telaCheia
    ? Math.min((larguraJanela - 130) / 2, 560)
    : Math.min((larguraJanela - 260) / 2, 500)

  const alturaDisponivel = telaCheia
  ? alturaJanela - 105
  : alturaJanela - 260

  const alturaBase = Math.min(Math.max(alturaDisponivel, 430), leitorMobile ? 620 : telaCheia ? 820 : 720)

  const larguraLivro = Math.max(280, Math.floor(larguraBase * zoom))
  const alturaLivro = Math.max(390, Math.floor(alturaBase * zoom))

  useEffect(() => {
    function atualizarTela() {
      setLarguraJanela(window.innerWidth)
      setAlturaJanela(window.innerHeight)
      setTelaCheia(Boolean(document.fullscreenElement))
    }

    window.addEventListener('resize', atualizarTela)
    document.addEventListener('fullscreenchange', atualizarTela)

    return () => {
      window.removeEventListener('resize', atualizarTela)
      document.removeEventListener('fullscreenchange', atualizarTela)
    }
  }, [])

  useEffect(() => {
    async function carregarMaterial() {
      if (!materialId) {
        setCarregandoMaterial(false)
        setErro('Material não encontrado.')
        return
      }

      try {
        const ref = doc(db, 'ensinoMateriais', materialId)
        const snapshot = await getDoc(ref)

        if (!snapshot.exists()) {
          setErro('Material não encontrado.')
          return
        }

        const dados = {
          id: snapshot.id,
          ...snapshot.data(),
        }

        setMaterial(dados)

        const marcacoesSalvas = localStorage.getItem(`marcacoesEnsino-${snapshot.id}`)

        if (marcacoesSalvas) {
          setMarcacoes(JSON.parse(marcacoesSalvas))
        }

        if (dados.pdfUrl) {
          await carregarPaginasPdf(dados.pdfUrl)
        } else {
          setErro('Este material ainda não possui PDF.')
        }
      } catch (error) {
        console.error('Erro ao carregar material de ensino.', error)
        setErro('Erro ao carregar o material.')
      } finally {
        setCarregandoMaterial(false)
      }
    }

    carregarMaterial()
  }, [materialId])

  useEffect(() => {
    if (!material?.id) return

    localStorage.setItem(`marcacoesEnsino-${material.id}`, JSON.stringify(marcacoes))
  }, [marcacoes, material?.id])

  async function carregarPaginasPdf(pdfUrl) {
    setCarregandoPdf(true)
    setErro('')
    setPaginasPdf([])
    setProgressoPdf('Preparando revista...')

    try {
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        withCredentials: false,
      })

      const pdf = await loadingTask.promise
      const paginasRenderizadas = []

      for (let numeroPagina = 1; numeroPagina <= pdf.numPages; numeroPagina += 1) {
        setProgressoPdf(`Carregando página ${numeroPagina} de ${pdf.numPages}`)

        const pagina = await pdf.getPage(numeroPagina)
        const escala = leitorMobile ? 1.55 : 1.95
        const viewport = pagina.getViewport({ scale: escala })

        const canvas = document.createElement('canvas')
        const contexto = canvas.getContext('2d')
        const proporcaoTela = window.devicePixelRatio || 1

        canvas.width = Math.floor(viewport.width * proporcaoTela)
        canvas.height = Math.floor(viewport.height * proporcaoTela)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        contexto.setTransform(proporcaoTela, 0, 0, proporcaoTela, 0, 0)

        await pagina.render({
          canvasContext: contexto,
          viewport,
        }).promise

        paginasRenderizadas.push({
          numero: numeroPagina,
          imagem: canvas.toDataURL('image/jpeg', 0.94),
        })
      }

      setPaginasPdf(paginasRenderizadas)
      setPaginaAtual(0)
      setProgressoPdf('')
    } catch (error) {
      console.error('Erro ao renderizar PDF.', error)
      setErro(
        'Não foi possível abrir este PDF em formato de revista. Verifique o arquivo enviado.',
      )
    } finally {
      setCarregandoPdf(false)
    }
  }

  function passarProximaPagina() {
    flipBookRef.current?.pageFlip()?.flipNext()
  }

  function voltarPagina() {
    flipBookRef.current?.pageFlip()?.flipPrev()
  }

  async function alternarTelaCheia() {
    if (!palcoRef.current) return

    if (!document.fullscreenElement) {
      await palcoRef.current.requestFullscreen()
      setTelaCheia(true)
      return
    }

    await document.exitFullscreen()
    setTelaCheia(false)
  }

  function aumentarZoom() {
  setZoom((valorAtual) => Math.min(Number((valorAtual + 0.15).toFixed(2)), 1.8))
 }

  function diminuirZoom() {
  setZoom((valorAtual) => Math.max(Number((valorAtual - 0.15).toFixed(2)), 0.7))
}

  function resetarZoom() {
    setZoom(1)
  }

  function obterPontoMarcacao(event, numeroPagina) {
    const area = event.currentTarget.getBoundingClientRect()

    return {
      numeroPagina,
      x: ((event.clientX - area.left) / area.width) * 100,
      y: ((event.clientY - area.top) / area.height) * 100,
    }
  }

  function iniciarMarcaTexto(event, numeroPagina) {
    if (!marcaTextoAtivo) return

    event.preventDefault()
    event.stopPropagation()

    const ponto = obterPontoMarcacao(event, numeroPagina)

    setInicioMarcacao(ponto)
    setMarcacaoTemporaria({
      numeroPagina,
      x: ponto.x,
      y: ponto.y,
      largura: 0,
      altura: 0,
    })
  }

  function moverMarcaTexto(event, numeroPagina) {
    if (!marcaTextoAtivo || !inicioMarcacao) return
    if (inicioMarcacao.numeroPagina !== numeroPagina) return

    event.preventDefault()
    event.stopPropagation()

    const pontoAtual = obterPontoMarcacao(event, numeroPagina)

    const x = Math.min(inicioMarcacao.x, pontoAtual.x)
    const y = Math.min(inicioMarcacao.y, pontoAtual.y)
    const largura = Math.abs(pontoAtual.x - inicioMarcacao.x)
    const altura = Math.abs(pontoAtual.y - inicioMarcacao.y)

    setMarcacaoTemporaria({
      numeroPagina,
      x,
      y,
      largura,
      altura,
    })
  }

  function finalizarMarcaTexto() {
    if (!marcaTextoAtivo || !marcacaoTemporaria) {
      setInicioMarcacao(null)
      setMarcacaoTemporaria(null)
      return
    }

    if (marcacaoTemporaria.largura < 2 || marcacaoTemporaria.altura < 1) {
      setInicioMarcacao(null)
      setMarcacaoTemporaria(null)
      return
    }

    setMarcacoes((marcacoesAtuais) => {
      const chavePagina = String(marcacaoTemporaria.numeroPagina)

      return {
        ...marcacoesAtuais,
        [chavePagina]: [
          ...(marcacoesAtuais[chavePagina] || []),
          {
            id: Date.now(),
            x: marcacaoTemporaria.x,
            y: marcacaoTemporaria.y,
            largura: marcacaoTemporaria.largura,
            altura: Math.max(marcacaoTemporaria.altura, 2.4),
          },
        ],
      }
    })

    setInicioMarcacao(null)
    setMarcacaoTemporaria(null)
  }

function abrirLupa(event, pagina) {
  if (!lupaAtiva || marcaTextoAtivo) return

  event.preventDefault()
  event.stopPropagation()

  const area = event.currentTarget.getBoundingClientRect()

  const x = ((event.clientX - area.left) / area.width) * 100
  const y = ((event.clientY - area.top) / area.height) * 100

  setPosicaoLupa({ x, y })

  setLupaAberta({
    numeroPagina: pagina.numero,
    imagem: pagina.imagem,
    x,
    y,
  })
}
function limitarPosicaoLupa(valor) {
  return Math.min(Math.max(valor, 0), 100)
}

function iniciarArrasteLupa(event) {
  event.preventDefault()
  event.stopPropagation()

  setArrastandoLupa(true)

  setInicioArrasteLupa({
    mouseX: event.clientX,
    mouseY: event.clientY,
    posicaoX: posicaoLupa.x,
    posicaoY: posicaoLupa.y,
  })
}

function moverArrasteLupa(event) {
  if (!arrastandoLupa || !inicioArrasteLupa) return

  event.preventDefault()
  event.stopPropagation()

  const area = event.currentTarget.getBoundingClientRect()

  const diferencaX =
    ((event.clientX - inicioArrasteLupa.mouseX) / area.width) * 100

  const diferencaY =
    ((event.clientY - inicioArrasteLupa.mouseY) / area.height) * 100

  setPosicaoLupa({
    x: limitarPosicaoLupa(inicioArrasteLupa.posicaoX - diferencaX),
    y: limitarPosicaoLupa(inicioArrasteLupa.posicaoY - diferencaY),
  })
}
function finalizarArrasteLupa() {
  setArrastandoLupa(false)
  setInicioArrasteLupa(null)
}
function fecharLupa() {
  setLupaAberta(null)
  setArrastandoLupa(false)
  setInicioArrasteLupa(null)
}

function aumentarZoomLupa() {
  setZoomLupa((valorAtual) => Math.min(Number((valorAtual + 0.25).toFixed(2)), 4.5))
}

function diminuirZoomLupa() {
  setZoomLupa((valorAtual) => Math.max(Number((valorAtual - 0.25).toFixed(2)), 1.2))
}
  function limparMarcacoesPaginaAtual() {
    const numeroPaginaAtual = paginaAtual + 1

    setMarcacoes((marcacoesAtuais) => {
      const novasMarcacoes = { ...marcacoesAtuais }
      delete novasMarcacoes[String(numeroPaginaAtual)]
      return novasMarcacoes
    })
  }

 const totalPaginas = paginasPdf.length

  if (carregandoMaterial) {
    return (
      <main className="teaching-reader-page">
        <section className="teaching-reader-empty">
          <strong>Carregando revista...</strong>
          <p>Aguarde um instante.</p>
        </section>
      </main>
    )
  }

  if (erro && !material) {
    return (
      <main className="teaching-reader-page">
        <section className="teaching-reader-empty">
          <strong>{erro}</strong>
          <p>Volte para a biblioteca de ensino e escolha outro material.</p>

          <a href="/ensino">Voltar para Ensino</a>
        </section>
      </main>
    )
  }

  return (
  <main
    className={
      telaCheia
        ? 'teaching-reader-page fullscreen-mode'
        : 'teaching-reader-page'
    }
  >
    <header className="teaching-reader-header">
      <a href="/ensino">← Voltar</a>

      <div>
        <span>{material?.categoria || 'Ensino'}</span>

        <h1>{material?.titulo}</h1>

        {(material?.periodo || material?.autor) && (
          <p>
            {material?.periodo}
            {material?.periodo && material?.autor ? ' • ' : ''}
            {material?.autor}
          </p>
        )}
      </div>

      {material?.pdfUrl && (
        <a href={material.pdfUrl} target="_blank" rel="noreferrer">
          Baixar PDF
        </a>
      )}
    </header>

    <section className="teaching-reader-stage" ref={palcoRef}>
      {carregandoPdf && (
        <div className="teaching-reader-loading">
          <strong>Preparando revista digital...</strong>
          <p>{progressoPdf}</p>
        </div>
      )}

      {!carregandoPdf && erro && (
        <div className="teaching-reader-loading">
          <strong>{erro}</strong>
          <p>
            Você ainda pode baixar o PDF original pelo botão no topo da página.
          </p>
        </div>
      )}

      {!carregandoPdf && !erro && totalPaginas > 0 && (
        <>
          <div className="teaching-reader-toolbar">
            <button type="button" onClick={voltarPagina}>
              ← Anterior
            </button>

            <span>
             Página {Math.min(paginaAtual + 1, totalPaginas)} de{' '}
             {totalPaginas}
            </span>

            <button type="button" onClick={passarProximaPagina}>
              Próxima →
            </button>

            <button type="button" onClick={diminuirZoom}>
              − Zoom
            </button>

            <button type="button" onClick={resetarZoom}>
              {Math.round(zoom * 100)}%
            </button>

            <button type="button" onClick={aumentarZoom}>
              + Zoom
            </button>

            <button
              type="button"
              className={marcaTextoAtivo ? 'active-tool' : ''}
              onClick={() => {
                setMarcaTextoAtivo(!marcaTextoAtivo)
                setLupaAtiva(false)
                setLupaAberta(null)
              }}
            >
              Marca texto
            </button>

            <button
              type="button"
              className={lupaAtiva ? 'active-tool' : ''}
              onClick={() => {
                setLupaAtiva(!lupaAtiva)
                setMarcaTextoAtivo(false)
                setLupaAberta(null)
              }}
            >
              Lupa
            </button>

            <button type="button" onClick={limparMarcacoesPaginaAtual}>
              Limpar página
            </button>

            <button type="button" onClick={alternarTelaCheia}>
              {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            </button>
          </div>

          {marcaTextoAtivo && (
            <div className="teaching-reader-tip">
              Marca-texto ativo: clique e arraste sobre a página para destacar
              uma área.
            </div>
          )}

          {lupaAtiva && (
            <div className="teaching-reader-tip magnifier-tip">
              Lupa ativa: clique sobre um trecho da página para ampliar.
            </div>
          )}

          <div className="teaching-book-wrap">
            <button
              type="button"
              className="teaching-reader-arrow teaching-reader-arrow-left"
              onClick={voltarPagina}
              aria-label="Página anterior"
            >
              ‹
            </button>

            <HTMLFlipBook
  key={`revista-${zoom}-${leitorMobile}-${telaCheia}-${marcaTextoAtivo}-${lupaAtiva}`}
  startPage={paginaAtual}
  width={larguraLivro}
  height={alturaLivro}
  size="fixed"
  maxShadowOpacity={0.12}
  showCover={false}
  mobileScrollSupport={!marcaTextoAtivo && !lupaAtiva}
  usePortrait={leitorMobile}
  drawShadow={true}
  flippingTime={650}
  useMouseEvents={!marcaTextoAtivo && !lupaAtiva}
  className="teaching-flipbook"
  ref={flipBookRef}
  onFlip={(event) => setPaginaAtual(event.data)}
>
              {paginasPdf.map((pagina) => {
               const marcacoesPagina = marcacoes[String(pagina.numero)] || []
const exibindoMarcacaoTemporaria =
  marcacaoTemporaria?.numeroPagina === pagina.numero


return (
  <div className="teaching-page-sheet" key={pagina.numero}>
                    <div
                      className={[
                        'teaching-page-mark-area',
                        marcaTextoAtivo ? 'marking-active' : '',
                        lupaAtiva ? 'magnifier-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onPointerDown={(event) => {
                        if (marcaTextoAtivo) {
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          )
                          iniciarMarcaTexto(event, pagina.numero)
                        }
                      }}
                      onPointerMove={(event) => {
                        if (marcaTextoAtivo) {
                          moverMarcaTexto(event, pagina.numero)
                        }
                      }}
                      onPointerUp={(event) => {
                        if (marcaTextoAtivo) {
                          event.currentTarget.releasePointerCapture(
                            event.pointerId,
                          )
                          finalizarMarcaTexto()
                        }
                      }}
                      onPointerCancel={finalizarMarcaTexto}
                      onClick={(event) => {
                        if (lupaAtiva) {
                          abrirLupa(event, pagina)
                        }
                      }}
                    >
                      <img
                        src={pagina.imagem}
                        alt={`Página ${pagina.numero} de ${material?.titulo}`}
                        draggable="false"
                      />

                      {marcacoesPagina.map((marcacao) => (
                        <div
                          className="teaching-highlight"
                          key={marcacao.id}
                          style={{
                            left: `${marcacao.x}%`,
                            top: `${marcacao.y}%`,
                            width: `${marcacao.largura}%`,
                            height: `${marcacao.altura}%`,
                          }}
                        />
                      ))}

                      {exibindoMarcacaoTemporaria && (
                        <div
                          className="teaching-highlight temporary"
                          style={{
                            left: `${marcacaoTemporaria.x}%`,
                            top: `${marcacaoTemporaria.y}%`,
                            width: `${marcacaoTemporaria.largura}%`,
                            height: `${marcacaoTemporaria.altura}%`,
                          }}
                        />
                      )}
                    </div>

                    <span>{pagina.numero}</span>
                  </div>
                )
              })}
            </HTMLFlipBook>

            <button
              type="button"
              className="teaching-reader-arrow teaching-reader-arrow-right"
              onClick={passarProximaPagina}
              aria-label="Próxima página"
            >
              ›
            </button>
          </div>

          {lupaAberta && (
            <div
              className="teaching-magnifier-backdrop"
              role="button"
              tabIndex={0}
              onClick={fecharLupa}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  fecharLupa()
                }
              }}
            >
              <div
                className="teaching-magnifier-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="teaching-magnifier-header">
                  <div>
                    <span>Lupa</span>
                    <strong>Página {lupaAberta.numeroPagina}</strong>
                  </div>

                  <div>
                    <button type="button" onClick={diminuirZoomLupa}>
                      −
                    </button>

                    <small>{Math.round(zoomLupa * 100)}%</small>

                    <button type="button" onClick={aumentarZoomLupa}>
                      +
                    </button>

                    <button type="button" onClick={fecharLupa}>
                      Fechar
                    </button>
                  </div>
                </div>

               <div
  className={
    arrastandoLupa
      ? 'teaching-magnifier-window dragging'
      : 'teaching-magnifier-window'
  }
  onPointerDown={(event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    iniciarArrasteLupa(event)
  }}
  onPointerMove={moverArrasteLupa}
  onPointerUp={(event) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    finalizarArrasteLupa()
  }}
  onPointerCancel={finalizarArrasteLupa}
>
  <div
    className="teaching-magnifier-content"
    style={{
      transform: `translate(-${posicaoLupa.x}%, -${posicaoLupa.y}%) scale(${zoomLupa})`,
    }}
  >
    <img
      src={lupaAberta.imagem}
      alt={`Ampliação da página ${lupaAberta.numeroPagina}`}
      draggable="false"
    />

    {(marcacoes[String(lupaAberta.numeroPagina)] || []).map((marcacao) => (
      <div
        className="teaching-highlight magnifier-highlight"
        key={marcacao.id}
        style={{
          left: `${marcacao.x}%`,
          top: `${marcacao.y}%`,
          width: `${marcacao.largura}%`,
          height: `${marcacao.altura}%`,
        }}
      />
    ))}
  </div>

  <span className="teaching-magnifier-drag-tip">
    Clique e arraste para enquadrar o texto
  </span>
</div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  </main>
)
}

export default LeitorEnsino
   