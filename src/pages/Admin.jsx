import { useEffect, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { deleteApp, initializeApp } from 'firebase/app'
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
import { auth, db, firebaseConfig } from '../services/firebase'
import { uploadArquivoCloudinary } from '../services/cloudinary'
import './Admin.css'

const ADMIN_EMAILS = ['suedilsonfilho@gmail.com']

const PERFIS_USUARIOS = {
  admin: 'Administrador geral',
  presidente: 'Presidente',
  tesoureiro: 'Tesoureiro',
  secretaria: 'Secretaria',
  midia: 'Mídia',
  membro: 'Membro',
}

const PERMISSOES_POR_PERFIL = {
  admin: [
    'programacao',
    'eventos',
    'oracao',
    'midia',
    'documentos',
    'contribuicao',
    'financeiro',
    'galeria',
    'membros',
    'localizacao',
    'usuarios',
  ],
  presidente: [
    'programacao',
    'eventos',
    'oracao',
    'midia',
    'documentos',
    'contribuicao',
    'financeiro',
    'galeria',
    'membros',
    'localizacao',
    'usuarios',
  ],
  tesoureiro: ['financeiro', 'contribuicao'],
  secretaria: ['programacao', 'eventos', 'oracao', 'membros'],
  midia: ['midia', 'documentos', 'galeria'],
  membro: ['meusDados'],
}

function Admin() {
  const [user, setUser] = useState(null)
const [checkingAuth, setCheckingAuth] = useState(true)
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [loading, setLoading] = useState(false)
const [abaAtiva, setAbaAtiva] = useState('programacao')

const [permissaoUsuario, setPermissaoUsuario] = useState(null)
const [carregandoPermissoes, setCarregandoPermissoes] = useState(false)

const [usuariosPermissoes, setUsuariosPermissoes] = useState([])
const [editandoUsuarioPermissaoId, setEditandoUsuarioPermissaoId] =
  useState(null)
const [criandoUsuarioAuth, setCriandoUsuarioAuth] = useState(false)

const [usuarioPermissaoForm, setUsuarioPermissaoForm] = useState({
  uid: '',
  nome: '',
  email: '',
  senha: '',
  usuarioExistente: false,
  perfil: 'membro',
  membroId: '',
  ativo: true,
  permissoes: PERMISSOES_POR_PERFIL.membro,
})
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
  const isSuperAdmin = user && ADMIN_EMAILS.includes(user.email)

const perfilUsuario = isSuperAdmin
  ? 'admin'
  : permissaoUsuario?.perfil || ''

const permissoesUsuario = isSuperAdmin
  ? PERMISSOES_POR_PERFIL.admin
  : permissaoUsuario?.permissoes || PERMISSOES_POR_PERFIL[perfilUsuario] || []

const isAdmin = Boolean(
  user &&
    (
      isSuperAdmin ||
      permissaoUsuario?.ativo === true
    ),
)

function usuarioPodeAcessar(permissao) {
  if (isSuperAdmin) return true

  return permissoesUsuario.includes(permissao)
}
function obterPrimeiraAbaPermitida() {
  const ordemAbas = [
    'programacao',
    'eventos',
    'oracao',
    'midia',
    'documentos',
    'contribuicao',
    'financeiro',
    'galeria',
    'membros',
    'localizacao',
    'usuarios',
  ]

  return ordemAbas.find((aba) => usuarioPodeAcessar(aba)) || 'programacao'
}
 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser)

    if (!currentUser) {
      setPermissaoUsuario(null)
      setCheckingAuth(false)
      return
    }

    if (ADMIN_EMAILS.includes(currentUser.email)) {
      setPermissaoUsuario({
        uid: currentUser.uid,
        email: currentUser.email,
        nome: 'Administrador geral',
        perfil: 'admin',
        permissoes: PERMISSOES_POR_PERFIL.admin,
        ativo: true,
      })

      setCheckingAuth(false)
      return
    }

    setCarregandoPermissoes(true)

    try {
      const refPermissao = doc(db, 'usuariosPermissoes', currentUser.uid)
      const snapshotPermissao = await getDoc(refPermissao)

      if (snapshotPermissao.exists()) {
        setPermissaoUsuario({
          id: snapshotPermissao.id,
          ...snapshotPermissao.data(),
        })
      } else {
        setPermissaoUsuario(null)
      }
    } catch (error) {
      console.error('Erro ao carregar permissões do usuário.', error)
      setPermissaoUsuario(null)
    } finally {
      setCarregandoPermissoes(false)
      setCheckingAuth(false)
    }
  })

  return () => unsubscribe()
}, [])
const [modoFinanceiro, setModoFinanceiro] = useState('dashboard')
const [contasBancarias, setContasBancarias] = useState([])
const [editandoContaBancariaId, setEditandoContaBancariaId] = useState(null)

const [contaBancariaForm, setContaBancariaForm] = useState({
  nome: '',
  banco: '',
  agencia: '',
  conta: '',
  tipo: 'Conta corrente',
  saldoInicial: '',
  observacoes: '',
  ativo: true,
})

const tiposContaBancaria = [
  'Conta corrente',
  'Poupança',
  'Caixa interno',
  'Pix',
  'Investimento',
  'Outros',
]
const [arrecadacoes, setArrecadacoes] = useState([])
const [editandoArrecadacaoId, setEditandoArrecadacaoId] = useState(null)
const [formArrecadacaoAberto, setFormArrecadacaoAberto] = useState(false)
const [enviandoComprovanteArrecadacao, setEnviandoComprovanteArrecadacao] =
  useState(false)
const [arrecadacaoForm, setArrecadacaoForm] = useState({
  data: '',
  tipo: 'Dízimo',
  descricao: '',
  valor: '',
  formaPagamento: 'Pix',
  contaBancariaId: '',
  responsavel: '',
  comprovante: '',
  comprovantePublicId: '',
  observacoes: '',
  ativo: true,
})

const tiposArrecadacao = [
  'Dízimo',
  'Oferta',
  'Campanha',
  'Evento',
  'Doação',
  'Projeto social',
  'Outros',
]

const formasPagamentoFinanceiro = [
  'Pix',
  'Dinheiro',
  'Cartão de débito',
  'Cartão de crédito',
  'Transferência',
  'Boleto',
  'Outros',
]
const [contasPagar, setContasPagar] = useState([])
const [editandoContaPagarId, setEditandoContaPagarId] = useState(null)
const [formContaPagarAberto, setFormContaPagarAberto] = useState(false)
const [enviandoComprovanteContaPagar, setEnviandoComprovanteContaPagar] =
  useState(false)

const [contaPagarForm, setContaPagarForm] = useState({
  vencimento: '',
  dataPagamento: '',
  fornecedor: '',
  categoria: 'Despesas fixas',
  descricao: '',
  valor: '',
  formaPagamento: 'Pix',
  contaBancariaId: '',
  comprovante: '',
  comprovantePublicId: '',
  observacoes: '',
  status: 'Aberta',
  ativo: true,
  recorrente: false,
  parcelada: false,
  numeroParcelas: '2',
})

const categoriasContaPagar = [
  'Despesas fixas',
  'Aluguel',
  'Energia',
  'Água',
  'Internet',
  'Telefone',
  'Material de consumo',
  'Material de limpeza',
  'Ajuda social',
  'Evento',
  'Obra / manutenção',
  'Equipamentos',
  'Ministério infantil',
  'Louvor',
  'Missões',
  'Impostos / taxas',
  'Outros',
]

const statusContaPagar = ['Aberta', 'Paga', 'Cancelada']
const [aprovisionamentos, setAprovisionamentos] = useState([])
const [editandoAprovisionamentoId, setEditandoAprovisionamentoId] = useState(null)
const [formAprovisionamentoAberto, setFormAprovisionamentoAberto] =
  useState(false)

const [aprovisionamentoForm, setAprovisionamentoForm] = useState({
  data: '',
  previsaoUso: '',
  categoria: 'Reserva geral',
  descricao: '',
  valor: '',
  contaBancariaId: '',
  responsavel: '',
  observacoes: '',
  status: 'Reservado',
  ativo: true,
})

const categoriasAprovisionamento = [
  'Reserva geral',
  'Aluguel',
  'Energia',
  'Água',
  'Evento',
  'Obra / manutenção',
  'Ajuda social',
  'Projeto social',
  'Missões',
  'Equipamentos',
  'Emergência',
  'Outros',
]

const statusAprovisionamento = ['Reservado', 'Utilizado', 'Cancelado']
useEffect(() => {
  if (!isAdmin) return

  if (!usuarioPodeAcessar(abaAtiva)) {
    setAbaAtiva(obterPrimeiraAbaPermitida())
  }
}, [isAdmin, permissaoUsuario, abaAtiva])
useEffect(() => {
  if (!isAdmin) return

  if (usuarioPodeAcessar('programacao')) {
    carregarProgramacao()
  }

  if (usuarioPodeAcessar('eventos')) {
    carregarEventos()
  }

  if (usuarioPodeAcessar('localizacao')) {
    carregarLocalizacao()
  }

  if (usuarioPodeAcessar('contribuicao')) {
    carregarContribuicao()
  }

  if (usuarioPodeAcessar('financeiro')) {
    carregarContasBancarias()
    carregarArrecadacoes()
    carregarContasPagar()
    carregarAprovisionamentos()
  }

  if (usuarioPodeAcessar('oracao')) {
    carregarPedidosOracao()
  }

  if (usuarioPodeAcessar('midia')) {
    carregarVideos()
  }

  if (usuarioPodeAcessar('documentos')) {
    carregarDocumentos()
  }

  if (usuarioPodeAcessar('galeria')) {
    carregarGaleria()
  }

  if (usuarioPodeAcessar('membros') || usuarioPodeAcessar('meusDados')) {
    carregarMembros()
  }

  if (usuarioPodeAcessar('usuarios')) {
    carregarUsuariosPermissoes()
  }
}, [isAdmin, permissaoUsuario])
const mesAtualFinanceiro = String(new Date().getMonth() + 1)
const anoAtualFinanceiro = String(new Date().getFullYear())

const mesesFinanceiro = [
  { valor: '1', nome: 'Jan' },
  { valor: '2', nome: 'Fev' },
  { valor: '3', nome: 'Mar' },
  { valor: '4', nome: 'Abr' },
  { valor: '5', nome: 'Mai' },
  { valor: '6', nome: 'Jun' },
  { valor: '7', nome: 'Jul' },
  { valor: '8', nome: 'Ago' },
  { valor: '9', nome: 'Set' },
  { valor: '10', nome: 'Out' },
  { valor: '11', nome: 'Nov' },
  { valor: '12', nome: 'Dez' },
]

const [mesesFiltroFinanceiro, setMesesFiltroFinanceiro] = useState([
  mesAtualFinanceiro,
])
const [anoFiltroFinanceiro, setAnoFiltroFinanceiro] = useState(
  anoAtualFinanceiro,
)
const [statusFiltroContaPagar, setStatusFiltroContaPagar] = useState('Todas')
const [fornecedorFiltroContaPagar, setFornecedorFiltroContaPagar] = useState('')
async function carregarUsuariosPermissoes() {
  const usuariosSnapshot = await getDocs(collection(db, 'usuariosPermissoes'))

  const listaUsuarios = usuariosSnapshot.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  }))

  setUsuariosPermissoes(
    listaUsuarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
  )
}

function atualizarPerfilUsuarioPermissao(perfil) {
  setUsuarioPermissaoForm((formAtual) => ({
    ...formAtual,
    perfil,
    permissoes: PERMISSOES_POR_PERFIL[perfil] || [],
  }))
}

function alternarPermissaoUsuario(permissao) {
  setUsuarioPermissaoForm((formAtual) => {
    const permissoesAtuais = formAtual.permissoes || []

    if (permissoesAtuais.includes(permissao)) {
      return {
        ...formAtual,
        permissoes: permissoesAtuais.filter((item) => item !== permissao),
      }
    }

    return {
      ...formAtual,
      permissoes: [...permissoesAtuais, permissao],
    }
  })
}

function limparFormularioUsuarioPermissao() {
  setEditandoUsuarioPermissaoId(null)

  setUsuarioPermissaoForm({
    uid: '',
    nome: '',
    email: '',
    senha: '',
    usuarioExistente: false,
    perfil: 'membro',
    membroId: '',
    ativo: true,
    permissoes: PERMISSOES_POR_PERFIL.membro,
  })
}
async function criarUsuarioNoAuthentication(emailUsuario, senhaUsuario) {
  const nomeAppSecundario = `admin-criacao-usuario-${Date.now()}`
  const appSecundario = initializeApp(firebaseConfig, nomeAppSecundario)
  const authSecundario = getAuth(appSecundario)

  try {
    const credencial = await createUserWithEmailAndPassword(
      authSecundario,
      emailUsuario,
      senhaUsuario,
    )

    return credencial.user.uid
  } finally {
    await deleteApp(appSecundario)
  }
}

async function salvarUsuarioPermissao(event) {
  event.preventDefault()

  if (!usuarioPermissaoForm.nome.trim()) {
    alert('Informe o nome do usuário.')
    return
  }

  if (!usuarioPermissaoForm.email.trim()) {
    alert('Informe o e-mail do usuário.')
    return
  }

  if (
  !editandoUsuarioPermissaoId &&
  !usuarioPermissaoForm.usuarioExistente &&
  !usuarioPermissaoForm.senha.trim()
) {
  alert('Informe uma senha inicial para o novo usuário.')
  return
}

if (
  !editandoUsuarioPermissaoId &&
  usuarioPermissaoForm.usuarioExistente &&
  !usuarioPermissaoForm.uid.trim()
) {
  alert('Informe o UID do usuário já existente no Firebase Authentication.')
  return
}

  if (
    usuarioPermissaoForm.perfil === 'membro' &&
    !usuarioPermissaoForm.membroId.trim()
  ) {
    alert('Para perfil de membro, vincule o cadastro de membro.')
    return
  }

  setCriandoUsuarioAuth(true)

  try {
    let uidUsuario = usuarioPermissaoForm.uid.trim()

if (!editandoUsuarioPermissaoId && !usuarioPermissaoForm.usuarioExistente) {
  uidUsuario = await criarUsuarioNoAuthentication(
    usuarioPermissaoForm.email.trim().toLowerCase(),
    usuarioPermissaoForm.senha.trim(),
  )
}

    const dadosUsuario = {
      uid: uidUsuario,
      nome: usuarioPermissaoForm.nome.trim(),
      email: usuarioPermissaoForm.email.trim().toLowerCase(),
      perfil: usuarioPermissaoForm.perfil,
      membroId: usuarioPermissaoForm.membroId || '',
      ativo: usuarioPermissaoForm.ativo,
      permissoes: usuarioPermissaoForm.permissoes || [],
      atualizadoEm: serverTimestamp(),
    }

    if (!editandoUsuarioPermissaoId) {
      dadosUsuario.criadoEm = serverTimestamp()
    }

    await setDoc(doc(db, 'usuariosPermissoes', uidUsuario), dadosUsuario, {
      merge: true,
    })

    await carregarUsuariosPermissoes()
    limparFormularioUsuarioPermissao()

    alert('Usuário e permissões salvos com sucesso.')
  } catch (error) {
    console.error('Erro ao salvar usuário.', error)

    if (error.code === 'auth/email-already-in-use') {
      alert(
        'Este e-mail já existe no Firebase Authentication. Use outro e-mail ou edite as permissões já existentes.',
      )
      return
    }

    if (error.code === 'auth/weak-password') {
      alert('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    alert('Erro ao salvar usuário. Verifique os dados e tente novamente.')
  } finally {
    setCriandoUsuarioAuth(false)
  }
}

function editarUsuarioPermissao(usuarioPermissao) {
  setEditandoUsuarioPermissaoId(usuarioPermissao.id)

  setUsuarioPermissaoForm({
  uid: usuarioPermissao.uid || usuarioPermissao.id,
  nome: usuarioPermissao.nome || '',
  email: usuarioPermissao.email || '',
  senha: '',
  usuarioExistente: true,
  perfil: usuarioPermissao.perfil || 'membro',
  membroId: usuarioPermissao.membroId || '',
  ativo: usuarioPermissao.ativo !== false,
  permissoes:
    usuarioPermissao.permissoes ||
    PERMISSOES_POR_PERFIL[usuarioPermissao.perfil] ||
    [],
})

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

async function alternarStatusUsuarioPermissao(usuarioPermissao) {
  const novoStatus = usuarioPermissao.ativo === false

  await updateDoc(doc(db, 'usuariosPermissoes', usuarioPermissao.id), {
    ativo: novoStatus,
    atualizadoEm: serverTimestamp(),
  })

  await carregarUsuariosPermissoes()
}
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
async function carregarContasBancarias() {
  try {
    const q = query(collection(db, 'contasBancarias'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setContasBancarias(lista)
  } catch (error) {
    alert('Erro ao carregar contas bancárias.')
    console.error(error)
  }
}

function limparFormularioContaBancaria() {
  setContaBancariaForm({
    nome: '',
    banco: '',
    agencia: '',
    conta: '',
    tipo: 'Conta corrente',
    saldoInicial: '',
    observacoes: '',
    ativo: true,
  })

  setEditandoContaBancariaId(null)
}

async function salvarContaBancaria(event) {
  event.preventDefault()

  if (!contaBancariaForm.nome) {
    alert('Preencha o nome da conta.')
    return
  }

  const saldoInicial = Number(
    String(contaBancariaForm.saldoInicial || '0').replace(',', '.'),
  )

  setLoading(true)

  try {
    const dadosConta = {
      nome: contaBancariaForm.nome,
      banco: contaBancariaForm.banco,
      agencia: contaBancariaForm.agencia,
      conta: contaBancariaForm.conta,
      tipo: contaBancariaForm.tipo,
      saldoInicial,
      observacoes: contaBancariaForm.observacoes,
      ativo: contaBancariaForm.ativo,
      atualizadoEm: serverTimestamp(),
    }

    if (editandoContaBancariaId) {
      await updateDoc(doc(db, 'contasBancarias', editandoContaBancariaId), dadosConta)
      alert('Conta bancária atualizada com sucesso!')
    } else {
      await addDoc(collection(db, 'contasBancarias'), {
        ...dadosConta,
        criadoEm: serverTimestamp(),
      })

      alert('Conta bancária cadastrada com sucesso!')
    }

    limparFormularioContaBancaria()
    await carregarContasBancarias()
  } catch (error) {
    alert('Erro ao salvar conta bancária.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarContaBancaria(conta) {
  setAbaAtiva('financeiro')
  setModoFinanceiro('contas')
  setEditandoContaBancariaId(conta.id)

  setContaBancariaForm({
    nome: conta.nome || '',
    banco: conta.banco || '',
    agencia: conta.agencia || '',
    conta: conta.conta || '',
    tipo: conta.tipo || 'Conta corrente',
    saldoInicial:
      conta.saldoInicial || conta.saldoInicial === 0
        ? String(conta.saldoInicial).replace('.', ',')
        : '',
    observacoes: conta.observacoes || '',
    ativo: conta.ativo !== false,
  })

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

function cancelarEdicaoContaBancaria() {
  limparFormularioContaBancaria()
}

async function alternarStatusContaBancaria(conta) {
  try {
    await updateDoc(doc(db, 'contasBancarias', conta.id), {
      ativo: conta.ativo === false ? true : false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarContasBancarias()
  } catch (error) {
    alert('Erro ao alterar status da conta bancária.')
    console.error(error)
  }
}

async function excluirContaBancaria(id) {
  const confirmar = confirm('Deseja realmente excluir esta conta bancária?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'contasBancarias', id))
    await carregarContasBancarias()
  } catch (error) {
    alert('Erro ao excluir conta bancária.')
    console.error(error)
  }
}
async function carregarArrecadacoes() {
  try {
    const q = query(collection(db, 'arrecadacoes'), orderBy('data', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setArrecadacoes(lista)
  } catch (error) {
    alert('Erro ao carregar arrecadações.')
    console.error(error)
  }
}

function limparFormularioArrecadacao() {
  setArrecadacaoForm({
    data: '',
    tipo: 'Dízimo',
    descricao: '',
    valor: '',
    formaPagamento: 'Pix',
    contaBancariaId: '',
    responsavel: '',
    comprovante: '',
    comprovantePublicId: '',
    observacoes: '',
    ativo: true,
  })

  setEditandoArrecadacaoId(null)
}
function abrirNovaArrecadacao() {
  limparFormularioArrecadacao()
  setFormArrecadacaoAberto(true)
}

function fecharFormularioArrecadacao() {
  limparFormularioArrecadacao()
  setFormArrecadacaoAberto(false)
}
async function enviarComprovanteArrecadacao(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoComprovanteArrecadacao(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setArrecadacaoForm((formAtual) => ({
      ...formAtual,
      comprovante: arquivo.url,
      comprovantePublicId: arquivo.publicId,
    }))

    event.target.value = ''

    alert('Comprovante enviado com sucesso!')
  } catch (error) {
    alert('Erro ao enviar comprovante.')
    console.error(error)
  } finally {
    setEnviandoComprovanteArrecadacao(false)
  }
}

async function salvarArrecadacao(event) {
  event.preventDefault()

  if (!arrecadacaoForm.data) {
    alert('Preencha a data da arrecadação.')
    return
  }

  if (!arrecadacaoForm.descricao) {
    alert('Preencha a descrição da arrecadação.')
    return
  }

  if (!arrecadacaoForm.valor) {
    alert('Preencha o valor da arrecadação.')
    return
  }

  
    if (!arrecadacaoForm.valor) {
    alert('Preencha o valor da arrecadação.')
    return
  }

  const valor = Number(String(arrecadacaoForm.valor).replace(',', '.'))

  if (!valor || valor <= 0) {
    alert('Informe um valor válido.')
    return
  }

  setLoading(true)

  try {
    const contaSelecionada = contasBancarias.find(
      (conta) => conta.id === arrecadacaoForm.contaBancariaId,
    )

    const dadosArrecadacao = {
      data: arrecadacaoForm.data,
      tipo: arrecadacaoForm.tipo,
      descricao: arrecadacaoForm.descricao,
      valor,
      formaPagamento: arrecadacaoForm.formaPagamento,
      contaBancariaId: arrecadacaoForm.contaBancariaId,
      contaBancariaNome: contaSelecionada?.nome || '',
      responsavel: arrecadacaoForm.responsavel,
      comprovante: arrecadacaoForm.comprovante,
      comprovantePublicId: arrecadacaoForm.comprovantePublicId,
      observacoes: arrecadacaoForm.observacoes,
      ativo: arrecadacaoForm.ativo,
      atualizadoEm: serverTimestamp(),
    }

    if (editandoArrecadacaoId) {
      await updateDoc(
        doc(db, 'arrecadacoes', editandoArrecadacaoId),
        dadosArrecadacao,
      )

      alert('Arrecadação atualizada com sucesso!')
    } else {
      await addDoc(collection(db, 'arrecadacoes'), {
        ...dadosArrecadacao,
        criadoEm: serverTimestamp(),
      })

      alert('Arrecadação cadastrada com sucesso!')
    }

    limparFormularioArrecadacao()
    setFormArrecadacaoAberto(false)
    await carregarArrecadacoes()
  } catch (error) {
    alert('Erro ao salvar arrecadação.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarArrecadacao(arrecadacao) {
  setAbaAtiva('financeiro')
  setModoFinanceiro('arrecadacoes')
  setEditandoArrecadacaoId(arrecadacao.id)
  setFormArrecadacaoAberto(true)

  setArrecadacaoForm({
    data: arrecadacao.data || '',
    tipo: arrecadacao.tipo || 'Dízimo',
    descricao: arrecadacao.descricao || '',
    valor:
      arrecadacao.valor || arrecadacao.valor === 0
        ? String(arrecadacao.valor).replace('.', ',')
        : '',
    formaPagamento: arrecadacao.formaPagamento || 'Pix',
    contaBancariaId: arrecadacao.contaBancariaId || '',
    responsavel: arrecadacao.responsavel || '',
    comprovante: arrecadacao.comprovante || '',
    comprovantePublicId: arrecadacao.comprovantePublicId || '',
    observacoes: arrecadacao.observacoes || '',
    ativo: arrecadacao.ativo !== false,
  })

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}
function cancelarEdicaoArrecadacao() {
  fecharFormularioArrecadacao()
}

async function alternarStatusArrecadacao(arrecadacao) {
  try {
    await updateDoc(doc(db, 'arrecadacoes', arrecadacao.id), {
      ativo: arrecadacao.ativo === false ? true : false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarArrecadacoes()
  } catch (error) {
    alert('Erro ao alterar status da arrecadação.')
    console.error(error)
  }
}

async function excluirArrecadacao(id) {
  const confirmar = confirm('Deseja realmente excluir esta arrecadação?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'arrecadacoes', id))
    await carregarArrecadacoes()
  } catch (error) {
    alert('Erro ao excluir arrecadação.')
    console.error(error)
  }
}
async function carregarContasPagar() {
  try {
    const q = query(collection(db, 'contasPagar'), orderBy('vencimento', 'asc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setContasPagar(lista)
  } catch (error) {
    alert('Erro ao carregar contas a pagar.')
    console.error(error)
  }
}

function limparFormularioContaPagar() {
  setContaPagarForm({
    vencimento: '',
    dataPagamento: '',
    fornecedor: '',
    categoria: 'Despesas fixas',
    descricao: '',
    valor: '',
    formaPagamento: 'Pix',
    contaBancariaId: '',
    comprovante: '',
    comprovantePublicId: '',
    observacoes: '',
    status: 'Aberta',
    ativo: true,
    recorrente: false,
    parcelada: false,
    numeroParcelas: '2',
  })

  setEditandoContaPagarId(null)
}

function abrirNovaContaPagar() {
  limparFormularioContaPagar()
  setFormContaPagarAberto(true)
}

function fecharFormularioContaPagar() {
  limparFormularioContaPagar()
  setFormContaPagarAberto(false)
}
function obterMesDaData(data) {
  if (!data) return ''

  if (typeof data === 'string') {
    const partes = data.split('-')

    if (partes.length < 2) return ''

    return String(Number(partes[1]))
  }

  if (data?.toDate) {
    return String(data.toDate().getMonth() + 1)
  }

  if (data instanceof Date) {
    return String(data.getMonth() + 1)
  }

  return ''
}

function obterAnoDaData(data) {
  if (!data) return ''

  if (typeof data === 'string') {
    const partes = data.split('-')

    if (!partes[0]) return ''

    return String(partes[0])
  }

  if (data?.toDate) {
    return String(data.toDate().getFullYear())
  }

  if (data instanceof Date) {
    return String(data.getFullYear())
  }

  return ''
}

function alternarMesFiltroFinanceiro(mes) {
  setMesesFiltroFinanceiro((mesesAtuais) => {
    if (mesesAtuais.includes(mes)) {
      const novosMeses = mesesAtuais.filter((item) => item !== mes)

      return novosMeses.length > 0 ? novosMeses : [mesAtualFinanceiro]
    }

    return [...mesesAtuais, mes]
  })
}

function selecionarTodosMesesFinanceiro() {
  if (mesesFiltroFinanceiro.length === mesesFinanceiro.length) {
    setMesesFiltroFinanceiro([mesAtualFinanceiro])
    return
  }

  setMesesFiltroFinanceiro(mesesFinanceiro.map((mes) => mes.valor))
}

function obterNomeMesFinanceiro(valorMes) {
  const mesEncontrado = mesesFinanceiro.find((mes) => mes.valor === valorMes)

  return mesEncontrado?.nome || valorMes
}

function obterDescricaoMesesFinanceiro() {
  const descricaoMeses =
    mesesFiltroFinanceiro.length === mesesFinanceiro.length
      ? 'todos-os-meses'
      : mesesFiltroFinanceiro
          .map((mes) => obterNomeMesFinanceiro(mes).toLowerCase())
          .join('-')

  return `${anoFiltroFinanceiro}-${descricaoMeses}`
}
function exportarRelatorioFinanceiroExcel() {
  const cabecalho = ['Indicador', 'Valor']

  const linhasResumo = [
    ['Saldo disponível', formatarMoeda(resumoFinanceiro.saldoDisponivel)],
    ['Saldo financeiro', formatarMoeda(resumoFinanceiro.saldoFinanceiro)],
    ['Total arrecadado', formatarMoeda(resumoFinanceiro.totalArrecadacoes)],
    [
      'Resultado do período',
      formatarMoeda(resumoFinanceiro.resultadoPeriodoFinanceiro),
    ],
    ['Contas pagas', formatarMoeda(resumoFinanceiro.totalContasPagas)],
    ['Contas em aberto', formatarMoeda(resumoFinanceiro.totalContasAbertas)],
    ['Aprovisionado', formatarMoeda(resumoFinanceiro.totalAprovisionado)],
    ['Despesas vencidas', resumoFinanceiro.contasPagarVencidas],
    ['Vencem hoje', resumoFinanceiro.contasPagarVencemHoje],
    ['Próximos 7 dias', resumoFinanceiro.contasPagarProximos7Dias],
    ['Contas bancárias', resumoFinanceiro.contas],
  ]

  const cabecalhoEntradasPorTipo = ['Tipo', 'Quantidade', 'Total']

  const linhasEntradasPorTipo = arrecadacoesPorTipo.map((item) => [
    item.categoria,
    item.quantidade,
    formatarMoeda(item.total),
  ])
  const cabecalhoMovimentoPorConta = [
    'Conta',
    'Banco / Tipo',
    'Entradas',
    'Despesas pagas',
    'Despesas abertas',
    'Resultado',
  ]

  const linhasMovimentoPorConta = movimentacaoPorContaBancaria.map((item) => [
    item.nome,
    item.banco || '',
    formatarMoeda(item.entradas),
    formatarMoeda(item.despesasPagas),
    formatarMoeda(item.despesasAbertas),
    formatarMoeda(item.resultado),
  ])
  const cabecalhoDespesasPorCategoria = [
    'Categoria',
    'Quantidade',
    'Total pago',
    'Total em aberto',
    'Total geral',
  ]

  const linhasDespesasPorCategoria = despesasPorCategoria.map((item) => [
    item.categoria,
    item.quantidade,
    formatarMoeda(item.totalPago),
    formatarMoeda(item.totalAberto),
    formatarMoeda(item.total),
  ])

  const cabecalhoAprovisionamentosPorCategoria = [
    'Categoria',
    'Quantidade',
    'Total',
  ]

  const linhasAprovisionamentosPorCategoria =
    aprovisionamentosPorCategoria.map((item) => [
      item.categoria,
      item.quantidade,
      formatarMoeda(item.total),
    ])

  const cabecalhoArrecadacoes = [
    'Data',
    'Tipo',
    'Descrição',
    'Forma de pagamento',
    'Conta',
    'Responsável',
    'Status',
    'Valor',
  ]

  const linhasArrecadacoes = arrecadacoesFiltradasFinanceiro.map((item) => [
    formatarData(item.data),
    item.tipo || '',
    item.descricao || '',
    item.formaPagamento || '',
    item.contaBancariaNome || '',
    item.responsavel || '',
    item.ativo === false ? 'Cancelada' : 'Ativa',
    formatarMoeda(item.valor),
  ])

  const cabecalhoDespesas = [
    'Vencimento',
    'Pagamento',
    'Fornecedor',
    'Categoria',
    'Descrição',
    'Forma de pagamento',
    'Conta',
    'Status',
    'Valor',
  ]

  const linhasDespesas = contasPagarFiltradasFinanceiro.map((item) => [
    formatarData(item.vencimento),
    item.dataPagamento ? formatarData(item.dataPagamento) : '',
    item.fornecedor || '',
    item.categoria || '',
    item.descricao || '',
    item.formaPagamento || '',
    item.contaBancariaNome || '',
    obterStatusVisualContaPagar(item),
    formatarMoeda(item.valor),
  ])

  const conteudo = [
    ['RELATÓRIO FINANCEIRO'],
    ['Período', obterDescricaoMesesFinanceiro()],
    [],
    ['RESUMO'],
    cabecalho,
    ...linhasResumo,
    [],
    ['ENTRADAS POR TIPO'],
    cabecalhoEntradasPorTipo,
    ...linhasEntradasPorTipo,
    [],
    ['DESPESAS POR CATEGORIA'],
    cabecalhoDespesasPorCategoria,
    ...linhasDespesasPorCategoria,
    [],
       ['APROVISIONAMENTOS POR CATEGORIA'],
    cabecalhoAprovisionamentosPorCategoria,
    ...linhasAprovisionamentosPorCategoria,
    [],
    ['MOVIMENTO POR CONTA BANCÁRIA'],
    cabecalhoMovimentoPorConta,
    ...linhasMovimentoPorConta,
    [],
    ['ARRECADAÇÕES DETALHADAS'],
    cabecalhoArrecadacoes,
    ...linhasArrecadacoes,
    [],
    ['CONTAS A PAGAR DETALHADAS'],
    cabecalhoDespesas,
    ...linhasDespesas,
  ]
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
  link.download = `relatorio-financeiro-${obterDescricaoMesesFinanceiro()}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
function itemDentroDosMesesFinanceiro(data) {
  const mesData = obterMesDaData(data)
  const anoData = obterAnoDaData(data)

  const correspondeMes = mesesFiltroFinanceiro.includes(mesData)
  const correspondeAno =
    !anoFiltroFinanceiro || anoData === anoFiltroFinanceiro

  return correspondeMes && correspondeAno
}
function contaPagarCorrespondeStatus(conta) {
  const statusVisual = obterStatusVisualContaPagar(conta)

  if (statusFiltroContaPagar === 'Todas') return true

  if (statusFiltroContaPagar === 'Paga') {
    return conta.status === 'Paga'
  }

  if (statusFiltroContaPagar === 'A pagar') {
    return conta.status !== 'Paga' && statusVisual !== 'Cancelada'
  }

  return true
}

function contaPagarCorrespondeFornecedor(conta) {
  const textoBusca = fornecedorFiltroContaPagar.toLowerCase().trim()

  if (!textoBusca) return true

  return conta.fornecedor?.toLowerCase().includes(textoBusca)
}
function obterHojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function adicionarMesesData(dataBase, quantidadeMeses) {
  if (!dataBase) return ''

  const [ano, mes, dia] = dataBase.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia)

  data.setMonth(data.getMonth() + quantidadeMeses)

  const novoAno = data.getFullYear()
  const novoMes = String(data.getMonth() + 1).padStart(2, '0')
  const novoDia = String(data.getDate()).padStart(2, '0')

  return `${novoAno}-${novoMes}-${novoDia}`
}

function obterStatusVisualContaPagar(conta) {
  if (conta.status === 'Paga') return 'Paga'
  if (conta.status === 'Cancelada' || conta.ativo === false) return 'Cancelada'

  const hoje = obterHojeISO()

  if (conta.vencimento && conta.vencimento < hoje) {
    return 'Vencida'
  }

  if (conta.vencimento === hoje) {
    return 'Vence hoje'
  }

  return 'Aberta'
}

function calcularDiasParaVencimento(vencimento) {
  if (!vencimento) return null

  const hoje = new Date(`${obterHojeISO()}T00:00:00`)
  const dataVencimento = new Date(`${vencimento}T00:00:00`)
  const diferenca = dataVencimento - hoje

  return Math.round(diferenca / (1000 * 60 * 60 * 24))
}

async function enviarComprovanteContaPagar(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoComprovanteContaPagar(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setContaPagarForm((formAtual) => ({
      ...formAtual,
      comprovante: arquivo.url,
      comprovantePublicId: arquivo.publicId,
    }))

    event.target.value = ''

    alert('Comprovante enviado com sucesso!')
  } catch (error) {
    alert('Erro ao enviar comprovante.')
    console.error(error)
  } finally {
    setEnviandoComprovanteContaPagar(false)
  }
}

async function salvarContaPagar(event) {
  event.preventDefault()

  if (!contaPagarForm.vencimento) {
    alert('Preencha a data de vencimento.')
    return
  }

  if (!contaPagarForm.descricao) {
    alert('Preencha a descrição da despesa.')
    return
  }

  if (!contaPagarForm.valor) {
    alert('Preencha o valor da despesa.')
    return
  }

  const valor = Number(String(contaPagarForm.valor).replace(',', '.'))

  if (!valor || valor <= 0) {
    alert('Informe um valor válido.')
    return
  }

  const numeroParcelas = Number(contaPagarForm.numeroParcelas || 1)

  if (contaPagarForm.parcelada && (!numeroParcelas || numeroParcelas < 2)) {
    alert('Informe pelo menos 2 parcelas.')
    return
  }

  setLoading(true)

  try {
    const contaSelecionada = contasBancarias.find(
      (conta) => conta.id === contaPagarForm.contaBancariaId,
    )

    const dadosBase = {
      fornecedor: contaPagarForm.fornecedor,
      categoria: contaPagarForm.categoria,
      descricao: contaPagarForm.descricao,
      valor,
      formaPagamento: contaPagarForm.formaPagamento,
      contaBancariaId: contaPagarForm.contaBancariaId,
      contaBancariaNome: contaSelecionada?.nome || '',
      comprovante: contaPagarForm.comprovante,
      comprovantePublicId: contaPagarForm.comprovantePublicId,
      observacoes: contaPagarForm.observacoes,
      status: contaPagarForm.status,
      ativo: contaPagarForm.ativo,
      recorrente: contaPagarForm.recorrente,
      parcelada: contaPagarForm.parcelada,
      numeroParcelas: contaPagarForm.parcelada ? numeroParcelas : 1,
      atualizadoEm: serverTimestamp(),
    }

    if (editandoContaPagarId) {
      await updateDoc(doc(db, 'contasPagar', editandoContaPagarId), {
        ...dadosBase,
        vencimento: contaPagarForm.vencimento,
        dataPagamento: contaPagarForm.status === 'Paga'
          ? contaPagarForm.dataPagamento || obterHojeISO()
          : contaPagarForm.dataPagamento,
      })

      alert('Despesa atualizada com sucesso!')
    } else if (contaPagarForm.parcelada) {
      const grupoParcelamentoId = crypto.randomUUID()
      const batch = writeBatch(db)

      for (let parcela = 1; parcela <= numeroParcelas; parcela += 1) {
        const vencimentoParcela = adicionarMesesData(
          contaPagarForm.vencimento,
          parcela - 1,
        )

        const ref = doc(collection(db, 'contasPagar'))

        batch.set(ref, {
          ...dadosBase,
          vencimento: vencimentoParcela,
          dataPagamento:
            contaPagarForm.status === 'Paga' && parcela === 1
              ? contaPagarForm.dataPagamento || obterHojeISO()
              : '',
          status:
            contaPagarForm.status === 'Paga' && parcela === 1
              ? 'Paga'
              : 'Aberta',
          parcelaAtual: parcela,
          numeroParcelas,
          grupoParcelamentoId,
          descricao: `${contaPagarForm.descricao} - Parcela ${parcela}/${numeroParcelas}`,
          criadoEm: serverTimestamp(),
        })
      }

      await batch.commit()

      alert(`${numeroParcelas} parcelas cadastradas com sucesso!`)
    } else if (contaPagarForm.recorrente) {
      const grupoRecorrenciaId = crypto.randomUUID()
      const batch = writeBatch(db)
      const quantidadeMeses = 12

      for (let mes = 0; mes < quantidadeMeses; mes += 1) {
        const vencimentoRecorrente = adicionarMesesData(
          contaPagarForm.vencimento,
          mes,
        )

        const ref = doc(collection(db, 'contasPagar'))

        batch.set(ref, {
          ...dadosBase,
          vencimento: vencimentoRecorrente,
          dataPagamento:
            contaPagarForm.status === 'Paga' && mes === 0
              ? contaPagarForm.dataPagamento || obterHojeISO()
              : '',
          status:
            contaPagarForm.status === 'Paga' && mes === 0
              ? 'Paga'
              : 'Aberta',
          grupoRecorrenciaId,
          recorrenciaMes: mes + 1,
          criadoEm: serverTimestamp(),
        })
      }

      await batch.commit()

      alert('Despesa recorrente cadastrada para os próximos 12 meses!')
    } else {
      await addDoc(collection(db, 'contasPagar'), {
        ...dadosBase,
        vencimento: contaPagarForm.vencimento,
        dataPagamento:
          contaPagarForm.status === 'Paga'
            ? contaPagarForm.dataPagamento || obterHojeISO()
            : '',
        criadoEm: serverTimestamp(),
      })

      alert('Despesa cadastrada com sucesso!')
    }

    limparFormularioContaPagar()
    setFormContaPagarAberto(false)
    await carregarContasPagar()
  } catch (error) {
    alert('Erro ao salvar despesa.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarContaPagar(conta) {
  setAbaAtiva('financeiro')
  setModoFinanceiro('pagar')
  setEditandoContaPagarId(conta.id)
  setFormContaPagarAberto(true)

  setContaPagarForm({
    vencimento: conta.vencimento || '',
    dataPagamento: conta.dataPagamento || '',
    fornecedor: conta.fornecedor || '',
    categoria: conta.categoria || 'Despesas fixas',
    descricao: conta.descricao || '',
    valor:
      conta.valor || conta.valor === 0 ? String(conta.valor).replace('.', ',') : '',
    formaPagamento: conta.formaPagamento || 'Pix',
    contaBancariaId: conta.contaBancariaId || '',
    comprovante: conta.comprovante || '',
    comprovantePublicId: conta.comprovantePublicId || '',
    observacoes: conta.observacoes || '',
    status: conta.status || 'Aberta',
    ativo: conta.ativo !== false,
    recorrente: conta.recorrente === true,
    parcelada: conta.parcelada === true,
    numeroParcelas: conta.numeroParcelas ? String(conta.numeroParcelas) : '2',
  })
}

function cancelarEdicaoContaPagar() {
  fecharFormularioContaPagar()
}

async function marcarContaPagarComoPaga(conta) {
  const confirmar = confirm(
    `Deseja marcar "${conta.descricao}" como paga? A data de pagamento será registrada como hoje.`,
  )

  if (!confirmar) return

  try {
    await updateDoc(doc(db, 'contasPagar', conta.id), {
      status: 'Paga',
      dataPagamento: obterHojeISO(),
      ativo: true,
      atualizadoEm: serverTimestamp(),
    })

    await carregarContasPagar()
  } catch (error) {
    alert('Erro ao marcar despesa como paga.')
    console.error(error)
  }
}

async function reabrirContaPagar(conta) {
  const confirmar = confirm(`Deseja reabrir a despesa "${conta.descricao}"?`)

  if (!confirmar) return

  try {
    await updateDoc(doc(db, 'contasPagar', conta.id), {
      status: 'Aberta',
      dataPagamento: '',
      ativo: true,
      atualizadoEm: serverTimestamp(),
    })

    await carregarContasPagar()
  } catch (error) {
    alert('Erro ao reabrir despesa.')
    console.error(error)
  }
}

async function cancelarContaPagar(conta) {
  const confirmar = confirm(`Deseja cancelar a despesa "${conta.descricao}"?`)

  if (!confirmar) return

  try {
    await updateDoc(doc(db, 'contasPagar', conta.id), {
      status: 'Cancelada',
      ativo: false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarContasPagar()
  } catch (error) {
    alert('Erro ao cancelar despesa.')
    console.error(error)
  }
}

async function excluirContaPagar(id) {
  const confirmar = confirm('Deseja realmente excluir esta despesa?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'contasPagar', id))
    await carregarContasPagar()
  } catch (error) {
    alert('Erro ao excluir despesa.')
    console.error(error)
  }
}
async function carregarAprovisionamentos() {
  try {
    const q = query(collection(db, 'aprovisionamentos'), orderBy('data', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setAprovisionamentos(lista)
  } catch (error) {
    alert('Erro ao carregar aprovisionamentos.')
    console.error(error)
  }
}

function limparFormularioAprovisionamento() {
  setAprovisionamentoForm({
    data: '',
    previsaoUso: '',
    categoria: 'Reserva geral',
    descricao: '',
    valor: '',
    contaBancariaId: '',
    responsavel: '',
    observacoes: '',
    status: 'Reservado',
    ativo: true,
  })

  setEditandoAprovisionamentoId(null)
}

function abrirNovoAprovisionamento() {
  limparFormularioAprovisionamento()
  setFormAprovisionamentoAberto(true)
}

function fecharFormularioAprovisionamento() {
  limparFormularioAprovisionamento()
  setFormAprovisionamentoAberto(false)
}

async function salvarAprovisionamento(event) {
  event.preventDefault()

  if (!aprovisionamentoForm.data) {
    alert('Preencha a data da reserva.')
    return
  }

  if (!aprovisionamentoForm.descricao) {
    alert('Preencha a descrição da reserva.')
    return
  }

  if (!aprovisionamentoForm.valor) {
    alert('Preencha o valor reservado.')
    return
  }

  const valor = Number(String(aprovisionamentoForm.valor).replace(',', '.'))

  if (!valor || valor <= 0) {
    alert('Informe um valor válido.')
    return
  }

  setLoading(true)

  try {
    const contaSelecionada = contasBancarias.find(
      (conta) => conta.id === aprovisionamentoForm.contaBancariaId,
    )

    const dadosAprovisionamento = {
      data: aprovisionamentoForm.data,
      previsaoUso: aprovisionamentoForm.previsaoUso,
      categoria: aprovisionamentoForm.categoria,
      descricao: aprovisionamentoForm.descricao,
      valor,
      contaBancariaId: aprovisionamentoForm.contaBancariaId,
      contaBancariaNome: contaSelecionada?.nome || '',
      responsavel: aprovisionamentoForm.responsavel,
      observacoes: aprovisionamentoForm.observacoes,
      status: aprovisionamentoForm.status,
      ativo:
        aprovisionamentoForm.status === 'Cancelado'
          ? false
          : aprovisionamentoForm.ativo,
      atualizadoEm: serverTimestamp(),
    }

    if (editandoAprovisionamentoId) {
      await updateDoc(
        doc(db, 'aprovisionamentos', editandoAprovisionamentoId),
        dadosAprovisionamento,
      )

      alert('Aprovisionamento atualizado com sucesso!')
    } else {
      await addDoc(collection(db, 'aprovisionamentos'), {
        ...dadosAprovisionamento,
        criadoEm: serverTimestamp(),
      })

      alert('Aprovisionamento cadastrado com sucesso!')
    }

    limparFormularioAprovisionamento()
    setFormAprovisionamentoAberto(false)
    await carregarAprovisionamentos()
  } catch (error) {
    alert('Erro ao salvar aprovisionamento.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarAprovisionamento(item) {
  setAbaAtiva('financeiro')
  setModoFinanceiro('aprovisionamentos')
  setEditandoAprovisionamentoId(item.id)
  setFormAprovisionamentoAberto(true)

  setAprovisionamentoForm({
    data: item.data || '',
    previsaoUso: item.previsaoUso || '',
    categoria: item.categoria || 'Reserva geral',
    descricao: item.descricao || '',
    valor: item.valor || item.valor === 0 ? String(item.valor).replace('.', ',') : '',
    contaBancariaId: item.contaBancariaId || '',
    responsavel: item.responsavel || '',
    observacoes: item.observacoes || '',
    status: item.status || 'Reservado',
    ativo: item.ativo !== false,
  })
}

function cancelarEdicaoAprovisionamento() {
  fecharFormularioAprovisionamento()
}

async function marcarAprovisionamentoUtilizado(item) {
  const confirmar = confirm(
    `Deseja marcar "${item.descricao}" como utilizado?`,
  )

  if (!confirmar) return

  try {
    await updateDoc(doc(db, 'aprovisionamentos', item.id), {
      status: 'Utilizado',
      ativo: false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarAprovisionamentos()
  } catch (error) {
    alert('Erro ao marcar aprovisionamento como utilizado.')
    console.error(error)
  }
}

async function cancelarAprovisionamento(item) {
  const confirmar = confirm(
    `Deseja cancelar o aprovisionamento "${item.descricao}"?`,
  )

  if (!confirmar) return

  try {
    await updateDoc(doc(db, 'aprovisionamentos', item.id), {
      status: 'Cancelado',
      ativo: false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarAprovisionamentos()
  } catch (error) {
    alert('Erro ao cancelar aprovisionamento.')
    console.error(error)
  }
}

async function reativarAprovisionamento(item) {
  const confirmar = confirm(
    `Deseja reativar o aprovisionamento "${item.descricao}"?`,
  )

  if (!confirmar) return

  try {
    await updateDoc(doc(db, 'aprovisionamentos', item.id), {
      status: 'Reservado',
      ativo: true,
      atualizadoEm: serverTimestamp(),
    })

    await carregarAprovisionamentos()
  } catch (error) {
    alert('Erro ao reativar aprovisionamento.')
    console.error(error)
  }
}

async function excluirAprovisionamento(id) {
  const confirmar = confirm('Deseja realmente excluir este aprovisionamento?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'aprovisionamentos', id))
    await carregarAprovisionamentos()
  } catch (error) {
    alert('Erro ao excluir aprovisionamento.')
    console.error(error)
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
async function adicionarFotosAoEventoGaleria() {
  if (!galeriaForm.titulo) {
    alert('Preencha o título do álbum antes de salvar novas fotos.')
    return
  }

  if (imagensGaleria.length === 0) {
    alert('Selecione pelo menos uma foto para adicionar.')
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
        ? 'Foto adicionada ao álbum com sucesso!'
        : `${imagensGaleria.length} fotos adicionadas ao álbum com sucesso!`,
    )

    setImagensGaleria([])
    await carregarGaleria()
  } catch (error) {
    alert('Erro ao adicionar fotos ao álbum.')
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
const anosFinanceiro = Array.from(
  new Set([
    anoAtualFinanceiro,
    ...arrecadacoes.map((item) => obterAnoDaData(item.data)),
    ...contasPagar.map((item) => obterAnoDaData(item.vencimento)),
    ...contasPagar.map((item) => obterAnoDaData(item.dataPagamento)),
    ...aprovisionamentos.map((item) => obterAnoDaData(item.data)),
    ...aprovisionamentos.map((item) => obterAnoDaData(item.previsaoUso)),
  ].filter(Boolean)),
).sort((a, b) => Number(b) - Number(a))

function renderizarFiltroAnoFinanceiro() {
  return (
    <label className="finance-year-filter">
      Ano
      <select
        value={anoFiltroFinanceiro}
        onChange={(event) => setAnoFiltroFinanceiro(event.target.value)}
      >
        {anosFinanceiro.map((ano) => (
          <option value={ano} key={ano}>
            {ano}
          </option>
        ))}
      </select>
    </label>
  )
}
const arrecadacoesFiltradasFinanceiro = arrecadacoes.filter((arrecadacao) =>
  itemDentroDosMesesFinanceiro(arrecadacao.data),
)

const contasPagarFiltradasFinanceiro = contasPagar.filter(
  (conta) =>
    itemDentroDosMesesFinanceiro(conta.vencimento) &&
    contaPagarCorrespondeStatus(conta) &&
    contaPagarCorrespondeFornecedor(conta),
)

const arrecadacoesAtivas = arrecadacoesFiltradasFinanceiro.filter(
  (arrecadacao) => arrecadacao.ativo !== false,
)

const totalArrecadacoes = arrecadacoesAtivas.reduce(
  (total, arrecadacao) => total + Number(arrecadacao.valor || 0),
  0,
)

const contasPagarAtivas = contasPagarFiltradasFinanceiro.filter(
  (conta) => conta.status !== 'Cancelada' && conta.ativo !== false,
)

const contasPagarPagas = contasPagarAtivas.filter(
  (conta) => conta.status === 'Paga',
)

const contasPagarAbertas = contasPagarAtivas.filter(
  (conta) => conta.status !== 'Paga',
)

const contasPagarVencidas = contasPagarAbertas.filter(
  (conta) => conta.vencimento && conta.vencimento < obterHojeISO(),
)

const contasPagarVencemHoje = contasPagarAbertas.filter(
  (conta) => conta.vencimento === obterHojeISO(),
)

const contasPagarProximos7Dias = contasPagarAbertas.filter((conta) => {
  const dias = calcularDiasParaVencimento(conta.vencimento)

  return dias !== null && dias > 0 && dias <= 7
})

const totalContasPagas = contasPagarPagas.reduce(
  (total, conta) => total + Number(conta.valor || 0),
  0,
)

const totalContasAbertas = contasPagarAbertas.reduce(
  (total, conta) => total + Number(conta.valor || 0),
  0,
)
const resultadoPeriodoFinanceiro = totalArrecadacoes - totalContasPagas

const aprovisionamentosAtivos = aprovisionamentos.filter(
  (item) => item.ativo !== false && item.status === 'Reservado',
)

const totalAprovisionado = aprovisionamentosAtivos.reduce(
  (total, item) => total + Number(item.valor || 0),
  0,
)

const saldoFinanceiro =
  contasBancarias.reduce(
    (total, conta) => total + Number(conta.saldoInicial || 0),
    0,
  ) +
  totalArrecadacoes -
  totalContasPagas

const saldoDisponivel = saldoFinanceiro - totalAprovisionado

const saldosContasBancarias = contasBancarias.map((conta) => {
  const entradasConta = arrecadacoes
    .filter(
      (arrecadacao) =>
        arrecadacao.ativo !== false &&
        arrecadacao.contaBancariaId === conta.id,
    )
    .reduce((total, arrecadacao) => total + Number(arrecadacao.valor || 0), 0)

  const saidasConta = contasPagar
    .filter(
      (despesa) =>
        despesa.status === 'Paga' &&
        despesa.ativo !== false &&
        despesa.contaBancariaId === conta.id,
    )
    .reduce((total, despesa) => total + Number(despesa.valor || 0), 0)

  const saldoInicial = Number(conta.saldoInicial || 0)
  const saldoAtual = saldoInicial + entradasConta - saidasConta

  return {
    ...conta,
    saldoInicial,
    entradasConta,
    saidasConta,
    saldoAtual,
  }
})

const saldoTotalPorContas = saldosContasBancarias.reduce(
  (total, conta) => total + Number(conta.saldoAtual || 0),
  0,
)
const movimentacaoPorContaBancaria = [
  ...contasBancarias.map((conta) => {
    const entradas = arrecadacoesAtivas
      .filter((item) => item.contaBancariaId === conta.id)
      .reduce((total, item) => total + Number(item.valor || 0), 0)

    const despesasPagas = contasPagarPagas
      .filter((item) => item.contaBancariaId === conta.id)
      .reduce((total, item) => total + Number(item.valor || 0), 0)

    const despesasAbertas = contasPagarAbertas
      .filter((item) => item.contaBancariaId === conta.id)
      .reduce((total, item) => total + Number(item.valor || 0), 0)

    return {
      id: conta.id,
      nome: conta.nome || 'Conta sem nome',
      banco: conta.banco || conta.tipo || '',
      entradas,
      despesasPagas,
      despesasAbertas,
      resultado: entradas - despesasPagas,
    }
  }),

  {
    id: 'sem-conta',
    nome: 'Sem conta bancária',
    banco: 'Lançamentos sem conta vinculada',
    entradas: arrecadacoesAtivas
      .filter((item) => !item.contaBancariaId)
      .reduce((total, item) => total + Number(item.valor || 0), 0),
    despesasPagas: contasPagarPagas
      .filter((item) => !item.contaBancariaId)
      .reduce((total, item) => total + Number(item.valor || 0), 0),
    despesasAbertas: contasPagarAbertas
      .filter((item) => !item.contaBancariaId)
      .reduce((total, item) => total + Number(item.valor || 0), 0),
    resultado:
      arrecadacoesAtivas
        .filter((item) => !item.contaBancariaId)
        .reduce((total, item) => total + Number(item.valor || 0), 0) -
      contasPagarPagas
        .filter((item) => !item.contaBancariaId)
        .reduce((total, item) => total + Number(item.valor || 0), 0),
  },
].filter(
  (item) =>
    item.entradas > 0 || item.despesasPagas > 0 || item.despesasAbertas > 0,
)
const arrecadacoesPorTipo = tiposArrecadacao
  .map((tipo) => {
    const itens = arrecadacoesAtivas.filter((item) => item.tipo === tipo)

    const total = itens.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    )

    return {
      categoria: tipo,
      quantidade: itens.length,
      total,
    }
  })
  .filter((item) => item.quantidade > 0 || item.total > 0)

const despesasPorCategoria = categoriasContaPagar
  .map((categoria) => {
    const itens = contasPagarAtivas.filter((item) => item.categoria === categoria)
    const pagas = itens.filter((item) => item.status === 'Paga')
    const abertas = itens.filter((item) => item.status !== 'Paga')

    const total = itens.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    )

    const totalPago = pagas.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    )

    const totalAberto = abertas.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    )

    return {
      categoria,
      quantidade: itens.length,
      total,
      totalPago,
      totalAberto,
    }
  })
  .filter((item) => item.quantidade > 0 || item.total > 0)

const aprovisionamentosPorCategoria = categoriasAprovisionamento
  .map((categoria) => {
    const itens = aprovisionamentosAtivos.filter(
      (item) => item.categoria === categoria,
    )

    const total = itens.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    )

    return {
      categoria,
      quantidade: itens.length,
      total,
    }
  })
  .filter((item) => item.quantidade > 0 || item.total > 0)
const resumoFinanceiro = {
  contas: contasBancarias.length,
  contasAtivas: contasBancarias.filter((conta) => conta.ativo !== false).length,
  contasInativas: contasBancarias.filter((conta) => conta.ativo === false).length,
  saldoInicialTotal: contasBancarias.reduce(
    (total, conta) => total + Number(conta.saldoInicial || 0),
    0,
  ),
  arrecadacoes: arrecadacoesFiltradasFinanceiro.length,
  arrecadacoesAtivas: arrecadacoesAtivas.length,
  totalArrecadacoes,
    totalContasPagas,
  totalContasAbertas,
  resultadoPeriodoFinanceiro,
  saldoFinanceiro,
  totalAprovisionado,
  saldoDisponivel,
  aprovisionamentos: aprovisionamentos.length,
  aprovisionamentosAtivos: aprovisionamentosAtivos.length,
  saldoTotalPorContas,
  contasPagar: contasPagarFiltradasFinanceiro.length,
  contasPagarAbertas: contasPagarAbertas.length,
  contasPagarPagas: contasPagarPagas.length,
  contasPagarVencidas: contasPagarVencidas.length,
  contasPagarVencemHoje: contasPagarVencemHoje.length,
  contasPagarProximos7Dias: contasPagarProximos7Dias.length,
}
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

  if (typeof data === 'string') {
    const [ano, mes, dia] = data.split('-')

    if (!ano || !mes || !dia) return data

    return `${dia}/${mes}/${ano}`
  }

  if (data?.toDate) {
    return data.toDate().toLocaleDateString('pt-BR')
  }

  if (data instanceof Date) {
    return data.toLocaleDateString('pt-BR')
  }

  return ''
}
function renderizarUsuariosPermissoes() {
  const todasPermissoes = [
    { id: 'programacao', nome: 'Programação' },
    { id: 'eventos', nome: 'Eventos' },
    { id: 'oracao', nome: 'Pedidos de oração' },
    { id: 'midia', nome: 'Vídeos / Mídia' },
    { id: 'documentos', nome: 'Documentos' },
    { id: 'contribuicao', nome: 'Contribuição' },
    { id: 'financeiro', nome: 'Financeiro' },
    { id: 'galeria', nome: 'Galeria' },
    { id: 'membros', nome: 'Membros' },
    { id: 'localizacao', nome: 'Localização' },
    { id: 'usuarios', nome: 'Usuários' },
    { id: 'meusDados', nome: 'Meus dados' },
  ]

  return (
    <section className="users-permission-area">
      <div className="finance-table-toolbar finance-report-toolbar">
        <div>
          <span className="admin-section-label">Controle de acesso</span>

          <h2>Usuários e permissões</h2>

          <p>
            Crie o login do usuário e defina quais módulos ele poderá acessar no
            painel administrativo.
          </p>
        </div>
      </div>

      <div className="users-permission-grid">
        <form
  className="admin-card users-permission-form"
  onSubmit={salvarUsuarioPermissao}
  autoComplete="off"
>
          <span className="admin-section-label">
            {editandoUsuarioPermissaoId ? 'Editar usuário' : 'Novo usuário'}
          </span>

          <h2>
            {editandoUsuarioPermissaoId
              ? 'Editar permissões'
              : 'Criar usuário e permissão'}
          </h2>

          <p>
            O usuário será criado no Firebase Authentication e também salvo na
            coleção de permissões.
          </p>

          <label>
            Nome
            <input
  name="permissaoNomeUsuario"
  autoComplete="off"
  value={usuarioPermissaoForm.nome}
              onChange={(event) =>
                setUsuarioPermissaoForm((formAtual) => ({
                  ...formAtual,
                  nome: event.target.value,
                }))
              }
              placeholder="Nome completo"
            />
          </label>

          <label>
            E-mail
           <input
  type="email"
  name="permissaoEmailUsuario"
  autoComplete="new-password"
  value={usuarioPermissaoForm.email}
  disabled={Boolean(editandoUsuarioPermissaoId)}
              onChange={(event) =>
                setUsuarioPermissaoForm((formAtual) => ({
                  ...formAtual,
                  email: event.target.value,
                }))
              }
              placeholder="email@exemplo.com"
            />
          </label>

         {!editandoUsuarioPermissaoId && (
  <label className="finance-toggle-label">
    <input
      type="checkbox"
      checked={usuarioPermissaoForm.usuarioExistente}
      onChange={(event) =>
        setUsuarioPermissaoForm((formAtual) => ({
          ...formAtual,
          usuarioExistente: event.target.checked,
          senha: event.target.checked ? '' : formAtual.senha,
        }))
      }
    />
    <span>Usuário já existe no Firebase Authentication</span>
  </label>
)}

{!editandoUsuarioPermissaoId && usuarioPermissaoForm.usuarioExistente && (
  <label>
    UID do usuário existente
    <input
  name="permissaoUidUsuario"
  autoComplete="off"
  value={usuarioPermissaoForm.uid}
      onChange={(event) =>
        setUsuarioPermissaoForm((formAtual) => ({
          ...formAtual,
          uid: event.target.value,
        }))
      }
      placeholder="Cole aqui o UID do Firebase Authentication"
    />
  </label>
)}

{!editandoUsuarioPermissaoId && !usuarioPermissaoForm.usuarioExistente && (
  <label>
    Senha inicial
    <input
  type="password"
  name="permissaoSenhaInicial"
  autoComplete="new-password"
  value={usuarioPermissaoForm.senha}
      onChange={(event) =>
        setUsuarioPermissaoForm((formAtual) => ({
          ...formAtual,
          senha: event.target.value,
        }))
      }
      placeholder="Mínimo 6 caracteres"
    />
  </label>
)}

{editandoUsuarioPermissaoId && (
  <label>
    UID
    <input value={usuarioPermissaoForm.uid} disabled />
  </label>
)}

          <label>
            Perfil
            <select
              value={usuarioPermissaoForm.perfil}
              onChange={(event) =>
                atualizarPerfilUsuarioPermissao(event.target.value)
              }
            >
              {Object.entries(PERFIS_USUARIOS).map(([valor, nome]) => (
                <option value={valor} key={valor}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Membro vinculado
            <select
              value={usuarioPermissaoForm.membroId}
              onChange={(event) =>
                setUsuarioPermissaoForm((formAtual) => ({
                  ...formAtual,
                  membroId: event.target.value,
                }))
              }
            >
              <option value="">Nenhum membro vinculado</option>

              {membros.map((membro) => (
                <option value={membro.id} key={membro.id}>
                  {membro.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-toggle-label">
            <input
              type="checkbox"
              checked={usuarioPermissaoForm.ativo}
              onChange={(event) =>
                setUsuarioPermissaoForm((formAtual) => ({
                  ...formAtual,
                  ativo: event.target.checked,
                }))
              }
            />
            <span>Usuário ativo</span>
          </label>

          <div className="users-permission-options">
            <strong>Permissões liberadas</strong>

            <div>
              {todasPermissoes.map((permissao) => (
                <label key={permissao.id}>
                  <input
                    type="checkbox"
                    checked={usuarioPermissaoForm.permissoes.includes(
                      permissao.id,
                    )}
                    onChange={() => alternarPermissaoUsuario(permissao.id)}
                  />
                  <span>{permissao.nome}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="finance-modal-actions">
            <button type="submit" disabled={criandoUsuarioAuth}>
              {criandoUsuarioAuth
                ? 'Salvando...'
                : editandoUsuarioPermissaoId
                  ? 'Salvar permissões'
                  : 'Criar usuário'}
            </button>

            {editandoUsuarioPermissaoId && (
              <button
                type="button"
                className="cancel-button"
                onClick={limparFormularioUsuarioPermissao}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>

        <section className="admin-card users-permission-list-card">
          <span className="admin-section-label">Usuários cadastrados</span>

          <h2>Lista de acessos</h2>

          <p>
            Usuários ativos conseguem acessar somente os módulos liberados.
          </p>

          <div className="users-permission-list">
            {usuariosPermissoes.length === 0 && (
              <div className="finance-empty-state">
                <strong>Nenhum usuário cadastrado.</strong>
                <p>Crie o primeiro acesso pelo formulário ao lado.</p>
              </div>
            )}

            {usuariosPermissoes.map((usuarioPermissao) => (
              <article
                className="users-permission-item"
                key={usuarioPermissao.id}
              >
                <div>
                  <span>
                    {PERFIS_USUARIOS[usuarioPermissao.perfil] ||
                      usuarioPermissao.perfil}
                  </span>

                  <strong>{usuarioPermissao.nome}</strong>

                  <p>{usuarioPermissao.email}</p>

                  <small>
                    UID: {usuarioPermissao.uid || usuarioPermissao.id}
                  </small>

                  <small>
                    Permissões:{' '}
                    {(usuarioPermissao.permissoes || []).join(', ') ||
                      'Nenhuma'}
                  </small>

                  <em
                    className={
                      usuarioPermissao.ativo === false
                        ? 'users-status inactive'
                        : 'users-status active'
                    }
                  >
                    {usuarioPermissao.ativo === false ? 'Inativo' : 'Ativo'}
                  </em>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => editarUsuarioPermissao(usuarioPermissao)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className={
                      usuarioPermissao.ativo === false
                        ? 'activate-button'
                        : 'deactivate-button'
                    }
                    onClick={() =>
                      alternarStatusUsuarioPermissao(usuarioPermissao)
                    }
                  >
                    {usuarioPermissao.ativo === false ? 'Ativar' : 'Inativar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
  if (checkingAuth) {
    return (
      <main className="admin-page">
        <p>Carregando...</p>
      </main>
    )
  }
function formatarMoeda(valor) {
  const numero = Number(valor || 0)

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
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

   <nav className="admin-tabs admin-tabs-grouped">
  {usuarioPodeAcessar('programacao') && (
    <button
      type="button"
      className={abaAtiva === 'programacao' ? 'active' : ''}
      onClick={() => setAbaAtiva('programacao')}
    >
      Programação
    </button>
  )}

  {usuarioPodeAcessar('oracao') && (
    <button
      type="button"
      className={abaAtiva === 'oracao' ? 'active' : ''}
      onClick={() => setAbaAtiva('oracao')}
    >
      Oração
    </button>
  )}

  {usuarioPodeAcessar('membros') && (
    <button
      type="button"
      className={abaAtiva === 'membros' ? 'active' : ''}
      onClick={() => setAbaAtiva('membros')}
    >
      Membros
    </button>
  )}

  {usuarioPodeAcessar('localizacao') && (
    <button
      type="button"
      className={abaAtiva === 'localizacao' ? 'active' : ''}
      onClick={() => setAbaAtiva('localizacao')}
    >
      Localização
    </button>
  )}

  {(usuarioPodeAcessar('midia') ||
    usuarioPodeAcessar('galeria') ||
    usuarioPodeAcessar('eventos')) && (
    <div
      className={
        ['midia', 'galeria', 'eventos'].includes(abaAtiva)
          ? 'admin-tab-group active'
          : 'admin-tab-group'
      }
    >
      <button type="button">
        Mídia
        <span>▾</span>
      </button>

      <div className="admin-submenu">
        {usuarioPodeAcessar('midia') && (
          <button
            type="button"
            className={abaAtiva === 'midia' ? 'active' : ''}
            onClick={() => setAbaAtiva('midia')}
          >
            Vídeos
          </button>
        )}

        {usuarioPodeAcessar('galeria') && (
          <button
            type="button"
            className={abaAtiva === 'galeria' ? 'active' : ''}
            onClick={() => setAbaAtiva('galeria')}
          >
            Galeria
          </button>
        )}

        {usuarioPodeAcessar('eventos') && (
          <button
            type="button"
            className={abaAtiva === 'eventos' ? 'active' : ''}
            onClick={() => setAbaAtiva('eventos')}
          >
            Eventos
          </button>
        )}
      </div>
    </div>
  )}

  {(usuarioPodeAcessar('financeiro') ||
    usuarioPodeAcessar('contribuicao')) && (
    <div
      className={
        ['financeiro', 'contribuicao'].includes(abaAtiva)
          ? 'admin-tab-group active'
          : 'admin-tab-group'
      }
    >
      <button type="button">
        Financeiro
        <span>▾</span>
      </button>

      <div className="admin-submenu">
        {usuarioPodeAcessar('financeiro') && (
          <button
            type="button"
            className={abaAtiva === 'financeiro' ? 'active' : ''}
            onClick={() => setAbaAtiva('financeiro')}
          >
            Gestão financeira
          </button>
        )}

        {usuarioPodeAcessar('contribuicao') && (
          <button
            type="button"
            className={abaAtiva === 'contribuicao' ? 'active' : ''}
            onClick={() => setAbaAtiva('contribuicao')}
          >
            Contribuição
          </button>
        )}
      </div>
    </div>
  )}

  {usuarioPodeAcessar('usuarios') && (
    <button
      type="button"
      className={abaAtiva === 'usuarios' ? 'active' : ''}
      onClick={() => setAbaAtiva('usuarios')}
    >
      Permissões
    </button>
  )}
</nav>

      {abaAtiva === 'programacao' && usuarioPodeAcessar('programacao') && (
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

      {abaAtiva === 'eventos' && usuarioPodeAcessar('eventos') && (
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

{abaAtiva === 'oracao' && usuarioPodeAcessar('oracao') && (
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

      {abaAtiva === 'midia' && usuarioPodeAcessar('midia') && (
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

      {abaAtiva === 'documentos' && usuarioPodeAcessar('documentos') && (
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
{abaAtiva === 'contribuicao' && usuarioPodeAcessar('contribuicao') && (
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
{abaAtiva === 'financeiro' && usuarioPodeAcessar('financeiro') && (
  <section className="finance-admin-area">
    <div className="finance-header-card">
      <div>
        <span className="admin-section-label">Financeiro</span>

        <h2>Gestão financeira da igreja</h2>

        <p>
          Controle contas bancárias, arrecadações, contas a pagar,
          aprovisionamentos e relatórios financeiros.
        </p>
      </div>
    </div>

    <div className="finance-mode-actions">
      <button
        type="button"
        className={modoFinanceiro === 'dashboard' ? 'active' : ''}
        onClick={() => setModoFinanceiro('dashboard')}
      >
        <span>📊</span>
        Dashboard
      </button>

      <button
        type="button"
        className={modoFinanceiro === 'contas' ? 'active' : ''}
        onClick={() => setModoFinanceiro('contas')}
      >
        <span>🏦</span>
        Contas bancárias
      </button>

      <button
        type="button"
        className={modoFinanceiro === 'arrecadacoes' ? 'active' : ''}
        onClick={() => setModoFinanceiro('arrecadacoes')}
      >
        <span>💚</span>
        Arrecadações
      </button>

      <button
        type="button"
        className={modoFinanceiro === 'pagar' ? 'active' : ''}
        onClick={() => setModoFinanceiro('pagar')}
      >
        <span>📄</span>
        Contas a pagar
      </button>

      <button
        type="button"
        className={modoFinanceiro === 'aprovisionamentos' ? 'active' : ''}
        onClick={() => setModoFinanceiro('aprovisionamentos')}
      >
        <span>🗂</span>
        Aprovisionamentos
      </button>

      <button
        type="button"
        className={modoFinanceiro === 'relatorios' ? 'active' : ''}
        onClick={() => setModoFinanceiro('relatorios')}
      >
        <span>📑</span>
        Relatórios
      </button>
    </div>

    {modoFinanceiro === 'dashboard' && (
      <section className="finance-dashboard">
       <div className="finance-summary-grid">
    <article>
    <span>Saldo disponível</span>
    <strong>{formatarMoeda(resumoFinanceiro.saldoDisponivel)}</strong>
  </article>

  <article>
    <span>Saldo financeiro</span>
    <strong>{formatarMoeda(resumoFinanceiro.saldoFinanceiro)}</strong>
  </article>

        <article>
        <span>Total arrecadado</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalArrecadacoes)}</strong>
      </article>

      <article>
        <span>Resultado período</span>
        <strong>{formatarMoeda(resumoFinanceiro.resultadoPeriodoFinanceiro)}</strong>
      </article>

      <article>
        <span>Contas pagas</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalContasPagas)}</strong>
      </article>

  <article>
    <span>Contas em aberto</span>
    <strong>{formatarMoeda(resumoFinanceiro.totalContasAbertas)}</strong>
  </article>
  <article>
    <span>Aprovisionado</span>
    <strong>{formatarMoeda(resumoFinanceiro.totalAprovisionado)}</strong>
  </article>

  <article>
    <span>Vencidas</span>
    <strong>{resumoFinanceiro.contasPagarVencidas}</strong>
  </article>

  <article>
    <span>Vencem hoje</span>
    <strong>{resumoFinanceiro.contasPagarVencemHoje}</strong>
  </article>

  <article>
    <span>Próximos 7 dias</span>
    <strong>{resumoFinanceiro.contasPagarProximos7Dias}</strong>
  </article>

  <article>
    <span>Contas bancárias</span>
    <strong>{resumoFinanceiro.contas}</strong>
  </article>
</div>

        <div className="finance-dashboard-grid">
          <section className="admin-card">
            <span className="admin-section-label">Resumo</span>

            <h2>Visão geral</h2>

            <p>
              Este painel será ampliado nas próximas etapas com entradas,
              saídas, contas vencidas, contas pagas e aprovisionamentos.
            </p>

            <div className="finance-empty-state">
              <strong>Próximo passo</strong>
              <p>
                Depois das contas bancárias, vamos cadastrar arrecadações,
                contas a pagar e reservas financeiras.
              </p>
            </div>
          </section>

                   <section className="admin-card finance-account-balance-card">
            <span className="admin-section-label">Contas</span>

            <div className="finance-account-balance-header">
              <div>
                <h2>Saldo por conta</h2>
                <p>Saldo inicial + arrecadações - despesas pagas.</p>
              </div>

              <strong
                className={
                  saldoTotalPorContas < 0
                    ? 'finance-balance-total negative'
                    : 'finance-balance-total'
                }
              >
                {formatarMoeda(saldoTotalPorContas)}
              </strong>
            </div>

            <div className="finance-account-mini-list finance-account-balance-list">
              {saldosContasBancarias.length === 0 && (
                <p>Nenhuma conta bancária cadastrada ainda.</p>
              )}

              {saldosContasBancarias.map((conta) => (
                <article
                  className={`finance-account-balance-item ${
                    conta.ativo === false ? 'inactive-item' : ''
                  } ${conta.saldoAtual < 0 ? 'negative' : ''}`}
                  key={conta.id}
                >
                  <div>
                    <strong>{conta.nome}</strong>
                    <small>{conta.banco || conta.tipo}</small>

                    <div className="finance-account-flow">
                      <span>Inicial: {formatarMoeda(conta.saldoInicial)}</span>
                      <span>Entradas: {formatarMoeda(conta.entradasConta)}</span>
                      <span>Saídas: {formatarMoeda(conta.saidasConta)}</span>
                    </div>
                  </div>

                  <section>
                    <small>Saldo atual</small>
                    <strong>{formatarMoeda(conta.saldoAtual)}</strong>
                  </section>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    )}

    {modoFinanceiro === 'contas' && (
      <section className="admin-grid admin-events-grid finance-bank-area">
        <form className="admin-card finance-bank-form" onSubmit={salvarContaBancaria}>
          <span className="admin-section-label">Contas bancárias</span>

          <h2>
            {editandoContaBancariaId
              ? 'Editar conta bancária'
              : 'Cadastrar conta bancária'}
          </h2>

          <p>
            Cadastre as contas usadas pela igreja, incluindo conta corrente,
            Pix, caixa interno ou poupança.
          </p>

          <label>
            Nome da conta
            <input
              value={contaBancariaForm.nome}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  nome: event.target.value,
                })
              }
              placeholder="Ex: Conta principal, Caixa da igreja, Pix oficial"
            />
          </label>

          <label>
            Banco
            <input
              value={contaBancariaForm.banco}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  banco: event.target.value,
                })
              }
              placeholder="Ex: Bradesco, Caixa, Nubank"
            />
          </label>

          <label>
            Agência
            <input
              value={contaBancariaForm.agencia}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  agencia: event.target.value,
                })
              }
              placeholder="Ex: 0001"
            />
          </label>

          <label>
            Conta
            <input
              value={contaBancariaForm.conta}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  conta: event.target.value,
                })
              }
              placeholder="Ex: 12345-6"
            />
          </label>

          <label>
            Tipo
            <select
              value={contaBancariaForm.tipo}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  tipo: event.target.value,
                })
              }
            >
              {tiposContaBancaria.map((tipo) => (
                <option value={tipo} key={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label>
            Saldo inicial
            <input
              value={contaBancariaForm.saldoInicial}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  saldoInicial: event.target.value,
                })
              }
              placeholder="Ex: 1500,00"
            />
          </label>

          <label>
            Observações
            <textarea
              value={contaBancariaForm.observacoes}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  observacoes: event.target.value,
                })
              }
              placeholder="Observações internas sobre esta conta"
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={contaBancariaForm.ativo}
              onChange={(event) =>
                setContaBancariaForm({
                  ...contaBancariaForm,
                  ativo: event.target.checked,
                })
              }
            />
            Conta ativa
          </label>

          <button type="submit" disabled={loading}>
            {loading
              ? 'Salvando...'
              : editandoContaBancariaId
                ? 'Salvar alterações'
                : 'Salvar conta bancária'}
          </button>

          {editandoContaBancariaId && (
            <button
              type="button"
              className="cancel-button"
              onClick={cancelarEdicaoContaBancaria}
            >
              Cancelar edição
            </button>
          )}
        </form>

        <section className="admin-card finance-bank-list-card">
          <span className="admin-section-label">Contas cadastradas</span>

          <h2>Contas bancárias</h2>

          <p>
            Lista de contas usadas na gestão financeira da igreja.
          </p>

          <div className="finance-bank-list">
            {contasBancarias.length === 0 && (
              <p>Nenhuma conta bancária cadastrada ainda.</p>
            )}

            {contasBancarias.map((conta) => (
              <article
                className={`finance-bank-item ${
                  conta.ativo === false ? 'inactive-item' : ''
                }`}
                key={conta.id}
              >
                <div className="finance-bank-icon">🏦</div>

                <div>
                  <span>{conta.tipo}</span>
                  <strong>{conta.nome}</strong>

                  {conta.banco && <p>{conta.banco}</p>}

                  <small>
                    {conta.agencia && <>Agência: {conta.agencia} · </>}
                    {conta.conta && <>Conta: {conta.conta}</>}
                  </small>

                  <em>{conta.ativo === false ? 'Inativa' : 'Ativa'}</em>
                </div>

                <div className="finance-bank-balance">
                  <small>Saldo inicial</small>
                  <strong>{formatarMoeda(conta.saldoInicial)}</strong>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => editarContaBancaria(conta)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className={
                      conta.ativo === false ? 'activate-button' : 'deactivate-button'
                    }
                    onClick={() => alternarStatusContaBancaria(conta)}
                  >
                    {conta.ativo === false ? 'Ativar' : 'Inativar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => excluirContaBancaria(conta.id)}
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

  {modoFinanceiro === 'arrecadacoes' && (
  <section className="finance-table-module">
    <div className="finance-table-toolbar finance-payments-toolbar">
      <div>
        <span className="admin-section-label">Arrecadações</span>

        <h2>Entradas financeiras</h2>

        <p>
          Controle dízimos, ofertas, campanhas, doações, eventos e demais entradas.
        </p>
      </div>

      <button
        type="button"
        className="finance-primary-action"
        onClick={abrirNovaArrecadacao}
      >
        + Nova arrecadação
      </button>
    </div>
   <div className="finance-premium-filters">
  <div className="finance-filter-header">
    {renderizarFiltroAnoFinanceiro()}
  </div>

  <div className="finance-month-filter">
        <button
          type="button"
          className={
            mesesFiltroFinanceiro.length === mesesFinanceiro.length
              ? 'active'
              : ''
          }
          onClick={selecionarTodosMesesFinanceiro}
        >
          Todos os meses
        </button>

        {mesesFinanceiro.map((mes) => (
          <button
            type="button"
            className={mesesFiltroFinanceiro.includes(mes.valor) ? 'active' : ''}
            onClick={() => alternarMesFiltroFinanceiro(mes.valor)}
            key={mes.valor}
          >
            {mes.nome}
          </button>
        ))}
      </div>
    </div>
    <div className="finance-table-summary">
      <article>
        <span>Total ativo</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalArrecadacoes)}</strong>
      </article>

      <article>
        <span>Lançamentos</span>
        <strong>{arrecadacoesFiltradasFinanceiro.length}</strong>
      </article>

      <article>
        <span>Ativos</span>
        <strong>{resumoFinanceiro.arrecadacoesAtivas}</strong>
      </article>

      <article>
        <span>Cancelados</span>
        <strong>
                    {
            arrecadacoesFiltradasFinanceiro.filter(
              (arrecadacao) => arrecadacao.ativo === false,
            ).length
          }
        </strong>
      </article>
    </div>
    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Relação de arrecadações</strong>

        <small>Clique em uma linha para editar</small>
      </div>

      <div className="finance-table-scroll">
        <table className="finance-spreadsheet-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Forma</th>
              <th>Conta</th>
              <th>Responsável</th>
              <th>Status</th>
              <th className="finance-money-column">Valor</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
           {arrecadacoesFiltradasFinanceiro.length === 0 && (
              <tr>
                <td colSpan="9" className="finance-empty-table">
                  Nenhuma arrecadação cadastrada ainda.
                </td>
              </tr>
            )}

            {arrecadacoesFiltradasFinanceiro.map((arrecadacao) => (
              <tr
                key={arrecadacao.id}
                className={arrecadacao.ativo === false ? 'finance-row-canceled' : ''}
                onClick={() => editarArrecadacao(arrecadacao)}
              >
                <td>{formatarData(arrecadacao.data)}</td>
                <td>{arrecadacao.tipo}</td>
                <td>
                  <strong>{arrecadacao.descricao}</strong>

                  {arrecadacao.observacoes && (
                    <small>{arrecadacao.observacoes}</small>
                  )}

                  {arrecadacao.comprovante && (
                    <small>
                      <a
                        href={arrecadacao.comprovante}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Abrir comprovante
                      </a>
                    </small>
                  )}
                </td>
                <td>{arrecadacao.formaPagamento}</td>
                <td>{arrecadacao.contaBancariaNome || '-'}</td>
                <td>{arrecadacao.responsavel || '-'}</td>
                <td>
                  <span
                    className={
                      arrecadacao.ativo === false
                        ? 'finance-status canceled'
                        : 'finance-status active'
                    }
                  >
                    {arrecadacao.ativo === false ? 'Cancelada' : 'Ativa'}
                  </span>
                </td>
                <td className="finance-money-column">
                  {formatarMoeda(arrecadacao.valor)}
                </td>
                <td>
                  <div className="finance-table-actions">
                    <button
                      type="button"
                      className="edit-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        editarArrecadacao(arrecadacao)
                      }}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={
                        arrecadacao.ativo === false
                          ? 'activate-button'
                          : 'deactivate-button'
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        alternarStatusArrecadacao(arrecadacao)
                      }}
                    >
                      {arrecadacao.ativo === false ? 'Reativar' : 'Cancelar'}
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        excluirArrecadacao(arrecadacao.id)
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {formArrecadacaoAberto && (
      <div className="finance-modal-backdrop">
        <section className="finance-modal-card">
          <div className="finance-modal-header">
            <div>
              <span className="admin-section-label">Arrecadações</span>

              <h2>
                {editandoArrecadacaoId
                  ? 'Editar arrecadação'
                  : 'Nova arrecadação'}
              </h2>
            </div>

            <button
              type="button"
              className="finance-modal-close"
              onClick={fecharFormularioArrecadacao}
            >
              ×
            </button>
          </div>

          <form className="finance-modal-form" onSubmit={salvarArrecadacao}>
            <div className="finance-form-grid">
              <label>
                Data
                <input
                  type="date"
                  value={arrecadacaoForm.data}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      data: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Tipo
                <select
                  value={arrecadacaoForm.tipo}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      tipo: event.target.value,
                    })
                  }
                >
                  {tiposArrecadacao.map((tipo) => (
                    <option value={tipo} key={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Valor
                <input
                  value={arrecadacaoForm.valor}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      valor: event.target.value,
                    })
                  }
                  placeholder="Ex: 250,00"
                />
              </label>

              <label>
                Forma de pagamento
                <select
                  value={arrecadacaoForm.formaPagamento}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      formaPagamento: event.target.value,
                    })
                  }
                >
                  {formasPagamentoFinanceiro.map((forma) => (
                    <option value={forma} key={forma}>
                      {forma}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Descrição
              <input
                value={arrecadacaoForm.descricao}
                onChange={(event) =>
                  setArrecadacaoForm({
                    ...arrecadacaoForm,
                    descricao: event.target.value,
                  })
                }
                placeholder="Ex: Dízimo culto domingo, oferta missionária"
              />
            </label>

            <div className="finance-form-grid">
                           <label>
                Conta bancária destino
                <select
                  value={arrecadacaoForm.contaBancariaId}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      contaBancariaId: event.target.value,
                    })
                  }
                >
                  <option value="">Não informar</option>

                  {contasBancarias
                    .filter((conta) => conta.ativo !== false)
                    .map((conta) => (
                      <option value={conta.id} key={conta.id}>
                        {conta.nome} {conta.banco ? `- ${conta.banco}` : ''}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Responsável
                <input
                  value={arrecadacaoForm.responsavel}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      responsavel: event.target.value,
                    })
                  }
                  placeholder="Quem lançou"
                />
              </label>
            </div>

            <label>
              Comprovante
              <input
                type="file"
                onChange={enviarComprovanteArrecadacao}
                disabled={enviandoComprovanteArrecadacao}
              />
            </label>

            {enviandoComprovanteArrecadacao && <p>Enviando comprovante...</p>}

            {arrecadacaoForm.comprovante && (
              <a
                className="admin-file-link"
                href={arrecadacaoForm.comprovante}
                target="_blank"
                rel="noreferrer"
              >
                Abrir comprovante enviado
              </a>
            )}

            <label>
              Observações
              <textarea
                value={arrecadacaoForm.observacoes}
                onChange={(event) =>
                  setArrecadacaoForm({
                    ...arrecadacaoForm,
                    observacoes: event.target.value,
                  })
                }
                placeholder="Observações internas"
              />
            </label>

                      <div className="finance-toggle-row">
              <label className="finance-toggle-label">
                <input
                  type="checkbox"
                  checked={arrecadacaoForm.ativo}
                  onChange={(event) =>
                    setArrecadacaoForm({
                      ...arrecadacaoForm,
                      ativo: event.target.checked,
                    })
                  }
                />
                <span>Lançamento ativo</span>
              </label>
            </div>

            <div className="finance-modal-actions">
              <button
                type="submit"
                disabled={loading || enviandoComprovanteArrecadacao}
              >
                {loading
                  ? 'Salvando...'
                  : editandoArrecadacaoId
                    ? 'Salvar alterações'
                    : 'Salvar arrecadação'}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={cancelarEdicaoArrecadacao}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      </div>
    )}
  </section>
)}

    {modoFinanceiro === 'pagar' && (
  <section className="finance-table-module">
    <div className="finance-table-toolbar">
      <div>
        <span className="admin-section-label">Contas a pagar</span>

        <h2>Despesas e pagamentos</h2>

        <p>
          Controle despesas, vencimentos, recorrências, parcelamentos e pagamentos.
        </p>
      </div>

      <button
        type="button"
        className="finance-primary-action"
        onClick={abrirNovaContaPagar}
      >
        + Nova despesa
      </button>
    </div>

    <div className="finance-premium-filters finance-payments-filters">
  <div className="finance-filter-header">
    {renderizarFiltroAnoFinanceiro()}
  </div>

  <div className="finance-month-filter">
        <button
          type="button"
          className={
            mesesFiltroFinanceiro.length === mesesFinanceiro.length
              ? 'active'
              : ''
          }
          onClick={selecionarTodosMesesFinanceiro}
        >
          Todos os meses
        </button>

        {mesesFinanceiro.map((mes) => (
          <button
            type="button"
            className={mesesFiltroFinanceiro.includes(mes.valor) ? 'active' : ''}
            onClick={() => alternarMesFiltroFinanceiro(mes.valor)}
            key={mes.valor}
          >
            {mes.nome}
          </button>
        ))}
      </div>

      <div className="finance-extra-filters">
        <label>
          Status
          <select
            value={statusFiltroContaPagar}
            onChange={(event) => setStatusFiltroContaPagar(event.target.value)}
          >
            <option value="Todas">Todas</option>
            <option value="Paga">Paga</option>
            <option value="A pagar">A pagar</option>
          </select>
        </label>

        <label>
          Fornecedor
          <input
            value={fornecedorFiltroContaPagar}
            onChange={(event) => setFornecedorFiltroContaPagar(event.target.value)}
            placeholder="Buscar fornecedor"
          />
        </label>
      </div>
    </div>
    <div className="finance-table-summary finance-alert-summary">
      <article>
        <span>Em aberto</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalContasAbertas)}</strong>
      </article>

      <article>
        <span>Pagas</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalContasPagas)}</strong>
      </article>

      <article className={resumoFinanceiro.contasPagarVencidas > 0 ? 'danger' : ''}>
        <span>Vencidas</span>
        <strong>{resumoFinanceiro.contasPagarVencidas}</strong>
      </article>

      <article className={resumoFinanceiro.contasPagarVencemHoje > 0 ? 'warning' : ''}>
        <span>Vencem hoje</span>
        <strong>{resumoFinanceiro.contasPagarVencemHoje}</strong>
      </article>
    </div>
    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Relação de contas a pagar</strong>
        <small>Clique em uma linha para editar</small>
      </div>

      <div className="finance-table-scroll">
        <table className="finance-spreadsheet-table">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Pagamento</th>
              <th>Fornecedor</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Forma</th>
              <th>Conta</th>
              <th>Status</th>
              <th className="finance-money-column">Valor</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
             {contasPagarFiltradasFinanceiro.length === 0 && (
              <tr>
                <td colSpan="10" className="finance-empty-table">
                  Nenhuma despesa cadastrada ainda.
                </td>
              </tr>
            )}

             {contasPagarFiltradasFinanceiro.map((conta) => {
              const statusVisual = obterStatusVisualContaPagar(conta)
              const diasVencimento = calcularDiasParaVencimento(conta.vencimento)

              return (
                <tr
                  key={conta.id}
                  className={
                    statusVisual === 'Vencida'
                      ? 'finance-row-overdue'
                      : statusVisual === 'Paga'
                        ? 'finance-row-paid'
                        : statusVisual === 'Cancelada'
                          ? 'finance-row-canceled'
                          : ''
                  }
                  onClick={() => editarContaPagar(conta)}
                >
                  <td>
                    {formatarData(conta.vencimento)}

                    {statusVisual === 'Vencida' && (
                      <small className="finance-alert-text">Vencida</small>
                    )}

                    {statusVisual === 'Vence hoje' && (
                      <small className="finance-warning-text">Vence hoje</small>
                    )}

                    {diasVencimento !== null &&
                      diasVencimento > 0 &&
                      diasVencimento <= 7 && (
                        <small className="finance-warning-text">
                          Vence em {diasVencimento} dia
                          {diasVencimento > 1 ? 's' : ''}
                        </small>
                      )}
                  </td>

                  <td>
                    {conta.dataPagamento ? formatarData(conta.dataPagamento) : '-'}
                  </td>

                  <td>{conta.fornecedor || '-'}</td>
                  <td>{conta.categoria}</td>

                  <td>
                    <strong>{conta.descricao}</strong>

                    {conta.parcelada && (
                      <small>
                        Parcela {conta.parcelaAtual || 1}/{conta.numeroParcelas}
                      </small>
                    )}

                    {conta.recorrente && !conta.parcelada && (
                      <small>Despesa recorrente mensal</small>
                    )}

                    {conta.observacoes && <small>{conta.observacoes}</small>}

                    {conta.comprovante && (
                      <small>
                        <a
                          href={conta.comprovante}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Abrir comprovante
                        </a>
                      </small>
                    )}
                  </td>

                  <td>{conta.formaPagamento}</td>
                  <td>{conta.contaBancariaNome || '-'}</td>

                  <td>
                    <span
                      className={
                        statusVisual === 'Paga'
                          ? 'finance-status paid'
                          : statusVisual === 'Vencida'
                            ? 'finance-status overdue'
                            : statusVisual === 'Cancelada'
                              ? 'finance-status canceled'
                              : statusVisual === 'Vence hoje'
                                ? 'finance-status warning'
                                : 'finance-status open'
                      }
                    >
                      {statusVisual}
                    </span>
                  </td>

                  <td className="finance-money-column">
                    {formatarMoeda(conta.valor)}
                  </td>

                  <td>
                    <div className="finance-table-actions">
                      {conta.status !== 'Paga' && conta.status !== 'Cancelada' && (
                        <button
                          type="button"
                          className="activate-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            marcarContaPagarComoPaga(conta)
                          }}
                        >
                          Pagar
                        </button>
                      )}

                      {conta.status === 'Paga' && (
                        <button
                          type="button"
                          className="deactivate-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            reabrirContaPagar(conta)
                          }}
                        >
                          Reabrir
                        </button>
                      )}

                      <button
                        type="button"
                        className="edit-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          editarContaPagar(conta)
                        }}
                      >
                        Editar
                      </button>

                      {conta.status !== 'Cancelada' && (
                        <button
                          type="button"
                          className="deactivate-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            cancelarContaPagar(conta)
                          }}
                        >
                          Cancelar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          excluirContaPagar(conta.id)
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>

    {formContaPagarAberto && (
      <div className="finance-modal-backdrop">
        <section className="finance-modal-card">
          <div className="finance-modal-header">
            <div>
              <span className="admin-section-label">Contas a pagar</span>

              <h2>
                {editandoContaPagarId ? 'Editar despesa' : 'Nova despesa'}
              </h2>
            </div>

            <button
              type="button"
              className="finance-modal-close"
              onClick={fecharFormularioContaPagar}
            >
              ×
            </button>
          </div>

          <form className="finance-modal-form" onSubmit={salvarContaPagar}>
            <div className="finance-form-grid">
              <label>
                Vencimento
                <input
                  type="date"
                  value={contaPagarForm.vencimento}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      vencimento: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Valor
                <input
                  value={contaPagarForm.valor}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      valor: event.target.value,
                    })
                  }
                  placeholder="Ex: 250,00"
                />
              </label>

              <label>
                Categoria
                <select
                  value={contaPagarForm.categoria}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      categoria: event.target.value,
                    })
                  }
                >
                  {categoriasContaPagar.map((categoria) => (
                    <option value={categoria} key={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Forma de pagamento
                <select
                  value={contaPagarForm.formaPagamento}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      formaPagamento: event.target.value,
                    })
                  }
                >
                  {formasPagamentoFinanceiro.map((forma) => (
                    <option value={forma} key={forma}>
                      {forma}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Descrição
              <input
                value={contaPagarForm.descricao}
                onChange={(event) =>
                  setContaPagarForm({
                    ...contaPagarForm,
                    descricao: event.target.value,
                  })
                }
                placeholder="Ex: Conta de energia, aluguel, compra de material"
              />
            </label>

            <div className="finance-form-grid">
              <label>
                Fornecedor
                <input
                  value={contaPagarForm.fornecedor}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      fornecedor: event.target.value,
                    })
                  }
                  placeholder="Ex: Coelba, Embasa, fornecedor"
                />
              </label>

              <label>
                Conta bancária de pagamento
                <select
                  value={contaPagarForm.contaBancariaId}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      contaBancariaId: event.target.value,
                    })
                  }
                >
                  <option value="">Não informar</option>

                  {contasBancarias
                    .filter((conta) => conta.ativo !== false)
                    .map((conta) => (
                      <option value={conta.id} key={conta.id}>
                        {conta.nome} {conta.banco ? `- ${conta.banco}` : ''}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {!editandoContaPagarId && (
              <div className="finance-repeat-options">
                <label className="finance-toggle-label">
                  <input
                    type="checkbox"
                    checked={contaPagarForm.recorrente}
                    onChange={(event) =>
                      setContaPagarForm({
                        ...contaPagarForm,
                        recorrente: event.target.checked,
                        parcelada: event.target.checked
                          ? false
                          : contaPagarForm.parcelada,
                      })
                    }
                  />
                  <span>Despesa recorrente mensal</span>
                </label>

                <label className="finance-toggle-label">
                  <input
                    type="checkbox"
                    checked={contaPagarForm.parcelada}
                    onChange={(event) =>
                      setContaPagarForm({
                        ...contaPagarForm,
                        parcelada: event.target.checked,
                        recorrente: event.target.checked
                          ? false
                          : contaPagarForm.recorrente,
                      })
                    }
                  />
                  <span>Despesa parcelada</span>
                </label>
              </div>
            )}

            {contaPagarForm.recorrente && !editandoContaPagarId && (
              <div className="finance-info-box">
                Esta despesa será lançada mensalmente pelos próximos 12 meses,
                usando a data de vencimento informada como referência.
              </div>
            )}

            {contaPagarForm.parcelada && !editandoContaPagarId && (
              <label>
                Número de parcelas
                <input
                  type="number"
                  min="2"
                  value={contaPagarForm.numeroParcelas}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      numeroParcelas: event.target.value,
                    })
                  }
                  placeholder="Ex: 6"
                />
              </label>
            )}

            <div className="finance-form-grid">
              <label>
                Status
                <select
                  value={contaPagarForm.status}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      status: event.target.value,
                      dataPagamento:
                        event.target.value === 'Paga'
                          ? contaPagarForm.dataPagamento || obterHojeISO()
                          : contaPagarForm.dataPagamento,
                    })
                  }
                >
                  {statusContaPagar.map((status) => (
                    <option value={status} key={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Data de pagamento
                <input
                  type="date"
                  value={contaPagarForm.dataPagamento}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      dataPagamento: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <label>
              Comprovante
              <input
                type="file"
                onChange={enviarComprovanteContaPagar}
                disabled={enviandoComprovanteContaPagar}
              />
            </label>

            {enviandoComprovanteContaPagar && <p>Enviando comprovante...</p>}

            {contaPagarForm.comprovante && (
              <a
                className="admin-file-link"
                href={contaPagarForm.comprovante}
                target="_blank"
                rel="noreferrer"
              >
                Abrir comprovante enviado
              </a>
            )}

            <label>
              Observações
              <textarea
                value={contaPagarForm.observacoes}
                onChange={(event) =>
                  setContaPagarForm({
                    ...contaPagarForm,
                    observacoes: event.target.value,
                  })
                }
                placeholder="Observações internas"
              />
            </label>

            <div className="finance-toggle-row">
              <label className="finance-toggle-label">
                <input
                  type="checkbox"
                  checked={contaPagarForm.ativo}
                  onChange={(event) =>
                    setContaPagarForm({
                      ...contaPagarForm,
                      ativo: event.target.checked,
                    })
                  }
                />
                <span>Despesa ativa</span>
              </label>
            </div>

            <div className="finance-modal-actions">
              <button
                type="submit"
                disabled={loading || enviandoComprovanteContaPagar}
              >
                {loading
                  ? 'Salvando...'
                  : editandoContaPagarId
                    ? 'Salvar alterações'
                    : contaPagarForm.parcelada
                      ? `Gerar ${contaPagarForm.numeroParcelas} parcelas`
                      : contaPagarForm.recorrente
                        ? 'Gerar recorrência'
                        : 'Salvar despesa'}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={cancelarEdicaoContaPagar}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      </div>
    )}
  </section>
)}

    {modoFinanceiro === 'aprovisionamentos' && (
  <section className="finance-table-module">
    <div className="finance-table-toolbar finance-provision-toolbar">
      <div>
        <span className="admin-section-label">Aprovisionamentos</span>

        <h2>Reservas financeiras</h2>

        <p>
          Controle valores reservados para despesas futuras, eventos, obras e projetos.
        </p>
      </div>

      <button
        type="button"
        className="finance-primary-action"
        onClick={abrirNovoAprovisionamento}
      >
        + Nova reserva
      </button>
    </div>

    <div className="finance-table-summary finance-alert-summary">
      <article>
        <span>Total reservado</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalAprovisionado)}</strong>
      </article>

      <article>
        <span>Reservas ativas</span>
        <strong>{resumoFinanceiro.aprovisionamentosAtivos}</strong>
      </article>

      <article>
        <span>Saldo financeiro</span>
        <strong>{formatarMoeda(resumoFinanceiro.saldoFinanceiro)}</strong>
      </article>

      <article
        className={resumoFinanceiro.saldoDisponivel < 0 ? 'danger' : ''}
      >
        <span>Saldo disponível</span>
        <strong>{formatarMoeda(resumoFinanceiro.saldoDisponivel)}</strong>
      </article>
    </div>

    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Relação de aprovisionamentos</strong>
        <small>Clique em uma linha para editar</small>
      </div>

      <div className="finance-table-scroll">
        <table className="finance-spreadsheet-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Previsão uso</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Conta</th>
              <th>Responsável</th>
              <th>Status</th>
              <th className="finance-money-column">Valor</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {aprovisionamentos.length === 0 && (
              <tr>
                <td colSpan="9" className="finance-empty-table">
                  Nenhum aprovisionamento cadastrado ainda.
                </td>
              </tr>
            )}

            {aprovisionamentos.map((item) => (
              <tr
                key={item.id}
                className={
                  item.status === 'Cancelado'
                    ? 'finance-row-canceled'
                    : item.status === 'Utilizado'
                      ? 'finance-row-paid'
                      : ''
                }
                onClick={() => editarAprovisionamento(item)}
              >
                <td>{formatarData(item.data)}</td>
                <td>{item.previsaoUso ? formatarData(item.previsaoUso) : '-'}</td>
                <td>{item.categoria}</td>

                <td>
                  <strong>{item.descricao}</strong>

                  {item.observacoes && <small>{item.observacoes}</small>}
                </td>

                <td>{item.contaBancariaNome || '-'}</td>
                <td>{item.responsavel || '-'}</td>

                <td>
                  <span
                    className={
                      item.status === 'Utilizado'
                        ? 'finance-status paid'
                        : item.status === 'Cancelado'
                          ? 'finance-status canceled'
                          : 'finance-status open'
                    }
                  >
                    {item.status || 'Reservado'}
                  </span>
                </td>

                <td className="finance-money-column">
                  {formatarMoeda(item.valor)}
                </td>

                <td>
                  <div className="finance-table-actions">
                    {item.status === 'Reservado' && (
                      <button
                        type="button"
                        className="activate-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          marcarAprovisionamentoUtilizado(item)
                        }}
                      >
                        Utilizado
                      </button>
                    )}

                    {item.status !== 'Reservado' && (
                      <button
                        type="button"
                        className="activate-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          reativarAprovisionamento(item)
                        }}
                      >
                        Reativar
                      </button>
                    )}

                    <button
                      type="button"
                      className="edit-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        editarAprovisionamento(item)
                      }}
                    >
                      Editar
                    </button>

                    {item.status !== 'Cancelado' && (
                      <button
                        type="button"
                        className="deactivate-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          cancelarAprovisionamento(item)
                        }}
                      >
                        Cancelar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        excluirAprovisionamento(item.id)
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {formAprovisionamentoAberto && (
      <div className="finance-modal-backdrop">
        <section className="finance-modal-card">
          <div className="finance-modal-header">
            <div>
              <span className="admin-section-label">Aprovisionamentos</span>

              <h2>
                {editandoAprovisionamentoId
                  ? 'Editar reserva'
                  : 'Nova reserva'}
              </h2>
            </div>

            <button
              type="button"
              className="finance-modal-close"
              onClick={fecharFormularioAprovisionamento}
            >
              ×
            </button>
          </div>

          <form
            className="finance-modal-form"
            onSubmit={salvarAprovisionamento}
          >
            <div className="finance-form-grid">
              <label>
                Data da reserva
                <input
                  type="date"
                  value={aprovisionamentoForm.data}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      data: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Previsão de uso
                <input
                  type="date"
                  value={aprovisionamentoForm.previsaoUso}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      previsaoUso: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Valor reservado
                <input
                  value={aprovisionamentoForm.valor}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      valor: event.target.value,
                    })
                  }
                  placeholder="Ex: 500,00"
                />
              </label>

              <label>
                Categoria
                <select
                  value={aprovisionamentoForm.categoria}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      categoria: event.target.value,
                    })
                  }
                >
                  {categoriasAprovisionamento.map((categoria) => (
                    <option value={categoria} key={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Descrição
              <input
                value={aprovisionamentoForm.descricao}
                onChange={(event) =>
                  setAprovisionamentoForm({
                    ...aprovisionamentoForm,
                    descricao: event.target.value,
                  })
                }
                placeholder="Ex: Reserva para aluguel, evento, obra ou projeto"
              />
            </label>

            <div className="finance-form-grid">
              <label>
                Conta vinculada
                <select
                  value={aprovisionamentoForm.contaBancariaId}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      contaBancariaId: event.target.value,
                    })
                  }
                >
                  <option value="">Não informar</option>

                  {contasBancarias
                    .filter((conta) => conta.ativo !== false)
                    .map((conta) => (
                      <option value={conta.id} key={conta.id}>
                        {conta.nome} {conta.banco ? `- ${conta.banco}` : ''}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Responsável
                <input
                  value={aprovisionamentoForm.responsavel}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      responsavel: event.target.value,
                    })
                  }
                  placeholder="Quem fez a reserva"
                />
              </label>
            </div>

            <label>
              Status
              <select
                value={aprovisionamentoForm.status}
                onChange={(event) =>
                  setAprovisionamentoForm({
                    ...aprovisionamentoForm,
                    status: event.target.value,
                    ativo: event.target.value === 'Reservado',
                  })
                }
              >
                {statusAprovisionamento.map((status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Observações
              <textarea
                value={aprovisionamentoForm.observacoes}
                onChange={(event) =>
                  setAprovisionamentoForm({
                    ...aprovisionamentoForm,
                    observacoes: event.target.value,
                  })
                }
                placeholder="Observações internas"
              />
            </label>

            <div className="finance-toggle-row">
              <label className="finance-toggle-label">
                <input
                  type="checkbox"
                  checked={aprovisionamentoForm.ativo}
                  onChange={(event) =>
                    setAprovisionamentoForm({
                      ...aprovisionamentoForm,
                      ativo: event.target.checked,
                    })
                  }
                />
                <span>Reserva ativa</span>
              </label>
            </div>

            <div className="finance-modal-actions">
              <button type="submit" disabled={loading}>
                {loading
                  ? 'Salvando...'
                  : editandoAprovisionamentoId
                    ? 'Salvar alterações'
                    : 'Salvar reserva'}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={cancelarEdicaoAprovisionamento}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      </div>
    )}
  </section>
)}

    {modoFinanceiro === 'relatorios' && (
  <section className="finance-table-module finance-report-area">
    <div className="finance-table-toolbar finance-report-toolbar">
  <div>
    <span className="admin-section-label">Relatórios</span>

    <h2>Relatórios financeiros</h2>

    <p>
      Consulte o resumo financeiro por ano e mês, com entradas, saídas,
      contas em aberto e valores aprovisionados.
    </p>
  </div>

  <button
    type="button"
    className="finance-primary-action"
    onClick={exportarRelatorioFinanceiroExcel}
  >
    📊 Exportar Excel
  </button>
</div>

    <div className="finance-premium-filters">
      <div className="finance-filter-header">
        {renderizarFiltroAnoFinanceiro()}
      </div>

      <div className="finance-month-filter">
        <button
          type="button"
          className={
            mesesFiltroFinanceiro.length === mesesFinanceiro.length
              ? 'active'
              : ''
          }
          onClick={selecionarTodosMesesFinanceiro}
        >
          Todos os meses
        </button>

        {mesesFinanceiro.map((mes) => (
          <button
            type="button"
            className={mesesFiltroFinanceiro.includes(mes.valor) ? 'active' : ''}
            onClick={() => alternarMesFiltroFinanceiro(mes.valor)}
            key={mes.valor}
          >
            {mes.nome}
          </button>
        ))}
      </div>
    </div>

    <div className="finance-summary-grid finance-report-summary-grid">
      <article>
        <span>Saldo disponível</span>
        <strong>{formatarMoeda(resumoFinanceiro.saldoDisponivel)}</strong>
      </article>

      <article>
        <span>Saldo financeiro</span>
        <strong>{formatarMoeda(resumoFinanceiro.saldoFinanceiro)}</strong>
      </article>

      <article>
        <span>Total arrecadado</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalArrecadacoes)}</strong>
      </article>

      <article>
        <span>Contas pagas</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalContasPagas)}</strong>
      </article>

      <article>
        <span>Contas em aberto</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalContasAbertas)}</strong>
      </article>

      <article>
        <span>Aprovisionado</span>
        <strong>{formatarMoeda(resumoFinanceiro.totalAprovisionado)}</strong>
      </article>

      <article>
        <span>Despesas vencidas</span>
        <strong>{resumoFinanceiro.contasPagarVencidas}</strong>
      </article>

      <article>
        <span>Vencem hoje</span>
        <strong>{resumoFinanceiro.contasPagarVencemHoje}</strong>
      </article>

      <article>
        <span>Próximos 7 dias</span>
        <strong>{resumoFinanceiro.contasPagarProximos7Dias}</strong>
      </article>

      <article>
        <span>Contas bancárias</span>
        <strong>{resumoFinanceiro.contas}</strong>
      </article>
    </div>

    <section className="finance-report-grid">
      <article className="finance-report-card">
        <span>Entradas no período</span>
        <strong>{arrecadacoesFiltradasFinanceiro.length}</strong>
        <p>{formatarMoeda(resumoFinanceiro.totalArrecadacoes)}</p>
      </article>

      <article className="finance-report-card">
        <span>Despesas pagas</span>
        <strong>{resumoFinanceiro.contasPagarPagas}</strong>
        <p>{formatarMoeda(resumoFinanceiro.totalContasPagas)}</p>
      </article>

      <article className="finance-report-card">
        <span>Despesas abertas</span>
        <strong>{resumoFinanceiro.contasPagarAbertas}</strong>
        <p>{formatarMoeda(resumoFinanceiro.totalContasAbertas)}</p>
      </article>

      <article className="finance-report-card">
        <span>Reservas ativas</span>
        <strong>{resumoFinanceiro.aprovisionamentosAtivos}</strong>
        <p>{formatarMoeda(resumoFinanceiro.totalAprovisionado)}</p>
      </article>
    </section>
<section className="finance-category-report-grid">
  <article className="finance-category-report-card">
    <div className="finance-category-report-header">
      <strong>Entradas por tipo</strong>
      <small>Arrecadações ativas do período</small>
    </div>

    <div className="finance-table-scroll">
      <table className="finance-spreadsheet-table finance-category-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Qtd.</th>
            <th className="finance-money-column">Total</th>
          </tr>
        </thead>

        <tbody>
          {arrecadacoesPorTipo.length === 0 && (
            <tr>
              <td colSpan="3" className="finance-empty-table">
                Nenhuma entrada no período.
              </td>
            </tr>
          )}

          {arrecadacoesPorTipo.map((item) => (
            <tr key={item.categoria}>
              <td>{item.categoria}</td>
              <td>{item.quantidade}</td>
              <td className="finance-money-column">
                {formatarMoeda(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </article>

  <article className="finance-category-report-card">
    <div className="finance-category-report-header">
      <strong>Despesas por categoria</strong>
      <small>Contas a pagar do período</small>
    </div>

    <div className="finance-table-scroll">
      <table className="finance-spreadsheet-table finance-category-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Qtd.</th>
            <th className="finance-money-column">Pago</th>
            <th className="finance-money-column">Aberto</th>
            <th className="finance-money-column">Total</th>
          </tr>
        </thead>

        <tbody>
          {despesasPorCategoria.length === 0 && (
            <tr>
              <td colSpan="5" className="finance-empty-table">
                Nenhuma despesa no período.
              </td>
            </tr>
          )}

          {despesasPorCategoria.map((item) => (
            <tr key={item.categoria}>
              <td>{item.categoria}</td>
              <td>{item.quantidade}</td>
              <td className="finance-money-column">
                {formatarMoeda(item.totalPago)}
              </td>
              <td className="finance-money-column">
                {formatarMoeda(item.totalAberto)}
              </td>
              <td className="finance-money-column">
                {formatarMoeda(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </article>

  <article className="finance-category-report-card">
    <div className="finance-category-report-header">
      <strong>Aprovisionamentos por categoria</strong>
      <small>Reservas ativas</small>
    </div>

    <div className="finance-table-scroll">
      <table className="finance-spreadsheet-table finance-category-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Qtd.</th>
            <th className="finance-money-column">Total</th>
          </tr>
        </thead>

        <tbody>
          {aprovisionamentosPorCategoria.length === 0 && (
            <tr>
              <td colSpan="3" className="finance-empty-table">
                Nenhuma reserva ativa.
              </td>
            </tr>
          )}

          {aprovisionamentosPorCategoria.map((item) => (
            <tr key={item.categoria}>
              <td>{item.categoria}</td>
              <td>{item.quantidade}</td>
              <td className="finance-money-column">
                {formatarMoeda(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </article>
</section>
    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Movimento por conta bancária</strong>
        <small>Entradas, despesas pagas e despesas em aberto no período</small>
      </div>

      <div className="finance-table-scroll">
        <table className="finance-spreadsheet-table finance-report-table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Banco / Tipo</th>
              <th className="finance-money-column">Entradas</th>
              <th className="finance-money-column">Despesas pagas</th>
              <th className="finance-money-column">Despesas abertas</th>
              <th className="finance-money-column">Resultado</th>
            </tr>
          </thead>

          <tbody>
            {movimentacaoPorContaBancaria.length === 0 && (
              <tr>
                <td colSpan="6" className="finance-empty-table">
                  Nenhuma movimentação por conta no período.
                </td>
              </tr>
            )}

            {movimentacaoPorContaBancaria.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.nome}</strong>
                </td>

                <td>{item.banco || '-'}</td>

                <td className="finance-money-column">
                  {formatarMoeda(item.entradas)}
                </td>

                <td className="finance-money-column">
                  {formatarMoeda(item.despesasPagas)}
                </td>

                <td className="finance-money-column">
                  {formatarMoeda(item.despesasAbertas)}
                </td>

                <td className="finance-money-column">
                  {formatarMoeda(item.resultado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Resumo do relatório</strong>
        <small>Baseado no ano e mês selecionados acima</small>
      </div>

      <div className="finance-table-scroll">
        <table className="finance-spreadsheet-table finance-report-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="finance-money-column">Valor</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Saldo disponível</td>
              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.saldoDisponivel)}
              </td>
            </tr>

            <tr>
              <td>Saldo financeiro</td>
              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.saldoFinanceiro)}
              </td>
            </tr>
            <tr>
              <td>Total arrecadado</td>
              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.totalArrecadacoes)}
              </td>
            </tr>

            <tr>
              <td>Resultado do período</td>
              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.resultadoPeriodoFinanceiro)}
              </td>
            </tr>

            <tr>
              <td>Contas pagas</td>

              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.totalContasPagas)}
              </td>
            </tr>

            <tr>
              <td>Contas em aberto</td>
              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.totalContasAbertas)}
              </td>
            </tr>

            <tr>
              <td>Aprovisionado</td>
              <td className="finance-money-column">
                {formatarMoeda(resumoFinanceiro.totalAprovisionado)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
)}
  </section>
)}
{abaAtiva === 'galeria' && usuarioPodeAcessar('galeria') && (
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
    {abaAtiva === 'membros' && usuarioPodeAcessar('membros') && (
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
      {abaAtiva === 'usuarios' &&
        usuarioPodeAcessar('usuarios') &&
        renderizarUsuariosPermissoes()}
    {abaAtiva === 'localizacao' && usuarioPodeAcessar('localizacao') && (
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
