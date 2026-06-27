import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../services/firebase'
import './Ensino.css'

function Ensino() {
  const [materiais, setMateriais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos')
  const [busca, setBusca] = useState('')

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

  const categorias = useMemo(
    () => [
      'Todos',
      ...Array.from(
        new Set(
          materiais.map((material) => material.categoria).filter(Boolean),
        ),
      ),
    ],
    [materiais],
  )

  const materiaisFiltrados = materiais.filter((material) => {
    const textoBusca = busca.toLowerCase().trim()

    const passaCategoria =
      categoriaAtiva === 'Todos' || material.categoria === categoriaAtiva

    const passaBusca =
      !textoBusca ||
      material.titulo?.toLowerCase().includes(textoBusca) ||
      material.descricao?.toLowerCase().includes(textoBusca) ||
      material.autor?.toLowerCase().includes(textoBusca) ||
      material.periodo?.toLowerCase().includes(textoBusca) ||
      material.categoria?.toLowerCase().includes(textoBusca)

    return passaCategoria && passaBusca
  })

  return (
    <main className="teaching-page bookshelf-page">
      <section className="teaching-hero bookshelf-hero">
        <div>
          <span>Ensino</span>

          <h1>Materiais de estudo bíblico</h1>

          <p>
            Acesse revistas, apostilas, estudos e materiais de apoio para
            crescimento espiritual, discipulado e Escola Bíblica.
          </p>
        </div>

        <a href="/" className="teaching-home-button">
          ← Voltar para a página inicial
        </a>
      </section>

      <section className="teaching-content">
        <div className="bookshelf-panel">
          <div className="bookshelf-panel-header">
            <div>
              <span>Biblioteca digital</span>

              <h2>Prateleira de estudos</h2>

              <p>
                Escolha um material para abrir em formato de revista digital ou
                baixar o PDF.
              </p>
            </div>

            <a href="/" className="bookshelf-back-link">
              Início
            </a>
          </div>

          <div className="bookshelf-tools">
            <label className="bookshelf-search">
              <span>Pesquisar</span>

              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por título, autor, período ou categoria"
              />
            </label>

            {categorias.length > 1 && (
              <div className="bookshelf-categories">
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
        </div>

        {carregando && (
          <div className="teaching-empty">
            <strong>Carregando materiais...</strong>
            <p>Aguarde um instante.</p>
          </div>
        )}

        {!carregando && materiaisFiltrados.length === 0 && (
          <div className="teaching-empty">
            <strong>Nenhum material encontrado.</strong>
            <p>
              Tente mudar a busca, selecionar outra categoria ou voltar mais
              tarde.
            </p>
          </div>
        )}

        {!carregando && materiaisFiltrados.length > 0 && (
          <div className="digital-bookshelf">
            <div className="digital-bookshelf-top">
              <strong>Biblioteca Filhos da Graça</strong>
            </div>

            <div className="digital-bookshelf-grid">
              {materiaisFiltrados.map((material) => (
                <article className="digital-book" key={material.id}>
                  <a href={`/ensino/${material.id}`} className="digital-book-cover">
                    <div className="digital-book-spine" />

                    {material.capa ? (
                      <img src={material.capa} alt={material.titulo} />
                    ) : (
                      <div className="digital-book-placeholder">
                        <span>PDF</span>
                      </div>
                    )}
                  </a>

                  <div className="digital-book-label">
                    <span>{material.categoria || 'Material'}</span>

                    <strong>{material.titulo}</strong>

                    {material.periodo && <small>{material.periodo}</small>}
                  </div>

                  <div className="digital-book-actions">
                    <a href={`/ensino/${material.id}`}>Abrir revista</a>

                    {material.pdfUrl && (
                      <a href={material.pdfUrl} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default Ensino