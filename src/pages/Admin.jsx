import { useEffect, useState } from 'react'
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
  <button type="button" className="cancel-button" onClick={cancelarEdicao}>
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

            {programacao.map((culto) => (
              <article className="admin-list-item" key={culto.id}>
                <div>
                  <span>{culto.dia}</span>
                  <strong>{culto.titulo}</strong>
                  <p>{culto.horario}</p>
                  {culto.descricao && <small>{culto.descricao}</small>}
                </div>

                <div className="admin-actions">
  <button
    type="button"
    className="edit-button"
    onClick={() => editarCulto(culto)}
  >
    Editar
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
    </main>
  )
}

export default Admin