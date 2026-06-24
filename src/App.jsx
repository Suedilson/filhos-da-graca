import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
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
    title: 'Como chegar',
    description: 'Encontre o caminho para nos visitar.',
    icon: '⌖',
    href: '#contato',
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

    carregarProgramacaoHome()
    carregarEventosHome()
  }, [])

  const programacaoExibida =
    programacaoHome.length > 0 ? programacaoHome : schedules

  function formatarData(data) {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')

    return `${dia}/${mes}/${ano}`
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
          <strong>Primeira visita?</strong>
          <p>
            Venha como está. Nossa equipe estará pronta para acolher você
            e sua família com carinho.
          </p>
          <a href="#contato">Ver como chegar</a>
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

      <section className="feature-row" id="midia">
        <article className="feature-card feature-video">
          <div>
            <span>Mídia</span>
            <h2>Mensagens, vídeos e transmissões.</h2>
            <p>Acompanhe os conteúdos da igreja em um só lugar.</p>
          </div>
          <a href="#videos">Acessar vídeos</a>
        </article>

        <article className="feature-card feature-transparency">
          <div>
            <span>Transparência</span>
            <h2>Informações e documentos para membros.</h2>
            <p>Prestação de contas com clareza e organização.</p>
          </div>
          <a href="/admin">Acessar portal</a>
        </article>
      </section>

      <section className="prayer" id="oracao">
        <div>
          <span className="section-label">Pedido de oração</span>
          <h2>Podemos orar por você?</h2>
          <p>
            Envie seu pedido de oração. Nossa liderança terá alegria em
            interceder por você e sua família.
          </p>
        </div>

        <a className="primary-button dark" href="#contato">
          Enviar pedido
        </a>
      </section>

      <footer className="footer" id="contato">
        <div>
          <strong>Filhos da Graça</strong>
          <span>Gerados no coração de Deus</span>
        </div>

        <nav>
          <a href="#cultos">Cultos</a>
          <a href="#eventos">Eventos</a>
          <a href="#oracao">Oração</a>
          <a href="#midia">Mídia</a>
          <a href="/admin">Área do Membro</a>
        </nav>
      </footer>
    </main>
  )
}

export default App