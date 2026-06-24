import { useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import './Admin.css'

const ADMIN_EMAILS = ['suedilsonfilho@gmail.com']

function Admin() {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [programacao, setProgramacao] = useState([])
  const [editandoId, setEditandoId] = useState(null)

  const [form, setForm] = useState({
    dia: '',
    titulo: '',
    horario: '',
    descricao: '',
  })

  const [eventos, setEventos] = useState([])
  const [editandoEventoId, setEditandoEventoId] = useState(null)

  const [eventoForm, setEventoForm] = useState({
    titulo: '',
    data: '',
    horario: '',
    local: '',
    descricao: '',
    imagem: '',
  })

  const eventoFormRef = useRef(null)
  const isAdmin = user && ADMIN_EMAILS.includes(user.email)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setCheckingAuth(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      carregarProgramacao()
      carregarEventos()
    }
  }, [isAdmin])

  async function login(event) {
    event.preventDefault()
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      alert('Não foi possível entrar. Verifique o e-mail e a senha.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function sair() {
    await signOut(auth)
  }

  async function carregarProgramacao() {
    const q = query(collection(db, 'programacao'), orderBy('ordem', 'asc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setProgramacao(lista)
  }

  async function cadastrarCulto(event) {
    event.preventDefault()

    if (!form.dia || !form.titulo || !form.horario) {
      alert('Preencha dia, título e horário.')
      return
    }

    setLoading(true)

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'programacao', editandoId), {
          dia: form.dia,
          titulo: form.titulo,
          horario: form.horario,
          descricao: form.descricao,
          atualizadoEm: serverTimestamp(),
        })

        alert('Programação atualizada com sucesso!')
      } else {
        await addDoc(collection(db, 'programacao'), {
          dia: form.dia,
          titulo: form.titulo,
          horario: form.horario,
          descricao: form.descricao,
          ordem: programacao.length + 1,
          ativo: true,
          criadoEm: serverTimestamp(),
        })

        alert('Programação cadastrada com sucesso!')
      }

      setForm({
        dia: '',
        titulo: '',
        horario: '',
        descricao: '',
      })

      setEditandoId(null)
      await carregarProgramacao()
    } catch (error) {
      alert('Erro ao salvar programação.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function editarCulto(culto) {
    setEditandoId(culto.id)

    setForm({
      dia: culto.dia || '',
      titulo: culto.titulo || '',
      horario: culto.horario || '',
      descricao: culto.descricao || '',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)

    setForm({
      dia: '',
      titulo: '',
      horario: '',
      descricao: '',
    })
  }

  async function excluirCulto(id) {
    const confirmar = confirm('Deseja realmente excluir esta programação?')

    if (!confirmar) return

    try {
      await deleteDoc(doc(db, 'programacao', id))
      await carregarProgramacao()
    } catch (error) {
      alert('Erro ao excluir programação.')
      console.error(error)
    }
  }

  async function alternarStatusCulto(culto) {
    try {
      await updateDoc(doc(db, 'programacao', culto.id), {
        ativo: culto.ativo === false ? true : false,
        atualizadoEm: serverTimestamp(),
      })

      await carregarProgramacao()
    } catch (error) {
      alert('Erro ao alterar status da programação.')
      console.error(error)
    }
  }

  async function moverCulto(indexAtual, direcao) {
    const novoIndex = direcao === 'subir' ? indexAtual - 1 : indexAtual + 1

    if (novoIndex < 0 || novoIndex >= programacao.length) {
      return
    }

    const cultoAtual = programacao[indexAtual]
    const cultoTroca = programacao[novoIndex]

    try {
      const batch = writeBatch(db)

      batch.update(doc(db, 'programacao', cultoAtual.id), {
        ordem: cultoTroca.ordem,
        atualizadoEm: serverTimestamp(),
      })

      batch.update(doc(db, 'programacao', cultoTroca.id), {
        ordem: cultoAtual.ordem,
        atualizadoEm: serverTimestamp(),
      })

      await batch.commit()
      await carregarProgramacao()
    } catch (error) {
      alert('Erro ao ordenar programação.')
      console.error(error)
    }
  }

  async function carregarEventos() {
    const q = query(collection(db, 'eventos'), orderBy('data', 'asc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setEventos(lista)
  }

  async function cadastrarEvento(event) {
    event.preventDefault()

    if (!eventoForm.titulo || !eventoForm.data) {
      alert('Preencha pelo menos o título e a data do evento.')
      return
    }

    setLoading(true)

    try {
      if (editandoEventoId) {
        await updateDoc(doc(db, 'eventos', editandoEventoId), {
          titulo: eventoForm.titulo,
          data: eventoForm.data,
          horario: eventoForm.horario,
          local: eventoForm.local,
          descricao: eventoForm.descricao,
          imagem: eventoForm.imagem,
          atualizadoEm: serverTimestamp(),
        })

        alert('Evento atualizado com sucesso!')
      } else {
        await addDoc(collection(db, 'eventos'), {
          titulo: eventoForm.titulo,
          data: eventoForm.data,
          horario: eventoForm.horario,
          local: eventoForm.local,
          descricao: eventoForm.descricao,
          imagem: eventoForm.imagem,
          ativo: true,
          criadoEm: serverTimestamp(),
        })

        alert('Evento cadastrado com sucesso!')
      }

      setEventoForm({
        titulo: '',
        data: '',
        horario: '',
        local: '',
        descricao: '',
        imagem: '',
      })

      setEditandoEventoId(null)
      await carregarEventos()
    } catch (error) {
      alert('Erro ao salvar evento.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function editarEvento(evento) {
    setEditandoEventoId(evento.id)

    setEventoForm({
      titulo: evento.titulo || '',
      data: evento.data || '',
      horario: evento.horario || '',
      local: evento.local || '',
      descricao: evento.descricao || '',
      imagem: evento.imagem || '',
    })

eventoFormRef.current?.scrollIntoView({
  behavior: 'smooth',
  block: 'start',
})  
}
 
  function cancelarEdicaoEvento() {
    setEditandoEventoId(null)

    setEventoForm({
      titulo: '',
      data: '',
      horario: '',
      local: '',
      descricao: '',
      imagem: '',
    })
  }

  async function excluirEvento(id) {
    const confirmar = confirm('Deseja realmente excluir este evento?')

    if (!confirmar) return

    try {
      await deleteDoc(doc(db, 'eventos', id))
      await carregarEventos()
    } catch (error) {
      alert('Erro ao excluir evento.')
      console.error(error)
    }
  }

  async function alternarStatusEvento(evento) {
    try {
      await updateDoc(doc(db, 'eventos', evento.id), {
        ativo: evento.ativo === false ? true : false,
        atualizadoEm: serverTimestamp(),
      })

      await carregarEventos()
    } catch (error) {
      alert('Erro ao alterar status do evento.')
      console.error(error)
    }
  }

  function formatarData(data) {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')

    return `${dia}/${mes}/${ano}`
  }

  if (checkingAuth) {
    return (
      <main className="admin-page">
        <p>Carregando...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="admin-page">
        <section className="login-card">
          <div className="admin-logo">FG</div>
          <h1>Administração</h1>
          <p>Entre para gerenciar o site da Igreja Filhos da Graça.</p>

          <form onSubmit={login}>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seuemail@exemplo.com"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <section className="login-card">
          <h1>Acesso negado</h1>
          <p>Seu usuário não tem permissão para administrar este site.</p>
          <button onClick={sair}>Sair</button>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span>Painel administrativo</span>
          <h1>Filhos da Graça</h1>
        </div>

        <button onClick={sair}>Sair</button>
      </header>

      <section className="admin-grid">
        <form className="admin-card" onSubmit={cadastrarCulto}>
          <span className="admin-section-label">Programação</span>

          <h2>{editandoId ? 'Editar culto' : 'Cadastrar culto'}</h2>

          <p>
            {editandoId
              ? 'Altere as informações e salve para atualizar a página inicial.'
              : 'Essas informações aparecerão automaticamente na página inicial.'}
          </p>

          <label>
            Dia
            <input
              value={form.dia}
              onChange={(event) =>
                setForm({ ...form, dia: event.target.value })
              }
              placeholder="Ex: Domingo"
            />
          </label>

          <label>
            Título
            <input
              value={form.titulo}
              onChange={(event) =>
                setForm({ ...form, titulo: event.target.value })
              }
              placeholder="Ex: Culto da Família"
            />
          </label>

          <label>
            Horário
            <input
              value={form.horario}
              onChange={(event) =>
                setForm({ ...form, horario: event.target.value })
              }
              placeholder="Ex: 19h"
            />
          </label>

          <label>
            Descrição
            <textarea
              value={form.descricao}
              onChange={(event) =>
                setForm({ ...form, descricao: event.target.value })
              }
              placeholder="Descrição opcional"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading
              ? 'Salvando...'
              : editandoId
                ? 'Salvar alterações'
                : 'Salvar programação'}
          </button>

          {editandoId && (
            <button
              type="button"
              className="cancel-button"
              onClick={cancelarEdicao}
            >
              Cancelar edição
            </button>
          )}
        </form>

        <section className="admin-card">
          <span className="admin-section-label">Página inicial</span>
          <h2>Programação cadastrada</h2>
          <p>Lista dos cultos que serão exibidos no site.</p>

          <div className="admin-list">
            {programacao.length === 0 && (
              <p>Nenhuma programação cadastrada ainda.</p>
            )}

            {programacao.map((culto, index) => (
              <article
                className={`admin-list-item ${
                  culto.ativo === false ? 'inactive-item' : ''
                }`}
                key={culto.id}
              >
                <div>
                  <span>{culto.dia}</span>
                  <strong>{culto.titulo}</strong>
                  <p>{culto.horario}</p>
                  {culto.descricao && <small>{culto.descricao}</small>}
                  <em>{culto.ativo === false ? 'Inativo' : 'Ativo'}</em>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="order-button"
                    onClick={() => moverCulto(index, 'subir')}
                    disabled={index === 0}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    className="order-button"
                    onClick={() => moverCulto(index, 'descer')}
                    disabled={index === programacao.length - 1}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => editarCulto(culto)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className={
                      culto.ativo === false
                        ? 'activate-button'
                        : 'deactivate-button'
                    }
                    onClick={() => alternarStatusCulto(culto)}
                  >
                    {culto.ativo === false ? 'Ativar' : 'Desativar'}
                  </button>

                  <button type="button" onClick={() => excluirCulto(culto.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="admin-grid admin-events-grid">
       <form
  ref={eventoFormRef}
  className="admin-card"
  onSubmit={cadastrarEvento}
>
          <span className="admin-section-label">Eventos</span>

          <h2>{editandoEventoId ? 'Editar evento' : 'Cadastrar evento'}</h2>

          <p>
            {editandoEventoId
              ? 'Altere as informações e salve para atualizar a página inicial.'
              : 'Cadastre eventos especiais para aparecerem na página inicial.'}
          </p>

          <label>
            Título do evento
            <input
              value={eventoForm.titulo}
              onChange={(event) =>
                setEventoForm({ ...eventoForm, titulo: event.target.value })
              }
              placeholder="Ex: Conferência da Família"
            />
          </label>

          <label>
            Data
            <input
              type="date"
              value={eventoForm.data}
              onChange={(event) =>
                setEventoForm({ ...eventoForm, data: event.target.value })
              }
            />
          </label>

          <label>
            Horário
            <input
              value={eventoForm.horario}
              onChange={(event) =>
                setEventoForm({ ...eventoForm, horario: event.target.value })
              }
              placeholder="Ex: 19h30"
            />
          </label>

          <label>
            Local
            <input
              value={eventoForm.local}
              onChange={(event) =>
                setEventoForm({ ...eventoForm, local: event.target.value })
              }
              placeholder="Ex: Templo sede"
            />
          </label>

          <label>
            Descrição
            <textarea
              value={eventoForm.descricao}
              onChange={(event) =>
                setEventoForm({
                  ...eventoForm,
                  descricao: event.target.value,
                })
              }
              placeholder="Descrição opcional do evento"
            />
          </label>

          <label>
            Imagem do evento
            <input
              value={eventoForm.imagem}
              onChange={(event) =>
                setEventoForm({ ...eventoForm, imagem: event.target.value })
              }
              placeholder="Ex: /evento.jpg ou https://..."
            />
          </label>

          {eventoForm.imagem && (
            <img
              className="admin-preview-image"
              src={eventoForm.imagem}
              alt="Prévia do evento"
            />
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? 'Salvando...'
              : editandoEventoId
                ? 'Salvar alterações'
                : 'Salvar evento'}
          </button>

          {editandoEventoId && (
            <button
              type="button"
              className="cancel-button"
              onClick={cancelarEdicaoEvento}
            >
              Cancelar edição
            </button>
          )}
        </form>

        <section className="admin-card">
          <span className="admin-section-label">Página inicial</span>
          <h2>Eventos cadastrados</h2>
          <p>Lista dos eventos que serão exibidos no site.</p>

          <div className="admin-list">
            {eventos.length === 0 && <p>Nenhum evento cadastrado ainda.</p>}

            {eventos.map((evento) => (
              <article
                className={`admin-list-item ${
                  evento.ativo === false ? 'inactive-item' : ''
                }`}
                key={evento.id}
              >
                <div>
                  <span>{formatarData(evento.data)}</span>
                  <strong>{evento.titulo}</strong>

                  {evento.horario && <p>{evento.horario}</p>}
                  {evento.local && <small>{evento.local}</small>}
                  {evento.descricao && <small>{evento.descricao}</small>}

                  <em>{evento.ativo === false ? 'Inativo' : 'Ativo'}</em>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => editarEvento(evento)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className={
                      evento.ativo === false
                        ? 'activate-button'
                        : 'deactivate-button'
                    }
                    onClick={() => alternarStatusEvento(evento)}
                  >
                    {evento.ativo === false ? 'Ativar' : 'Desativar'}
                  </button>

                  <button type="button" onClick={() => excluirEvento(evento.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default Admin