import './App.css'

const modules = [
  {
    title: 'Secretaria',
    description: 'Organize membros, visitantes, congregados, dados cadastrais e histórico.',
    icon: '👥',
  },
  {
    title: 'Financeiro',
    description: 'Controle receitas, despesas, contas a pagar, recebimentos e relatórios.',
    icon: '🏦',
  },
  {
    title: 'Eventos',
    description: 'Gerencie cultos, eventos, inscrições, check-in e presença.',
    icon: '📅',
  },
  {
    title: 'Escalas',
    description: 'Organize equipes, ministérios, voluntários e responsáveis.',
    icon: '✅',
  },
  {
    title: 'Ensino / EBD',
    description: 'Gerencie turmas, alunos, professores, frequência e conteúdos.',
    icon: '📖',
  },
  {
    title: 'Atendimento Pastoral',
    description: 'Registre solicitações, acompanhe atendimentos e mantenha histórico.',
    icon: '🤝',
  },
  {
    title: 'Células / Grupos',
    description: 'Acompanhe pequenos grupos, líderes, participantes e encontros.',
    icon: '🏠',
  },
  {
    title: 'Patrimônio',
    description: 'Controle bens, categorias, movimentações e manutenções da igreja.',
    icon: '📦',
  },
  {
    title: 'WhatsApp Automático',
    description: 'Automatize avisos, lembretes e comunicações importantes.',
    icon: '💬',
  },
  {
    title: 'Contribuições Online',
    description: 'Acompanhe dízimos, ofertas e campanhas online com organização.',
    icon: '💚',
  },
  {
    title: 'Transmissão Online',
    description: 'Centralize transmissões, vídeos e facilite o acesso dos membros.',
    icon: '📺',
  },
  {
    title: 'Portal da Transparência',
    description: 'Publique relatórios, documentos, receitas, despesas e prestação de contas.',
    icon: '📊',
  },
]

const events = [
  {
    day: 'Dom',
    date: '19h',
    title: 'Culto da Família',
  },
  {
    day: 'Qua',
    date: '19h30',
    title: 'Culto de Ensino',
  },
  {
    day: 'Sáb',
    date: '18h',
    title: 'Encontro de Jovens',
  },
]

function App() {
  return (
    <main className="app">
      <header className="header">
        <a href="#inicio" className="brand" aria-label="Filhos da Graça">
          <div className="brand-symbol">FG</div>
          <div>
            <strong>Filhos da Graça</strong>
            <span>Gerados no coração de Deus</span>
          </div>
        </a>

        <nav className="nav">
          <a href="#modulos">Módulos</a>
          <a href="#agenda">Agenda</a>
          <a href="#transparencia">Transparência</a>
          <a href="#contato">Contato</a>
        </nav>

        <a className="login-button" href="#area-membro">
          Área do Membro
        </a>
      </header>

      <section id="inicio" className="hero">
        <div className="hero-content">
          <span className="tag">Igreja Evangélica Filhos da Graça</span>
          <h1>Um portal moderno para conectar, cuidar e organizar a igreja.</h1>
          <p>
            Site e aplicativo responsivo para membros, visitantes, secretaria,
            eventos, transparência, fotos, vídeos, enquetes e comunicação da igreja.
          </p>

          <div className="hero-actions">
            <a href="#contato" className="primary-button">
              Sou visitante
            </a>
            <a href="#agenda" className="secondary-button">
              Ver agenda
            </a>
          </div>

          <div className="hero-stats">
            <div>
              <strong>100%</strong>
              <span>Responsivo</span>
            </div>
            <div>
              <strong>PWA</strong>
              <span>Instalável no celular</span>
            </div>
            <div>
              <strong>R$ 0</strong>
              <span>Hospedagem inicial gratuita</span>
            </div>
          </div>
        </div>

        <div className="hero-card">
          <div className="card-glow"></div>
          <h2>Bem-vindo</h2>
          <p>
            Aqui você encontrará informações da igreja, próximos eventos,
            pedidos de oração, vídeos, fotos e prestação de contas.
          </p>

          <div className="quick-links">
            <a href="#oracao">🙏 Pedido de oração</a>
            <a href="#transparencia">📊 Transparência</a>
            <a href="#videos">▶️ Vídeos</a>
            <a href="#como-chegar">📍 Como chegar</a>
          </div>
        </div>
      </section>

      <section className="section" id="modulos">
        <div className="section-heading">
          <span>Gestão da igreja</span>
          <h2>Módulos do sistema</h2>
          <p>
            Estrutura preparada para administrar a igreja com organização,
            simplicidade e transparência.
          </p>
        </div>

        <div className="module-grid">
          {modules.map((module) => (
            <article className="module-card" key={module.title}>
              <div className="module-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section" id="agenda">
        <div>
          <span className="section-label">Comunhão</span>
          <h2>Agenda e eventos</h2>
          <p>
            Acompanhe os cultos, encontros, reuniões, eventos especiais,
            inscrições e atividades da igreja.
          </p>
          <a href="#eventos" className="primary-button small">
            Ver todos os eventos
          </a>
        </div>

        <div className="event-list">
          {events.map((event) => (
            <article className="event-card" key={event.title}>
              <div>
                <strong>{event.day}</strong>
                <span>{event.date}</span>
              </div>
              <h3>{event.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-band" id="transparencia">
        <div>
          <span className="section-label">Portal da Transparência</span>
          <h2>Prestação de contas clara para a comunidade.</h2>
          <p>
            Área dedicada à publicação de receitas, despesas, contas a pagar,
            documentos, relatórios e comunicados importantes.
          </p>
        </div>
        <a href="#documentos" className="secondary-button light">
          Acessar documentos
        </a>
      </section>

      <section className="content-grid">
        <article id="aniversariantes" className="content-card">
          <span>🎂</span>
          <h3>Aniversariantes do mês</h3>
          <p>Espaço para celebrar e honrar os membros aniversariantes.</p>
        </article>

        <article id="fotos" className="content-card">
          <span>📸</span>
          <h3>Álbum de fotos</h3>
          <p>Galerias de cultos, eventos, células, encontros e ações sociais.</p>
        </article>

        <article id="videos" className="content-card">
          <span>▶️</span>
          <h3>Vídeos e transmissões</h3>
          <p>Central de pregações, estudos, lives e transmissões online.</p>
        </article>

        <article id="oracao" className="content-card">
          <span>🙏</span>
          <h3>Pedidos de oração</h3>
          <p>Canal para membros e visitantes enviarem pedidos à liderança.</p>
        </article>
      </section>

      <section className="contact-section" id="contato">
        <div>
          <span className="section-label">Visite-nos</span>
          <h2>Como chegar</h2>
          <p>
            Em breve, esta área terá endereço, mapa, horários dos cultos,
            telefone, WhatsApp e redes sociais oficiais da igreja.
          </p>
        </div>

        <div className="contact-card">
          <h3>Igreja Filhos da Graça</h3>
          <p>Gerados no coração de Deus</p>
          <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">
            Abrir mapa
          </a>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>Filhos da Graça</strong>
          <span>Site e aplicativo em desenvolvimento</span>
        </div>
        <p>© 2026 Igreja Filhos da Graça. Todos os direitos reservados.</p>
      </footer>
    </main>
  )
}

export default App