import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../services/firebase'
import './Ensino.css'

function Ensino() {
  const [materiais, setMateriais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos')

  useEffect(() => {
    async function carregarMateriais() {
      try {
        const q = query(
          collection(db, 'ensinoMateriais'),
          orderBy('criadoEm', 'desc'),
        )

        const snapshot = await getDocs(q)

        const lista = snapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...documento.data(),
          }))
          .filter((material) => material.ativo !== false)

        setMateriais(lista)
      } catch (error) {
        console.error('Erro ao carregar materiais de ensino.', error)
      } finally {
        setCarregando(false)
      }
    }

    carregarMateriais()
  }, [])

  const categorias = [
    'Todos',
    ...Array.from(
      new Set(materiais.map((material) => material.categoria).filter(Boolean)),
    ),
  ]

  const materiaisFiltrados =
    categoriaAtiva === 'Todos'
      ? materiais
      : materiais.filter((material) => material.categoria === categoriaAtiva)

  return (
    <main className="teaching-page">
      <section className="teaching-hero">
        <div>
          <span>Ensino</span>

          <h1>Materiais de estudo bíblico</h1>

          <p>
            Acesse revistas, apostilas, estudos e materiais de apoio para
            crescimento espiritual, discipulado e Escola Bíblica.
          </p>
        </div>
      </section>

      <section className="teaching-content">
        <div className="teaching-toolbar">
          <div>
            <span>Biblioteca</span>

            <h2>Materiais disponíveis</h2>

            <p>
              Escolha um material para abrir em formato de revista digital ou
              baixar o PDF.
            </p>
          </div>

          {categorias.length > 1 && (
            <div className="teaching-categories">
              {categorias.map((categoria) => (
                <button
                  type="button"
                  key={categoria}
                  className={categoriaAtiva === categoria ? 'active' : ''}
                  onClick={() => setCategoriaAtiva(categoria)}
                >
                  {categoria}
                </button>
              ))}
            </div>
          )}
        </div>

        {carregando && (
          <div className="teaching-empty">
            <strong>Carregando materiais...</strong>
            <p>Aguarde um instante.</p>
          </div>
        )}

        {!carregando && materiaisFiltrados.length === 0 && (
          <div className="teaching-empty">
            <strong>Nenhum material disponível.</strong>
            <p>Em breve novos conteúdos serão publicados aqui.</p>
          </div>
        )}

        <div className="teaching-grid">
          {materiaisFiltrados.map((material) => (
            <article className="teaching-card" key={material.id}>
              <div className="teaching-cover">
                {material.capa ? (
                  <img src={material.capa} alt={material.titulo} />
                ) : (
                  <div>
                    <span>PDF</span>
                  </div>
                )}
              </div>

              <div className="teaching-card-content">
                <span>{material.categoria || 'Material'}</span>

                <h3>{material.titulo}</h3>

                {material.periodo && <strong>{material.periodo}</strong>}

                {material.autor && <small>{material.autor}</small>}

                {material.descricao && <p>{material.descricao}</p>}

                <div className="teaching-card-actions">
                  <a href={`/ensino/${material.id}`}>Abrir revista</a>

                  {material.pdfUrl && (
                    <a
                      href={material.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Baixar PDF
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default Ensino