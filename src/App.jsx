import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import './App.css'
import Admin from './pages/Admin'
import { db } from './services/firebase'

const quickActions = [
  {
    title: 'Cultos',
    description: 'Veja os horários dos nossos encontros semanais.',
    icon: '✦',
    href: '#cultos',
  },
  {
    title: 'Oração',
    description: 'Envie seu pedido de oração para a liderança.',
    icon: '✚',
    href: '#oracao',
  },
    {
    title: 'Vídeos',
    description: 'Acompanhe mensagens, estudos e transmissões.',
    icon: '▶',
    href: '#midia',
  },
 {
  title: 'Contribuição',
  description: 'Contribua com dízimos, ofertas e projetos da igreja.',
  icon: '◇',
  href: '#contribuicao',
},
  {
    title: 'Como chegar',
    description: 'Encontre o caminho para nos visitar.',
    icon: '⌖',
    href: '#localizacao',
  },
]

const schedules = [
  {
    day: 'Domingo',
    name: 'Culto da Família',
    time: '19h',
  },
  {
    day: 'Quarta-feira',
    name: 'Culto de Ensino',
    time: '19h30',
  },
  {
    day: 'Sábado',
    name: 'Jovens e Comunhão',
    time: '18h',
  },
]

function App() {
  if (window.location.pathname === '/admin') {
    return <Admin />
  }

  return <Home />
}
function Home() {
  const [programacaoHome, setProgramacaoHome] = useState([])
  const [eventosHome, setEventosHome] = useState([])
  const [localizacaoHome, setLocalizacaoHome] = useState(null)
  const [videosHome, setVideosHome] = useState([])
  const [documentosHome, setDocumentosHome] = useState([])
  const [galeriaHome, setGaleriaHome] = useState([])
  const [contribuicaoHome, setContribuicaoHome] = useState(null)
  const [pixCopiado, setPixCopiado] = useState(false)
  const [albumAberto, setAlbumAberto] = useState(null)
  const [fotoAtualAlbum, setFotoAtualAlbum] = useState(0)
  const [pedidoForm, setPedidoForm] = useState({
  nome: '',
  telefone: '',
  pedido: '',
})

const [enviandoPedido, setEnviandoPedido] = useState(false)

   useEffect(() => {
    async function carregarProgramacaoHome() {
      try {
        const q = query(collection(db, 'programacao'), orderBy('ordem', 'asc'))
        const snapshot = await getDocs(q)

        const lista = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => item.ativo !== false)

        setProgramacaoHome(lista)
      } catch (error) {
        console.error('Erro ao carregar programação da home:', error)
      }
    }

    async function carregarLocalizacaoHome() {
      try {
        const ref = doc(db, 'configuracoes', 'localizacao')
        const snapshot = await getDoc(ref)

        if (snapshot.exists()) {
          setLocalizacaoHome(snapshot.data())
        }
      } catch (error) {
        console.error('Erro ao carregar localização da home:', error)
      }
    }

    async function carregarEventosHome() {
      try {
        const q = query(collection(db, 'eventos'), orderBy('data', 'asc'))
        const snapshot = await getDocs(q)

        const lista = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => item.ativo !== false)

        setEventosHome(lista)
      } catch (error) {
        console.error('Erro ao carregar eventos da home:', error)
      }
    }

    async function carregarVideosHome() {
      try {
        const q = query(collection(db, 'videos'), orderBy('criadoEm', 'desc'))
        const snapshot = await getDocs(q)

        const lista = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => item.ativo !== false)

        setVideosHome(lista)
      } catch (error) {
        console.error('Erro ao carregar vídeos da home:', error)
      }
    }

        async function carregarDocumentosHome() {
      try {
        const q = query(collection(db, 'documentos'), orderBy('criadoEm', 'desc'))
        const snapshot = await getDocs(q)

        const lista = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => item.ativo !== false)

        setDocumentosHome(lista)
      } catch (error) {
        console.error('Erro ao carregar documentos da home:', error)
      }
    }

    async function carregarGaleriaHome() {
      try {
        const q = query(collection(db, 'galeria'), orderBy('criadoEm', 'desc'))
        const snapshot = await getDocs(q)

        const lista = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => item.ativo !== false)

        setGaleriaHome(lista)
      } catch (error) {
        console.error('Erro ao carregar galeria da home:', error)
      }
    }

       carregarProgramacaoHome()
carregarEventosHome()
carregarLocalizacaoHome()
carregarVideosHome()
carregarDocumentosHome()
carregarGaleriaHome()
carregarContribuicaoHome()
  }, [])

  const programacaoExibida =
    programacaoHome.length > 0 ? programacaoHome : schedules
const albunsGaleria = Object.values(
  galeriaHome.reduce((albuns, foto) => {
    const chave = `${foto.titulo || 'Sem título'}-${foto.descricao || ''}-${
      foto.categoria || 'Galeria'
    }`

    if (!albuns[chave]) {
      albuns[chave] = {
        id: chave,
        titulo: foto.titulo || 'Sem título',
        descricao: foto.descricao || '',
        categoria: foto.categoria || 'Galeria',
        fotos: [],
      }
    }

    albuns[chave].fotos.push(foto)

    return albuns
  }, {}),
)
function abrirAlbum(album) {
  setAlbumAberto(album)
  setFotoAtualAlbum(0)
}

function fecharAlbum() {
  setAlbumAberto(null)
  setFotoAtualAlbum(0)
}

function avancarFotoAlbum() {
  if (!albumAberto) return

  setFotoAtualAlbum((indiceAtual) =>
    indiceAtual === albumAberto.fotos.length - 1 ? 0 : indiceAtual + 1,
  )
}

function voltarFotoAlbum() {
  if (!albumAberto) return

  setFotoAtualAlbum((indiceAtual) =>
    indiceAtual === 0 ? albumAberto.fotos.length - 1 : indiceAtual - 1,
  )
}
async function copiarChavePix() {
  if (!contribuicaoHome?.chavePix) return

  try {
    await navigator.clipboard.writeText(contribuicaoHome.chavePix)
    setPixCopiado(true)

    setTimeout(() => {
      setPixCopiado(false)
    }, 2500)
  } catch (error) {
    alert('Não foi possível copiar a chave Pix.')
    console.error(error)
  }
}

  function formatarData(data) {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')

    return `${dia}/${mes}/${ano}`
  }
async function enviarPedidoOracao(event) {
  event.preventDefault()

  if (!pedidoForm.nome || !pedidoForm.pedido) {
    alert('Preencha seu nome e o pedido de oração.')
    return
  }

  setEnviandoPedido(true)

  try {
    await addDoc(collection(db, 'pedidosOracao'), {
      nome: pedidoForm.nome,
      telefone: pedidoForm.telefone,
      pedido: pedidoForm.pedido,
      lido: false,
      criadoEm: serverTimestamp(),
    })

    setPedidoForm({
      nome: '',
      telefone: '',
      pedido: '',
    })

    alert('Pedido de oração enviado com sucesso!')
  } catch (error) {
    alert('Não foi possível enviar o pedido de oração. Tente novamente.')
    console.error('Erro ao enviar pedido de oração:', error)
  } finally {
    setEnviandoPedido(false)
  }
}
async function carregarContribuicaoHome() {
  try {
    const ref = doc(db, 'configuracoes', 'contribuicao')
    const snapshot = await getDoc(ref)

    if (snapshot.exists()) {
      const dados = snapshot.data()

      if (dados.ativo !== false) {
        setContribuicaoHome(dados)
      }
    }
  } catch (error) {
    console.error('Erro ao carregar contribuição da home:', error)
  }
}
async function carregarDocumentosHome() {
  try {
    const q = query(collection(db, 'documentos'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      .filter((item) => item.ativo !== false)

    setDocumentosHome(lista)
  } catch (error) {
    console.error('Erro ao carregar documentos da home:', error)
  }
}
async function carregarVideosHome() {
  try {
    const q = query(collection(db, 'videos'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      .filter((item) => item.ativo !== false)

    setVideosHome(lista)
  } catch (error) {
    console.error('Erro ao carregar vídeos da home:', error)
  }
}
function obterThumbnailYoutube(url) {
  if (!url) return ''

  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/
  )

  if (!match?.[1]) return ''

  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
}

  return (
    <main className="site">
      <div className="top-strip notranslate" translate="no">
        <span></span>
      </div>

      <header className="header notranslate" translate="no">
        <a className="brand" href="#inicio">
          <div className="brand-mark">
            <img
              src="/logo-filhos-colorida.png"
              alt="Filhos da Graça"
              className="brand-logo-img"
            />
          </div>

          <div>
            <strong>Filhos da Graça</strong>
            <span>Gerados no coração de Deus</span>
          </div>
        </a>

        <nav className="menu notranslate" translate="no">
          <a href="#inicio">Início</a>
          <a href="#cultos">Cultos</a>
          <a href="#visitante">Visitantes</a>
          <a href="#eventos">Eventos</a>
          <a href="#galeria">Galeria</a>
          <a href="#contribuicao">Contribuição</a>
          <a href="#localizacao">Como chegar</a>
          <a href="#midia">Mídia</a>
          <a href="#contato">Contato</a>
        </nav>

        <a href="/admin" className="member-link notranslate" translate="no">
          Área do Membro
        </a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-image" aria-hidden="true"></div>

        <div className="hero-card">
          <span className="hero-kicker"></span>

          <img
            src="/logo-filhos.png"
            alt="Filhos da Graça"
            className="hero-logo"
          />

          <p>
            Seja bem-vindo. Aqui caminhamos em família, servimos com amor
            e vivemos a Palavra de Deus.
          </p>

          <div className="hero-actions">
            <a href="#visitante" className="primary-button">
              Sou visitante
            </a>
            <a href="#cultos" className="secondary-button">
              Horários dos cultos
            </a>
          </div>
        </div>
      </section>

      <section className="quick-actions">
        {quickActions.map((item) => (
          <a className="quick-card" href={item.href} key={item.title}>
            <span>{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </a>
        ))}
      </section>

      <section className="welcome" id="visitante">
        <div className="section-copy">
          <span className="section-label">Bem-vindo</span>
          <h2>Sua família tem um lugar especial entre nós.</h2>
          <p>
            A Igreja Filhos da Graça é uma comunidade cristã que valoriza
            a comunhão, o cuidado, a adoração e o ensino da Palavra.
            Será uma alegria receber você.
          </p>
        </div>

        <div className="welcome-note">
  <img
    src="/Pastor.png"
    alt="Casal de pastores da Igreja Filhos da Graça"
    className="welcome-note-image"
  />

  <div className="welcome-note-overlay"></div>

  <div className="welcome-note-content">
    <strong>Primeira visita?</strong>

    <p>
      Venha como está. Nossa equipe estará pronta para acolher você
      e sua família com carinho.
    </p>

    <a href="#localizacao">Ver como chegar</a>
  </div>
</div>
      </section>

      <section className="services" id="cultos">
        <div className="section-heading">
          <span className="section-label">Programação</span>
          <h2>Nossos encontros</h2>
        </div>

        <div className="service-list">
          {programacaoExibida.map((item) => (
            <article className="service-card" key={item.id || item.name}>
              <span>{item.dia || item.day}</span>
              <strong>{item.titulo || item.name}</strong>
              <p>{item.horario || item.time}</p>
              {item.descricao && <small>{item.descricao}</small>}
            </article>
          ))}
        </div>
      </section>

      {eventosHome.length > 0 && (
        <section className="events-section" id="eventos">
          <div className="section-heading">
            <span className="section-label">Eventos</span>
            <h2>Próximos eventos</h2>
          </div>

          <div className="events-list">
            {eventosHome.map((evento) => (
              <article className="event-card" key={evento.id}>
                {evento.imagem ? (
                  <img src={evento.imagem} alt={evento.titulo} />
                ) : (
                  <div className="event-placeholder">
                    <span>Filhos da Graça</span>
                  </div>
                )}

                <div className="event-content">
                  <span>{formatarData(evento.data)}</span>
                  <h3>{evento.titulo}</h3>

                  {evento.horario && <p>{evento.horario}</p>}
                  {evento.local && <small>{evento.local}</small>}
                  {evento.descricao && <small>{evento.descricao}</small>}
                </div>
              </article>
            ))}
          </div>
        </section>
           )}
{albunsGaleria.length > 0 && (
  <section className="gallery-section" id="galeria">
    <div className="section-heading">
      <span className="section-label">Galeria</span>
      <h2>Momentos da nossa igreja</h2>
    </div>

    <div className="gallery-list gallery-album-list">
      {albunsGaleria.map((album) => {
        const fotoCapa = album.fotos[0]

        return (
          <button
            type="button"
            className="gallery-card gallery-album-card"
            key={album.id}
            onClick={() => abrirAlbum(album)}
          >
            <div className="gallery-cover-image">
              <img src={fotoCapa.imagem} alt={album.titulo} />
            </div>

            <div className="gallery-card-content">
              <span>{album.categoria}</span>
              <h3>{album.titulo}</h3>

              {album.descricao && <p>{album.descricao}</p>}

              <small>
                {album.fotos.length} foto{album.fotos.length > 1 ? 's' : ''}
              </small>
            </div>
          </button>
        )
      })}
    </div>
  </section>
)}
      <section className="location-section" id="localizacao">
  <div className="section-heading">
    <span className="section-label">Como chegar</span>
    <h2>Venha nos visitar</h2>
  </div>

  <div className="location-grid">
    <article className="location-card">
      {localizacaoHome?.fotoFachada ? (
        <img
          src={localizacaoHome.fotoFachada}
          alt="Fachada da Igreja Filhos da Graça"
        />
      ) : (
        <div className="location-placeholder">
          <span>Filhos da Graça</span>
        </div>
      )}
    </article>

    <article className="location-info">
      <span className="section-label">Endereço</span>

      <h3>
        {localizacaoHome?.nomeLocal || 'Igreja Filhos da Graça'}
      </h3>

      {localizacaoHome?.endereco ? (
        <p>{localizacaoHome.endereco}</p>
      ) : (
        <p>O endereço será cadastrado em breve.</p>
      )}

      {(localizacaoHome?.latitude || localizacaoHome?.longitude) && (
        <small>
          Coordenadas: {localizacaoHome.latitude}, {localizacaoHome.longitude}
        </small>
      )}

      {localizacaoHome?.googleMapsUrl && (
        <a
          className="primary-button"
          href={localizacaoHome.googleMapsUrl}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no Google Maps
        </a>
      )}
    </article>
  </div>
</section>
      <section className="media-section" id="midia">
  <div className="section-heading">
    <span className="section-label">Mídia</span>
    <h2>Mensagens, vídeos e transmissões</h2>
  </div>

  {videosHome.length > 0 ? (
    <div className="video-list">
      {videosHome.map((video) => {
        const thumbnail = obterThumbnailYoutube(video.url)

        return (
          <article className="video-card" key={video.id}>
            <a href={video.url} target="_blank" rel="noreferrer">
              {thumbnail ? (
                <img src={thumbnail} alt={video.titulo} />
              ) : (
                <div className="video-placeholder">
                  <span>Filhos da Graça</span>
                </div>
              )}

              <div className="video-content">
                <span>Assistir vídeo</span>
                <h3>{video.titulo}</h3>
                {video.descricao && <p>{video.descricao}</p>}
              </div>
            </a>
          </article>
        )
      })}
    </div>
  ) : (
    <article className="feature-card feature-video">
      <div>
        <span>Mídia</span>
        <h2>Mensagens, vídeos e transmissões.</h2>
        <p>Acompanhe os conteúdos da igreja em um só lugar.</p>
      </div>
      <a href="#contato">Em breve</a>
    </article>
  )}
</section>
{contribuicaoHome && (
  <section className="contribution-section" id="contribuicao">
    <div className="contribution-content">
      <div className="section-copy">
        <span className="section-label">Contribuição</span>

        <h2>{contribuicaoHome.titulo || 'Contribua com a obra'}</h2>

        <p>
          {contribuicaoHome.descricao ||
            'Sua contribuição nos ajuda a manter a missão da igreja.'}
        </p>

        <div className="contribution-info">
          {contribuicaoHome.favorecido && (
            <small>
              <b>Favorecido:</b> {contribuicaoHome.favorecido}
            </small>
          )}

          {contribuicaoHome.banco && (
            <small>
              <b>Banco:</b> {contribuicaoHome.banco}
            </small>
          )}
        </div>
      </div>

      <article className="contribution-card">
        {contribuicaoHome.qrCodePix ? (
          <img src={contribuicaoHome.qrCodePix} alt="QR Code Pix" />
        ) : (
          <div className="contribution-public-placeholder">
            QR Code Pix
          </div>
        )}

        <span>Chave Pix</span>

        <strong>{contribuicaoHome.chavePix}</strong>

        <button type="button" onClick={copiarChavePix}>
          {pixCopiado ? 'Chave copiada!' : 'Copiar chave Pix'}
        </button>
      </article>
    </div>
  </section>
)}
<section className="documents-section" id="transparencia">
  <div className="section-heading">
    <span className="section-label">Transparência</span>
    <h2>Documentos e informações para membros</h2>
  </div>

  {documentosHome.length > 0 ? (
    <div className="documents-list">
      {documentosHome.map((documento) => (
        <article className="document-card" key={documento.id}>
          <span>{documento.categoria || 'Documento'}</span>

          <h3>{documento.titulo}</h3>

          {documento.descricao && <p>{documento.descricao}</p>}

          <a href={documento.url} target="_blank" rel="noreferrer">
            Abrir documento
          </a>
        </article>
      ))}
    </div>
  ) : (
    <article className="feature-card feature-transparency">
      <div>
        <span>Transparência</span>
        <h2>Informações e documentos para membros.</h2>
        <p>Prestação de contas com clareza e organização.</p>
      </div>
      <a href="/admin">Acessar portal</a>
    </article>
  )}
</section>

     <section className="prayer prayer-form-section" id="oracao">
  <div className="prayer-copy">
    <span className="section-label">Pedido de oração</span>
    <h2>Podemos orar por você?</h2>
    <p>
      Envie seu pedido de oração. Nossa liderança terá alegria em
      interceder por você e sua família.
    </p>
  </div>

  <form className="prayer-form" onSubmit={enviarPedidoOracao}>
    <label>
      Nome
      <input
        value={pedidoForm.nome}
        onChange={(event) =>
          setPedidoForm({
            ...pedidoForm,
            nome: event.target.value,
          })
        }
        placeholder="Digite seu nome"
      />
    </label>

    <label>
      Telefone ou WhatsApp
      <input
        value={pedidoForm.telefone}
        onChange={(event) =>
          setPedidoForm({
            ...pedidoForm,
            telefone: event.target.value,
          })
        }
        placeholder="Opcional"
      />
    </label>

    <label>
      Pedido de oração
      <textarea
        value={pedidoForm.pedido}
        onChange={(event) =>
          setPedidoForm({
            ...pedidoForm,
            pedido: event.target.value,
          })
        }
        placeholder="Escreva seu pedido"
      />
    </label>

    <button className="primary-button dark" type="submit" disabled={enviandoPedido}>
      {enviandoPedido ? 'Enviando...' : 'Enviar pedido'}
    </button>
  </form>
</section>

             {albumAberto && (
  <div
    className="gallery-modal"
    role="button"
    tabIndex={0}
    onClick={fecharAlbum}
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        fecharAlbum()
      }

      if (event.key === 'ArrowRight') {
        avancarFotoAlbum()
      }

      if (event.key === 'ArrowLeft') {
        voltarFotoAlbum()
      }
    }}
  >
    <div
      className="gallery-modal-content gallery-album-modal-content"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="gallery-modal-close"
        onClick={fecharAlbum}
      >
        ×
      </button>

      {albumAberto.fotos.length > 1 && (
        <>
          <button
            type="button"
            className="gallery-arrow gallery-arrow-left"
            onClick={voltarFotoAlbum}
          >
            ‹
          </button>

          <button
            type="button"
            className="gallery-arrow gallery-arrow-right"
            onClick={avancarFotoAlbum}
          >
            ›
          </button>
        </>
      )}

      <img
        src={albumAberto.fotos[fotoAtualAlbum].imagem}
        alt={albumAberto.titulo}
      />

      <div className="gallery-modal-info">
        <span>{albumAberto.categoria}</span>
        <h3>{albumAberto.titulo}</h3>

        {albumAberto.descricao && <p>{albumAberto.descricao}</p>}

        <small>
          Foto {fotoAtualAlbum + 1} de {albumAberto.fotos.length}
        </small>
      </div>

      {albumAberto.fotos.length > 1 && (
        <div className="gallery-thumbnails">
          {albumAberto.fotos.map((foto, index) => (
            <button
              type="button"
              className={index === fotoAtualAlbum ? 'active' : ''}
              key={foto.id}
              onClick={() => setFotoAtualAlbum(index)}
            >
              <img src={foto.imagem} alt={`${albumAberto.titulo} ${index + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
)}
      <footer className="footer" id="contato">
        <div>
          <strong>Filhos da Graça</strong>
          <span>Gerados no coração de Deus</span>
        </div>

        <nav>
          <a href="#cultos">Cultos</a>
          <a href="#eventos">Eventos</a>
          <a href="#galeria">Galeria</a>
          <a href="#contribuicao">Contribuição</a>
          <a href="#oracao">Oração</a>
          <a href="#midia">Mídia</a>
          <a href="/admin">Área do Membro</a>
        </nav>
      </footer>
    </main>
  )
}

export default App