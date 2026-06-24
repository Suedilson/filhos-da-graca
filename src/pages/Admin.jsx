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
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { uploadArquivoCloudinary } from '../services/cloudinary'
import './Admin.css'

const ADMIN_EMAILS = ['suedilsonfilho@gmail.com']

function Admin() {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState('programacao')

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
  const [pedidosOracao, setPedidosOracao] = useState([])
  const [videos, setVideos] = useState([])
  const [editandoVideoId, setEditandoVideoId] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [editandoDocumentoId, setEditandoDocumentoId] = useState(null)
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)

  const [eventoForm, setEventoForm] = useState({
    titulo: '',
    data: '',
    horario: '',
    local: '',
    descricao: '',
    imagem: '',
  })
const [videoForm, setVideoForm] = useState({
  titulo: '',
  descricao: '',
  url: '',
})
const [documentoForm, setDocumentoForm] = useState({
  titulo: '',
  categoria: '',
  descricao: '',
  url: '',
  publicId: '',
})
const [localizacaoForm, setLocalizacaoForm] = useState({
  nomeLocal: '',
  endereco: '',
  googleMapsUrl: '',
  latitude: '',
  longitude: '',
  fotoFachada: '',
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
    carregarLocalizacao()
    carregarPedidosOracao()
    carregarVideos()
    carregarDocumentos()
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
    setAbaAtiva('programacao')
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
    setAbaAtiva('eventos')
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
async function carregarLocalizacao() {
  try {
    const ref = doc(db, 'configuracoes', 'localizacao')
    const snapshot = await getDoc(ref)

    if (snapshot.exists()) {
      const dados = snapshot.data()

      setLocalizacaoForm({
        nomeLocal: dados.nomeLocal || '',
        endereco: dados.endereco || '',
        googleMapsUrl: dados.googleMapsUrl || '',
        latitude: dados.latitude || '',
        longitude: dados.longitude || '',
        fotoFachada: dados.fotoFachada || '',
      })
    }
  } catch (error) {
    alert('Erro ao carregar localização.')
    console.error(error)
  }
}

async function salvarLocalizacao(event) {
  event.preventDefault()

  if (!localizacaoForm.endereco) {
    alert('Preencha pelo menos o endereço.')
    return
  }

  setLoading(true)

  try {
    await setDoc(
      doc(db, 'configuracoes', 'localizacao'),
      {
        nomeLocal: localizacaoForm.nomeLocal,
        endereco: localizacaoForm.endereco,
        googleMapsUrl: localizacaoForm.googleMapsUrl,
        latitude: localizacaoForm.latitude,
        longitude: localizacaoForm.longitude,
        fotoFachada: localizacaoForm.fotoFachada,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    )

    alert('Localização salva com sucesso!')
  } catch (error) {
    alert('Erro ao salvar localização.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}
async function carregarPedidosOracao() {
  try {
    const q = query(collection(db, 'pedidosOracao'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setPedidosOracao(lista)
  } catch (error) {
    alert('Erro ao carregar pedidos de oração.')
    console.error(error)
  }
}

async function alternarStatusPedido(pedido) {
  try {
    await updateDoc(doc(db, 'pedidosOracao', pedido.id), {
      lido: pedido.lido === true ? false : true,
      atualizadoEm: serverTimestamp(),
    })

    await carregarPedidosOracao()
  } catch (error) {
    alert('Erro ao alterar status do pedido.')
    console.error(error)
  }
}

async function excluirPedidoOracao(id) {
  const confirmar = confirm('Deseja realmente excluir este pedido de oração?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'pedidosOracao', id))
    await carregarPedidosOracao()
  } catch (error) {
    alert('Erro ao excluir pedido de oração.')
    console.error(error)
  }
}

function formatarDataHoraFirebase(dataFirebase) {
  if (!dataFirebase?.toDate) return ''

  return dataFirebase.toDate().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
async function carregarVideos() {
  try {
    const q = query(collection(db, 'videos'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setVideos(lista)
  } catch (error) {
    alert('Erro ao carregar vídeos.')
    console.error(error)
  }
}

async function salvarVideo(event) {
  event.preventDefault()

  if (!videoForm.titulo || !videoForm.url) {
    alert('Preencha pelo menos o título e o link do vídeo.')
    return
  }

  setLoading(true)

  try {
    if (editandoVideoId) {
      await updateDoc(doc(db, 'videos', editandoVideoId), {
        titulo: videoForm.titulo,
        descricao: videoForm.descricao,
        url: videoForm.url,
        atualizadoEm: serverTimestamp(),
      })

      alert('Vídeo atualizado com sucesso!')
    } else {
      await addDoc(collection(db, 'videos'), {
        titulo: videoForm.titulo,
        descricao: videoForm.descricao,
        url: videoForm.url,
        ativo: true,
        criadoEm: serverTimestamp(),
      })

      alert('Vídeo cadastrado com sucesso!')
    }

    setVideoForm({
      titulo: '',
      descricao: '',
      url: '',
    })

    setEditandoVideoId(null)
    await carregarVideos()
  } catch (error) {
    alert('Erro ao salvar vídeo.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarVideo(video) {
  setAbaAtiva('midia')
  setEditandoVideoId(video.id)

  setVideoForm({
    titulo: video.titulo || '',
    descricao: video.descricao || '',
    url: video.url || '',
  })

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

function cancelarEdicaoVideo() {
  setEditandoVideoId(null)

  setVideoForm({
    titulo: '',
    descricao: '',
    url: '',
  })
}

async function alternarStatusVideo(video) {
  try {
    await updateDoc(doc(db, 'videos', video.id), {
      ativo: video.ativo === false ? true : false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarVideos()
  } catch (error) {
    alert('Erro ao alterar status do vídeo.')
    console.error(error)
  }
}

async function excluirVideo(id) {
  const confirmar = confirm('Deseja realmente excluir este vídeo?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'videos', id))
    await carregarVideos()
  } catch (error) {
    alert('Erro ao excluir vídeo.')
    console.error(error)
  }
}
async function carregarDocumentos() {
  try {
    const q = query(collection(db, 'documentos'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setDocumentos(lista)
  } catch (error) {
    alert('Erro ao carregar documentos.')
    console.error(error)
  }
}

async function enviarArquivoDocumento(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoArquivo(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setDocumentoForm((formAtual) => ({
      ...formAtual,
      url: arquivo.url,
      publicId: arquivo.publicId,
    }))

    alert('Arquivo enviado com sucesso!')
  } catch (error) {
    alert('Erro ao enviar arquivo.')
    console.error(error)
  } finally {
    setEnviandoArquivo(false)
  }
}

async function salvarDocumento(event) {
  event.preventDefault()

  if (!documentoForm.titulo || !documentoForm.url) {
    alert('Preencha pelo menos o título e o link do documento.')
    return
  }

  setLoading(true)

  try {
    if (editandoDocumentoId) {
      await updateDoc(doc(db, 'documentos', editandoDocumentoId), {
        titulo: documentoForm.titulo,
        categoria: documentoForm.categoria,
        descricao: documentoForm.descricao,
        url: documentoForm.url,
        publicId: documentoForm.publicId,
        atualizadoEm: serverTimestamp(),
      })

      alert('Documento atualizado com sucesso!')
    } else {
      await addDoc(collection(db, 'documentos'), {
        titulo: documentoForm.titulo,
        categoria: documentoForm.categoria,
        descricao: documentoForm.descricao,
        url: documentoForm.url,
        publicId: documentoForm.publicId,
        ativo: true,
        criadoEm: serverTimestamp(),
      })

      alert('Documento cadastrado com sucesso!')
    }

    setDocumentoForm({
      titulo: '',
      categoria: '',
      descricao: '',
      url: '',
      publicId: '',
    })

    setEditandoDocumentoId(null)
    await carregarDocumentos()
  } catch (error) {
    alert('Erro ao salvar documento.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarDocumento(documento) {
  setAbaAtiva('documentos')
  setEditandoDocumentoId(documento.id)

  setDocumentoForm({
    titulo: documento.titulo || '',
    categoria: documento.categoria || '',
    descricao: documento.descricao || '',
    url: documento.url || '',
    publicId: documento.publicId || '',
  })

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

function cancelarEdicaoDocumento() {
  setEditandoDocumentoId(null)

  setDocumentoForm({
    titulo: '',
    categoria: '',
    descricao: '',
    url: '',
    publicId: '',
  })
}

async function alternarStatusDocumento(documento) {
  try {
    await updateDoc(doc(db, 'documentos', documento.id), {
      ativo: documento.ativo === false ? true : false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarDocumentos()
  } catch (error) {
    alert('Erro ao alterar status do documento.')
    console.error(error)
  }
}

async function excluirDocumento(id) {
  const confirmar = confirm('Deseja realmente excluir este documento?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'documentos', id))
    await carregarDocumentos()
  } catch (error) {
    alert('Erro ao excluir documento.')
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

<nav className="admin-tabs">
  <button
    type="button"
    className={abaAtiva === 'programacao' ? 'active' : ''}
    onClick={() => setAbaAtiva('programacao')}
  >
    Programação
  </button>

  <button
    type="button"
    className={abaAtiva === 'eventos' ? 'active' : ''}
    onClick={() => setAbaAtiva('eventos')}
  >
    Eventos
  </button>

  <button
    type="button"
    className={abaAtiva === 'oracao' ? 'active' : ''}
    onClick={() => setAbaAtiva('oracao')}
  >
    Oração
  </button>

  <button
    type="button"
    className={abaAtiva === 'midia' ? 'active' : ''}
    onClick={() => setAbaAtiva('midia')}
  >
    Mídia
  </button>
<button
  type="button"
  className={abaAtiva === 'documentos' ? 'active' : ''}
  onClick={() => setAbaAtiva('documentos')}
>
  Documentos
</button>

  <button
    type="button"
    className={abaAtiva === 'localizacao' ? 'active' : ''}
    onClick={() => setAbaAtiva('localizacao')}
  >
    Localização
  </button>
</nav>
        {abaAtiva === 'programacao' && (
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
)}

       {abaAtiva === 'eventos' && (
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
      )}
{abaAtiva === 'oracao' && (
  <section className="admin-card admin-full-card">
    <span className="admin-section-label">Pedidos de oração</span>

    <h2>Pedidos recebidos</h2>

    <p>
      Acompanhe os pedidos enviados pelo site e marque como lidos depois de tratar.
    </p>

    <div className="admin-list">
      {pedidosOracao.length === 0 && (
        <p>Nenhum pedido de oração recebido ainda.</p>
      )}

      {pedidosOracao.map((pedido) => (
        <article
          className={`admin-list-item prayer-request-item ${
            pedido.lido === true ? 'inactive-item' : ''
          }`}
          key={pedido.id}
        >
          <div>
            <span>
              {pedido.lido === true ? 'Lido' : 'Novo pedido'}
            </span>

            <strong>{pedido.nome}</strong>

            {pedido.telefone && <p>{pedido.telefone}</p>}

            <small>{pedido.pedido}</small>

            {pedido.criadoEm && (
              <em>{formatarDataHoraFirebase(pedido.criadoEm)}</em>
            )}
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className={
                pedido.lido === true ? 'activate-button' : 'deactivate-button'
              }
              onClick={() => alternarStatusPedido(pedido)}
            >
              {pedido.lido === true ? 'Marcar como novo' : 'Marcar como lido'}
            </button>

            <button
              type="button"
              onClick={() => excluirPedidoOracao(pedido.id)}
            >
              Excluir
            </button>
          </div>
        </article>
      ))}
    </div>
  </section>
)}
{abaAtiva === 'midia' && (
  <section className="admin-grid admin-events-grid">
    <form className="admin-card" onSubmit={salvarVideo}>
      <span className="admin-section-label">Mídia</span>

      <h2>{editandoVideoId ? 'Editar vídeo' : 'Cadastrar vídeo'}</h2>

      <p>
        Cadastre links do YouTube para exibir mensagens, estudos e transmissões no site.
      </p>

      <label>
        Título do vídeo
        <input
          value={videoForm.titulo}
          onChange={(event) =>
            setVideoForm({
              ...videoForm,
              titulo: event.target.value,
            })
          }
          placeholder="Ex: Culto da Família"
        />
      </label>

      <label>
        Descrição
        <textarea
          value={videoForm.descricao}
          onChange={(event) =>
            setVideoForm({
              ...videoForm,
              descricao: event.target.value,
            })
          }
          placeholder="Descrição opcional do vídeo"
        />
      </label>

      <label>
        Link do vídeo
        <input
          value={videoForm.url}
          onChange={(event) =>
            setVideoForm({
              ...videoForm,
              url: event.target.value,
            })
          }
          placeholder="Cole aqui o link do YouTube"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading
          ? 'Salvando...'
          : editandoVideoId
            ? 'Salvar alterações'
            : 'Salvar vídeo'}
      </button>

      {editandoVideoId && (
        <button
          type="button"
          className="cancel-button"
          onClick={cancelarEdicaoVideo}
        >
          Cancelar edição
        </button>
      )}
    </form>

    <section className="admin-card">
      <span className="admin-section-label">Página inicial</span>
      <h2>Vídeos cadastrados</h2>
      <p>Lista dos vídeos que serão exibidos no site.</p>

      <div className="admin-list">
        {videos.length === 0 && <p>Nenhum vídeo cadastrado ainda.</p>}

        {videos.map((video) => (
          <article
            className={`admin-list-item ${
              video.ativo === false ? 'inactive-item' : ''
            }`}
            key={video.id}
          >
            <div>
              <span>{video.ativo === false ? 'Inativo' : 'Ativo'}</span>
              <strong>{video.titulo}</strong>

              {video.descricao && <small>{video.descricao}</small>}
              {video.url && <small>{video.url}</small>}
            </div>

            <div className="admin-actions">
              <button
                type="button"
                className="edit-button"
                onClick={() => editarVideo(video)}
              >
                Editar
              </button>

              <button
                type="button"
                className={
                  video.ativo === false ? 'activate-button' : 'deactivate-button'
                }
                onClick={() => alternarStatusVideo(video)}
              >
                {video.ativo === false ? 'Ativar' : 'Desativar'}
              </button>

              <button type="button" onClick={() => excluirVideo(video.id)}>
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  </section>
)}
{abaAtiva === 'documentos' && (
  <section className="admin-grid admin-events-grid">
    <form className="admin-card" onSubmit={salvarDocumento}>
      <span className="admin-section-label">Documentos</span>

      <h2>
        {editandoDocumentoId ? 'Editar documento' : 'Cadastrar documento'}
      </h2>

      <p>
        Envie arquivos pelo Cloudinary ou cole um link externo, como Google Drive.
      </p>

      <label>
        Título do documento
        <input
          value={documentoForm.titulo}
          onChange={(event) =>
            setDocumentoForm({
              ...documentoForm,
              titulo: event.target.value,
            })
          }
          placeholder="Ex: Prestação de contas mensal"
        />
      </label>

      <label>
        Categoria
        <input
          value={documentoForm.categoria}
          onChange={(event) =>
            setDocumentoForm({
              ...documentoForm,
              categoria: event.target.value,
            })
          }
          placeholder="Ex: Transparência, Ata, Comunicado"
        />
      </label>

      <label>
        Descrição
        <textarea
          value={documentoForm.descricao}
          onChange={(event) =>
            setDocumentoForm({
              ...documentoForm,
              descricao: event.target.value,
            })
          }
          placeholder="Descrição opcional do documento"
        />
      </label>

      <label>
        Enviar arquivo
        <input
          type="file"
          onChange={enviarArquivoDocumento}
          disabled={enviandoArquivo}
        />
      </label>

      {enviandoArquivo && <p>Enviando arquivo...</p>}

      <label>
        Link do documento
        <input
          value={documentoForm.url}
          onChange={(event) =>
            setDocumentoForm({
              ...documentoForm,
              url: event.target.value,
            })
          }
          placeholder="Cole um link ou envie um arquivo acima"
        />
      </label>

      {documentoForm.url && (
        <a
          className="admin-file-link"
          href={documentoForm.url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir documento enviado
        </a>
      )}

      <button type="submit" disabled={loading || enviandoArquivo}>
        {loading
          ? 'Salvando...'
          : editandoDocumentoId
            ? 'Salvar alterações'
            : 'Salvar documento'}
      </button>

      {editandoDocumentoId && (
        <button
          type="button"
          className="cancel-button"
          onClick={cancelarEdicaoDocumento}
        >
          Cancelar edição
        </button>
      )}
    </form>

    <section className="admin-card">
      <span className="admin-section-label">Documentos publicados</span>
      <h2>Lista de documentos</h2>
      <p>Documentos que poderão aparecer na área de transparência do site.</p>

      <div className="admin-list">
        {documentos.length === 0 && <p>Nenhum documento cadastrado ainda.</p>}

        {documentos.map((documento) => (
          <article
            className={`admin-list-item ${
              documento.ativo === false ? 'inactive-item' : ''
            }`}
            key={documento.id}
          >
            <div>
              <span>{documento.ativo === false ? 'Inativo' : 'Ativo'}</span>
              <strong>{documento.titulo}</strong>

              {documento.categoria && <p>{documento.categoria}</p>}
              {documento.descricao && <small>{documento.descricao}</small>}

              {documento.url && (
                <small>
                  <a href={documento.url} target="_blank" rel="noreferrer">
                    Abrir documento
                  </a>
                </small>
              )}
            </div>

            <div className="admin-actions">
              <button
                type="button"
                className="edit-button"
                onClick={() => editarDocumento(documento)}
              >
                Editar
              </button>

              <button
                type="button"
                className={
                  documento.ativo === false
                    ? 'activate-button'
                    : 'deactivate-button'
                }
                onClick={() => alternarStatusDocumento(documento)}
              >
                {documento.ativo === false ? 'Ativar' : 'Desativar'}
              </button>

              <button type="button" onClick={() => excluirDocumento(documento.id)}>
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  </section>
)}
{abaAtiva === 'localizacao' && (
  <section className="admin-grid admin-events-grid">
    <form className="admin-card" onSubmit={salvarLocalizacao}>
      <span className="admin-section-label">Localização</span>

      <h2>Dados de endereço</h2>

      <p>
        Essas informações serão exibidas na seção Como chegar da página inicial.
      </p>

      <label>
        Nome do local
        <input
          value={localizacaoForm.nomeLocal}
          onChange={(event) =>
            setLocalizacaoForm({
              ...localizacaoForm,
              nomeLocal: event.target.value,
            })
          }
          placeholder="Ex: Igreja Filhos da Graça"
        />
      </label>

      <label>
        Endereço completo
        <textarea
          value={localizacaoForm.endereco}
          onChange={(event) =>
            setLocalizacaoForm({
              ...localizacaoForm,
              endereco: event.target.value,
            })
          }
          placeholder="Ex: Rua, número, bairro, cidade e estado"
        />
      </label>

      <label>
        Link do Google Maps
        <input
          value={localizacaoForm.googleMapsUrl}
          onChange={(event) =>
            setLocalizacaoForm({
              ...localizacaoForm,
              googleMapsUrl: event.target.value,
            })
          }
          placeholder="Cole aqui o link do Google Maps"
        />
      </label>

      <label>
        Latitude
        <input
          value={localizacaoForm.latitude}
          onChange={(event) =>
            setLocalizacaoForm({
              ...localizacaoForm,
              latitude: event.target.value,
            })
          }
          placeholder="Ex: -8.047562"
        />
      </label>

      <label>
        Longitude
        <input
          value={localizacaoForm.longitude}
          onChange={(event) =>
            setLocalizacaoForm({
              ...localizacaoForm,
              longitude: event.target.value,
            })
          }
          placeholder="Ex: -34.877003"
        />
      </label>

      <label>
        Foto da fachada
        <input
          value={localizacaoForm.fotoFachada}
          onChange={(event) =>
            setLocalizacaoForm({
              ...localizacaoForm,
              fotoFachada: event.target.value,
            })
          }
          placeholder="Ex: /fachada.jpg ou https://..."
        />
      </label>

      {localizacaoForm.fotoFachada && (
        <img
          className="admin-preview-image"
          src={localizacaoForm.fotoFachada}
          alt="Prévia da fachada"
        />
      )}

      <button type="submit" disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar localização'}
      </button>
    </form>

    <section className="admin-card">
      <span className="admin-section-label">Prévia</span>
      <h2>Como aparecerá no site</h2>

      <div className="admin-location-preview">
        {localizacaoForm.fotoFachada ? (
          <img src={localizacaoForm.fotoFachada} alt="Fachada da igreja" />
        ) : (
          <div>
            <span>Filhos da Graça</span>
          </div>
        )}

        <strong>
          {localizacaoForm.nomeLocal || 'Igreja Filhos da Graça'}
        </strong>

        <p>
          {localizacaoForm.endereco || 'Endereço ainda não preenchido.'}
        </p>

        {(localizacaoForm.latitude || localizacaoForm.longitude) && (
          <small>
            Coordenadas: {localizacaoForm.latitude}, {localizacaoForm.longitude}
          </small>
        )}

        {localizacaoForm.googleMapsUrl && (
          <a
            href={localizacaoForm.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir mapa
          </a>
        )}
      </div>
    </section>
  </section>
)}
    </main>
  )
}

export default Admin