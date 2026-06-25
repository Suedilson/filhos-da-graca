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
const [filtroStatusOracao, setFiltroStatusOracao] = useState('Todos')
const [filtroDataInicialOracao, setFiltroDataInicialOracao] = useState('')
const [filtroDataFinalOracao, setFiltroDataFinalOracao] = useState('')

  const [videos, setVideos] = useState([])
  const [editandoVideoId, setEditandoVideoId] = useState(null)

  const [documentos, setDocumentos] = useState([])
  const [editandoDocumentoId, setEditandoDocumentoId] = useState(null)
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)
  const [galeria, setGaleria] = useState([])
  const [editandoFotoId, setEditandoFotoId] = useState(null)
  const [enviandoImagemGaleria, setEnviandoImagemGaleria] = useState(false)
  const [imagensGaleria, setImagensGaleria] = useState([])
  const [galeriaForm, setGaleriaForm] = useState({
  titulo: '',
  descricao: '',
  categoria: 'Culto',
  imagem: '',
  imagemPublicId: '',
  ativo: true,
})

const categoriasGaleria = [
  'Culto',
  'Evento',
  'Crianças',
  'Ação social',
  'Jovens',
  'Batismo',
  'Outros',
]

  const [membros, setMembros] = useState([])
  const [editandoMembroId, setEditandoMembroId] = useState(null)
  const [enviandoFotoMembro, setEnviandoFotoMembro] = useState(false)
  const [buscaMembro, setBuscaMembro] = useState('')
  const [filtroStatusMembro, setFiltroStatusMembro] = useState('Todos')
  const [filtroMinisterioMembro, setFiltroMinisterioMembro] = useState('Todos')
  const [modoMembros, setModoMembros] = useState('lista')
  const [mesAniversariantes, setMesAniversariantes] = useState(
  String(new Date().getMonth() + 1),
)

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

  const [membroForm, setMembroForm] = useState({
  nome: '',
  telefone: '',
  nascimento: '',
  endereco: '',
  ministerio: '',
  status: 'Ativo',
  foto: '',
  fotoPublicId: '',
  observacoes: '',
  responsavelAcompanhamento: '',
  situacaoPastoral: 'Em acompanhamento',
  ultimoContato: '',
  proximaAcao: '',
  dataProximaAcao: '',
  observacaoAcompanhamento: '',
})
  const [localizacaoForm, setLocalizacaoForm] = useState({
    nomeLocal: '',
    endereco: '',
    googleMapsUrl: '',
    latitude: '',
    longitude: '',
    fotoFachada: '',
  })
const [contribuicaoForm, setContribuicaoForm] = useState({
  titulo: 'Contribua com a obra',
  descricao:
    'Sua contribuição nos ajuda a manter a missão, os projetos sociais, os cultos e o cuidado com vidas.',
  chavePix: '',
  favorecido: '',
  banco: '',
  qrCodePix: '',
  qrCodePixPublicId: '',
  ativo: true,
})

const [enviandoQrCodePix, setEnviandoQrCodePix] = useState(false)

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
  carregarContribuicao()
  carregarPedidosOracao()
  carregarVideos()
  carregarDocumentos()
  carregarGaleria()
  carregarMembros()
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
async function carregarContribuicao() {
  try {
    const ref = doc(db, 'configuracoes', 'contribuicao')
    const snapshot = await getDoc(ref)

    if (snapshot.exists()) {
      const dados = snapshot.data()

      setContribuicaoForm({
        titulo: dados.titulo || 'Contribua com a obra',
        descricao:
          dados.descricao ||
          'Sua contribuição nos ajuda a manter a missão, os projetos sociais, os cultos e o cuidado com vidas.',
        chavePix: dados.chavePix || '',
        favorecido: dados.favorecido || '',
        banco: dados.banco || '',
        qrCodePix: dados.qrCodePix || '',
        qrCodePixPublicId: dados.qrCodePixPublicId || '',
        ativo: dados.ativo !== false,
      })
    }
  } catch (error) {
    alert('Erro ao carregar dados de contribuição.')
    console.error(error)
  }
}

async function enviarQrCodePix(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoQrCodePix(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setContribuicaoForm((formAtual) => ({
      ...formAtual,
      qrCodePix: arquivo.url,
      qrCodePixPublicId: arquivo.publicId,
    }))

    event.target.value = ''

    alert('QR Code enviado com sucesso!')
  } catch (error) {
    alert('Erro ao enviar QR Code.')
    console.error(error)
  } finally {
    setEnviandoQrCodePix(false)
  }
}

async function salvarContribuicao(event) {
  event.preventDefault()

  if (!contribuicaoForm.titulo) {
    alert('Preencha o título da seção.')
    return
  }

  if (!contribuicaoForm.chavePix) {
    alert('Preencha a chave Pix.')
    return
  }

  setLoading(true)

  try {
    await setDoc(
      doc(db, 'configuracoes', 'contribuicao'),
      {
        titulo: contribuicaoForm.titulo,
        descricao: contribuicaoForm.descricao,
        chavePix: contribuicaoForm.chavePix,
        favorecido: contribuicaoForm.favorecido,
        banco: contribuicaoForm.banco,
        qrCodePix: contribuicaoForm.qrCodePix,
        qrCodePixPublicId: contribuicaoForm.qrCodePixPublicId,
        ativo: contribuicaoForm.ativo,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    )

    alert('Dados de contribuição salvos com sucesso!')
  } catch (error) {
    alert('Erro ao salvar dados de contribuição.')
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
function obterDataPedidoOracao(pedido) {
  if (!pedido.criadoEm?.toDate) return ''

  return pedido.criadoEm.toDate().toISOString().slice(0, 10)
}

function pedidoOracaoDentroDoPeriodo(pedido) {
  const dataPedido = obterDataPedidoOracao(pedido)

  if (!dataPedido) return true

  const depoisDaDataInicial =
    !filtroDataInicialOracao || dataPedido >= filtroDataInicialOracao

  const antesDaDataFinal =
    !filtroDataFinalOracao || dataPedido <= filtroDataFinalOracao

  return depoisDaDataInicial && antesDaDataFinal
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
async function carregarGaleria() {
  try {
    const q = query(collection(db, 'galeria'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setGaleria(lista)
  } catch (error) {
    alert('Erro ao carregar galeria.')
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

 function limparFormularioGaleria() {
  setGaleriaForm({
    titulo: '',
    descricao: '',
    categoria: 'Culto',
    imagem: '',
    imagemPublicId: '',
    ativo: true,
  })

  setImagensGaleria([])
  setEditandoFotoId(null)
}

  async function enviarImagemGaleria(event) {
  const files = Array.from(event.target.files || [])

  if (files.length === 0) return

  setEnviandoImagemGaleria(true)

  try {
    const imagensEnviadas = await Promise.all(
      files.map(async (file) => {
        const arquivo = await uploadArquivoCloudinary(file)

        return {
          url: arquivo.url,
          publicId: arquivo.publicId,
        }
      }),
    )

    setImagensGaleria((imagensAtuais) => [
      ...imagensAtuais,
      ...imagensEnviadas,
    ])

    setGaleriaForm((formAtual) => ({
      ...formAtual,
      imagem: formAtual.imagem || imagensEnviadas[0]?.url || '',
      imagemPublicId: formAtual.imagemPublicId || imagensEnviadas[0]?.publicId || '',
    }))

    event.target.value = ''

    alert(
      imagensEnviadas.length === 1
        ? 'Imagem adicionada com sucesso!'
        : `${imagensEnviadas.length} imagens adicionadas com sucesso!`,
    )
  } catch (error) {
    alert('Erro ao enviar imagem da galeria.')
    console.error(error)
  } finally {
    setEnviandoImagemGaleria(false)
  }
}

  async function salvarFotoGaleria(event) {
  event.preventDefault()

  if (!galeriaForm.titulo) {
    alert('Preencha o título da galeria.')
    return
  }

  if (editandoFotoId && !galeriaForm.imagem) {
    alert('Envie uma imagem.')
    return
  }

  if (!editandoFotoId && imagensGaleria.length === 0) {
    alert('Selecione e envie pelo menos uma imagem.')
    return
  }

  setLoading(true)

  try {
    const dadosBase = {
      titulo: galeriaForm.titulo,
      descricao: galeriaForm.descricao,
      categoria: galeriaForm.categoria,
      ativo: galeriaForm.ativo,
      atualizadoEm: serverTimestamp(),
    }

    if (editandoFotoId) {
      const albumAtual = albunsGaleriaAdmin.find((album) =>
        album.fotos.some((foto) => foto.id === editandoFotoId),
      )

      if (albumAtual) {
        const batch = writeBatch(db)

        albumAtual.fotos.forEach((foto) => {
          batch.update(doc(db, 'galeria', foto.id), dadosBase)
        })

        await batch.commit()

        alert('Álbum atualizado com sucesso!')
      } else {
        await updateDoc(doc(db, 'galeria', editandoFotoId), {
          ...dadosBase,
          imagem: galeriaForm.imagem,
          imagemPublicId: galeriaForm.imagemPublicId,
        })

        alert('Foto atualizada com sucesso!')
      }
    } else {
      await Promise.all(
        imagensGaleria.map((imagem) =>
          addDoc(collection(db, 'galeria'), {
            ...dadosBase,
            imagem: imagem.url,
            imagemPublicId: imagem.publicId,
            criadoEm: serverTimestamp(),
          }),
        ),
      )

      alert(
        imagensGaleria.length === 1
          ? 'Foto cadastrada com sucesso!'
          : `${imagensGaleria.length} fotos cadastradas com sucesso!`,
      )
    }

    limparFormularioGaleria()
    await carregarGaleria()
  } catch (error) {
    alert('Erro ao salvar galeria.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}
  function editarFotoGaleria(foto) {
    setAbaAtiva('galeria')
    setEditandoFotoId(foto.id)
    setImagensGaleria([])

    setGaleriaForm({
      titulo: foto.titulo || '',
      descricao: foto.descricao || '',
      categoria: foto.categoria || 'Culto',
      imagem: foto.imagem || '',
      imagemPublicId: foto.imagemPublicId || '',
      ativo: foto.ativo !== false,
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function cancelarEdicaoGaleria() {
    limparFormularioGaleria()
  }

  async function alternarStatusFotoGaleria(foto) {
    try {
      await updateDoc(doc(db, 'galeria', foto.id), {
        ativo: foto.ativo === false ? true : false,
        atualizadoEm: serverTimestamp(),
      })

      await carregarGaleria()
    } catch (error) {
      alert('Erro ao alterar status da foto.')
      console.error(error)
    }
  }

  async function excluirFotoGaleria(id) {
    const confirmar = confirm('Deseja realmente excluir esta foto da galeria?')

    if (!confirmar) return

    try {
      await deleteDoc(doc(db, 'galeria', id))
      await carregarGaleria()
    } catch (error) {
      alert('Erro ao excluir foto da galeria.')
      console.error(error)
    }
  }
async function alternarStatusAlbumGaleria(album) {
  const albumAtivo = album.fotos.some((foto) => foto.ativo !== false)
  const novoStatus = !albumAtivo

  try {
    const batch = writeBatch(db)

    album.fotos.forEach((foto) => {
      batch.update(doc(db, 'galeria', foto.id), {
        ativo: novoStatus,
        atualizadoEm: serverTimestamp(),
      })
    })

    await batch.commit()
    await carregarGaleria()
  } catch (error) {
    alert('Erro ao alterar status do álbum.')
    console.error(error)
  }
}
async function excluirFotoIndividualGaleria(foto) {
  const confirmar = confirm(
    `Deseja realmente excluir somente esta foto do álbum "${foto.titulo}"?`,
  )

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'galeria', foto.id))

    if (editandoFotoId === foto.id) {
      limparFormularioGaleria()
    }

    await carregarGaleria()
  } catch (error) {
    alert('Erro ao excluir foto do álbum.')
    console.error(error)
  }
}
async function excluirAlbumGaleria(album) {
  const confirmar = confirm(
    `Deseja realmente excluir o álbum "${album.titulo}" com ${album.fotos.length} foto(s)?`,
  )

  if (!confirmar) return

  try {
    const batch = writeBatch(db)

    album.fotos.forEach((foto) => {
      batch.delete(doc(db, 'galeria', foto.id))
    })

    await batch.commit()
    await carregarGaleria()
  } catch (error) {
    alert('Erro ao excluir álbum da galeria.')
    console.error(error)
  }
}
  async function carregarMembros() {
    try {
      const q = query(collection(db, 'membros'), orderBy('nome', 'asc'))
      const snapshot = await getDocs(q)

      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))

      setMembros(lista)
    } catch (error) {
      alert('Erro ao carregar membros.')
      console.error(error)
    }
  }

  async function enviarFotoMembro(event) {
    const file = event.target.files?.[0]

    if (!file) return

    setEnviandoFotoMembro(true)

    try {
      const arquivo = await uploadArquivoCloudinary(file)

      setMembroForm((formAtual) => ({
        ...formAtual,
        foto: arquivo.url,
        fotoPublicId: arquivo.publicId,
      }))

      alert('Foto enviada com sucesso!')
    } catch (error) {
      alert('Erro ao enviar foto.')
      console.error(error)
    } finally {
      setEnviandoFotoMembro(false)
    }
  }

  async function salvarMembro(event) {
    event.preventDefault()

    if (!membroForm.nome) {
      alert('Preencha o nome do membro.')
      return
    }

    setLoading(true)

    try {
     const dadosMembro = {
  nome: membroForm.nome,
  telefone: membroForm.telefone,
  nascimento: membroForm.nascimento,
  endereco: membroForm.endereco,
  ministerio: membroForm.ministerio,
  status: membroForm.status,
  foto: membroForm.foto,
  fotoPublicId: membroForm.fotoPublicId,
  observacoes: membroForm.observacoes,
  responsavelAcompanhamento: membroForm.responsavelAcompanhamento,
  situacaoPastoral: membroForm.situacaoPastoral,
  ultimoContato: membroForm.ultimoContato,
  proximaAcao: membroForm.proximaAcao,
  dataProximaAcao: membroForm.dataProximaAcao,
  observacaoAcompanhamento: membroForm.observacaoAcompanhamento,
  ativo: membroForm.status !== 'Inativo',
  atualizadoEm: serverTimestamp(),
}

      if (editandoMembroId) {
        await updateDoc(doc(db, 'membros', editandoMembroId), dadosMembro)
        alert('Membro atualizado com sucesso!')
      } else {
        await addDoc(collection(db, 'membros'), {
          ...dadosMembro,
          criadoEm: serverTimestamp(),
        })

        alert('Membro cadastrado com sucesso!')
      }

     setMembroForm({
  nome: '',
  telefone: '',
  nascimento: '',
  endereco: '',
  ministerio: '',
  status: 'Ativo',
  foto: '',
  fotoPublicId: '',
  observacoes: '',
  responsavelAcompanhamento: '',
  situacaoPastoral: 'Em acompanhamento',
  ultimoContato: '',
  proximaAcao: '',
  dataProximaAcao: '',
  observacaoAcompanhamento: '',
})

      setEditandoMembroId(null)
      await carregarMembros()
      setModoMembros('lista')
    } catch (error) {
      alert('Erro ao salvar membro.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function editarMembro(membro) {
    setAbaAtiva('membros')
    setModoMembros('cadastro')
    setEditandoMembroId(membro.id)

    setMembroForm({
      nome: membro.nome || '',
      telefone: membro.telefone || '',
      nascimento: membro.nascimento || '',
      endereco: membro.endereco || '',
      ministerio: membro.ministerio || '',
      status: membro.status || 'Ativo',
      foto: membro.foto || '',
      fotoPublicId: membro.fotoPublicId || '',
      observacoes: membro.observacoes || '',
      responsavelAcompanhamento: membro.responsavelAcompanhamento || '',
      situacaoPastoral: membro.situacaoPastoral || 'Em acompanhamento',
      ultimoContato: membro.ultimoContato || '',
      proximaAcao: membro.proximaAcao || '',
      dataProximaAcao: membro.dataProximaAcao || '',
      observacaoAcompanhamento: membro.observacaoAcompanhamento || '',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function cancelarEdicaoMembro() {
    setEditandoMembroId(null)

    setMembroForm({
      nome: '',
      telefone: '',
      nascimento: '',
      endereco: '',
      ministerio: '',
      status: 'Ativo',
      foto: '',
      fotoPublicId: '',
      observacoes: '',
      responsavelAcompanhamento: '',
      situacaoPastoral: 'Em acompanhamento',
      ultimoContato: '',
      proximaAcao: '',
      dataProximaAcao: '',
      observacaoAcompanhamento: '',
    })

    setModoMembros('lista')
  }

  async function alternarStatusMembro(membro) {
    try {
      const novoStatus = membro.status === 'Inativo' ? 'Ativo' : 'Inativo'

      await updateDoc(doc(db, 'membros', membro.id), {
        status: novoStatus,
        ativo: novoStatus !== 'Inativo',
        atualizadoEm: serverTimestamp(),
      })

      await carregarMembros()
    } catch (error) {
      alert('Erro ao alterar status do membro.')
      console.error(error)
    }
  }

  async function excluirMembro(id) {
    const confirmar = confirm('Deseja realmente excluir este membro?')

    if (!confirmar) return

    try {
      await deleteDoc(doc(db, 'membros', id))
      await carregarMembros()
    } catch (error) {
      alert('Erro ao excluir membro.')
      console.error(error)
    }
  }

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return ''

  const hoje = new Date()
  const nascimento = new Date(dataNascimento + 'T00:00:00')

  let idade = hoje.getFullYear() - nascimento.getFullYear()

  const mesAtual = hoje.getMonth()
  const diaAtual = hoje.getDate()
  const mesNascimento = nascimento.getMonth()
  const diaNascimento = nascimento.getDate()

  const aindaNaoFezAniversario =
    mesAtual < mesNascimento ||
    (mesAtual === mesNascimento && diaAtual < diaNascimento)

  if (aindaNaoFezAniversario) {
    idade -= 1
  }

  return idade
}
function obterMesNascimento(dataNascimento) {
  if (!dataNascimento) return ''

  const partes = dataNascimento.split('-')

  return String(Number(partes[1]))
}

function obterDiaNascimento(dataNascimento) {
  if (!dataNascimento) return ''

  const partes = dataNascimento.split('-')

  return Number(partes[2])
}

function calcularNovaIdade(dataNascimento) {
  if (!dataNascimento) return ''

  return calcularIdade(dataNascimento) + 1
}

function ehAniversarianteHoje(dataNascimento) {
  if (!dataNascimento) return false

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const diaAtual = hoje.getDate()

  return (
    Number(obterMesNascimento(dataNascimento)) === mesAtual &&
    obterDiaNascimento(dataNascimento) === diaAtual
  )
}
function temAcompanhamentoPastoral(membro) {
  return Boolean(
    membro.responsavelAcompanhamento ||
      (membro.situacaoPastoral && membro.situacaoPastoral !== 'Sem acompanhamento') ||
      membro.ultimoContato ||
      membro.proximaAcao ||
      membro.dataProximaAcao ||
      membro.observacaoAcompanhamento,
  )
}
function obterNomeMes(numeroMes) {
  const meses = {
    1: 'Janeiro',
    2: 'Fevereiro',
    3: 'Março',
    4: 'Abril',
    5: 'Maio',
    6: 'Junho',
    7: 'Julho',
    8: 'Agosto',
    9: 'Setembro',
    10: 'Outubro',
    11: 'Novembro',
    12: 'Dezembro',
  }

  return meses[Number(numeroMes)] || ''
}

function gerarRelatorioAniversariantes() {
  const nomeMes = obterNomeMes(mesAniversariantes)

  const linhas = aniversariantesDoMes
    .map(
      (membro) => `
        <tr>
          <td>${obterDiaNascimento(membro.nascimento)}</td>
          <td>${membro.nome || ''}</td>
          <td>${membro.telefone || ''}</td>
          <td>${calcularIdade(membro.nascimento)} anos</td>
          <td>${calcularNovaIdade(membro.nascimento)} anos</td>
          <td>${membro.ministerio || ''}</td>
        </tr>
      `,
    )
    .join('')

  const janela = window.open('', '_blank')

  janela.document.write(`
    <html>
      <head>
        <title>Aniversariantes de ${nomeMes}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 32px;
            color: #17105f;
          }

          h1 {
            margin-bottom: 4px;
          }

          p {
            color: #60708a;
            margin-top: 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
          }

          th,
          td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-size: 14px;
          }

          th {
            background: #17105f;
            color: white;
          }
        </style>
      </head>

      <body>
        <h1>Aniversariantes de ${nomeMes}</h1>
        <p>Total de aniversariantes: ${aniversariantesDoMes.length}</p>

        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Idade atual</th>
              <th>Nova idade</th>
              <th>Ministério</th>
            </tr>
          </thead>

          <tbody>
            ${
              linhas ||
              '<tr><td colspan="6">Nenhum aniversariante neste mês.</td></tr>'
            }
          </tbody>
        </table>

        <script>
          window.print()
        </script>
      </body>
    </html>
  `)

  janela.document.close()
}

function exportarAniversariantesExcel() {
  const nomeMes = obterNomeMes(mesAniversariantes)

  const cabecalho = [
    'Dia',
    'Nome',
    'Telefone',
    'Data de nascimento',
    'Idade atual',
    'Nova idade',
    'Ministério',
    'Status',
  ]

  const linhas = aniversariantesDoMes.map((membro) => [
    obterDiaNascimento(membro.nascimento),
    membro.nome || '',
    membro.telefone || '',
    formatarData(membro.nascimento),
    calcularIdade(membro.nascimento),
    calcularNovaIdade(membro.nascimento),
    membro.ministerio || '',
    membro.status || '',
  ])

  const conteudo = [cabecalho, ...linhas]
    .map((linha) =>
      linha
        .map((campo) => `"${String(campo).replaceAll('"', '""')}"`)
        .join(';'),
    )
    .join('\n')

  const blob = new Blob(['\uFEFF' + conteudo], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `aniversariantes-${nomeMes.toLowerCase()}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
const ministeriosDisponiveis = Array.from(
  new Set(
    membros
      .map((membro) => membro.ministerio)
      .filter(Boolean),
  ),
).sort()

function exportarMembrosExcel() {
  const cabecalho = [
    'Nome',
    'Telefone',
    'Data de nascimento',
    'Idade',
    'Endereço',
    'Ministério',
    'Status',
    'Observações internas',
    'Responsável pelo acompanhamento',
    'Situação pastoral',
    'Último contato',
    'Próxima ação',
    'Data da próxima ação',
    'Observação do acompanhamento',
  ]

  const linhas = membrosFiltrados.map((membro) => [
    membro.nome || '',
    membro.telefone || '',
    membro.nascimento ? formatarData(membro.nascimento) : '',
    membro.nascimento ? calcularIdade(membro.nascimento) : '',
    membro.endereco || '',
    membro.ministerio || '',
    membro.status || '',
    membro.observacoes || '',
    membro.responsavelAcompanhamento || '',
    membro.situacaoPastoral || '',
    membro.ultimoContato ? formatarData(membro.ultimoContato) : '',
    membro.proximaAcao || '',
    membro.dataProximaAcao ? formatarData(membro.dataProximaAcao) : '',
    membro.observacaoAcompanhamento || '',
  ])

  const conteudo = [cabecalho, ...linhas]
    .map((linha) =>
      linha
        .map((campo) => `"${String(campo).replaceAll('"', '""')}"`)
        .join(';'),
    )
    .join('\n')

  const blob = new Blob(['\uFEFF' + conteudo], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'membros-filhos-da-graca.csv'
  link.click()

  URL.revokeObjectURL(url)
}
function exportarPedidosOracaoExcel() {
  const cabecalho = [
    'Status',
    'Nome',
    'Telefone',
    'Pedido',
    'Data e hora',
  ]

  const linhas = pedidosOracaoFiltrados.map((pedido) => [
    pedido.lido === true ? 'Lido' : 'Novo',
    pedido.nome || '',
    pedido.telefone || '',
    pedido.pedido || '',
    pedido.criadoEm ? formatarDataHoraFirebase(pedido.criadoEm) : '',
  ])

  const conteudo = [cabecalho, ...linhas]
    .map((linha) =>
      linha
        .map((campo) => `"${String(campo).replaceAll('"', '""')}"`)
        .join(';'),
    )
    .join('\n')

  const blob = new Blob(['\uFEFF' + conteudo], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'pedidos-oracao-filhos-da-graca.csv'
  link.click()

  URL.revokeObjectURL(url)
}
const resumoMembros = {
  total: membros.length,
  ativos: membros.filter((membro) => membro.status === 'Ativo').length,
  visitantes: membros.filter((membro) => membro.status === 'Visitante').length,
  afastados: membros.filter((membro) => membro.status === 'Afastado').length,
  inativos: membros.filter((membro) => membro.status === 'Inativo').length,
}
const aniversariantesDoMes = membros
  .filter((membro) => obterMesNascimento(membro.nascimento) === mesAniversariantes)
  .sort((a, b) => obterDiaNascimento(a.nascimento) - obterDiaNascimento(b.nascimento))

const aniversariantesHoje = aniversariantesDoMes.filter((membro) =>
  ehAniversarianteHoje(membro.nascimento),
)
const pedidosOracaoFiltrados = pedidosOracao.filter((pedido) => {
  const correspondeStatus =
    filtroStatusOracao === 'Todos' ||
    (filtroStatusOracao === 'Novo' && pedido.lido !== true) ||
    (filtroStatusOracao === 'Lido' && pedido.lido === true)

  return correspondeStatus && pedidoOracaoDentroDoPeriodo(pedido)
})

const resumoPedidosOracao = {
  total: pedidosOracao.length,
  novos: pedidosOracao.filter((pedido) => pedido.lido !== true).length,
  lidos: pedidosOracao.filter((pedido) => pedido.lido === true).length,
  filtrados: pedidosOracaoFiltrados.length,
}
const albunsGaleriaAdmin = Object.values(
  galeria.reduce((albuns, foto) => {
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
const albumEditandoGaleria = editandoFotoId
  ? albunsGaleriaAdmin.find((album) =>
      album.fotos.some((foto) => foto.id === editandoFotoId),
    )
  : null
const membrosFiltrados = membros.filter((membro) => {
  const textoBusca = buscaMembro.toLowerCase().trim()

  const correspondeBusca =
    !textoBusca ||
    membro.nome?.toLowerCase().includes(textoBusca) ||
    membro.telefone?.toLowerCase().includes(textoBusca) ||
    membro.endereco?.toLowerCase().includes(textoBusca) ||
    membro.ministerio?.toLowerCase().includes(textoBusca)

  const correspondeStatus =
    filtroStatusMembro === 'Todos' || membro.status === filtroStatusMembro

  const correspondeMinisterio =
    filtroMinisterioMembro === 'Todos' ||
    membro.ministerio === filtroMinisterioMembro

  return correspondeBusca && correspondeStatus && correspondeMinisterio
})
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
  <a className="admin-brand-link" href="/">
    <span>Painel administrativo</span>
    <h1>Filhos da Graça</h1>
  </a>

  {abaAtiva === 'membros' && (
    <div className="header-members-summary">
      <article>
        <span>Total</span>
        <strong>{resumoMembros.total}</strong>
      </article>

      <article>
        <span>Ativos</span>
        <strong>{resumoMembros.ativos}</strong>
      </article>

      <article>
        <span>Visitantes</span>
        <strong>{resumoMembros.visitantes}</strong>
      </article>

      <article>
        <span>Afastados</span>
        <strong>{resumoMembros.afastados}</strong>
      </article>

      <article>
        <span>Inativos</span>
        <strong>{resumoMembros.inativos}</strong>
      </article>
    </div>
  )}

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
  className={abaAtiva === 'contribuicao' ? 'active' : ''}
  onClick={() => setAbaAtiva('contribuicao')}
>
  Contribuição
</button>
        <button
        type="button"
        className={abaAtiva === 'galeria' ? 'active' : ''}
        onClick={() => setAbaAtiva('galeria')}
        >
         Galeria
         </button>

        <button
          type="button"
          className={abaAtiva === 'membros' ? 'active' : ''}
          onClick={() => setAbaAtiva('membros')}
        >
          Membros
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
  <section className="admin-card admin-full-card prayer-admin-card">
    <div className="prayer-card-header">
      <div>
        <span className="admin-section-label">Pedidos de oração</span>

        <h2>Pedidos recebidos</h2>

        <p>
          Acompanhe os pedidos enviados pelo site, filtre por status e período,
          e exporte para Excel.
        </p>
      </div>

      <button
        type="button"
        className="export-prayer-button"
        onClick={exportarPedidosOracaoExcel}
      >
        📊 Exportar pedidos
      </button>
    </div>

    <div className="prayer-summary">
      <article>
        <span>Total</span>
        <strong>{resumoPedidosOracao.total}</strong>
      </article>

      <article>
        <span>Novos</span>
        <strong>{resumoPedidosOracao.novos}</strong>
      </article>

      <article>
        <span>Lidos</span>
        <strong>{resumoPedidosOracao.lidos}</strong>
      </article>

      <article>
        <span>Filtrados</span>
        <strong>{resumoPedidosOracao.filtrados}</strong>
      </article>
    </div>

    <div className="prayer-filters">
      <label>
        Status
        <select
          value={filtroStatusOracao}
          onChange={(event) => setFiltroStatusOracao(event.target.value)}
        >
          <option value="Todos">Todos</option>
          <option value="Novo">Novo</option>
          <option value="Lido">Lido</option>
        </select>
      </label>

      <label>
        Data inicial
        <input
          type="date"
          value={filtroDataInicialOracao}
          onChange={(event) => setFiltroDataInicialOracao(event.target.value)}
        />
      </label>

      <label>
        Data final
        <input
          type="date"
          value={filtroDataFinalOracao}
          onChange={(event) => setFiltroDataFinalOracao(event.target.value)}
        />
      </label>
    </div>

    <div className="admin-list">
      {pedidosOracao.length === 0 && (
        <p>Nenhum pedido de oração recebido ainda.</p>
      )}

      {pedidosOracao.length > 0 && pedidosOracaoFiltrados.length === 0 && (
        <p>Nenhum pedido encontrado com os filtros selecionados.</p>
      )}

      {pedidosOracaoFiltrados.map((pedido) => (
        <article
          className={`admin-list-item prayer-request-item ${
            pedido.lido === true ? 'inactive-item' : ''
          }`}
          key={pedido.id}
        >
          <div>
            <span>{pedido.lido === true ? 'Lido' : 'Novo pedido'}</span>

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
                        video.ativo === false
                          ? 'activate-button'
                          : 'deactivate-button'
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

                    <button
                      type="button"
                      onClick={() => excluirDocumento(documento.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
{abaAtiva === 'contribuicao' && (
  <section className="admin-grid admin-events-grid contribution-admin-area">
    <form className="admin-card contribution-form-card" onSubmit={salvarContribuicao}>
      <span className="admin-section-label">Contribuição</span>

      <h2>Dízimos e ofertas</h2>

      <p>
        Cadastre as informações de Pix e QR Code que aparecerão na página inicial.
      </p>

      <label>
        Título da seção
        <input
          value={contribuicaoForm.titulo}
          onChange={(event) =>
            setContribuicaoForm({
              ...contribuicaoForm,
              titulo: event.target.value,
            })
          }
          placeholder="Ex: Contribua com a obra"
        />
      </label>

      <label>
        Texto explicativo
        <textarea
          value={contribuicaoForm.descricao}
          onChange={(event) =>
            setContribuicaoForm({
              ...contribuicaoForm,
              descricao: event.target.value,
            })
          }
          placeholder="Explique de forma breve como a contribuição ajuda a igreja"
        />
      </label>

      <label>
        Chave Pix
        <input
          value={contribuicaoForm.chavePix}
          onChange={(event) =>
            setContribuicaoForm({
              ...contribuicaoForm,
              chavePix: event.target.value,
            })
          }
          placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
        />
      </label>

      <label>
        Favorecido
        <input
          value={contribuicaoForm.favorecido}
          onChange={(event) =>
            setContribuicaoForm({
              ...contribuicaoForm,
              favorecido: event.target.value,
            })
          }
          placeholder="Ex: Igreja Filhos da Graça"
        />
      </label>

      <label>
        Banco / Instituição
        <input
          value={contribuicaoForm.banco}
          onChange={(event) =>
            setContribuicaoForm({
              ...contribuicaoForm,
              banco: event.target.value,
            })
          }
          placeholder="Ex: Banco, instituição ou conta"
        />
      </label>

      <label>
        QR Code Pix
        <input
          type="file"
          accept="image/*"
          onChange={enviarQrCodePix}
          disabled={enviandoQrCodePix}
        />
      </label>

      {enviandoQrCodePix && <p>Enviando QR Code...</p>}

      {contribuicaoForm.qrCodePix && (
        <div className="contribution-qrcode-preview">
          <img src={contribuicaoForm.qrCodePix} alt="QR Code Pix" />
        </div>
      )}

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={contribuicaoForm.ativo}
          onChange={(event) =>
            setContribuicaoForm({
              ...contribuicaoForm,
              ativo: event.target.checked,
            })
          }
        />
        Exibir seção no site
      </label>

      <button type="submit" disabled={loading || enviandoQrCodePix}>
        {loading ? 'Salvando...' : 'Salvar contribuição'}
      </button>
    </form>

    <section className="admin-card contribution-preview-card">
      <span className="admin-section-label">Prévia</span>

      <h2>Como aparecerá no site</h2>

      <div className="contribution-admin-preview">
        <span>{contribuicaoForm.ativo ? 'Ativo no site' : 'Inativo no site'}</span>

        <h3>{contribuicaoForm.titulo || 'Contribua com a obra'}</h3>

        <p>
          {contribuicaoForm.descricao ||
            'Sua contribuição nos ajuda a manter a missão da igreja.'}
        </p>

        {contribuicaoForm.qrCodePix ? (
          <img src={contribuicaoForm.qrCodePix} alt="QR Code Pix" />
        ) : (
          <div className="contribution-qrcode-placeholder">
            QR Code Pix
          </div>
        )}

        <strong>{contribuicaoForm.chavePix || 'Chave Pix ainda não cadastrada'}</strong>

        {contribuicaoForm.favorecido && (
          <small>Favorecido: {contribuicaoForm.favorecido}</small>
        )}

        {contribuicaoForm.banco && (
          <small>Banco: {contribuicaoForm.banco}</small>
        )}
      </div>
    </section>
  </section>
)}
{abaAtiva === 'galeria' && (
  <section className="admin-card admin-full-card gallery-admin-card">
    <div className="gallery-card-header">
      <div>
        <span className="admin-section-label">Galeria</span>

        <h2>Fotos da igreja</h2>

        <p>
          Cadastre fotos de cultos, eventos, ações sociais e momentos especiais.
        </p>
      </div>
    </div>

    <div className="admin-grid admin-events-grid">
      <form className="admin-card gallery-form-card" onSubmit={salvarFotoGaleria}>
        <span className="admin-section-label">
          {editandoFotoId ? 'Editando álbum' : 'Novo álbum'}
        </span>

        <h2>{editandoFotoId ? 'Editar álbum' : 'Cadastrar álbum'}</h2>

        <label>
          Título
          <input
            type="text"
            value={galeriaForm.titulo}
            onChange={(event) =>
              setGaleriaForm({
                ...galeriaForm,
                titulo: event.target.value,
              })
            }
            placeholder="Ex: Culto de celebração"
          />
        </label>

        <label>
          Descrição
          <textarea
            value={galeriaForm.descricao}
            onChange={(event) =>
              setGaleriaForm({
                ...galeriaForm,
                descricao: event.target.value,
              })
            }
            placeholder="Descrição opcional da foto"
          />
        </label>

        <label>
          Categoria
          <select
            value={galeriaForm.categoria}
            onChange={(event) =>
              setGaleriaForm({
                ...galeriaForm,
                categoria: event.target.value,
              })
            }
          >
            {categoriasGaleria.map((categoria) => (
              <option value={categoria} key={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </label>

        <label>
          Imagens
          <input
            id="gallery-images-input"
            className="gallery-hidden-file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={enviarImagemGaleria}
            disabled={enviandoImagemGaleria}
          />
        </label>

        <div className="gallery-add-more-actions">
          <label htmlFor="gallery-images-input" className="gallery-add-more-button">
            <span>+</span>
            {imagensGaleria.length > 0 ? 'Adicionar mais fotos' : 'Selecionar fotos'}
          </label>

          {imagensGaleria.length > 0 && (
            <button
              type="button"
              className="gallery-save-extra-button"
              onClick={adicionarFotosAoEventoGaleria}
              disabled={loading || enviandoImagemGaleria}
            >
              Salvar {imagensGaleria.length} foto
              {imagensGaleria.length > 1 ? 's' : ''} neste evento
            </button>
          )}
        </div>

        {enviandoImagemGaleria && (
          <p className="upload-feedback">Enviando imagem...</p>
        )}

        {imagensGaleria.length > 0 && (
          <div className="gallery-multiple-preview">
            {imagensGaleria.map((imagem) => (
              <div className="gallery-image-preview" key={imagem.publicId}>
                <img
                  src={imagem.url}
                  alt={galeriaForm.titulo || 'Prévia da foto'}
                />
              </div>
            ))}
          </div>
        )}

        {galeriaForm.imagem && editandoFotoId && (
          <div className="gallery-image-preview">
            <img
              src={galeriaForm.imagem}
              alt={galeriaForm.titulo || 'Prévia da foto'}
            />
          </div>
        )}
{albumEditandoGaleria && (
  <div className="gallery-album-edit-photos">
    <div className="gallery-album-edit-header">
      <span>Fotos do álbum</span>
      <strong>
        {albumEditandoGaleria.fotos.length} foto
        {albumEditandoGaleria.fotos.length > 1 ? 's' : ''}
      </strong>
    </div>

    <div className="gallery-album-edit-grid">
      {albumEditandoGaleria.fotos.map((foto, index) => (
        <article
          className={`gallery-album-edit-photo ${
            foto.id === editandoFotoId ? 'active' : ''
          }`}
          key={foto.id}
        >
          <button
            type="button"
            className="gallery-album-thumb-button"
            onClick={() => editarFotoGaleria(foto)}
          >
            <img src={foto.imagem} alt={`${foto.titulo} ${index + 1}`} />

            <small>
              {foto.id === editandoFotoId ? 'Selecionada' : `Foto ${index + 1}`}
            </small>
          </button>

          <button
            type="button"
            className="gallery-delete-single-photo"
            onClick={() => excluirFotoIndividualGaleria(foto)}
          >
            Excluir foto
          </button>
        </article>
      ))}
    </div>
  </div>
)}

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={galeriaForm.ativo}
            onChange={(event) =>
              setGaleriaForm({
                ...galeriaForm,
                ativo: event.target.checked,
              })
            }
          />
          Álbum ativo no site
        </label>

        <button type="submit" disabled={loading || enviandoImagemGaleria}>
  {loading
    ? 'Salvando...'
    : editandoFotoId
      ? 'Salvar alterações do álbum'
      : imagensGaleria.length > 1
        ? `Cadastrar ${imagensGaleria.length} fotos`
        : 'Cadastrar foto'}
</button>

        {editandoFotoId && (
          <button
            type="button"
            className="cancel-button"
            onClick={cancelarEdicaoGaleria}
          >
            Cancelar edição
          </button>
        )}
      </form>

      <section className="admin-card gallery-list-card">
        <span className="admin-section-label">Álbuns cadastrados</span>

        <h2>Galeria cadastrada</h2>

        <p>
          Gerencie os álbuns que poderão aparecer na galeria pública do site.
        </p>

        <div className="gallery-admin-list">
          {galeria.length === 0 && <p>Nenhuma foto cadastrada ainda.</p>}

          {galeria.length > 0 &&
            albunsGaleriaAdmin.map((album) => {
              const fotoCapa = album.fotos[0]
              const albumAtivo = album.fotos.some((foto) => foto.ativo !== false)

              return (
                <article
                  className={`gallery-admin-item gallery-admin-album-item ${
                    !albumAtivo ? 'inactive-item' : ''
                  }`}
                  key={album.id}
                >
                  {fotoCapa?.imagem && (
                    <img src={fotoCapa.imagem} alt={album.titulo} />
                  )}

                  <div>
                    <span>{album.categoria || 'Sem categoria'}</span>

                    <strong>{album.titulo}</strong>

                    {album.descricao && <p>{album.descricao}</p>}

                    <small>
                      {albumAtivo ? 'Ativo no site' : 'Inativo no site'} ·{' '}
                      {album.fotos.length} foto{album.fotos.length > 1 ? 's' : ''}
                    </small>
                  </div>

                  <div className="admin-actions">
                    <button
                      type="button"
                      className="edit-button"
                      onClick={() => editarFotoGaleria(fotoCapa)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={albumAtivo ? 'deactivate-button' : 'activate-button'}
                      onClick={() => alternarStatusAlbumGaleria(album)}
                    >
                      {albumAtivo ? 'Desativar' : 'Ativar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => excluirAlbumGaleria(album)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              )
            })}
        </div>
      </section>
    </div>
  </section>
)}
     {abaAtiva === 'membros' && (
  <section className="members-admin-area">
  <div className="member-mode-actions member-mode-actions-four">
  <button
    type="button"
    className={modoMembros === 'lista' ? 'active' : ''}
    onClick={() => {
      cancelarEdicaoMembro()
      setModoMembros('lista')
    }}
  >
    <span>📋</span>
    Membros cadastrados
  </button>

  <button
    type="button"
    className={modoMembros === 'cadastro' ? 'active' : ''}
    onClick={() => {
      cancelarEdicaoMembro()
      setModoMembros('cadastro')
    }}
  >
    <span>✚</span>
    Cadastrar membro
  </button>

  <button
    type="button"
    className={modoMembros === 'pastoral' ? 'active' : ''}
    onClick={() => {
      cancelarEdicaoMembro()
      setModoMembros('pastoral')
    }}
  >
    <span>❤</span>
    Acompanhamento pastoral
  </button>

  <button
    type="button"
    className={modoMembros === 'aniversariantes' ? 'active' : ''}
    onClick={() => {
      cancelarEdicaoMembro()
      setModoMembros('aniversariantes')
    }}
  >
    <span>🎂</span>
    Aniversariantes
  </button>
</div>
<div className="admin-grid admin-events-grid">
 <form
  className={`admin-card member-form-panel ${
    modoMembros === 'lista' || modoMembros === 'aniversariantes'
      ? 'member-hidden-panel'
      : ''
  } ${
    modoMembros === 'pastoral' ? 'member-form-pastoral' : 'member-form-cadastro'
  }`}
  onSubmit={salvarMembro}
>
   
            <span className="admin-section-label">Membros</span>

            <h2>
  {editandoMembroId
    ? 'Editar membro'
    : modoMembros === 'pastoral'
      ? 'Acompanhamento pastoral'
      : 'Cadastrar membro'}
</h2>

<p>
  {modoMembros === 'pastoral'
    ? 'Registre informações de cuidado, contato, próxima ação e acompanhamento.'
    : 'Cadastre membros, visitantes e pessoas acompanhadas pela igreja.'}
</p>

            <label>
              Nome completo
              <input
                value={membroForm.nome}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    nome: event.target.value,
                  })
                }
                placeholder="Nome do membro"
              />
            </label>

            <label>
              Telefone / WhatsApp
              <input
                value={membroForm.telefone}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    telefone: event.target.value,
                  })
                }
                placeholder="(00) 00000-0000"
              />
            </label>

            <label>
              Data de nascimento
              <input
                type="date"
                value={membroForm.nascimento}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    nascimento: event.target.value,
                  })
                }
              />
            </label>
{membroForm.nascimento && (
  <p className="member-age-note">
    Idade calculada automaticamente: {calcularIdade(membroForm.nascimento)} anos
  </p>
)}

            <label>
              Endereço
              <input
                value={membroForm.endereco}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    endereco: event.target.value,
                  })
                }
                placeholder="Endereço completo"
              />
            </label>

            <label>
              Ministério
              <input
                value={membroForm.ministerio}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    ministerio: event.target.value,
                  })
                }
                placeholder="Ex: Louvor, Infantil, Recepção"
              />
            </label>

            <label>
              Status
              <select
                value={membroForm.status}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    status: event.target.value,
                  })
                }
              >
                <option value="Ativo">Ativo</option>
                <option value="Visitante">Visitante</option>
                <option value="Afastado">Afastado</option>
                <option value="Inativo">Inativo</option>
              </select>
            </label>

            <label>
              Foto do membro
              <input
                type="file"
                accept="image/*"
                onChange={enviarFotoMembro}
                disabled={enviandoFotoMembro}
              />
            </label>

            {enviandoFotoMembro && <p>Enviando foto...</p>}

            {membroForm.foto && (
              <div className="member-photo-preview">
                <img
                  src={membroForm.foto}
                  alt={membroForm.nome || 'Foto do membro'}
                />
              </div>
            )}

            <label>
              Observações internas
              <textarea
                value={membroForm.observacoes}
                onChange={(event) =>
                  setMembroForm({
                    ...membroForm,
                    observacoes: event.target.value,
                  })
                }
                placeholder="Observações internas sobre acompanhamento, família ou integração"
              />
            </label>
<div className="pastoral-form-section">
  <span>Acompanhamento pastoral</span>

  <label>
    Responsável pelo acompanhamento
    <input
      value={membroForm.responsavelAcompanhamento}
      onChange={(event) =>
        setMembroForm({
          ...membroForm,
          responsavelAcompanhamento: event.target.value,
        })
      }
      placeholder="Ex: Pastor, líder, discipulador"
    />
  </label>

  <label>
    Situação pastoral
    <select
      value={membroForm.situacaoPastoral}
      onChange={(event) =>
        setMembroForm({
          ...membroForm,
          situacaoPastoral: event.target.value,
        })
      }
    >
      <option value="Em acompanhamento">Em acompanhamento</option>
      <option value="Integrado">Integrado</option>
      <option value="Precisa de contato">Precisa de contato</option>
      <option value="Novo convertido">Novo convertido</option>
      <option value="Visitante recorrente">Visitante recorrente</option>
      <option value="Sem acompanhamento">Sem acompanhamento</option>
    </select>
  </label>

  <label>
    Último contato
    <input
      type="date"
      value={membroForm.ultimoContato}
      onChange={(event) =>
        setMembroForm({
          ...membroForm,
          ultimoContato: event.target.value,
        })
      }
    />
  </label>

  <label>
    Próxima ação
    <input
      value={membroForm.proximaAcao}
      onChange={(event) =>
        setMembroForm({
          ...membroForm,
          proximaAcao: event.target.value,
        })
      }
      placeholder="Ex: Ligar, visitar, convidar para célula"
    />
  </label>

  <label>
    Data da próxima ação
    <input
      type="date"
      value={membroForm.dataProximaAcao}
      onChange={(event) =>
        setMembroForm({
          ...membroForm,
          dataProximaAcao: event.target.value,
        })
      }
    />
  </label>

  <label>
    Observação do acompanhamento
    <textarea
      value={membroForm.observacaoAcompanhamento}
      onChange={(event) =>
        setMembroForm({
          ...membroForm,
          observacaoAcompanhamento: event.target.value,
        })
      }
      placeholder="Registre informações importantes do cuidado pastoral"
    />
  </label>
</div>

            <button type="submit" disabled={loading || enviandoFotoMembro}>
              {loading
                ? 'Salvando...'
                : editandoMembroId
                  ? 'Salvar alterações'
                  : 'Salvar membro'}
            </button>

            {editandoMembroId && (
              <button
                type="button"
                className="cancel-button"
                onClick={cancelarEdicaoMembro}
              >
                Cancelar edição
              </button>
            )}
                             </form>

          <section
            className={`admin-card ${
              modoMembros !== 'lista' ? 'member-hidden-panel' : ''
            }`}
          >
<div className="members-list-header">
  <div>
    <span className="admin-section-label">Lista de membros</span>
    <h2>Membros cadastrados</h2>
    <p>Controle interno de membros e visitantes.</p>
  </div>

  <button
    type="button"
    className="export-members-button"
    onClick={exportarMembrosExcel}
  >
    📊 Exportar membros
  </button>
</div>

<div className="member-filters">
  <label>
    Buscar membro
    <input
      value={buscaMembro}
      onChange={(event) => setBuscaMembro(event.target.value)}
      placeholder="Buscar por nome, telefone, endereço ou ministério"
    />
  </label>

  <label>
    Status
    <select
      value={filtroStatusMembro}
      onChange={(event) => setFiltroStatusMembro(event.target.value)}
    >
      <option value="Todos">Todos</option>
      <option value="Ativo">Ativo</option>
      <option value="Visitante">Visitante</option>
      <option value="Afastado">Afastado</option>
      <option value="Inativo">Inativo</option>
    </select>
  </label>

  <label>
    Ministério
    <select
      value={filtroMinisterioMembro}
      onChange={(event) => setFiltroMinisterioMembro(event.target.value)}
    >
      <option value="Todos">Todos</option>

      {ministeriosDisponiveis.map((ministerio) => (
        <option value={ministerio} key={ministerio}>
          {ministerio}
        </option>
      ))}
    </select>
  </label>
</div>

<div className="member-results-count">
  Exibindo {membrosFiltrados.length} de {membros.length} membros
</div>

<div className="admin-list">
            {membros.length === 0 && <p>Nenhum membro cadastrado ainda.</p>}

            {membros.length > 0 && membrosFiltrados.length === 0 && (
            <p>Nenhum membro encontrado com os filtros selecionados.</p>
            )}

            {membrosFiltrados.map((membro) => (
                <article
                  className={`admin-list-item member-list-item ${
                    membro.status === 'Inativo' ? 'inactive-item' : ''
                  }`}
                  key={membro.id}
                >
                  {membro.foto ? (
                    <img
                      className="member-list-photo"
                      src={membro.foto}
                      alt={membro.nome}
                    />
                  ) : (
                    <div className="member-list-placeholder">
                      {membro.nome?.charAt(0) || '?'}
                    </div>
                  )}

                 <div className="member-info">
 <span className="member-status-line">
  {membro.status || 'Ativo'}

  {temAcompanhamentoPastoral(membro) && (
    <em title="Possui acompanhamento pastoral">💚</em>
  )}
</span>

<strong>{membro.nome}</strong>

  <div className="member-details">
    {membro.telefone && (
      <small>
        <b>Telefone:</b> {membro.telefone}
      </small>
    )}

    {membro.nascimento && (
      <small>
        <b>Nascimento:</b> {formatarData(membro.nascimento)}
      </small>
    )}

    {membro.nascimento && (
      <small>
        <b>Idade:</b> {calcularIdade(membro.nascimento)} anos
      </small>
    )}

    {membro.endereco && (
      <small>
        <b>Endereço:</b> {membro.endereco}
      </small>
    )}

    {membro.ministerio && (
      <small>
        <b>Ministério:</b> {membro.ministerio}
      </small>
    )}

    {membro.observacoes && (
      <small>
        <b>Observações:</b> {membro.observacoes}
      </small>
    )}

    {membro.situacaoPastoral && (
      <small>
        <b>Situação pastoral:</b> {membro.situacaoPastoral}
      </small>
    )}

    {membro.responsavelAcompanhamento && (
      <small>
        <b>Responsável:</b> {membro.responsavelAcompanhamento}
      </small>
    )}

    {membro.ultimoContato && (
      <small>
        <b>Último contato:</b> {formatarData(membro.ultimoContato)}
      </small>
    )}

    {membro.proximaAcao && (
      <small>
        <b>Próxima ação:</b> {membro.proximaAcao}
      </small>
    )}

    {membro.dataProximaAcao && (
      <small>
        <b>Data da próxima ação:</b> {formatarData(membro.dataProximaAcao)}
      </small>
    )}

    {membro.observacaoAcompanhamento && (
      <small>
        <b>Obs. acompanhamento:</b> {membro.observacaoAcompanhamento}
      </small>
    )}
  </div>
</div>

                  <div className="admin-actions">
                    <button
                      type="button"
                      className="edit-button"
                      onClick={() => editarMembro(membro)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={
                        membro.status === 'Inativo'
                          ? 'activate-button'
                          : 'deactivate-button'
                      }
                      onClick={() => alternarStatusMembro(membro)}
                    >
                      {membro.status === 'Inativo' ? 'Ativar' : 'Inativar'}
                    </button>

                    <button type="button" onClick={() => excluirMembro(membro.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
                           ))}
                      </div>
          </section>

          {modoMembros === 'aniversariantes' && (
            <section className="admin-card member-birthday-card">
              <div className="birthday-page-header">
                <div>
                  <span className="admin-section-label">Aniversariantes</span>
                  <h2>🎂 Aniversariantes do mês</h2>
                  <p>
                    Consulte os aniversariantes, gere relatório para impressão e exporte para Excel.
                  </p>
                </div>

                <div className="birthday-page-actions">
                  <label>
                    Mês
                    <select
                      value={mesAniversariantes}
                      onChange={(event) => setMesAniversariantes(event.target.value)}
                    >
                      <option value="1">Janeiro</option>
                      <option value="2">Fevereiro</option>
                      <option value="3">Março</option>
                      <option value="4">Abril</option>
                      <option value="5">Maio</option>
                      <option value="6">Junho</option>
                      <option value="7">Julho</option>
                      <option value="8">Agosto</option>
                      <option value="9">Setembro</option>
                      <option value="10">Outubro</option>
                      <option value="11">Novembro</option>
                      <option value="12">Dezembro</option>
                    </select>
                  </label>

                  <div className="birthday-buttons">
                    <button
                      type="button"
                      className="report-button"
                      onClick={gerarRelatorioAniversariantes}
                    >
                      📄 Relatório
                    </button>

                    <button
                      type="button"
                      className="excel-button"
                      onClick={exportarAniversariantesExcel}
                    >
                      📊 Exportar Excel
                    </button>
                  </div>
                </div>
              </div>

              <div className="birthday-page-stats">
                <article>
                  <span>No mês</span>
                  <strong>{aniversariantesDoMes.length}</strong>
                </article>

                <article>
                  <span>Hoje</span>
                  <strong>{aniversariantesHoje.length}</strong>
                </article>
              </div>

              <div className="birthday-page-list">
                {aniversariantesDoMes.length === 0 && (
                  <p>Nenhum aniversariante neste mês.</p>
                )}

                {aniversariantesDoMes.map((membro) => (
                  <article
                    className={
                      'birthday-page-item ' +
                      (ehAniversarianteHoje(membro.nascimento)
                        ? 'birthday-today'
                        : '')
                    }
                    key={membro.id}
                  >
                    {membro.foto ? (
                      <img src={membro.foto} alt={membro.nome} />
                    ) : (
                      <div>{membro.nome?.charAt(0) || '?'}</div>
                    )}

                    <section>
                      <span>
                        Dia {obterDiaNascimento(membro.nascimento)}
                        {ehAniversarianteHoje(membro.nascimento) ? ' - hoje' : ''}
                      </span>

                      <strong>{membro.nome}</strong>

                      <small>
                        Idade atual: {calcularIdade(membro.nascimento)} anos
                      </small>

                      <small>
                        Nova idade: {calcularNovaIdade(membro.nascimento)} anos
                      </small>

                      {membro.telefone && (
                        <small>Telefone: {membro.telefone}</small>
                      )}

                      {membro.ministerio && (
                        <small>Ministério: {membro.ministerio}</small>
                      )}
                    </section>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
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

              <p>{localizacaoForm.endereco || 'Endereço ainda não preenchido.'}</p>

              {(localizacaoForm.latitude || localizacaoForm.longitude) && (
                <small>
                  Coordenadas: {localizacaoForm.latitude},{' '}
                  {localizacaoForm.longitude}
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
