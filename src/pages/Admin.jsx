import { useEffect, useRef, useState } from 'react'

const MODOS_MEMBROS = ['lista', 'cadastro', 'pastoral', 'aniversariantes', 'carteirinhas', 'boasVindas']

// A aba aberta fica no endereço (/admin#membros, /admin#membros/cadastro), assim o botão
// Voltar do navegador ou do celular volta para a aba anterior em vez de sair do painel.
function lerNavegacaoAdmin() {
  const [aba, modo] = decodeURIComponent(window.location.hash.slice(1)).split('/')
  return {
    aba: /^[a-zA-Z]+$/.test(aba || '') ? aba : 'programacao',
    modo: MODOS_MEMBROS.includes(modo) ? modo : 'lista',
  }
}

function enderecoDaNavegacao(aba, modo) {
  return `#${aba}${aba === 'membros' && modo !== 'lista' ? `/${modo}` : ''}`
}
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
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
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db, firebaseConfig } from '../services/firebase'
import { miniaturaVideoCloudinary, uploadArquivoCloudinary } from '../services/cloudinary'
import { mostrarAviso } from '../services/avisos'
import CampoSenha from '../components/CampoSenha'
import { enviarEmailAniversarioTeste } from '../services/emailAniversario'
import { fazerBackupAgora } from '../services/backup'
import { enviarBoasVindas, enviarBoasVindasManual, enviarTesteBoasVindas } from '../services/boasVindas'
import { TEXTO_PADRAO_BOAS_VINDAS } from '../../cloudflare/emailBoasVindas.js'
import { TEXTO_PADRAO as TEXTO_PADRAO_EMAIL_ANIVERSARIO } from '../../cloudflare/emailAniversario.js'
import './Admin.css'
import Louvor from './Louvor'
import FinanceiroDashboard from './FinanceiroDashboard'
import Carteirinhas from './Carteirinhas'
import CarteirinhaViewer from './CarteirinhaViewer'
import { gerarPdfCarteirinhas, TEXTO_VERSO_PADRAO } from '../services/carteirinhaPdf'

const ADMIN_EMAILS = ['suedilsonfilho@gmail.com']
// Caixa de e-mail @filhosdagraca.com.br (Zoho Mail). O botão só aparece para quem tem a
// permissão "E-mail da igreja"; o login no Zoho continua pedindo a senha do e-mail.
const ENDERECO_EMAIL_IGREJA = 'https://mail.zoho.com/zm/#mail/folder/inbox'

// Evita que o Excel interprete como fórmula um texto que começa com =, +, - ou @.
function campoCsv(valor) {
  let texto = String(valor ?? '')

  if (/^[=+\-@\t\r]/.test(texto) && !/^[+-]?\d[\d\s().-]*$/.test(texto)) {
    texto = `'${texto}`
  }

  return `"${texto.replaceAll('"', '""')}"`
}

function obterIniciais(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, indice, partes) => indice === 0 || indice === partes.length - 1)
    .map((parte) => parte[0].toUpperCase())
    .join('')
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const PERFIS_USUARIOS = {
  admin: 'Administrador geral',
  presidente: 'Presidente',
  vicePresidente: 'Vice-presidente',
  tesoureiro: 'Tesoureiro',
  segundoTesoureiro: '2º Tesoureiro',
  secretaria: 'Secretaria',
  midia: 'Mídia',
  membro: 'Membro',
}

const PERMISSOES_POR_PERFIL = {
  admin: [
    'emailIgreja',
    'carteirinhas',
    'louvor',
    'programacao',
    'ensino',
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
    'louvor',
    'programacao',
    'ensino',
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
  vicePresidente: [
    'louvor',
    'programacao',
    'ensino',
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
  segundoTesoureiro: ['financeiro', 'contribuicao'],
  secretaria: ['programacao', 'ensino', 'eventos', 'oracao', 'membros'],
  midia: ['midia', 'documentos', 'galeria', 'ensino'],
  membro: ['meusDados'],
}
// Áreas que configuram o site: só o perfil Administrador acessa.
const ABAS_SO_ADMINISTRADOR = [
  'programacao',
  'localizacao',
  'midia',
  'galeria',
  'eventos',
  'documentos',
  'contribuicao',
  'usuarios',
]

function ministerioIncluiLouvor(ministerio) {
  return String(ministerio || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('louvor')
}

function Admin() {
  const [user, setUser] = useState(null)
const [checkingAuth, setCheckingAuth] = useState(true)
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [modoEntrada, setModoEntrada] = useState(() => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cadastro') === '1') return 'cadastro'
  }
  return 'login'
})
const [cadastroMembroForm, setCadastroMembroForm] = useState({
  nome: '',
  email: '',
  telefone: '',
  nascimento: '',
  endereco: '',
  ministerio: '',
  senha: '',
  confirmarSenha: '',
})
const [loading, setLoading] = useState(false)
const [abaAtiva, setAbaAtiva] = useState(() => lerNavegacaoAdmin().aba)
const substituirHistorico = useRef(false)
const [grupoMenuAberto, setGrupoMenuAberto] = useState(null)
const [menuAdminMobileAberto, setMenuAdminMobileAberto] = useState(false)

const [permissaoUsuario, setPermissaoUsuario] = useState(null)
const [ministerioUsuario, setMinisterioUsuario] = useState('')
const [carregandoPermissoes, setCarregandoPermissoes] = useState(false)

const [ensinoMateriais, setEnsinoMateriais] = useState([])
const [editandoEnsinoId, setEditandoEnsinoId] = useState(null)
const [enviandoCapaEnsino, setEnviandoCapaEnsino] = useState(false)
const [enviandoPdfEnsino, setEnviandoPdfEnsino] = useState(false)
const [progressoPdfEnsino, setProgressoPdfEnsino] = useState(0)
const [descricoesEnsinoAbertas, setDescricoesEnsinoAbertas] = useState({})

const [ensinoForm, setEnsinoForm] = useState({
  titulo: '',
  descricao: '',
  categoria: 'Revista EBD',
  autor: '',
  periodo: '',
  capa: '',
  capaPublicId: '',
  pdfUrl: '',
  pdfPublicId: '',
  ativo: true,
})
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
  const [youtubeConfigForm, setYoutubeConfigForm] = useState({
    apiKey: '',
    channelId: '',
    uploadsPlaylistId: '',
    limiteVideos: '100',
    ativo: true,
  })

  const [documentos, setDocumentos] = useState([])
  const [editandoDocumentoId, setEditandoDocumentoId] = useState(null)
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)
  const [galeria, setGaleria] = useState([])
  const [editandoFotoId, setEditandoFotoId] = useState(null)
  const [enviandoImagemGaleria, setEnviandoImagemGaleria] = useState(false)
  const [imagensGaleria, setImagensGaleria] = useState([])
  const [progressoGaleria, setProgressoGaleria] = useState(0)
  const [galeriaForm, setGaleriaForm] = useState({
  titulo: '',
  descricao: '',
  categoria: 'Culto',
  imagem: '',
  imagemPublicId: '',
  ativo: true,
  autoLoop: false,
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
  const [enviandoFotoFachada, setEnviandoFotoFachada] = useState(false)
  const [enviandoTesteAniversario, setEnviandoTesteAniversario] = useState(false)
  const [textoEmailAniversario, setTextoEmailAniversario] = useState(TEXTO_PADRAO_EMAIL_ANIVERSARIO)
  const [salvandoTextoEmail, setSalvandoTextoEmail] = useState(false)
  const [textoBoasVindas, setTextoBoasVindas] = useState(TEXTO_PADRAO_BOAS_VINDAS)
  const [salvandoBoasVindas, setSalvandoBoasVindas] = useState(false)
  const [enviandoTesteBoasVindas, setEnviandoTesteBoasVindas] = useState(false)
  const [enviandoBoasVindasId, setEnviandoBoasVindasId] = useState('')
  const [membroBoasVindasId, setMembroBoasVindasId] = useState('')
  const [fazendoBackup, setFazendoBackup] = useState(false)
  const [buscaMembro, setBuscaMembro] = useState('')
  const [filtroStatusMembro, setFiltroStatusMembro] = useState('Todos')
  const [filtroMinisterioMembro, setFiltroMinisterioMembro] = useState('Todos')
  const [modoMembros, setModoMembros] = useState(() => lerNavegacaoAdmin().modo)
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
  situacaoPastoral: 'Sem acompanhamento',
  ultimoContato: '',
  proximaAcao: '',
  dataProximaAcao: '',
  observacaoAcompanhamento: '',
  email: '',
  receberEmailAniversario: true,
})
const [meusDadosMembro, setMeusDadosMembro] = useState(null)
// Carteirinha válida do próprio membro (aba Meus dados)
const [minhaCarteirinha, setMinhaCarteirinha] = useState(null)
const [minhaCarteirinhaUrl, setMinhaCarteirinhaUrl] = useState('')
const [minhaCarteirinhaBytes, setMinhaCarteirinhaBytes] = useState(null)
const [abrindoCarteirinha, setAbrindoCarteirinha] = useState(false)
// Meus dados abre só para ver; o formulário aparece ao tocar em "Editar"
const [editandoMeusDados, setEditandoMeusDados] = useState(false)
const [enviandoFotoMeusDados, setEnviandoFotoMeusDados] = useState(false)

const [meusDadosForm, setMeusDadosForm] = useState({
  nome: '',
  telefone: '',
  nascimento: '',
  endereco: '',
  ministerio: '',
  foto: '',
  fotoPublicId: '',
  observacoes: '',
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

const nomeUsuarioLogado =
  (permissaoUsuario?.nome && permissaoUsuario.nome !== 'Administrador geral'
    ? permissaoUsuario.nome
    : user?.displayName) ||
  permissaoUsuario?.nome ||
  user?.email ||
  ''

const isPerfilAdministrador =
  isSuperAdmin || (permissaoUsuario?.ativo === true && perfilUsuario === 'admin')

function usuarioPodeAcessar(permissao) {
  if (isSuperAdmin) return true

  if (ABAS_SO_ADMINISTRADOR.includes(permissao)) return isPerfilAdministrador

  if (permissao === 'louvor') {
    return (
      permissoesUsuario.includes('louvor') ||
      (permissaoUsuario?.ativo === true && ministerioIncluiLouvor(ministerioUsuario))
    )
  }

  return permissoesUsuario.includes(permissao)
}
function abrirAbaAdmin(aba) {
  setAbaAtiva(aba)
  setGrupoMenuAberto(null)
  setMenuAdminMobileAberto(false)
}
function obterPrimeiraAbaPermitida() {
 const ordemAbas = [
  'louvor',
  'programacao',
  'ensino',
  'oracao',
  'membros',
  'meusDados',
  'localizacao',
  'midia',
  'galeria',
  'eventos',
  'financeiro',
  'contribuicao',
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
      let dadosPermissaoAdmin = {}

      try {
        const refPermissaoAdmin = doc(db, 'usuariosPermissoes', currentUser.uid)
        const snapshotPermissaoAdmin = await getDoc(refPermissaoAdmin)

        if (snapshotPermissaoAdmin.exists()) {
          dadosPermissaoAdmin = snapshotPermissaoAdmin.data()
        }
      } catch (error) {
        console.error('Erro ao carregar vínculo do administrador.', error)
      }

      setPermissaoUsuario({
        uid: currentUser.uid,
        email: currentUser.email,
        nome: dadosPermissaoAdmin.nome || 'Administrador geral',
        perfil: 'admin',
        membroId: dadosPermissaoAdmin.membroId || '',
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
        const dadosPermissao = snapshotPermissao.data()

        setPermissaoUsuario({
          id: snapshotPermissao.id,
          ...dadosPermissao,
        })

        setMinisterioUsuario('')

        if (dadosPermissao.ativo === true && dadosPermissao.membroId) {
          try {
            const snapshotMembro = await getDoc(doc(db, 'membros', dadosPermissao.membroId))

            if (snapshotMembro.exists()) {
              setMinisterioUsuario(snapshotMembro.data().ministerio || '')
            }
          } catch (error) {
            console.error('Erro ao carregar ministério do usuário.', error)
          }
        }
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
const [gerandoPdfFinanceiro, setGerandoPdfFinanceiro] = useState(false)
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
    substituirHistorico.current = true
    setAbaAtiva(obterPrimeiraAbaPermitida())
  }
}, [isAdmin, permissaoUsuario, abaAtiva])

// Cada troca de aba vira um passo no histórico do navegador.
useEffect(() => {
  if (!isAdmin) return

  const endereco = enderecoDaNavegacao(abaAtiva, modoMembros)
  if (window.location.hash === endereco) return

  const substituir = substituirHistorico.current || !window.location.hash
  substituirHistorico.current = false
  window.history[substituir ? 'replaceState' : 'pushState'](
    null,
    '',
    `${window.location.pathname}${window.location.search}${endereco}`,
  )
}, [isAdmin, abaAtiva, modoMembros])

// Botão Voltar/Avançar: abre a aba que está no endereço.
useEffect(() => {
  function aoVoltar() {
    const { aba, modo } = lerNavegacaoAdmin()
    setAbaAtiva(aba)
    setModoMembros(modo)
    setGrupoMenuAberto(null)
    setMenuAdminMobileAberto(false)
    window.scrollTo({ top: 0 })
  }

  window.addEventListener('popstate', aoVoltar)
  return () => window.removeEventListener('popstate', aoVoltar)
}, [])
useEffect(() => {
  if (!isAdmin) return

  if (usuarioPodeAcessar('programacao')) {
    carregarProgramacao()
  }
  if (usuarioPodeAcessar('ensino')) {
  carregarEnsinoMateriais()
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
    carregarYoutubeConfig()
  }

  if (usuarioPodeAcessar('documentos')) {
    carregarDocumentos()
  }

  if (usuarioPodeAcessar('galeria')) {
    carregarGaleria()
  }

  if (usuarioPodeAcessar('membros') || usuarioPodeAcessar('usuarios')) {
    carregarMembros()
  }

  if (usuarioPodeAcessar('meusDados')) {
    carregarMeuCadastroMembro()
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
// Linha marcada nas tabelas do Financeiro: { tabela, id }
const [linhaFinanceiroSelecionada, setLinhaFinanceiroSelecionada] = useState(null)
const [fornecedorFiltroContaPagar, setFornecedorFiltroContaPagar] = useState('')
async function carregarEnsinoMateriais() {
  try {
    const q = query(collection(db, 'ensinoMateriais'), orderBy('criadoEm', 'desc'))
    const snapshot = await getDocs(q)

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    setEnsinoMateriais(lista)
  } catch (error) {
    mostrarAviso('Erro ao carregar materiais de ensino.')
    console.error(error)
  }
}

function limparFormularioEnsino() {
  setEditandoEnsinoId(null)

  setEnsinoForm({
    titulo: '',
    descricao: '',
    categoria: 'Revista EBD',
    autor: '',
    periodo: '',
    capa: '',
    capaPublicId: '',
    pdfUrl: '',
    pdfPublicId: '',
    ativo: true,
  })
}

async function enviarCapaEnsino(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoCapaEnsino(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setEnsinoForm((formAtual) => ({
      ...formAtual,
      capa: arquivo.url,
      capaPublicId: arquivo.publicId,
    }))

    event.target.value = ''

    mostrarAviso('Capa enviada com sucesso!')
  } catch (error) {
    mostrarAviso('Erro ao enviar capa.')
    console.error(error)
  } finally {
    setEnviandoCapaEnsino(false)
  }
}

async function enviarPdfEnsino(event) {
  const file = event.target.files?.[0]

  if (!file) return

  if (file.type !== 'application/pdf') {
    mostrarAviso('Selecione um arquivo PDF.')
    event.target.value = ''
    return
  }

  setEnviandoPdfEnsino(true)
  setProgressoPdfEnsino(0)

  try {
    const arquivo = await uploadArquivoCloudinary(file, {
      onProgress: setProgressoPdfEnsino,
    })

    setEnsinoForm((formAtual) => ({
      ...formAtual,
      pdfUrl: arquivo.url,
      pdfPublicId: arquivo.publicId,
    }))

    event.target.value = ''

    mostrarAviso('PDF enviado com sucesso!')
  } catch (error) {
    const mensagemErro = error.message || ''
    const limiteCloudinary = mensagemErro.match(/Maximum is (\d+)/i)
    const limiteFormatado = limiteCloudinary
      ? formatarTamanhoArquivo(Number(limiteCloudinary[1]))
      : '10 MB'

    if (mensagemErro.toLowerCase().includes('file size too large')) {
      mostrarAviso(
        `Erro ao enviar PDF.

O arquivo tem ${formatarTamanhoArquivo(file.size)}, mas o Cloudinary está limitado a ${limiteFormatado} neste preset.

Aumente o limite do upload preset "filhos_da_graca_unsigned" no Cloudinary ou envie um PDF menor.`,
      )
      console.error(error)
      return
    }

    mostrarAviso(
      `Erro ao enviar PDF.

${mensagemErro || 'Verifique o tamanho do arquivo e as configurações do Cloudinary.'}`,
    )
    console.error(error)
  } finally {
    setEnviandoPdfEnsino(false)
    setProgressoPdfEnsino(0)
  }
}

function formatarTamanhoArquivo(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'

  const megabytes = bytes / 1024 / 1024

  return `${megabytes.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })} MB`
}

async function salvarEnsinoMaterial(event) {
  event.preventDefault()

  if (!ensinoForm.titulo.trim()) {
    mostrarAviso('Informe o título do material.')
    return
  }

  if (!ensinoForm.pdfUrl) {
    mostrarAviso('Envie o arquivo PDF do material.')
    return
  }

  setLoading(true)

  try {
    const dadosMaterial = {
      titulo: ensinoForm.titulo.trim(),
      descricao: ensinoForm.descricao,
      categoria: ensinoForm.categoria,
      autor: ensinoForm.autor,
      periodo: ensinoForm.periodo,
      capa: ensinoForm.capa,
      capaPublicId: ensinoForm.capaPublicId,
      pdfUrl: ensinoForm.pdfUrl,
      pdfPublicId: ensinoForm.pdfPublicId,
      ativo: ensinoForm.ativo,
      atualizadoEm: serverTimestamp(),
    }

    if (editandoEnsinoId) {
      await updateDoc(doc(db, 'ensinoMateriais', editandoEnsinoId), dadosMaterial)

      mostrarAviso('Material atualizado com sucesso!')
    } else {
      await addDoc(collection(db, 'ensinoMateriais'), {
        ...dadosMaterial,
        criadoEm: serverTimestamp(),
      })

      mostrarAviso('Material cadastrado com sucesso!')
    }

    limparFormularioEnsino()
    await carregarEnsinoMateriais()
  } catch (error) {
    mostrarAviso('Erro ao salvar material de ensino.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

function editarEnsinoMaterial(material) {
  setAbaAtiva('ensino')
  setEditandoEnsinoId(material.id)

  setEnsinoForm({
    titulo: material.titulo || '',
    descricao: material.descricao || '',
    categoria: material.categoria || 'Revista EBD',
    autor: material.autor || '',
    periodo: material.periodo || '',
    capa: material.capa || '',
    capaPublicId: material.capaPublicId || '',
    pdfUrl: material.pdfUrl || '',
    pdfPublicId: material.pdfPublicId || '',
    ativo: material.ativo !== false,
  })

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

async function alternarStatusEnsinoMaterial(material) {
  try {
    await updateDoc(doc(db, 'ensinoMateriais', material.id), {
      ativo: material.ativo === false ? true : false,
      atualizadoEm: serverTimestamp(),
    })

    await carregarEnsinoMateriais()
  } catch (error) {
    mostrarAviso('Erro ao alterar status do material.')
    console.error(error)
  }
}

async function excluirEnsinoMaterial(id) {
  const confirmar = confirm('Deseja realmente excluir este material de ensino?')

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'ensinoMateriais', id))
    await carregarEnsinoMateriais()
  } catch (error) {
    mostrarAviso('Erro ao excluir material de ensino.')
    console.error(error)
  }
}
async function carregarUsuariosPermissoes() {
  const usuariosSnapshot = await getDocs(collection(db, 'usuariosPermissoes'))

  const listaUsuarios = usuariosSnapshot.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  }))

  setUsuariosPermissoes(
    listaUsuarios.sort((a, b) => {
      if (a.aguardandoAprovacao && !b.aguardandoAprovacao) return -1
      if (!a.aguardandoAprovacao && b.aguardandoAprovacao) return 1

      return (a.nome || '').localeCompare(b.nome || '')
    }),
  )
}

function atualizarPerfilUsuarioPermissao(perfil) {
  setUsuarioPermissaoForm((formAtual) => {
    let permissoes = PERMISSOES_POR_PERFIL[perfil] || []

    // Só o administrador geral concede ou retira o Financeiro.
    if (!isSuperAdmin) {
      const tinhaFinanceiro = (formAtual.permissoes || []).includes('financeiro')
      permissoes = permissoes.filter((item) => item !== 'financeiro')
      if (tinhaFinanceiro) permissoes = [...permissoes, 'financeiro']
    }

    return {
      ...formAtual,
      perfil,
      permissoes,
    }
  })
}

function alternarPermissaoUsuario(permissao) {
  if (permissao === 'financeiro' && !isSuperAdmin) return

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

async function existeOutroUsuarioComEmail(emailUsuario, usuarioIdAtual = '') {
  const emailNormalizado = emailUsuario.trim().toLowerCase()
  const consultaEmail = query(
    collection(db, 'usuariosPermissoes'),
    where('email', '==', emailNormalizado),
  )
  const snapshot = await getDocs(consultaEmail)

  return snapshot.docs.some((documento) => documento.id !== usuarioIdAtual)
}

async function salvarUsuarioPermissao(event) {
  event.preventDefault()

  if (!usuarioPermissaoForm.nome.trim()) {
    mostrarAviso('Informe o nome do usuário.')
    return
  }

  if (!usuarioPermissaoForm.email.trim()) {
    mostrarAviso('Informe o e-mail do usuário.')
    return
  }

  if (
  !editandoUsuarioPermissaoId &&
  !usuarioPermissaoForm.usuarioExistente &&
  !usuarioPermissaoForm.senha.trim()
) {
  mostrarAviso('Informe uma senha inicial para o novo usuário.')
  return
}

if (
  !editandoUsuarioPermissaoId &&
  usuarioPermissaoForm.usuarioExistente &&
  !usuarioPermissaoForm.uid.trim()
) {
  mostrarAviso('Informe o UID do usuário já existente no Firebase Authentication.')
  return
}

  if (
    usuarioPermissaoForm.perfil === 'membro' &&
    !usuarioPermissaoForm.membroId.trim()
  ) {
    mostrarAviso('Para perfil de membro, vincule o cadastro de membro.')
    return
  }

  setCriandoUsuarioAuth(true)

  try {
    const emailNormalizado = usuarioPermissaoForm.email.trim().toLowerCase()
    const usuarioDuplicado = await existeOutroUsuarioComEmail(
      emailNormalizado,
      editandoUsuarioPermissaoId || usuarioPermissaoForm.uid.trim(),
    )

    if (usuarioDuplicado) {
      mostrarAviso(
        'Já existe um usuário cadastrado com este e-mail. Use outro e-mail ou edite o cadastro existente.',
      )
      return
    }

    let uidUsuario = usuarioPermissaoForm.uid.trim()

if (!editandoUsuarioPermissaoId && !usuarioPermissaoForm.usuarioExistente) {
  uidUsuario = await criarUsuarioNoAuthentication(
    emailNormalizado,
    usuarioPermissaoForm.senha.trim(),
  )
}

    const dadosUsuario = {
      uid: uidUsuario,
      nome: usuarioPermissaoForm.nome.trim(),
      email: emailNormalizado,
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

    mostrarAviso('Usuário e permissões salvos com sucesso.')
  } catch (error) {
    console.error('Erro ao salvar usuário.', error)

    if (error.code === 'auth/email-already-in-use') {
      mostrarAviso(
        'Este e-mail já existe no Firebase Authentication. Use outro e-mail ou edite as permissões já existentes.',
      )
      return
    }

    if (error.code === 'auth/weak-password') {
      mostrarAviso('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    mostrarAviso(
  `Erro ao salvar usuário.

Código: ${error.code || 'sem código'}
Mensagem: ${error.message || 'sem mensagem'}`
)
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
    aguardandoAprovacao: false,
    atualizadoEm: serverTimestamp(),
  })

  await carregarUsuariosPermissoes()
}

async function removerUsuarioPermissao(usuarioPermissao) {
  const confirmar = confirm(
    `Deseja remover este acesso de ${usuarioPermissao.nome || usuarioPermissao.email}? Essa ação remove apenas o registro de permissões.`,
  )

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'usuariosPermissoes', usuarioPermissao.id))
    await carregarUsuariosPermissoes()
    mostrarAviso('Registro de permissões removido com sucesso.')
  } catch (error) {
    mostrarAviso('Erro ao remover o registro de permissões.')
    console.error(error)
  }
}

// Acesso de login do membro que ainda espera aprovação (só para quem administra as permissões).
function acessoPendenteDoMembro(membro) {
  if (!membro.usuarioUid || !usuarioPodeAcessar('usuarios')) return null

  return (
    usuariosPermissoes.find(
      (usuarioPermissao) =>
        usuarioPermissao.id === membro.usuarioUid &&
        (usuarioPermissao.aguardandoAprovacao ||
          (usuarioPermissao.ativo === false &&
            usuarioPermissao.origemCadastro === 'autoCadastro')),
    ) || null
  )
}

async function aprovarUsuarioPendente(usuarioPermissao) {
  if (!usuarioPermissao.membroId) {
    mostrarAviso('Este usuário não está vinculado a um cadastro de membro.')
    return
  }

  const confirmar = confirm(
    `Deseja aprovar o acesso de ${usuarioPermissao.nome || usuarioPermissao.email}?`,
  )

  if (!confirmar) return

  setCriandoUsuarioAuth(true)

  try {
    const batch = writeBatch(db)
    const permissaoRef = doc(db, 'usuariosPermissoes', usuarioPermissao.id)
    const membroRef = doc(db, 'membros', usuarioPermissao.membroId)
    const membroSnapshot = await getDoc(membroRef)

    // Só aprova se o cadastro de membro vinculado pertence a este usuário.
    if (
      !membroSnapshot.exists() ||
      membroSnapshot.data().usuarioUid !== usuarioPermissao.id
    ) {
      mostrarAviso(
        'O cadastro de membro vinculado não pertence a este usuário. Verifique antes de aprovar.',
      )
      return
    }

    batch.update(permissaoRef, {
      ativo: true,
      aguardandoAprovacao: false,
      atualizadoEm: serverTimestamp(),
    })

    batch.update(membroRef, {
      status: 'Ativo',
      ativo: true,
      atualizadoEm: serverTimestamp(),
    })

    await batch.commit()

    // Quem se cadastrou pelo site recebe o e-mail de boas-vindas; uma falha aqui não desfaz a aprovação.
    let avisoBoasVindas = ''
    if (usuarioPermissao.origemCadastro === 'autoCadastro') {
      try {
        const resultado = await enviarBoasVindas(usuarioPermissao.id)
        if (resultado.enviado) avisoBoasVindas = ' E-mail de boas-vindas enviado.'
      } catch (error) {
        console.error('Erro no e-mail de boas-vindas.', error)
        avisoBoasVindas = ' Não foi possível enviar o e-mail de boas-vindas agora.'
      }
    }

    await carregarUsuariosPermissoes()

    if (usuarioPodeAcessar('membros')) {
      await carregarMembros()
    }

    mostrarAviso(`Usuário aprovado com sucesso.${avisoBoasVindas}`, 'sucesso')
  } catch (error) {
    mostrarAviso('Erro ao aprovar usuário pendente.')
    console.error(error)
  } finally {
    setCriandoUsuarioAuth(false)
  }
}
async function login(event) {
   event.preventDefault()
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      mostrarAviso('Não foi possível entrar. Verifique o e-mail e a senha.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

async function recuperarSenha() {
  const emailInformado = email.trim().toLowerCase()

  if (!emailInformado) {
    mostrarAviso('Digite seu e-mail no campo acima para receber o link de nova senha.', 'info')
    return
  }

  try {
    await sendPasswordResetEmail(auth, emailInformado)
  } catch (error) {
    if (error.code === 'auth/invalid-email') {
      mostrarAviso('Este e-mail não é válido.', 'erro')
      return
    }

    console.error(error)
  }

  // Mesma mensagem para e-mail cadastrado ou não, para não revelar quem tem conta.
  mostrarAviso(
    'Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a caixa de spam.',
    'sucesso',
  )
}

async function cadastrarMembroPendente(event) {
  event.preventDefault()

  if (!cadastroMembroForm.nome.trim()) {
    mostrarAviso('Informe seu nome completo.')
    return
  }

  if (!cadastroMembroForm.email.trim()) {
    mostrarAviso('Informe seu e-mail.')
    return
  }

  if (cadastroMembroForm.senha.length < 6) {
    mostrarAviso('A senha precisa ter pelo menos 6 caracteres.')
    return
  }

  if (cadastroMembroForm.senha !== cadastroMembroForm.confirmarSenha) {
    mostrarAviso('As senhas não conferem.')
    return
  }

  setLoading(true)

  try {
    const credencial = await createUserWithEmailAndPassword(
      auth,
      cadastroMembroForm.email.trim().toLowerCase(),
      cadastroMembroForm.senha,
    )

    const membroRef = doc(collection(db, 'membros'))
    const permissaoRef = doc(db, 'usuariosPermissoes', credencial.user.uid)
    const batch = writeBatch(db)

    const dadosMembro = {
      nome: cadastroMembroForm.nome.trim(),
      email: cadastroMembroForm.email.trim().toLowerCase(),
      telefone: cadastroMembroForm.telefone.trim(),
      nascimento: cadastroMembroForm.nascimento,
      endereco: cadastroMembroForm.endereco.trim(),
      ministerio: cadastroMembroForm.ministerio.trim(),
      status: 'Pendente aprovação',
      origemCadastro: 'autoCadastro',
      usuarioUid: credencial.user.uid,
      ativo: false,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }

    const dadosPermissao = {
      uid: credencial.user.uid,
      nome: cadastroMembroForm.nome.trim(),
      email: cadastroMembroForm.email.trim().toLowerCase(),
      perfil: 'membro',
      membroId: membroRef.id,
      ativo: false,
      permissoes: PERMISSOES_POR_PERFIL.membro,
      origemCadastro: 'autoCadastro',
      aguardandoAprovacao: true,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }

    batch.set(membroRef, dadosMembro)
    batch.set(permissaoRef, dadosPermissao)

    await batch.commit()

    setPermissaoUsuario({
      id: credencial.user.uid,
      ...dadosPermissao,
    })
    setCadastroMembroForm({
      nome: '',
      email: '',
      telefone: '',
      nascimento: '',
      endereco: '',
      ministerio: '',
      senha: '',
      confirmarSenha: '',
    })

    mostrarAviso('Cadastro enviado com sucesso. Aguarde a aprovação da liderança.')
  } catch (error) {
    console.error('Erro ao solicitar cadastro de membro.', error)

    if (error.code === 'auth/email-already-in-use') {
      mostrarAviso('Este e-mail já possui cadastro. Faça login ou fale com a liderança.')
      return
    }

    if (error.code === 'auth/weak-password') {
      mostrarAviso('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    mostrarAviso('Não foi possível enviar seu cadastro. Tente novamente.')
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
      mostrarAviso('Preencha dia, título e horário.')
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

        mostrarAviso('Programação atualizada com sucesso!')
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

        mostrarAviso('Programação cadastrada com sucesso!')
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
      mostrarAviso('Erro ao salvar programação.')
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
      mostrarAviso('Erro ao excluir programação.')
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
      mostrarAviso('Erro ao alterar status da programação.')
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
      mostrarAviso('Erro ao ordenar programação.')
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
      mostrarAviso('Preencha pelo menos o título e a data do evento.')
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

        mostrarAviso('Evento atualizado com sucesso!')
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

        mostrarAviso('Evento cadastrado com sucesso!')
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
      mostrarAviso('Erro ao salvar evento.')
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
      mostrarAviso('Erro ao excluir evento.')
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
      mostrarAviso('Erro ao alterar status do evento.')
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
      mostrarAviso('Erro ao carregar localização.')
      console.error(error)
    }
  }

  async function salvarLocalizacao(event) {
    event.preventDefault()

    if (!localizacaoForm.endereco) {
      mostrarAviso('Preencha pelo menos o endereço.')
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

      mostrarAviso('Localização salva com sucesso!')
    } catch (error) {
      mostrarAviso('Erro ao salvar localização.')
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
    mostrarAviso('Erro ao carregar dados de contribuição.')
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

    mostrarAviso('QR Code enviado com sucesso!')
  } catch (error) {
    mostrarAviso('Erro ao enviar QR Code.')
    console.error(error)
  } finally {
    setEnviandoQrCodePix(false)
  }
}

async function salvarContribuicao(event) {
  event.preventDefault()

  if (!contribuicaoForm.titulo) {
    mostrarAviso('Preencha o título da seção.')
    return
  }

  if (!contribuicaoForm.chavePix) {
    mostrarAviso('Preencha a chave Pix.')
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

    mostrarAviso('Dados de contribuição salvos com sucesso!')
  } catch (error) {
    mostrarAviso('Erro ao salvar dados de contribuição.')
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
    mostrarAviso('Erro ao carregar contas bancárias.')
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
    mostrarAviso('Preencha o nome da conta.')
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
      mostrarAviso('Conta bancária atualizada com sucesso!')
    } else {
      await addDoc(collection(db, 'contasBancarias'), {
        ...dadosConta,
        criadoEm: serverTimestamp(),
      })

      mostrarAviso('Conta bancária cadastrada com sucesso!')
    }

    limparFormularioContaBancaria()
    await carregarContasBancarias()
  } catch (error) {
    mostrarAviso('Erro ao salvar conta bancária.')
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
    mostrarAviso('Erro ao alterar status da conta bancária.')
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
    mostrarAviso('Erro ao excluir conta bancária.')
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
    mostrarAviso('Erro ao carregar arrecadações.')
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

    mostrarAviso('Comprovante enviado com sucesso!')
  } catch (error) {
    mostrarAviso('Erro ao enviar comprovante.')
    console.error(error)
  } finally {
    setEnviandoComprovanteArrecadacao(false)
  }
}

async function salvarArrecadacao(event) {
  event.preventDefault()

  if (!arrecadacaoForm.data) {
    mostrarAviso('Preencha a data da arrecadação.')
    return
  }

  if (!arrecadacaoForm.descricao) {
    mostrarAviso('Preencha a descrição da arrecadação.')
    return
  }

  if (!arrecadacaoForm.valor) {
    mostrarAviso('Preencha o valor da arrecadação.')
    return
  }

  
    if (!arrecadacaoForm.valor) {
    mostrarAviso('Preencha o valor da arrecadação.')
    return
  }

  const valor = Number(String(arrecadacaoForm.valor).replace(',', '.'))

  if (!valor || valor <= 0) {
    mostrarAviso('Informe um valor válido.')
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

      mostrarAviso('Arrecadação atualizada com sucesso!')
    } else {
      await addDoc(collection(db, 'arrecadacoes'), {
        ...dadosArrecadacao,
        criadoEm: serverTimestamp(),
      })

      mostrarAviso('Arrecadação cadastrada com sucesso!')
    }

    limparFormularioArrecadacao()
    setFormArrecadacaoAberto(false)
    await carregarArrecadacoes()
  } catch (error) {
    mostrarAviso('Erro ao salvar arrecadação.')
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
  if (!arrecadacao || loading) return
  setLoading(true)
  try {
    await updateDoc(doc(db, 'arrecadacoes', arrecadacao.id), {
      ativo: arrecadacao.ativo === false ? true : false,
      atualizadoEm: serverTimestamp(),
    })

    fecharFormularioArrecadacao()
    await carregarArrecadacoes()
  } catch (error) {
    mostrarAviso('Erro ao alterar status da arrecadação.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}

async function excluirArrecadacao(id) {
  if (loading) return
  const confirmar = confirm('Deseja realmente excluir esta arrecadação?')

  if (!confirmar) return

  try {
    setLoading(true)
    await deleteDoc(doc(db, 'arrecadacoes', id))
    fecharFormularioArrecadacao()
    await carregarArrecadacoes()
  } catch (error) {
    mostrarAviso('Erro ao excluir arrecadação.')
    console.error(error)
  } finally {
    setLoading(false)
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
    mostrarAviso('Erro ao carregar contas a pagar.')
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
async function exportarRelatorioFinanceiroPdf() {
  if (!usuarioPodeAcessar('financeiro') || gerandoPdfFinanceiro) return
  setGerandoPdfFinanceiro(true)
  try {
    const { baixarRelatorioFinanceiro } = await import('../services/relatorioFinanceiro')
    await baixarRelatorioFinanceiro({
      resumo: resumoFinanceiro,
      entradasPorTipo: arrecadacoesPorTipo,
      despesasPorCategoria,
      reservasPorCategoria: aprovisionamentosPorCategoria,
      movimentoPorConta: movimentacaoPorContaBancaria,
      arrecadacoes: arrecadacoesFiltradasFinanceiro,
      despesas: contasPagarFiltradasFinanceiro.map((conta) => ({ ...conta, statusRelatorio: obterStatusVisualContaPagar(conta) })),
    }, {
      periodo: `${mesesFinanceiro.filter((mes) => mesesFiltroFinanceiro.includes(mes.valor)).map((mes) => mes.nome).join(', ')} / ${anoFiltroFinanceiro}`,
      emitidoPor: user?.email || '',
      filtros: `Despesas: ${statusFiltroContaPagar}. Fornecedor: ${fornecedorFiltroContaPagar.trim() || 'Todos'}.`,
    })
  } catch (error) {
    console.error('Erro ao gerar relatório financeiro PDF:', error)
    mostrarAviso('Não foi possível gerar o relatório financeiro em PDF. Tente novamente.')
  } finally { setGerandoPdfFinanceiro(false) }
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
        .map((campo) => campoCsv(campo))
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
  // Vai para o mês desejado e usa o mesmo dia; se o mês não tiver esse dia
  // (ex.: 31 em novembro, 29-31 em fevereiro), usa o último dia do mês.
  // Antes, 31/01 + 1 mês virava 03/03, pulando fevereiro e repetindo março.
  const alvo = new Date(ano, mes - 1 + quantidadeMeses, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()

  const novoAno = alvo.getFullYear()
  const novoMes = String(alvo.getMonth() + 1).padStart(2, '0')
  const novoDia = String(Math.min(dia, ultimoDia)).padStart(2, '0')

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

    mostrarAviso('Comprovante enviado com sucesso!')
  } catch (error) {
    mostrarAviso('Erro ao enviar comprovante.')
    console.error(error)
  } finally {
    setEnviandoComprovanteContaPagar(false)
  }
}

async function salvarContaPagar(event) {
  event.preventDefault()

  if (!contaPagarForm.vencimento) {
    mostrarAviso('Preencha a data de vencimento.')
    return
  }

  if (!contaPagarForm.descricao) {
    mostrarAviso('Preencha a descrição da despesa.')
    return
  }

  if (!contaPagarForm.valor) {
    mostrarAviso('Preencha o valor da despesa.')
    return
  }

  const valor = Number(String(contaPagarForm.valor).replace(',', '.'))

  if (!valor || valor <= 0) {
    mostrarAviso('Informe um valor válido.')
    return
  }

  const numeroParcelas = Number(contaPagarForm.numeroParcelas || 1)

  if (contaPagarForm.parcelada && (!numeroParcelas || numeroParcelas < 2)) {
    mostrarAviso('Informe pelo menos 2 parcelas.')
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

      mostrarAviso('Despesa atualizada com sucesso!')
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

      mostrarAviso(`${numeroParcelas} parcelas cadastradas com sucesso!`)
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

      mostrarAviso('Despesa recorrente cadastrada para os próximos 12 meses!')
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

      mostrarAviso('Despesa cadastrada com sucesso!')
    }

    limparFormularioContaPagar()
    setFormContaPagarAberto(false)
    await carregarContasPagar()
  } catch (error) {
    mostrarAviso('Erro ao salvar despesa.')
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
    mostrarAviso('Erro ao marcar despesa como paga.')
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
    mostrarAviso('Erro ao reabrir despesa.')
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
    mostrarAviso('Erro ao cancelar despesa.')
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
    mostrarAviso('Erro ao excluir despesa.')
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
    mostrarAviso('Erro ao carregar aprovisionamentos.')
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
    mostrarAviso('Preencha a data da reserva.')
    return
  }

  if (!aprovisionamentoForm.descricao) {
    mostrarAviso('Preencha a descrição da reserva.')
    return
  }

  if (!aprovisionamentoForm.valor) {
    mostrarAviso('Preencha o valor reservado.')
    return
  }

  const valor = Number(String(aprovisionamentoForm.valor).replace(',', '.'))

  if (!valor || valor <= 0) {
    mostrarAviso('Informe um valor válido.')
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

      mostrarAviso('Aprovisionamento atualizado com sucesso!')
    } else {
      await addDoc(collection(db, 'aprovisionamentos'), {
        ...dadosAprovisionamento,
        criadoEm: serverTimestamp(),
      })

      mostrarAviso('Aprovisionamento cadastrado com sucesso!')
    }

    limparFormularioAprovisionamento()
    setFormAprovisionamentoAberto(false)
    await carregarAprovisionamentos()
  } catch (error) {
    mostrarAviso('Erro ao salvar aprovisionamento.')
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
    mostrarAviso('Erro ao marcar aprovisionamento como utilizado.')
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
    mostrarAviso('Erro ao cancelar aprovisionamento.')
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
    mostrarAviso('Erro ao reativar aprovisionamento.')
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
    mostrarAviso('Erro ao excluir aprovisionamento.')
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
      mostrarAviso('Erro ao carregar pedidos de oração.')
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
      mostrarAviso('Erro ao alterar status do pedido.')
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
      mostrarAviso('Erro ao excluir pedido de oração.')
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
      mostrarAviso('Erro ao carregar vídeos.')
      console.error(error)
    }
  }

  async function carregarYoutubeConfig() {
    try {
      const snapshot = await getDoc(doc(db, 'configuracoes', 'youtube'))

      if (!snapshot.exists()) return

      const dados = snapshot.data()

      setYoutubeConfigForm({
        apiKey: dados.apiKey || '',
        channelId: dados.channelId || '',
        uploadsPlaylistId: dados.uploadsPlaylistId || '',
        limiteVideos: String(dados.limiteVideos || 100),
        ativo: dados.ativo !== false,
      })
    } catch (error) {
      console.error('Erro ao carregar configuração do YouTube.', error)
    }
  }

  async function salvarYoutubeConfig(event) {
    event.preventDefault()

    if (!youtubeConfigForm.apiKey.trim()) {
      mostrarAviso('Informe a API key do YouTube.')
      return
    }

    if (
      !youtubeConfigForm.uploadsPlaylistId.trim() &&
      !youtubeConfigForm.channelId.trim()
    ) {
      mostrarAviso('Informe a playlist de uploads ou o Channel ID do YouTube.')
      return
    }

    setLoading(true)

    try {
      await setDoc(
        doc(db, 'configuracoes', 'youtube'),
        {
          apiKey: youtubeConfigForm.apiKey.trim(),
          channelId: youtubeConfigForm.channelId.trim(),
          uploadsPlaylistId: youtubeConfigForm.uploadsPlaylistId.trim(),
          limiteVideos: Number(youtubeConfigForm.limiteVideos || 100),
          ativo: youtubeConfigForm.ativo,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      )

      mostrarAviso('Configuração do YouTube salva com sucesso!')
    } catch (error) {
      mostrarAviso('Erro ao salvar configuração do YouTube.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function salvarVideo(event) {
    event.preventDefault()

    if (!videoForm.titulo || !videoForm.url) {
      mostrarAviso('Preencha pelo menos o título e o link do vídeo.')
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

        mostrarAviso('Vídeo atualizado com sucesso!')
      } else {
        await addDoc(collection(db, 'videos'), {
          titulo: videoForm.titulo,
          descricao: videoForm.descricao,
          url: videoForm.url,
          ativo: true,
          criadoEm: serverTimestamp(),
        })

        mostrarAviso('Vídeo cadastrado com sucesso!')
      }

      setVideoForm({
        titulo: '',
        descricao: '',
        url: '',
      })

      setEditandoVideoId(null)
      await carregarVideos()
    } catch (error) {
      mostrarAviso('Erro ao salvar vídeo.')
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
      mostrarAviso('Erro ao alterar status do vídeo.')
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
      mostrarAviso('Erro ao excluir vídeo.')
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
      mostrarAviso('Erro ao carregar documentos.')
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
    mostrarAviso('Erro ao carregar galeria.')
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

      mostrarAviso('Arquivo enviado com sucesso!')
    } catch (error) {
      mostrarAviso('Erro ao enviar arquivo.')
      console.error(error)
    } finally {
      setEnviandoArquivo(false)
    }
  }

  async function salvarDocumento(event) {
    event.preventDefault()

    if (!documentoForm.titulo || !documentoForm.url) {
      mostrarAviso('Preencha pelo menos o título e o link do documento.')
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

        mostrarAviso('Documento atualizado com sucesso!')
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

        mostrarAviso('Documento cadastrado com sucesso!')
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
      mostrarAviso('Erro ao salvar documento.')
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
      mostrarAviso('Erro ao alterar status do documento.')
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
      mostrarAviso('Erro ao excluir documento.')
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
    autoLoop: false,
  })

  setImagensGaleria([])
  setEditandoFotoId(null)
}

  async function enviarImagemGaleria(event) {
  const files = Array.from(event.target.files || [])

  if (files.length === 0) return

  const LIMITE_VIDEO_MB = 100
  const videoGrande = files.find(
    (file) => file.type.startsWith('video/') && file.size > LIMITE_VIDEO_MB * 1024 * 1024,
  )

  if (videoGrande) {
    mostrarAviso(
      `O vídeo "${videoGrande.name}" passa de ${LIMITE_VIDEO_MB} MB. Corte ou comprima o vídeo antes de enviar.`,
      'erro',
    )
    event.target.value = ''
    return
  }

  setEnviandoImagemGaleria(true)
  setProgressoGaleria(0)

  try {
    const progressoPorArquivo = files.map(() => 0)
    const imagensEnviadas = await Promise.all(
      files.map(async (file, indice) => {
        const arquivo = await uploadArquivoCloudinary(file, {
          onProgress: (porcentagem) => {
            progressoPorArquivo[indice] = porcentagem
            setProgressoGaleria(
              Math.round(progressoPorArquivo.reduce((a, b) => a + b, 0) / files.length),
            )
          },
        })
        const ehVideo = arquivo.tipo === 'video'

        return {
          url: ehVideo ? miniaturaVideoCloudinary(arquivo.url) : arquivo.url,
          publicId: arquivo.publicId,
          tipo: ehVideo ? 'video' : 'imagem',
          video: ehVideo ? arquivo.url : '',
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

    mostrarAviso(
      imagensEnviadas.length === 1
        ? 'Arquivo adicionado com sucesso!'
        : `${imagensEnviadas.length} arquivos adicionados com sucesso!`,
    )
  } catch (error) {
    mostrarAviso(`Erro ao enviar para a galeria: ${error.message}`, 'erro')
    console.error(error)
    event.target.value = ''
  } finally {
    setEnviandoImagemGaleria(false)
    setProgressoGaleria(0)
  }
}

  async function salvarFotoGaleria(event) {
  event.preventDefault()

  if (!galeriaForm.titulo) {
    mostrarAviso('Preencha o título da galeria.')
    return
  }

  if (editandoFotoId && !galeriaForm.imagem) {
    mostrarAviso('Envie uma imagem.')
    return
  }

  if (!editandoFotoId && imagensGaleria.length === 0) {
    mostrarAviso('Selecione e envie pelo menos uma foto ou vídeo.')
    return
  }

  setLoading(true)

  try {
    const dadosBase = {
      titulo: galeriaForm.titulo,
      descricao: galeriaForm.descricao,
      categoria: galeriaForm.categoria,
      ativo: galeriaForm.ativo,
      autoLoop: galeriaForm.autoLoop === true,
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

        mostrarAviso('Álbum atualizado com sucesso!')
      } else {
        await updateDoc(doc(db, 'galeria', editandoFotoId), {
          ...dadosBase,
          imagem: galeriaForm.imagem,
          imagemPublicId: galeriaForm.imagemPublicId,
        })

        mostrarAviso('Foto atualizada com sucesso!')
      }
    } else {
      await Promise.all(
        imagensGaleria.map((imagem) =>
          addDoc(collection(db, 'galeria'), {
            ...dadosBase,
            imagem: imagem.url,
            imagemPublicId: imagem.publicId,
            tipo: imagem.tipo || 'imagem',
            video: imagem.video || '',
            criadoEm: serverTimestamp(),
          }),
        ),
      )

      mostrarAviso(
        imagensGaleria.length === 1
          ? 'Item cadastrado com sucesso!'
          : `${imagensGaleria.length} itens cadastrados com sucesso!`,
      )
    }

    limparFormularioGaleria()
    await carregarGaleria()
  } catch (error) {
    mostrarAviso('Erro ao salvar galeria.')
    console.error(error)
  } finally {
    setLoading(false)
  }
}
async function adicionarFotosAoEventoGaleria() {
  if (!galeriaForm.titulo) {
    mostrarAviso('Preencha o título do álbum antes de salvar novas fotos.')
    return
  }

  if (imagensGaleria.length === 0) {
    mostrarAviso('Selecione pelo menos uma foto ou vídeo para adicionar.')
    return
  }

  setLoading(true)

  try {
    const dadosBase = {
      titulo: galeriaForm.titulo,
      descricao: galeriaForm.descricao,
      categoria: galeriaForm.categoria,
      ativo: galeriaForm.ativo,
      autoLoop: galeriaForm.autoLoop === true,
      atualizadoEm: serverTimestamp(),
    }

    await Promise.all(
      imagensGaleria.map((imagem) =>
        addDoc(collection(db, 'galeria'), {
          ...dadosBase,
          imagem: imagem.url,
          imagemPublicId: imagem.publicId,
          tipo: imagem.tipo || 'imagem',
          video: imagem.video || '',
          criadoEm: serverTimestamp(),
        }),
      ),
    )

    mostrarAviso(
      imagensGaleria.length === 1
        ? 'Item adicionado ao álbum com sucesso!'
        : `${imagensGaleria.length} itens adicionados ao álbum com sucesso!`,
    )

    setImagensGaleria([])
    await carregarGaleria()
  } catch (error) {
    mostrarAviso('Erro ao adicionar fotos ao álbum.')
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
      autoLoop: foto.autoLoop === true,
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
      mostrarAviso('Erro ao alterar status da foto.')
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
      mostrarAviso('Erro ao excluir foto da galeria.')
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
    mostrarAviso('Erro ao alterar status do álbum.')
    console.error(error)
  }
}
async function excluirFotoIndividualGaleria(foto) {
  const confirmar = confirm(
    `Deseja realmente excluir somente ${foto.tipo === 'video' ? 'este vídeo' : 'esta foto'} do álbum "${foto.titulo}"?`,
  )

  if (!confirmar) return

  try {
    await deleteDoc(doc(db, 'galeria', foto.id))

    if (editandoFotoId === foto.id) {
      limparFormularioGaleria()
    }

    await carregarGaleria()
  } catch (error) {
    mostrarAviso('Erro ao excluir foto do álbum.')
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
    mostrarAviso('Erro ao excluir álbum da galeria.')
    console.error(error)
  }
}
async function carregarMinhaCarteirinha(membroId) {
  try {
    const snap = await getDocs(
      query(collection(db, 'carteirinhas'), where('membroId', '==', membroId)),
    )
    const hoje = obterHojeISO()
    const valida = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((c) => c.ativa !== false && (!c.validade || c.validade >= hoje))
      .sort((a, b) => (b.numeroSeq || 0) - (a.numeroSeq || 0))[0]
    setMinhaCarteirinha(valida || null)
  } catch (error) {
    setMinhaCarteirinha(null)
    console.error('Erro ao buscar a carteirinha do membro.', error)
  }
}

async function abrirMinhaCarteirinha() {
  if (!minhaCarteirinha) return
  setAbrindoCarteirinha(true)
  try {
    const pdf = await gerarPdfCarteirinhas(
      [{
        nome: minhaCarteirinha.nome,
        foto: meusDadosMembro?.foto,
        nascimento: meusDadosMembro?.nascimento,
        funcao: minhaCarteirinha.funcao,
        validade: minhaCarteirinha.validade,
        emitidaEm: minhaCarteirinha.emitidaEm,
        textoVerso: TEXTO_VERSO_PADRAO,
        numero: minhaCarteirinha.numero,
        codigo: minhaCarteirinha.id,
      }],
      { formato: 'cartao', incluirVerso: true },
    )
    if (minhaCarteirinhaUrl) URL.revokeObjectURL(minhaCarteirinhaUrl)
    setMinhaCarteirinhaBytes(pdf.output('arraybuffer'))
    setMinhaCarteirinhaUrl(URL.createObjectURL(pdf.output('blob')))
  } catch (error) {
    console.error(error)
    mostrarAviso('Não foi possível abrir a carteirinha.', 'erro')
  } finally {
    setAbrindoCarteirinha(false)
  }
}

function fecharMinhaCarteirinha() {
  if (minhaCarteirinhaUrl) URL.revokeObjectURL(minhaCarteirinhaUrl)
  setMinhaCarteirinhaUrl('')
  setMinhaCarteirinhaBytes(null)
}

async function carregarMeuCadastroMembro() {
  if (!permissaoUsuario?.membroId) {
    setMeusDadosMembro(null)
    return
  }

  try {
    const refMembro = doc(db, 'membros', permissaoUsuario.membroId)
    const snapshotMembro = await getDoc(refMembro)

    if (!snapshotMembro.exists()) {
      setMeusDadosMembro(null)
      return
    }

    const dados = {
      id: snapshotMembro.id,
      ...snapshotMembro.data(),
    }

    setMeusDadosMembro(dados)
    carregarMinhaCarteirinha(dados.id)

    setMeusDadosForm({
      nome: dados.nome || '',
      telefone: dados.telefone || '',
      nascimento: dados.nascimento || '',
      endereco: dados.endereco || '',
      ministerio: dados.ministerio || '',
      foto: dados.foto || '',
      fotoPublicId: dados.fotoPublicId || '',
      observacoes: dados.observacoes || '',
    })
  } catch (error) {
    mostrarAviso('Erro ao carregar seus dados.')
    console.error(error)
  }
}

function obterMesDiaNascimento(dataNascimento) {
  if (!dataNascimento) {
    return { mes: null, dia: null }
  }

  const [, mes, dia] = dataNascimento.split('-')

  return {
    mes: Number(mes),
    dia: Number(dia),
  }
}

async function sincronizarAniversariantePublico(membroId, dadosMembro) {
  if (!membroId) return

  const refPublica = doc(db, 'aniversariantesPublicos', membroId)
  const { mes, dia } = obterMesDiaNascimento(dadosMembro.nascimento)
  const devePublicar =
    Boolean(dadosMembro.nome?.trim()) &&
    Boolean(mes) &&
    Boolean(dia) &&
    dadosMembro.status !== 'Inativo' &&
    dadosMembro.ativo !== false

  if (!devePublicar) {
    await deleteDoc(refPublica)
    return
  }

  await setDoc(
    refPublica,
    {
      membroId,
      nome: dadosMembro.nome.trim(),
      mes,
      dia,
      ministerio: dadosMembro.ministerio || '',
      foto: dadosMembro.foto || '',
      ativo: true,
      atualizadoEm: serverTimestamp(),
    }
  )
}

async function enviarFotoMeusDados(event) {
  const file = event.target.files?.[0]

  if (!file) return

  setEnviandoFotoMeusDados(true)

  try {
    const arquivo = await uploadArquivoCloudinary(file)

    setMeusDadosForm((formAtual) => ({
      ...formAtual,
      foto: arquivo.url,
      fotoPublicId: arquivo.publicId,
    }))

    event.target.value = ''

    mostrarAviso('Foto enviada com sucesso!')
  } catch (error) {
    mostrarAviso('Erro ao enviar foto.')
    console.error(error)
  } finally {
    setEnviandoFotoMeusDados(false)
  }
}

async function salvarMeusDados(event) {
  event.preventDefault()

  if (!permissaoUsuario?.membroId) {
    mostrarAviso('Seu usuário não está vinculado a um cadastro de membro.')
    return
  }

  if (!meusDadosForm.nome.trim()) {
    mostrarAviso('Preencha seu nome.')
    return
  }

  setLoading(true)

  try {
    const dadosAtualizados = {
      nome: meusDadosForm.nome,
      telefone: meusDadosForm.telefone,
      nascimento: meusDadosForm.nascimento,
      endereco: meusDadosForm.endereco,
      ministerio: meusDadosForm.ministerio,
      foto: meusDadosForm.foto,
      fotoPublicId: meusDadosForm.fotoPublicId,
      observacoes: meusDadosForm.observacoes,
      atualizadoEm: serverTimestamp(),
    }

    await updateDoc(doc(db, 'membros', permissaoUsuario.membroId), dadosAtualizados)
    await sincronizarAniversariantePublico(permissaoUsuario.membroId, {
      ...meusDadosMembro,
      ...dadosAtualizados,
      status: meusDadosMembro?.status || 'Ativo',
      ativo: meusDadosMembro?.ativo !== false,
    })

    await carregarMeuCadastroMembro()

    mostrarAviso('Seus dados foram atualizados com sucesso!')
    setEditandoMeusDados(false)
  } catch (error) {
    mostrarAviso('Erro ao salvar seus dados.')
    console.error(error)
  } finally {
    setLoading(false)
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

      // Mantém a lista pública de aniversariantes (página inicial) igual ao cadastro de membros.
      reconciliarAniversariantesPublicos(lista).catch((error) =>
        console.error('Erro ao atualizar os aniversariantes da página inicial.', error),
      )
    } catch (error) {
      mostrarAviso('Erro ao carregar membros.')
      console.error(error)
    }
  }

  // Membros cadastrados pelo site, aprovados ou antigos podem não estar na lista pública;
  // aqui cada membro ativo com data de nascimento entra, e quem saiu ou ficou inativo é removido.
  async function reconciliarAniversariantesPublicos(listaMembros) {
    const snapshot = await getDocs(collection(db, 'aniversariantesPublicos'))
    const publicados = new Map(snapshot.docs.map((item) => [item.id, item.data()]))
    const operacoes = []

    for (const membro of listaMembros) {
      const { mes, dia } = obterMesDiaNascimento(membro.nascimento)
      const nome = String(membro.nome || '').trim()
      const devePublicar =
        nome.length >= 2 &&
        mes >= 1 && mes <= 12 &&
        dia >= 1 && dia <= 31 &&
        membro.status !== 'Inativo' &&
        membro.ativo !== false
      const atual = publicados.get(membro.id)
      publicados.delete(membro.id)

      if (!devePublicar) {
        if (atual) operacoes.push((batch) => batch.delete(doc(db, 'aniversariantesPublicos', membro.id)))
        continue
      }

      const dados = {
        membroId: membro.id,
        nome: nome.slice(0, 140),
        mes,
        dia,
        ministerio: membro.ministerio || '',
        foto: membro.foto || '',
        ativo: true,
      }
      const igual =
        atual && Object.keys(dados).every((chave) => atual[chave] === dados[chave])

      if (!igual) {
        operacoes.push((batch) =>
          batch.set(doc(db, 'aniversariantesPublicos', membro.id), {
            ...dados,
            atualizadoEm: serverTimestamp(),
          }),
        )
      }
    }

    // O que sobrou não corresponde a nenhum membro cadastrado.
    for (const id of publicados.keys()) {
      operacoes.push((batch) => batch.delete(doc(db, 'aniversariantesPublicos', id)))
    }

    for (let inicio = 0; inicio < operacoes.length; inicio += 400) {
      const batch = writeBatch(db)
      operacoes.slice(inicio, inicio + 400).forEach((aplicar) => aplicar(batch))
      await batch.commit()
    }

    return operacoes.length
  }

  async function carregarTextoEmailAniversario() {
    const snapshot = await getDoc(doc(db, 'configuracoes', 'emailAniversario'))
    const salvo = snapshot.exists() ? snapshot.data() : {}

    return Object.fromEntries(
      Object.keys(TEXTO_PADRAO_EMAIL_ANIVERSARIO).map((chave) => [
        chave,
        salvo[chave] || TEXTO_PADRAO_EMAIL_ANIVERSARIO[chave],
      ]),
    )
  }

  async function salvarTextoEmailAniversario(event) {
    event.preventDefault()
    setSalvandoTextoEmail(true)

    try {
      await setDoc(doc(db, 'configuracoes', 'emailAniversario'), {
        ...Object.fromEntries(
          Object.keys(TEXTO_PADRAO_EMAIL_ANIVERSARIO).map((chave) => [
            chave,
            String(textoEmailAniversario[chave] || '').trim(),
          ]),
        ),
        atualizadoEm: serverTimestamp(),
      })

      mostrarAviso('Texto do e-mail de aniversário salvo com sucesso.', 'sucesso')
    } catch (error) {
      mostrarAviso('Erro ao salvar o texto do e-mail.', 'erro')
      console.error(error)
    } finally {
      setSalvandoTextoEmail(false)
    }
  }

  function restaurarTextoEmailAniversario() {
    if (!confirm('Voltar para o texto padrão? A mudança só vale depois de clicar em Salvar texto.')) return
    setTextoEmailAniversario(TEXTO_PADRAO_EMAIL_ANIVERSARIO)
  }

  async function carregarTextoBoasVindas() {
    const snapshot = await getDoc(doc(db, 'configuracoes', 'emailBoasVindas'))
    const salvo = snapshot.exists() ? snapshot.data() : {}

    return Object.fromEntries(
      Object.keys(TEXTO_PADRAO_BOAS_VINDAS).map((chave) => [
        chave,
        salvo[chave] || TEXTO_PADRAO_BOAS_VINDAS[chave],
      ]),
    )
  }

  async function salvarTextoBoasVindas(event) {
    event.preventDefault()
    setSalvandoBoasVindas(true)

    try {
      await setDoc(doc(db, 'configuracoes', 'emailBoasVindas'), {
        ...Object.fromEntries(
          Object.keys(TEXTO_PADRAO_BOAS_VINDAS).map((chave) => [
            chave,
            String(textoBoasVindas[chave] || '').trim(),
          ]),
        ),
        atualizadoEm: serverTimestamp(),
      })

      mostrarAviso('Texto do e-mail de boas-vindas salvo com sucesso.', 'sucesso')
    } catch (error) {
      mostrarAviso('Erro ao salvar o texto do e-mail de boas-vindas.', 'erro')
      console.error(error)
    } finally {
      setSalvandoBoasVindas(false)
    }
  }

  function restaurarTextoBoasVindas() {
    if (!confirm('Voltar para o texto padrão? A mudança só vale depois de clicar em Salvar texto.')) return
    setTextoBoasVindas(TEXTO_PADRAO_BOAS_VINDAS)
  }

  async function testarTextoBoasVindas() {
    setEnviandoTesteBoasVindas(true)

    try {
      const resultado = await enviarTesteBoasVindas(textoBoasVindas)
      mostrarAviso(resultado.mensagem, 'sucesso')
    } catch (error) {
      mostrarAviso(error.message, 'erro')
    } finally {
      setEnviandoTesteBoasVindas(false)
    }
  }

  // Envio manual (usa o texto salvo). Pode ser repetido, por isso pede confirmação.
  async function enviarBoasVindasParaMembro(membro) {
    if (!membro?.email) {
      mostrarAviso('Este membro não tem e-mail cadastrado.', 'erro')
      return
    }
    if (!confirm(`Enviar o e-mail de boas-vindas para ${membro.nome} (${membro.email})?`)) return

    setEnviandoBoasVindasId(membro.id)

    try {
      const resultado = await enviarBoasVindasManual(membro.id)
      mostrarAviso(resultado.mensagem, resultado.enviado ? 'sucesso' : 'erro')
    } catch (error) {
      mostrarAviso(error.message, 'erro')
    } finally {
      setEnviandoBoasVindasId('')
    }
  }

  useEffect(() => {
    if (modoMembros === 'boasVindas' && isPerfilAdministrador) {
      carregarTextoBoasVindas()
        .then(setTextoBoasVindas)
        .catch((error) => console.error('Erro ao carregar o texto do e-mail de boas-vindas.', error))
    }
  }, [modoMembros, isPerfilAdministrador])

  async function fazerBackupManual() {
    setFazendoBackup(true)

    try {
      mostrarAviso(await fazerBackupAgora(), 'sucesso')
    } catch (error) {
      mostrarAviso(error.message, 'erro')
    } finally {
      setFazendoBackup(false)
    }
  }

  async function enviarTesteEmailAniversario() {
    setEnviandoTesteAniversario(true)

    try {
      mostrarAviso(await enviarEmailAniversarioTeste(textoEmailAniversario), 'sucesso')
    } catch (error) {
      mostrarAviso(error.message, 'erro')
    } finally {
      setEnviandoTesteAniversario(false)
    }
  }

  useEffect(() => {
    if (modoMembros === 'aniversariantes' && isPerfilAdministrador) {
      carregarTextoEmailAniversario()
        .then(setTextoEmailAniversario)
        .catch((error) => console.error('Erro ao carregar o texto do e-mail de aniversário.', error))
    }
  }, [modoMembros, isPerfilAdministrador])

  async function enviarFotoFachada(event) {
    const file = event.target.files?.[0]

    if (!file) return

    setEnviandoFotoFachada(true)

    try {
      const arquivo = await uploadArquivoCloudinary(file)

      setLocalizacaoForm((formAtual) => ({
        ...formAtual,
        fotoFachada: arquivo.url,
      }))

      mostrarAviso('Foto enviada! Clique em "Salvar localização" para publicar.')
    } catch (error) {
      mostrarAviso('Erro ao enviar a foto da fachada.')
      console.error(error)
    } finally {
      setEnviandoFotoFachada(false)
      event.target.value = ''
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

      mostrarAviso('Foto enviada com sucesso!')
    } catch (error) {
      mostrarAviso('Erro ao enviar foto.')
      console.error(error)
    } finally {
      setEnviandoFotoMembro(false)
    }
  }

  async function salvarMembro(event) {
    event.preventDefault()

    if (!membroForm.nome) {
      mostrarAviso('Preencha o nome do membro.')
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
  email: membroForm.email.trim().toLowerCase(),
  receberEmailAniversario: membroForm.receberEmailAniversario !== false,
  ativo: membroForm.status !== 'Inativo',
  atualizadoEm: serverTimestamp(),
}

      if (editandoMembroId) {
        await updateDoc(doc(db, 'membros', editandoMembroId), dadosMembro)
        await sincronizarAniversariantePublico(editandoMembroId, dadosMembro)
        mostrarAviso('Membro atualizado com sucesso!')
      } else {
        const membroRef = await addDoc(collection(db, 'membros'), {
          ...dadosMembro,
          criadoEm: serverTimestamp(),
        })
        await sincronizarAniversariantePublico(membroRef.id, dadosMembro)

        mostrarAviso('Membro cadastrado com sucesso!')
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
  situacaoPastoral: 'Sem acompanhamento',
  ultimoContato: '',
  proximaAcao: '',
  dataProximaAcao: '',
  observacaoAcompanhamento: '',
  email: '',
  receberEmailAniversario: true,
})

      setEditandoMembroId(null)
      await carregarMembros()
      setModoMembros('lista')
    } catch (error) {
      mostrarAviso('Erro ao salvar membro.')
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
      situacaoPastoral: membro.situacaoPastoral || 'Sem acompanhamento',
      ultimoContato: membro.ultimoContato || '',
      proximaAcao: membro.proximaAcao || '',
      dataProximaAcao: membro.dataProximaAcao || '',
      observacaoAcompanhamento: membro.observacaoAcompanhamento || '',
      email: membro.email || '',
      receberEmailAniversario: membro.receberEmailAniversario !== false,
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
      situacaoPastoral: 'Sem acompanhamento',
      ultimoContato: '',
      proximaAcao: '',
      dataProximaAcao: '',
      observacaoAcompanhamento: '',
      email: '',
      receberEmailAniversario: true,
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
      await sincronizarAniversariantePublico(membro.id, {
        ...membro,
        status: novoStatus,
        ativo: novoStatus !== 'Inativo',
      })

      await carregarMembros()
    } catch (error) {
      mostrarAviso('Erro ao alterar status do membro.')
      console.error(error)
    }
  }

  async function excluirMembro(id) {
    const confirmar = confirm('Deseja realmente excluir este membro?')

    if (!confirmar) return

    try {
      await deleteDoc(doc(db, 'membros', id))
      await deleteDoc(doc(db, 'aniversariantesPublicos', id))
      await carregarMembros()
    } catch (error) {
      mostrarAviso('Erro ao excluir membro.')
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
      // "Em acompanhamento" era o valor padrão da ficha; sozinho, não indica acompanhamento real.
      (membro.situacaoPastoral &&
        !['Sem acompanhamento', 'Em acompanhamento'].includes(membro.situacaoPastoral)) ||
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
          <td>${escaparHtml(obterDiaNascimento(membro.nascimento))}</td>
          <td>${escaparHtml(membro.nome)}</td>
          <td>${escaparHtml(membro.telefone)}</td>
          <td>${escaparHtml(calcularIdade(membro.nascimento))} anos</td>
          <td>${escaparHtml(calcularNovaIdade(membro.nascimento))} anos</td>
          <td>${escaparHtml(membro.ministerio)}</td>
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
        <h1>Aniversariantes de ${escaparHtml(nomeMes)}</h1>
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
        .map((campo) => campoCsv(campo))
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
        .map((campo) => campoCsv(campo))
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
        .map((campo) => campoCsv(campo))
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

// Saldo no último dia do último mês selecionado no filtro:
// saldo inicial + arrecadações até essa data - despesas pagas até essa data.
const ultimoMesFiltroFinanceiro = Math.max(
  ...mesesFiltroFinanceiro.map(Number).filter((mes) => mes >= 1 && mes <= 12),
  1,
)
const anoSaldoFinalFinanceiro = Number(anoFiltroFinanceiro) || new Date().getFullYear()
const dataSaldoFinalFinanceiro = `${anoSaldoFinalFinanceiro}-${String(
  ultimoMesFiltroFinanceiro,
).padStart(2, '0')}-${String(
  new Date(anoSaldoFinalFinanceiro, ultimoMesFiltroFinanceiro, 0).getDate(),
).padStart(2, '0')}`
const nomeMesSaldoFinalFinanceiro = new Date(
  anoSaldoFinalFinanceiro,
  ultimoMesFiltroFinanceiro - 1,
  1,
).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

function dataPagamentoDespesa(despesa) {
  return despesa.dataPagamento || despesa.vencimento || ''
}

function calcularSaldoFinalFinanceiro(contaBancariaId) {
  const daConta = (item) => contaBancariaId === undefined || item.contaBancariaId === contaBancariaId
  const inicial = contasBancarias
    .filter((conta) => contaBancariaId === undefined || conta.id === contaBancariaId)
    .reduce((total, conta) => total + Number(conta.saldoInicial || 0), 0)
  const entradas = arrecadacoes
    .filter(
      (item) =>
        item.ativo !== false && daConta(item) && (item.data || '') <= dataSaldoFinalFinanceiro,
    )
    .reduce((total, item) => total + Number(item.valor || 0), 0)
  const saidas = contasPagar
    .filter(
      (item) =>
        item.status === 'Paga' &&
        item.ativo !== false &&
        daConta(item) &&
        dataPagamentoDespesa(item) <= dataSaldoFinalFinanceiro,
    )
    .reduce((total, item) => total + Number(item.valor || 0), 0)
  const emAberto = contasPagar
    .filter(
      (item) =>
        item.status !== 'Paga' &&
        item.status !== 'Cancelada' &&
        item.ativo !== false &&
        daConta(item) &&
        (item.vencimento || '') <= dataSaldoFinalFinanceiro,
    )
    .reduce((total, item) => total + Number(item.valor || 0), 0)

  const realizado = inicial + entradas - saidas
  return { realizado, previsto: realizado - emAberto, emAberto }
}

const saldoFinalMesFinanceiro = calcularSaldoFinalFinanceiro()
const saldoFinalMesPorConta = contasBancarias.map((conta) => ({
  id: conta.id,
  nome: conta.nome,
  ...calcularSaldoFinalFinanceiro(conta.id),
}))

function renderizarSaldoFinalMes() {
  const classeValor = (valor) => (valor < 0 ? 'negative' : '')

  return (
    <section className="finance-month-balance">
      <div className="finance-month-balance-main">
        <span>Saldo final em {nomeMesSaldoFinalFinanceiro}</span>
        <strong className={classeValor(saldoFinalMesFinanceiro.realizado)}>
          {formatarMoeda(saldoFinalMesFinanceiro.realizado)}
        </strong>
        <small>Saldo inicial + arrecadações − despesas pagas até {formatarData(dataSaldoFinalFinanceiro)}</small>
      </div>

      <div className="finance-month-balance-main">
        <span>Saldo previsto</span>
        <strong className={classeValor(saldoFinalMesFinanceiro.previsto)}>
          {formatarMoeda(saldoFinalMesFinanceiro.previsto)}
        </strong>
        <small>
          Descontando {formatarMoeda(saldoFinalMesFinanceiro.emAberto)} em despesas abertas até essa data
        </small>
      </div>

      {saldoFinalMesPorConta.length > 0 && (
        <div className="finance-month-balance-accounts">
          {saldoFinalMesPorConta.map((conta) => (
            <article key={conta.id}>
              <span>{conta.nome}</span>
              <strong className={classeValor(conta.realizado)}>
                {formatarMoeda(conta.realizado)}
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function linhaFinanceiroEstaSelecionada(tabela, id) {
  return linhaFinanceiroSelecionada?.tabela === tabela && linhaFinanceiroSelecionada.id === id
}

function alternarLinhaFinanceiro(tabela, id) {
  setLinhaFinanceiroSelecionada((atual) =>
    atual?.tabela === tabela && atual.id === id ? null : { tabela, id },
  )
}

// Barra que aparece em cima da tabela quando uma linha está marcada.
function renderizarBarraLinhaSelecionada(tabela, lista, descrever, aoEditar) {
  const item =
    linhaFinanceiroSelecionada?.tabela === tabela
      ? lista.find((registro) => registro.id === linhaFinanceiroSelecionada.id)
      : null

  if (!item) {
    return <small>Clique em uma linha para selecionar</small>
  }

  return (
    <div className="finance-selected-bar">
      <span>
        Selecionado: <strong>{descrever(item)}</strong>
      </span>
      <button type="button" className="edit-button" onClick={() => aoEditar(item)}>
        Editar
      </button>
      <button
        type="button"
        className="cancel-button"
        onClick={() => setLinhaFinanceiroSelecionada(null)}
      >
        Desmarcar
      </button>
    </div>
  )
}
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
function renderizarEnsino() {
  const categoriasEnsino = [
    'Revista EBD',
    'Apostila',
    'Estudo bíblico',
    'Discipulado',
    'Crianças',
    'Jovens',
    'Casais',
    'Outros',
  ]

  return (
    <section className="teaching-admin-area">
      <div className="finance-table-toolbar finance-report-toolbar">
        <div>
          <span className="admin-section-label">Ensino</span>

          <h2>Materiais de ensino</h2>

          <p>
            Cadastre revistas, apostilas e estudos em PDF. Depois eles serão
            exibidos no site em formato de revista digital.
          </p>
        </div>
      </div>

      <section className="admin-grid admin-events-grid teaching-admin-grid">
        <form className="admin-card teaching-form-card" onSubmit={salvarEnsinoMaterial}>
          <span className="admin-section-label">
            {editandoEnsinoId ? 'Editar material' : 'Novo material'}
          </span>

          <h2>{editandoEnsinoId ? 'Editar material' : 'Cadastrar material'}</h2>

          <p>
            Envie a capa e o PDF. O material aparece no site como revista
            digital.
          </p>

          <label>
            Título
            <input
              value={ensinoForm.titulo}
              onChange={(event) =>
                setEnsinoForm({
                  ...ensinoForm,
                  titulo: event.target.value,
                })
              }
              placeholder="Ex: Lições Bíblicas - Abraão"
            />
          </label>

          <label>
            Categoria
            <select
              value={ensinoForm.categoria}
              onChange={(event) =>
                setEnsinoForm({
                  ...ensinoForm,
                  categoria: event.target.value,
                })
              }
            >
              {categoriasEnsino.map((categoria) => (
                <option value={categoria} key={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </label>

          <label>
            Autor / professor
            <input
              value={ensinoForm.autor}
              onChange={(event) =>
                setEnsinoForm({
                  ...ensinoForm,
                  autor: event.target.value,
                })
              }
              placeholder="Ex: Professor, Ministério de Ensino"
            />
          </label>

          <label>
            Período
            <input
              value={ensinoForm.periodo}
              onChange={(event) =>
                setEnsinoForm({
                  ...ensinoForm,
                  periodo: event.target.value,
                })
              }
              placeholder="Ex: 2º Trimestre 2026"
            />
          </label>

          <label>
            Descrição
            <textarea
              value={ensinoForm.descricao}
              onChange={(event) =>
                setEnsinoForm({
                  ...ensinoForm,
                  descricao: event.target.value,
                })
              }
              placeholder="Breve descrição do material"
            />
          </label>

          <label>
            Capa do material
            <input
              type="file"
              accept="image/*"
              onChange={enviarCapaEnsino}
              disabled={enviandoCapaEnsino}
            />
          </label>

          {enviandoCapaEnsino && <p>Enviando capa...</p>}

          {ensinoForm.capa && (
            <div className="teaching-cover-preview">
              <img src={ensinoForm.capa} alt="Capa do material" />
            </div>
          )}

          <label>
            Arquivo PDF
            <input
              type="file"
              accept="application/pdf"
              onChange={enviarPdfEnsino}
              disabled={enviandoPdfEnsino}
            />
          </label>

          {enviandoPdfEnsino && (
            <p>
              Enviando PDF
              {progressoPdfEnsino > 0 ? `... ${progressoPdfEnsino}%` : '...'}
            </p>
          )}

          {ensinoForm.pdfUrl && (
            <a
              className="admin-file-link"
              href={ensinoForm.pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir PDF enviado
            </a>
          )}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={ensinoForm.ativo}
              onChange={(event) =>
                setEnsinoForm({
                  ...ensinoForm,
                  ativo: event.target.checked,
                })
              }
            />
            Exibir material no site
          </label>

          <button type="submit" disabled={loading || enviandoCapaEnsino || enviandoPdfEnsino}>
            {loading
              ? 'Salvando...'
              : editandoEnsinoId
                ? 'Salvar alterações'
                : 'Salvar material'}
          </button>

          {editandoEnsinoId && (
            <button
              type="button"
              className="cancel-button"
              onClick={limparFormularioEnsino}
            >
              Cancelar edição
            </button>
          )}
        </form>

        <section className="admin-card teaching-list-card">
          <span className="admin-section-label">Biblioteca</span>

          <h2>Materiais cadastrados</h2>

          <p>
            {ensinoMateriais.length === 1
              ? '1 material cadastrado'
              : `${ensinoMateriais.length} materiais cadastrados`}
            {' · '}
            {ensinoMateriais.filter((material) => material.ativo !== false).length}{' '}
            visíveis no site
          </p>

          <div className="teaching-admin-list">
            {ensinoMateriais.length === 0 && (
              <div className="finance-empty-state">
                <strong>Nenhum material cadastrado.</strong>
                <p>Cadastre o primeiro material pelo formulário ao lado.</p>
              </div>
            )}

            {ensinoMateriais.map((material) => (
              <article
                className={`teaching-admin-item ${
                  material.ativo === false ? 'inactive-item' : ''
                }`}
                key={material.id}
              >
                {material.capa ? (
                  <img src={material.capa} alt={material.titulo} />
                ) : (
                  <div className="teaching-cover-placeholder">PDF</div>
                )}

                <div className="teaching-item-body">
                  <div className="teaching-item-top">
                    <span className="teaching-item-category">
                      {material.categoria || 'Material'}
                    </span>

                    <em
                      className={`teaching-item-status ${
                        material.ativo === false ? 'is-inactive' : ''
                      }`}
                    >
                      {material.ativo === false ? 'Inativo' : 'Visível no site'}
                    </em>
                  </div>

                  <strong className="teaching-item-title">{material.titulo}</strong>

                  {(material.periodo || material.autor) && (
                    <p className="teaching-item-meta">
                      {[material.periodo, material.autor].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {material.descricao && (
                    <p
                      className={`teaching-item-description ${
                        descricoesEnsinoAbertas[material.id] ? 'is-open' : ''
                      }`}
                    >
                      {material.descricao}
                    </p>
                  )}

                  {material.descricao?.length > 180 && (
                    <button
                      type="button"
                      className="teaching-item-more"
                      onClick={() =>
                        setDescricoesEnsinoAbertas((abertas) => ({
                          ...abertas,
                          [material.id]: !abertas[material.id],
                        }))
                      }
                    >
                      {descricoesEnsinoAbertas[material.id] ? 'Ver menos' : 'Ver mais'}
                    </button>
                  )}

                  <div className="admin-actions teaching-item-actions">
                    {material.pdfUrl && (
                      <a
                        className="teaching-open-pdf"
                        href={material.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir PDF
                      </a>
                    )}

                    <button
                      type="button"
                      className="edit-button"
                      onClick={() => editarEnsinoMaterial(material)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={
                        material.ativo === false
                          ? 'activate-button'
                          : 'deactivate-button'
                      }
                      onClick={() => alternarStatusEnsinoMaterial(material)}
                    >
                      {material.ativo === false ? 'Ativar' : 'Inativar'}
                    </button>

                    <button
                      type="button"
                      className="teaching-item-delete"
                      onClick={() => excluirEnsinoMaterial(material.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  )
}
function renderizarJanelaMinhaCarteirinha() {
  if (!minhaCarteirinhaUrl || !minhaCarteirinhaBytes || !minhaCarteirinha) return null
  return (
    <CarteirinhaViewer
      dadosPdf={minhaCarteirinhaBytes}
      urlPdf={minhaCarteirinhaUrl}
      nomeArquivo={`carteirinha-${minhaCarteirinha.numero}.pdf`}
      titulo={`${minhaCarteirinha.numero} · válida até ${formatarData(minhaCarteirinha.validade)}`}
      onFechar={fecharMinhaCarteirinha}
    />
  )
}

function cancelarEdicaoMeusDados() {
  const dados = meusDadosMembro || {}
  setMeusDadosForm((atual) => ({
    ...atual,
    nome: dados.nome || '',
    telefone: dados.telefone || '',
    nascimento: dados.nascimento || '',
    endereco: dados.endereco || '',
    ministerio: dados.ministerio || '',
    foto: dados.foto || '',
    fotoPublicId: dados.fotoPublicId || '',
    observacoes: dados.observacoes || '',
  }))
  setEditandoMeusDados(false)
}

function diasParaAniversario(nascimento) {
  if (!nascimento) return null
  const [, mes, dia] = nascimento.split('-').map(Number)
  if (!mes || !dia) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let proximo = new Date(hoje.getFullYear(), mes - 1, dia)
  if (proximo < hoje) proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia)
  return Math.round((proximo - hoje) / 86400000)
}

function linkWhatsApp(telefone) {
  const numero = String(telefone || '').replace(/\D/g, '').replace(/^55/, '')
  return numero.length >= 10 ? `https://wa.me/55${numero}` : ''
}

function renderizarPerfilMeusDados() {
  const dados = meusDadosMembro || {}
  const idade = dados.nascimento ? calcularIdade(dados.nascimento) : null
  const dias = diasParaAniversario(dados.nascimento)
  const email = dados.email || user?.email || ''
  const ativo = (dados.status || 'Ativo') !== 'Inativo'
  const whatsapp = linkWhatsApp(dados.telefone)
  const valor = (texto) =>
    texto ? <strong>{texto}</strong> : <strong className="md-empty">Não informado</strong>

  return (
    <section className="md">
      <div className="md-hero">
        <div className="md-photo">
          {dados.foto ? (
            <img src={dados.foto} alt={dados.nome || 'Minha foto'} />
          ) : (
            <span>{obterIniciais(dados.nome) || '?'}</span>
          )}
        </div>
        <div className="md-hero-text">
          <span className="md-eyebrow">Meu cadastro</span>
          <h2>{dados.nome || 'Membro'}</h2>
          <div className="md-chips">
            <span className={`md-chip ${ativo ? 'md-chip-ok' : 'md-chip-off'}`}>
              {ativo ? '● ' : '○ '}
              {dados.status || 'Ativo'}
            </span>
            {dados.ministerio && <span className="md-chip">⛪ {dados.ministerio}</span>}
            {idade !== null && <span className="md-chip">{idade} anos</span>}
          </div>
        </div>
      </div>

      <div className="md-actions">
        <button type="button" className="md-edit" onClick={() => setEditandoMeusDados(true)}>
          <span aria-hidden="true">✏️</span>
          Editar meus dados
        </button>
        {minhaCarteirinha && (
          <button
            type="button"
            className="md-card"
            onClick={abrirMinhaCarteirinha}
            disabled={abrindoCarteirinha}
          >
            <span aria-hidden="true">🪪</span>
            {abrindoCarteirinha ? 'Abrindo...' : 'Ver minha carteirinha'}
          </button>
        )}
      </div>

      {dias !== null && (
        <div className="md-birthday">
          <span aria-hidden="true">🎂</span>
          {dias === 0
            ? 'Hoje é o seu aniversário! Feliz aniversário!'
            : dias === 1
              ? 'Seu aniversário é amanhã!'
              : `Faltam ${dias} dias para o seu aniversário (${formatarData(dados.nascimento).slice(0, 5)}).`}
        </div>
      )}

      <div className="md-sections">
        <section className="md-section">
          <h3>Contato</h3>
          <ul>
            <li>
              <span className="md-icon" aria-hidden="true">📞</span>
              <div>
                <small>Telefone</small>
                {valor(dados.telefone)}
              </div>
              {whatsapp && (
                <a className="md-link" href={whatsapp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
            </li>
            <li>
              <span className="md-icon" aria-hidden="true">✉️</span>
              <div>
                <small>E-mail</small>
                {valor(email)}
              </div>
            </li>
          </ul>
        </section>

        <section className="md-section">
          <h3>Dados pessoais</h3>
          <ul>
            <li>
              <span className="md-icon" aria-hidden="true">🎂</span>
              <div>
                <small>Data de nascimento</small>
                {valor(dados.nascimento ? formatarData(dados.nascimento) : '')}
              </div>
            </li>
            <li>
              <span className="md-icon" aria-hidden="true">⛪</span>
              <div>
                <small>Ministério</small>
                {valor(dados.ministerio)}
              </div>
            </li>
          </ul>
        </section>

        <section className="md-section md-section-wide">
          <h3>Endereço</h3>
          <ul>
            <li>
              <span className="md-icon" aria-hidden="true">📍</span>
              <div>
                <small>Onde moro</small>
                {valor(dados.endereco)}
              </div>
            </li>
          </ul>
        </section>

        {dados.observacoes && (
          <section className="md-section md-section-wide">
            <h3>Observações para a secretaria</h3>
            <p className="md-note">{dados.observacoes}</p>
          </section>
        )}
      </div>

      <p className="md-hint">
        Mantenha seus dados atualizados. Eles são usados pela secretaria, nos e-mails de aniversário e na sua carteirinha.
      </p>
    </section>
  )
}

function renderizarMeusDados() {
  if (!permissaoUsuario?.membroId) {
    return (
      <section className="admin-card admin-full-card my-data-card">
        <span className="admin-section-label">Meus dados</span>

        <h2>Cadastro não vinculado</h2>

        <p>
          Seu usuário ainda não está vinculado a um cadastro de membro. Procure
          a administração da igreja para fazer o vínculo.
        </p>
      </section>
    )
  }

  if (!meusDadosMembro) {
    return (
      <section className="admin-card admin-full-card my-data-card">
        <span className="admin-section-label">Meus dados</span>

        <h2>Carregando cadastro</h2>

        <p>Estamos buscando suas informações.</p>
      </section>
    )
  }

  if (!editandoMeusDados) {
    return renderizarPerfilMeusDados()
  }

  return (
    <section className="my-data-area">
      <form className="admin-card my-data-form" onSubmit={salvarMeusDados}>
        <div className="my-data-header">
          <div>
            <span className="admin-section-label">Meus dados</span>

            <h2>Editar meu cadastro</h2>

            <p>
              Atualize suas informações de contato para manter o cadastro da
              igreja sempre correto.
            </p>
          </div>

          <div className="my-data-photo">
            {meusDadosForm.foto ? (
              <img src={meusDadosForm.foto} alt={meusDadosForm.nome} />
            ) : (
              <span>{meusDadosForm.nome?.charAt(0) || '?'}</span>
            )}
          </div>
        </div>

        <div className="my-data-grid">
          <label>
            Nome
            <input
              value={meusDadosForm.nome}
              onChange={(event) =>
                setMeusDadosForm({
                  ...meusDadosForm,
                  nome: event.target.value,
                })
              }
              placeholder="Seu nome completo"
            />
          </label>

          <label>
            Telefone
            <input
              value={meusDadosForm.telefone}
              onChange={(event) =>
                setMeusDadosForm({
                  ...meusDadosForm,
                  telefone: event.target.value,
                })
              }
              placeholder="Seu telefone"
            />
          </label>

          <label>
            Data de nascimento
            <input
              type="date"
              value={meusDadosForm.nascimento}
              onChange={(event) =>
                setMeusDadosForm({
                  ...meusDadosForm,
                  nascimento: event.target.value,
                })
              }
            />
          </label>

          <label>
            Ministério
            <input
              value={meusDadosForm.ministerio}
              onChange={(event) =>
                setMeusDadosForm({
                  ...meusDadosForm,
                  ministerio: event.target.value,
                })
              }
              placeholder="Ex: Louvor, Infantil, Recepção"
            />
          </label>
        </div>

        <label>
          Endereço
          <textarea
            value={meusDadosForm.endereco}
            onChange={(event) =>
              setMeusDadosForm({
                ...meusDadosForm,
                endereco: event.target.value,
              })
            }
            placeholder="Seu endereço completo"
          />
        </label>

        <label>
          Foto
          <input
            type="file"
            accept="image/*"
            onChange={enviarFotoMeusDados}
            disabled={enviandoFotoMeusDados}
          />
        </label>

        {enviandoFotoMeusDados && <p>Enviando foto...</p>}

        <label>
          Observações
          <textarea
            value={meusDadosForm.observacoes}
            onChange={(event) =>
              setMeusDadosForm({
                ...meusDadosForm,
                observacoes: event.target.value,
              })
            }
            placeholder="Alguma informação importante para a secretaria"
          />
        </label>

        <div className="my-data-summary">
          <article>
            <span>Status</span>
            <strong>{meusDadosMembro.status || 'Não informado'}</strong>
          </article>

          <article>
            <span>Idade</span>
            <strong>
              {meusDadosForm.nascimento
                ? `${calcularIdade(meusDadosForm.nascimento)} anos`
                : 'Não informada'}
            </strong>
          </article>
        </div>

        <div className="md-form-actions">
          <button type="submit" disabled={loading || enviandoFotoMeusDados}>
            {loading ? 'Salvando...' : 'Salvar meus dados'}
          </button>
          <button type="button" className="cancel-button" onClick={cancelarEdicaoMeusDados}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}
function renderizarUsuariosPermissoes() {
  const todasPermissoes = [
    { id: 'louvor', nome: 'Louvor: escalas e repertório' },
    { id: 'programacao', nome: 'Programação' },
    { id: 'ensino', nome: 'Ensino' },
    { id: 'eventos', nome: 'Eventos' },
    { id: 'oracao', nome: 'Pedidos de oração' },
    { id: 'midia', nome: 'Vídeos / Mídia' },
    { id: 'documentos', nome: 'Documentos' },
    { id: 'contribuicao', nome: 'Contribuição' },
    { id: 'financeiro', nome: 'Financeiro' },
    { id: 'emailIgreja', nome: 'E-mail da igreja' },
    { id: 'galeria', nome: 'Galeria' },
    { id: 'membros', nome: 'Membros' },
    { id: 'carteirinhas', nome: 'Carteirinhas de membro (requer Membros)' },
    { id: 'localizacao', nome: 'Localização' },
    { id: 'usuarios', nome: 'Permissões' },
    { id: 'meusDados', nome: 'Meus dados' },
  ]

  const membrosParaVinculo = membros
    .filter((membro) => {
      const textoBusca = usuarioPermissaoForm.nome.toLowerCase().trim()

      if (textoBusca.length < 2) return false

      return (
        membro.nome?.toLowerCase().includes(textoBusca) ||
        membro.telefone?.toLowerCase().includes(textoBusca) ||
        membro.ministerio?.toLowerCase().includes(textoBusca)
      )
    })
    .slice(0, 8)

  const membroSelecionadoPermissao = usuarioPermissaoForm.membroId
    ? membros.find((membro) => membro.id === usuarioPermissaoForm.membroId)
    : null
  const emailsDuplicados = usuariosPermissoes.reduce((emails, usuario) => {
    const emailUsuario = usuario.email?.trim().toLowerCase()

    if (!emailUsuario) return emails

    const total = usuariosPermissoes.filter(
      (item) => item.email?.trim().toLowerCase() === emailUsuario,
    ).length

    if (total > 1) {
      emails.add(emailUsuario)
    }

    return emails
  }, new Set())

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

        {isSuperAdmin && (
          <button
            type="button"
            className="backup-now-button"
            onClick={fazerBackupManual}
            disabled={fazendoBackup}
            title="Salva agora uma cópia de todos os dados no Google Drive de backup. A cópia automática roda todo dia às 3h."
          >
            {fazendoBackup ? 'Salvando backup...' : '💾 Fazer backup agora'}
          </button>
        )}
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
            Digite o nome do membro já cadastrado. Ao clicar na sugestão, o
            vínculo será feito automaticamente.
          </p>

          <div className="permission-name-autocomplete">
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
                    membroId: '',
                  }))
                }
                placeholder="Digite o nome para buscar um membro"
              />
            </label>

            {usuarioPermissaoForm.nome.trim().length >= 2 &&
              !usuarioPermissaoForm.membroId &&
              membrosParaVinculo.length > 0 && (
                <div className="permission-name-results">
                  {membrosParaVinculo.map((membro) => (
                    <button
                      type="button"
                      key={membro.id}
                      onClick={() =>
                        setUsuarioPermissaoForm((formAtual) => ({
                          ...formAtual,
                          nome: membro.nome || '',
                          membroId: membro.id,
                        }))
                      }
                    >
                      <strong>{membro.nome}</strong>

                      <span>
                        {membro.telefone || 'Sem telefone'}
                        {membro.ministerio ? ` • ${membro.ministerio}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}

            {membroSelecionadoPermissao && (
              <div className="permission-member-linked">
                <span>Membro vinculado automaticamente</span>

                <strong>{membroSelecionadoPermissao.nome}</strong>

                <button
                  type="button"
                  onClick={() =>
                    setUsuarioPermissaoForm((formAtual) => ({
                      ...formAtual,
                      membroId: '',
                    }))
                  }
                >
                  Remover vínculo
                </button>
              </div>
            )}
          </div>

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

          {!editandoUsuarioPermissaoId &&
            usuarioPermissaoForm.usuarioExistente && (
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

          {!editandoUsuarioPermissaoId &&
            !usuarioPermissaoForm.usuarioExistente && (
              <label>
                Senha inicial
                <CampoSenha
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

            <p className="users-permission-hint">
              Áreas marcadas como (Administrador) só abrem para o perfil
              Administrador. A aba Louvor também abre automaticamente para
              quem tem "Louvor" no ministério do cadastro.
              {!isSuperAdmin &&
                ' A permissão Financeiro só pode ser alterada pelo administrador geral.'}
            </p>

            <div>
              {todasPermissoes.map((permissao) => (
                <label
                  key={permissao.id}
                  title={
                    permissao.id === 'financeiro' && !isSuperAdmin
                      ? 'Somente o administrador geral pode conceder ou retirar o Financeiro.'
                      : ABAS_SO_ADMINISTRADOR.includes(permissao.id)
                        ? 'Esta área só fica disponível para o perfil Administrador.'
                        : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={usuarioPermissaoForm.permissoes.includes(
                      permissao.id,
                    )}
                    disabled={permissao.id === 'financeiro' && !isSuperAdmin}
                    onChange={() => alternarPermissaoUsuario(permissao.id)}
                  />

                  <span>
                    {permissao.nome}
                    {ABAS_SO_ADMINISTRADOR.includes(permissao.id) && ' (Administrador)'}
                    {permissao.id === 'financeiro' && !isSuperAdmin && ' 🔒'}
                  </span>
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

            {usuariosPermissoes.map((usuarioPermissao) => {
              const emailUsuario = usuarioPermissao.email?.trim().toLowerCase()
              const emailDuplicado = emailsDuplicados.has(emailUsuario)

              return (
              <article
                className={`users-permission-item ${
                  usuarioPermissao.aguardandoAprovacao
                    ? 'pending-approval-item'
                    : ''
                } ${emailDuplicado ? 'duplicate-email-item' : ''}`}
                key={usuarioPermissao.id}
              >
                <div>
                  <span>
                    {PERFIS_USUARIOS[usuarioPermissao.perfil] ||
                      usuarioPermissao.perfil}
                  </span>

                  <strong>{usuarioPermissao.nome}</strong>

                  <p>{usuarioPermissao.email}</p>

                  {emailDuplicado && (
                    <small className="user-duplicate-warning">
                      E-mail duplicado. Remova um dos acessos para este e-mail.
                    </small>
                  )}

                  <small className="user-permission-modules">
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
                    {usuarioPermissao.aguardandoAprovacao
                      ? 'Pendente aprovação'
                      : usuarioPermissao.ativo === false
                        ? 'Inativo'
                        : 'Ativo'}
                  </em>
                </div>

                <div className="admin-actions">
                  {usuarioPermissao.aguardandoAprovacao && (
                    <button
                      type="button"
                      className="approve-button"
                      onClick={() => aprovarUsuarioPendente(usuarioPermissao)}
                      disabled={criandoUsuarioAuth}
                    >
                      Aprovar
                    </button>
                  )}

                  {emailDuplicado && (
                    <button
                      type="button"
                      className="remove-access-button"
                      onClick={() => removerUsuarioPermissao(usuarioPermissao)}
                    >
                      Remover duplicado
                    </button>
                  )}

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
              )
            })}
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
          <div className="admin-logo cadastro-logo-marca">
            <img src="/Filhosdagraça.png" alt="Filhos da Graça" />
          </div>
          <h1>{modoEntrada === 'login' ? 'Área do Membro' : 'Cadastro de membro'}</h1>
          <p>
            {modoEntrada === 'login'
              ? 'Entre para acessar sua área ou administrar o site conforme suas permissões.'
              : 'Solicite seu acesso. A liderança fará a aprovação antes da liberação.'}
          </p>

          <div className="login-mode-switch">
            <button
              type="button"
              className={modoEntrada === 'login' ? 'active' : ''}
              onClick={() => setModoEntrada('login')}
            >
              Entrar
            </button>

            <button
              type="button"
              className={modoEntrada === 'cadastro' ? 'active' : ''}
              onClick={() => setModoEntrada('cadastro')}
            >
              Cadastrar
            </button>
          </div>

          {modoEntrada === 'login' ? (
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
                <CampoSenha
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                />
              </label>

              <button type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                className="login-forgot-password"
                onClick={recuperarSenha}
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form className="member-signup-form" onSubmit={cadastrarMembroPendente}>
              <label>
                Nome completo
                <input
                  value={cadastroMembroForm.nome}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      nome: event.target.value,
                    })
                  }
                  placeholder="Seu nome"
                />
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={cadastroMembroForm.email}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="seuemail@exemplo.com"
                />
              </label>

              <label>
                Telefone ou WhatsApp
                <input
                  value={cadastroMembroForm.telefone}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      telefone: event.target.value,
                    })
                  }
                  placeholder="(00) 00000-0000"
                />
              </label>

              <label>
                Nascimento
                <input
                  type="date"
                  value={cadastroMembroForm.nascimento}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      nascimento: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Ministério
                <input
                  value={cadastroMembroForm.ministerio}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      ministerio: event.target.value,
                    })
                  }
                  placeholder="Opcional"
                />
              </label>

              <label>
                Endereço
                <textarea
                  value={cadastroMembroForm.endereco}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      endereco: event.target.value,
                    })
                  }
                  placeholder="Opcional"
                />
              </label>

              <label>
                Senha
                <CampoSenha
                  value={cadastroMembroForm.senha}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      senha: event.target.value,
                    })
                  }
                  placeholder="Mínimo 6 caracteres"
                />
              </label>

              <label>
                Confirmar senha
                <CampoSenha
                  value={cadastroMembroForm.confirmarSenha}
                  onChange={(event) =>
                    setCadastroMembroForm({
                      ...cadastroMembroForm,
                      confirmarSenha: event.target.value,
                    })
                  }
                  placeholder="Repita a senha"
                />
              </label>

              <button type="submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Solicitar cadastro'}
              </button>
            </form>
          )}
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <section className="login-card">
          <h1>
            {permissaoUsuario?.ativo === false
              ? 'Cadastro em análise'
              : 'Acesso negado'}
          </h1>
          <p>
            {permissaoUsuario?.ativo === false
              ? 'Seu cadastro foi recebido e precisa ser aprovado pela liderança antes do acesso.'
              : 'Seu usuário não tem permissão para administrar este site.'}
          </p>
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

  <div className="admin-user-chip" title={user?.email || ''}>
    <span className="admin-user-avatar" aria-hidden="true">
      {obterIniciais(nomeUsuarioLogado) || '?'}
    </span>

    <div>
      <strong>{nomeUsuarioLogado}</strong>
      <small>
        {PERFIS_USUARIOS[perfilUsuario] || 'Usuário'}
        {user?.email && nomeUsuarioLogado !== user.email ? ` · ${user.email}` : ''}
      </small>
    </div>
  </div>

  {usuarioPodeAcessar('emailIgreja') && (
    <a
      className="admin-email-button"
      href={ENDERECO_EMAIL_IGREJA}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir o e-mail da igreja (Zoho Mail) em outra aba"
    >
      <span aria-hidden="true">✉️</span>
      E-mail da igreja
    </a>
  )}

  <button onClick={sair}>Sair</button>
</header>

   <nav
  className={`admin-tabs admin-tabs-grouped ${
    menuAdminMobileAberto ? 'mobile-open' : ''
  }`}
>
  <button
    type="button"
    className="admin-mobile-menu-toggle"
    onClick={() => setMenuAdminMobileAberto(!menuAdminMobileAberto)}
  >
    <span>☰</span>
    Menu administrativo
  </button>
  {usuarioPodeAcessar('programacao') && (
    <button
      type="button"
      className={abaAtiva === 'programacao' ? 'active' : ''}
      onClick={() => abrirAbaAdmin('programacao')}
    >
      Programação
    </button>
  )}
{usuarioPodeAcessar('louvor') && (
  <button type="button" className={abaAtiva === 'louvor' ? 'active' : ''}
    onClick={() => abrirAbaAdmin('louvor')}>Louvor</button>
)}
{usuarioPodeAcessar('ensino') && (
  <button
    type="button"
    className={abaAtiva === 'ensino' ? 'active' : ''}
    onClick={() => abrirAbaAdmin('ensino')}
  >
    Biblioteca
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
{usuarioPodeAcessar('meusDados') && (
  <button
    type="button"
    className={abaAtiva === 'meusDados' ? 'active' : ''}
    onClick={() => setAbaAtiva('meusDados')}
  >
    Meus dados
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
    usuarioPodeAcessar('eventos') ||
    usuarioPodeAcessar('documentos')) && (
    <div
  className={`admin-tab-group ${
    ['midia', 'galeria', 'eventos', 'documentos'].includes(abaAtiva) ? 'active' : ''
  } ${grupoMenuAberto === 'midia' ? 'open' : ''}`}
>
  <button
    type="button"
    onClick={() =>
      setGrupoMenuAberto(grupoMenuAberto === 'midia' ? null : 'midia')
    }
  >
    Vídeos
    <span>▾</span>
  </button>

      <div className="admin-submenu">
        {usuarioPodeAcessar('midia') && (
          <button
            type="button"
            className={abaAtiva === 'midia' ? 'active' : ''}
            onClick={() => abrirAbaAdmin('midia')}
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

        {usuarioPodeAcessar('documentos') && (
          <button
            type="button"
            className={abaAtiva === 'documentos' ? 'active' : ''}
            onClick={() => setAbaAtiva('documentos')}
          >
            Documentos
          </button>
        )}
      </div>
    </div>
  )}

  {(usuarioPodeAcessar('financeiro') ||
    usuarioPodeAcessar('contribuicao')) && (
   <div
  className={`admin-tab-group ${
    ['financeiro', 'contribuicao'].includes(abaAtiva) ? 'active' : ''
  } ${grupoMenuAberto === 'financeiro' ? 'open' : ''}`}
>
  <button
    type="button"
    onClick={() =>
      setGrupoMenuAberto(
        grupoMenuAberto === 'financeiro' ? null : 'financeiro',
      )
    }
  >
    Financeiro
    <span>▾</span>
  </button>

      <div className="admin-submenu">
        {usuarioPodeAcessar('financeiro') && (
          <button
            type="button"
            className={abaAtiva === 'financeiro' ? 'active' : ''}
            onClick={() => abrirAbaAdmin('financeiro')}
          >
            Gestão financeira
          </button>
        )}

        {usuarioPodeAcessar('contribuicao') && (
          <button
            type="button"
            className={abaAtiva === 'contribuicao' ? 'active' : ''}
            onClick={() => abrirAbaAdmin('contribuicao')}
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
{abaAtiva === 'louvor' && usuarioPodeAcessar('louvor') && <Louvor user={user} />}
{abaAtiva === 'ensino' &&
  usuarioPodeAcessar('ensino') &&
  renderizarEnsino()}
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

          <form className="admin-card" onSubmit={salvarYoutubeConfig}>
            <span className="admin-section-label">Canal do YouTube</span>
            <h2>Integração automática</h2>
            <p>
              Configure o canal para a página inicial carregar automaticamente os
              vídeos mais novos. A playlist de uploads começa com UU; se você
              informar apenas o Channel ID começando com UC, o site converte
              automaticamente.
            </p>

            <label>
              YouTube API key
              <input
                value={youtubeConfigForm.apiKey}
                onChange={(event) =>
                  setYoutubeConfigForm({
                    ...youtubeConfigForm,
                    apiKey: event.target.value,
                  })
                }
                placeholder="Cole a API key do Google Cloud"
              />
            </label>

            <label>
              Channel ID
              <input
                value={youtubeConfigForm.channelId}
                onChange={(event) =>
                  setYoutubeConfigForm({
                    ...youtubeConfigForm,
                    channelId: event.target.value,
                  })
                }
                placeholder="Ex: UCxxxxxxxxxxxxxxxxxxxxxx"
              />
            </label>

            <label>
              Playlist de uploads
              <input
                value={youtubeConfigForm.uploadsPlaylistId}
                onChange={(event) =>
                  setYoutubeConfigForm({
                    ...youtubeConfigForm,
                    uploadsPlaylistId: event.target.value,
                  })
                }
                placeholder="Ex: UUxxxxxxxxxxxxxxxxxxxxxx"
              />
            </label>

            <label>
              Limite de vídeos carregados
              <input
                type="number"
                min="1"
                max="200"
                value={youtubeConfigForm.limiteVideos}
                onChange={(event) =>
                  setYoutubeConfigForm({
                    ...youtubeConfigForm,
                    limiteVideos: event.target.value,
                  })
                }
              />
            </label>

            <label className="finance-toggle-label">
              <input
                type="checkbox"
                checked={youtubeConfigForm.ativo}
                onChange={(event) =>
                  setYoutubeConfigForm({
                    ...youtubeConfigForm,
                    ativo: event.target.checked,
                  })
                }
              />
              <span>Usar integração automática no site</span>
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar integração'}
            </button>
          </form>

          <section className="admin-card admin-span-full">
            <span className="admin-section-label">Página inicial</span>
            <h2>Vídeos cadastrados</h2>
            <p>
              Estes vídeos continuam como fallback caso a integração automática
              não esteja configurada ou fique indisponível.
            </p>

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
      <FinanceiroDashboard
        arrecadacoes={arrecadacoes}
        contasPagar={contasPagar}
        contasBancarias={contasBancarias}
        aprovisionamentos={aprovisionamentos}
        aoAbrir={setModoFinanceiro}
      />
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

    {renderizarSaldoFinalMes()}
    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Relação de arrecadações</strong>

        {renderizarBarraLinhaSelecionada(
          'arrecadacoes',
          arrecadacoesFiltradasFinanceiro,
          (item) => `${formatarData(item.data)} · ${item.descricao} · ${formatarMoeda(item.valor)}`,
          editarArrecadacao,
        )}
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
            </tr>
          </thead>

          <tbody>
           {arrecadacoesFiltradasFinanceiro.length === 0 && (
              <tr>
                <td colSpan="8" className="finance-empty-table">
                  Nenhuma arrecadação cadastrada ainda.
                </td>
              </tr>
            )}

            {arrecadacoesFiltradasFinanceiro.map((arrecadacao) => (
              <tr
                key={arrecadacao.id}
                className={`${arrecadacao.ativo === false ? 'finance-row-canceled' : ''} ${
                  linhaFinanceiroEstaSelecionada('arrecadacoes', arrecadacao.id)
                    ? 'finance-row-selected'
                    : ''
                }`}
                onClick={() => alternarLinhaFinanceiro('arrecadacoes', arrecadacao.id)}
                onDoubleClick={() => editarArrecadacao(arrecadacao)}
                aria-selected={linhaFinanceiroEstaSelecionada('arrecadacoes', arrecadacao.id)}
                tabIndex={0}
                aria-label={`Selecionar arrecadação: ${arrecadacao.descricao}`}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    editarArrecadacao(arrecadacao)
                  }
                }}
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

            <div className="finance-modal-actions" style={{ flexWrap: 'wrap' }}>
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

              {editandoArrecadacaoId && (
                <>
                  <button
                    type="button"
                    className={arrecadacaoForm.ativo ? 'deactivate-button' : 'activate-button'}
                    disabled={loading || enviandoComprovanteArrecadacao}
                    onClick={() => alternarStatusArrecadacao(
                      arrecadacoes.find((item) => item.id === editandoArrecadacaoId),
                    )}
                  >
                    {arrecadacoes.find((item) => item.id === editandoArrecadacaoId)?.ativo === false
                      ? 'Reativar arrecadação'
                      : 'Cancelar arrecadação'}
                  </button>
                  <button
                    type="button"
                    disabled={loading || enviandoComprovanteArrecadacao}
                    onClick={() => excluirArrecadacao(editandoArrecadacaoId)}
                  >
                    Excluir
                  </button>
                </>
              )}
              <button
                type="button"
                className="cancel-button"
                disabled={loading}
                onClick={cancelarEdicaoArrecadacao}
              >
                Fechar
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

    {renderizarSaldoFinalMes()}
    <section className="finance-spreadsheet-card">
      <div className="finance-spreadsheet-topbar">
        <strong>Relação de contas a pagar</strong>
        {renderizarBarraLinhaSelecionada(
          'contasPagar',
          contasPagarFiltradasFinanceiro,
          (item) => `${formatarData(item.vencimento)} · ${item.descricao} · ${formatarMoeda(item.valor)}`,
          editarContaPagar,
        )}
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
                  className={`${
                    statusVisual === 'Vencida'
                      ? 'finance-row-overdue'
                      : statusVisual === 'Paga'
                        ? 'finance-row-paid'
                        : statusVisual === 'Cancelada'
                          ? 'finance-row-canceled'
                          : ''
                  } ${linhaFinanceiroEstaSelecionada('contasPagar', conta.id) ? 'finance-row-selected' : ''}`}
                  onClick={() => alternarLinhaFinanceiro('contasPagar', conta.id)}
                  onDoubleClick={() => editarContaPagar(conta)}
                  aria-selected={linhaFinanceiroEstaSelecionada('contasPagar', conta.id)}
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
        {renderizarBarraLinhaSelecionada(
          'aprovisionamentos',
          aprovisionamentos,
          (item) => `${formatarData(item.data)} · ${item.descricao} · ${formatarMoeda(item.valor)}`,
          editarAprovisionamento,
        )}
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
                className={`${
                  item.status === 'Cancelado'
                    ? 'finance-row-canceled'
                    : item.status === 'Utilizado'
                      ? 'finance-row-paid'
                      : ''
                } ${linhaFinanceiroEstaSelecionada('aprovisionamentos', item.id) ? 'finance-row-selected' : ''}`}
                onClick={() => alternarLinhaFinanceiro('aprovisionamentos', item.id)}
                onDoubleClick={() => editarAprovisionamento(item)}
                aria-selected={linhaFinanceiroEstaSelecionada('aprovisionamentos', item.id)}
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

  <div className="finance-export-actions">
    <button type="button" className="finance-primary-action" onClick={exportarRelatorioFinanceiroPdf} disabled={gerandoPdfFinanceiro}>
      {gerandoPdfFinanceiro ? 'Gerando PDF...' : 'Imprimir / PDF'}
    </button>
    <button type="button" className="finance-primary-action" onClick={exportarRelatorioFinanceiroExcel}>
      📊 Exportar Excel
    </button>
  </div>
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
          Fotos e vídeos
          <input
            id="gallery-images-input"
            className="gallery-hidden-file-input"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={enviarImagemGaleria}
            disabled={enviandoImagemGaleria}
          />
        </label>

        <div className="gallery-add-more-actions">
          <label htmlFor="gallery-images-input" className="gallery-add-more-button">
            <span>+</span>
            {imagensGaleria.length > 0 ? 'Adicionar mais fotos ou vídeos' : 'Selecionar fotos ou vídeos'}
          </label>

          {imagensGaleria.length > 0 && (
            <button
              type="button"
              className="gallery-save-extra-button"
              onClick={adicionarFotosAoEventoGaleria}
              disabled={loading || enviandoImagemGaleria}
            >
              Salvar {imagensGaleria.length} {imagensGaleria.length > 1 ? 'itens' : 'item'} neste evento
            </button>
          )}
        </div>

        {enviandoImagemGaleria && (
          <p className="upload-feedback">
            Enviando... {progressoGaleria > 0 ? `${progressoGaleria}%` : ''}
          </p>
        )}

        <small className="member-field-hint">
          Vídeos de até 100 MB (cerca de 2 a 3 minutos em boa qualidade). Para vídeos longos, prefira o YouTube na aba Mídia.
        </small>

        {imagensGaleria.length > 0 && (
          <div className="gallery-multiple-preview">
            {imagensGaleria.map((imagem) => (
              <div
                className={`gallery-image-preview ${imagem.tipo === 'video' ? 'gallery-item-video' : ''}`}
                key={imagem.publicId}
              >
                <img
                  src={imagem.url}
                  alt={galeriaForm.titulo || 'Prévia'}
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
            className={`gallery-album-thumb-button ${foto.tipo === 'video' ? 'gallery-item-video' : ''}`}
            onClick={() => editarFotoGaleria(foto)}
          >
            <img src={foto.imagem} alt={`${foto.titulo} ${index + 1}`} />

            <small>
              {foto.id === editandoFotoId
                ? 'Selecionado'
                : `${foto.tipo === 'video' ? 'Vídeo' : 'Foto'} ${index + 1}`}
            </small>
          </button>

          <button
            type="button"
            className="gallery-delete-single-photo"
            onClick={() => excluirFotoIndividualGaleria(foto)}
          >
            {foto.tipo === 'video' ? 'Excluir vídeo' : 'Excluir foto'}
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

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={galeriaForm.autoLoop}
            onChange={(event) =>
              setGaleriaForm({
                ...galeriaForm,
                autoLoop: event.target.checked,
              })
            }
          />
          Vídeos rodando automaticamente em loop (sem som)
        </label>

        <button type="submit" disabled={loading || enviandoImagemGaleria}>
  {loading
    ? 'Salvando...'
    : editandoFotoId
      ? 'Salvar alterações do álbum'
      : imagensGaleria.length > 1
        ? `Cadastrar ${imagensGaleria.length} itens`
        : 'Cadastrar na galeria'}
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
  <div className={`member-mode-actions member-mode-actions-four ${isPerfilAdministrador ? 'member-mode-actions-five' : ''}`}>
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

  {usuarioPodeAcessar('carteirinhas') && (
    <button
      type="button"
      className={modoMembros === 'carteirinhas' ? 'active' : ''}
      onClick={() => {
        cancelarEdicaoMembro()
        setModoMembros('carteirinhas')
      }}
    >
      <span>🪪</span>
      Carteirinhas
    </button>
  )}

  {isPerfilAdministrador && (
    <button
      type="button"
      className={modoMembros === 'boasVindas' ? 'active' : ''}
      onClick={() => {
        cancelarEdicaoMembro()
        setModoMembros('boasVindas')
      }}
    >
      <span>✉️</span>
      E-mail de boas-vindas
    </button>
  )}
</div>
<div className="admin-grid admin-events-grid">
 <form
  className={`admin-card member-form-panel ${
    modoMembros === 'lista' || modoMembros === 'aniversariantes' || modoMembros === 'boasVindas' || modoMembros === 'carteirinhas'
      ? 'member-hidden-panel'
      : ''
  } ${
    modoMembros === 'pastoral' ? 'member-form-pastoral' : 'member-form-cadastro'
  }`}
  onSubmit={salvarMembro}
>
  <div className="member-form-header">
    <div className="member-form-avatar">
      {membroForm.foto ? (
        <img src={membroForm.foto} alt={membroForm.nome || 'Foto do membro'} />
      ) : (
        <span>{obterIniciais(membroForm.nome) || '?'}</span>
      )}
    </div>

    <div className="member-form-heading">
      <span className="admin-section-label">
        {modoMembros === 'pastoral' ? 'Cuidado pastoral' : 'Membros'}
      </span>

      <h2>
        {editandoMembroId
          ? membroForm.nome || 'Editar membro'
          : modoMembros === 'pastoral'
            ? 'Acompanhamento pastoral'
            : 'Cadastrar membro'}
      </h2>

      <p>
        {modoMembros === 'pastoral'
          ? 'Registre informações de cuidado, contato, próxima ação e acompanhamento.'
          : editandoMembroId
            ? 'Atualize os dados do cadastro e salve as alterações.'
            : 'Cadastre membros, visitantes e pessoas acompanhadas pela igreja.'}
      </p>

      {modoMembros !== 'pastoral' && (
        <label className="member-photo-button">
          <input
            type="file"
            accept="image/*"
            onChange={enviarFotoMembro}
            disabled={enviandoFotoMembro}
          />
          {enviandoFotoMembro
            ? 'Enviando foto...'
            : membroForm.foto
              ? 'Trocar foto'
              : 'Adicionar foto'}
        </label>
      )}
    </div>

    {editandoMembroId && membroForm.status && (
      <em className="member-form-status">{membroForm.status}</em>
    )}
  </div>

  <fieldset className="member-form-section">
    <legend>{modoMembros === 'pastoral' ? 'Contato' : 'Dados pessoais'}</legend>

    <label className="member-field-wide">
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

    {modoMembros !== 'pastoral' && (
      <label>
        E-mail
        <input
          type="email"
          value={membroForm.email}
          onChange={(event) =>
            setMembroForm({
              ...membroForm,
              email: event.target.value,
            })
          }
          placeholder="email@exemplo.com"
        />
      </label>
    )}

    {modoMembros !== 'pastoral' && (
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
        {membroForm.nascimento && (
          <small className="member-field-hint">
            {calcularIdade(membroForm.nascimento)} anos
          </small>
        )}
      </label>
    )}
  </fieldset>

  {modoMembros !== 'pastoral' && (
    <>
      <fieldset className="member-form-section">
        <legend>Endereço e igreja</legend>

        <label className="member-field-wide">
          Endereço
          <input
            value={membroForm.endereco}
            onChange={(event) =>
              setMembroForm({
                ...membroForm,
                endereco: event.target.value,
              })
            }
            placeholder="Rua, número, bairro e cidade"
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
            <option value="Pendente aprovação">Pendente aprovação</option>
            <option value="Visitante">Visitante</option>
            <option value="Afastado">Afastado</option>
            <option value="Inativo">Inativo</option>
          </select>
        </label>

        <label className="checkbox-label member-field-wide">
          <input
            type="checkbox"
            checked={membroForm.receberEmailAniversario !== false}
            onChange={(event) =>
              setMembroForm({
                ...membroForm,
                receberEmailAniversario: event.target.checked,
              })
            }
          />
          Enviar e-mail de felicitações no aniversário
        </label>
      </fieldset>

      <fieldset className="member-form-section">
        <legend>Observações internas</legend>

        <label className="member-field-wide">
          <span className="member-sr-only">Observações internas</span>
          <textarea
            value={membroForm.observacoes}
            onChange={(event) =>
              setMembroForm({
                ...membroForm,
                observacoes: event.target.value,
              })
            }
            placeholder="Acompanhamento, família ou integração. Visível apenas para a liderança."
          />
        </label>
      </fieldset>
    </>
  )}

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

  <div className="member-form-actions">
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
  </div>
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
      <option value="Pendente aprovação">Pendente aprovação</option>
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
                      {obterIniciais(membro.nome) || '?'}
                    </div>
                  )}

                  <div className="member-info">
                    <div className="member-card-title">
                      <strong>{membro.nome}</strong>

                      <span
                        className={`member-status-pill status-${String(
                          membro.status || 'Ativo',
                        )
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {membro.status || 'Ativo'}
                      </span>

                      {acessoPendenteDoMembro(membro) && (
                        <span className="member-status-pill status-pendente-aprovacao">
                          Login aguardando aprovação
                        </span>
                      )}

                      {temAcompanhamentoPastoral(membro) && (
                        <span
                          className="member-pastoral-pill"
                          title="Possui acompanhamento pastoral"
                        >
                          💚 Acompanhamento
                        </span>
                      )}
                    </div>

                    <div className="member-card-meta">
                      {membro.telefone && <span>📞 {membro.telefone}</span>}

                      {membro.nascimento && (
                        <span>
                          🎂 {formatarData(membro.nascimento)} ·{' '}
                          {calcularIdade(membro.nascimento)} anos
                        </span>
                      )}

                      {membro.ministerio && <span>⛪ {membro.ministerio}</span>}
                    </div>

                    {membro.endereco && (
                      <p className="member-card-address">📍 {membro.endereco}</p>
                    )}

                    {(membro.observacoes || temAcompanhamentoPastoral(membro)) && (
                      <details className="member-card-details">
                        <summary>Observações e acompanhamento</summary>

                        <div className="member-details">
                          {membro.observacoes && (
                            <small>
                              <b>Observações:</b> {membro.observacoes}
                            </small>
                          )}

                          {temAcompanhamentoPastoral(membro) && membro.situacaoPastoral && (
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
                              <b>Data da próxima ação:</b>{' '}
                              {formatarData(membro.dataProximaAcao)}
                            </small>
                          )}

                          {membro.observacaoAcompanhamento && (
                            <small>
                              <b>Obs. acompanhamento:</b>{' '}
                              {membro.observacaoAcompanhamento}
                            </small>
                          )}
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="admin-actions member-card-actions">
                    {acessoPendenteDoMembro(membro) && (
                      <button
                        type="button"
                        className="approve-button"
                        onClick={() => aprovarUsuarioPendente(acessoPendenteDoMembro(membro))}
                        disabled={criandoUsuarioAuth}
                      >
                        Aprovar acesso
                      </button>
                    )}

                    {isPerfilAdministrador && membro.email && (
                      <button
                        type="button"
                        className="welcome-button"
                        onClick={() => enviarBoasVindasParaMembro(membro)}
                        disabled={enviandoBoasVindasId === membro.id}
                        title="Enviar o e-mail de boas-vindas"
                      >
                        {enviandoBoasVindasId === membro.id ? 'Enviando...' : '✉️ Boas-vindas'}
                      </button>
                    )}

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

          {modoMembros === 'carteirinhas' &&
            (usuarioPodeAcessar('carteirinhas') ? (
              <Carteirinhas membros={membros} />
            ) : (
              <section className="admin-card">
                <h2>Sem acesso às carteirinhas</h2>
                <p>Peça a um administrador para liberar a permissão “Carteirinhas de membro”.</p>
              </section>
            ))}

          {modoMembros === 'boasVindas' && isPerfilAdministrador && (
            <section className="admin-card member-welcome-card">
              <div className="member-welcome-header">
                <span className="admin-section-label">E-mail de boas-vindas</span>
                <h2>✉️ Boas-vindas para novos membros</h2>
                <p>
                  Enviado automaticamente quando o acesso de quem se cadastrou pelo site é liberado.
                  Você também pode enviar manualmente para qualquer membro com e-mail.
                </p>
              </div>

              <div className="member-welcome-send">
                <label>
                  Enviar agora para
                  <select
                    value={membroBoasVindasId}
                    onChange={(event) => setMembroBoasVindasId(event.target.value)}
                  >
                    <option value="">Escolha um membro</option>
                    {membros
                      .filter((membro) => membro.email)
                      .slice()
                      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
                      .map((membro) => (
                        <option key={membro.id} value={membro.id}>
                          {membro.nome} — {membro.email}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!membroBoasVindasId || Boolean(enviandoBoasVindasId)}
                  onClick={() =>
                    enviarBoasVindasParaMembro(membros.find((membro) => membro.id === membroBoasVindasId))
                  }
                >
                  {enviandoBoasVindasId ? 'Enviando...' : 'Enviar boas-vindas'}
                </button>
                <small className="member-field-hint">
                  O envio usa o texto salvo. Salve as alterações antes de enviar.
                </small>
              </div>

              <form className="birthday-email-editor" onSubmit={salvarTextoBoasVindas}>
              <div className="birthday-email-editor-header member-field-wide">
                <span className="admin-section-label">Texto do e-mail</span>
                <h3>Mensagem de boas-vindas</h3>
                <p>
                  Escreva <code>{'{nome}'}</code> onde deve aparecer o primeiro nome do membro.
                  A logo, as cores e o botão para o site são fixos.
                </p>
              </div>

              <label className="member-field-wide">
                Assunto do e-mail
                <input
                  value={textoBoasVindas.assunto}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, assunto: event.target.value })}
                  maxLength={300}
                />
              </label>
              <label className="member-field-wide">
                Título no topo do e-mail
                <input
                  value={textoBoasVindas.titulo}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, titulo: event.target.value })}
                  maxLength={300}
                />
              </label>
              <label className="member-field-wide">
                Mensagem
                <textarea
                  rows={10}
                  value={textoBoasVindas.mensagem}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, mensagem: event.target.value })}
                  maxLength={4000}
                />
                <small className="member-field-hint">Deixe uma linha em branco entre os parágrafos.</small>
              </label>
              <label>
                Versículo
                <input
                  value={textoBoasVindas.versiculo}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, versiculo: event.target.value })}
                  maxLength={300}
                />
              </label>
              <label>
                Referência do versículo
                <input
                  value={textoBoasVindas.referencia}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, referencia: event.target.value })}
                  maxLength={300}
                />
              </label>
              <label>
                Despedida
                <input
                  value={textoBoasVindas.despedida}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, despedida: event.target.value })}
                  maxLength={300}
                />
              </label>
              <label>
                Assinatura
                <input
                  value={textoBoasVindas.assinatura}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, assinatura: event.target.value })}
                  maxLength={300}
                />
              </label>
              <label className="member-field-wide">
                Complemento da assinatura
                <input
                  value={textoBoasVindas.assinaturaComplemento}
                  onChange={(event) => setTextoBoasVindas({ ...textoBoasVindas, assinaturaComplemento: event.target.value })}
                  maxLength={300}
                />
              </label>

              <div className="birthday-email-editor-actions member-field-wide">
                <button type="submit" disabled={salvandoBoasVindas}>
                  {salvandoBoasVindas ? 'Salvando...' : 'Salvar texto'}
                </button>

                <button
                  type="button"
                  className="cancel-button"
                  onClick={testarTextoBoasVindas}
                  disabled={enviandoTesteBoasVindas}
                >
                  {enviandoTesteBoasVindas ? 'Enviando...' : 'Testar no meu e-mail'}
                </button>

                <button type="button" className="cancel-button" onClick={restaurarTextoBoasVindas}>
                  Restaurar texto padrão
                </button>
              </div>
              </form>
            </section>
          )}

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

                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="email-test-button"
                        onClick={enviarTesteEmailAniversario}
                        disabled={enviandoTesteAniversario}
                        title="Envia um exemplo do e-mail de aniversário para o seu e-mail"
                      >
                        {enviandoTesteAniversario ? 'Enviando...' : '✉️ E-mail de teste'}
                      </button>
                    )}
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

              {isPerfilAdministrador && (
                <form className="birthday-email-editor" onSubmit={salvarTextoEmailAniversario}>
                  <div className="birthday-email-editor-header member-field-wide">
                    <span className="admin-section-label">E-mail automático</span>
                    <h3>Mensagem do e-mail de aniversário</h3>
                    <p>
                      Enviada todo dia às 8h para quem faz aniversário. Escreva{' '}
                      <code>{'{nome}'}</code> onde deve aparecer o primeiro nome do
                      aniversariante. A logo e as cores do e-mail são fixas.
                    </p>
                  </div>

                  <label className="member-field-wide">
                    Assunto do e-mail
                    <input
                      value={textoEmailAniversario.assunto}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          assunto: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <label className="member-field-wide">
                    Título no topo do e-mail
                    <input
                      value={textoEmailAniversario.titulo}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          titulo: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <label className="member-field-wide">
                    Mensagem
                    <textarea
                      rows={9}
                      value={textoEmailAniversario.mensagem}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          mensagem: event.target.value,
                        })
                      }
                      maxLength={4000}
                    />
                    <small className="member-field-hint">
                      Deixe uma linha em branco entre os parágrafos.
                    </small>
                  </label>

                  <label>
                    Versículo
                    <input
                      value={textoEmailAniversario.versiculo}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          versiculo: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <label>
                    Referência do versículo
                    <input
                      value={textoEmailAniversario.referencia}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          referencia: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <label>
                    Despedida
                    <input
                      value={textoEmailAniversario.despedida}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          despedida: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <label>
                    Assinatura
                    <input
                      value={textoEmailAniversario.assinatura}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          assinatura: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <label className="member-field-wide">
                    Complemento da assinatura
                    <input
                      value={textoEmailAniversario.assinaturaComplemento}
                      onChange={(event) =>
                        setTextoEmailAniversario({
                          ...textoEmailAniversario,
                          assinaturaComplemento: event.target.value,
                        })
                      }
                      maxLength={300}
                    />
                  </label>

                  <div className="birthday-email-editor-actions member-field-wide">
                    <button type="submit" disabled={salvandoTextoEmail}>
                      {salvandoTextoEmail ? 'Salvando...' : 'Salvar texto'}
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={enviarTesteEmailAniversario}
                        disabled={enviandoTesteAniversario}
                      >
                        {enviandoTesteAniversario ? 'Enviando...' : 'Testar com este texto'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="cancel-button"
                      onClick={restaurarTextoEmailAniversario}
                    >
                      Restaurar texto padrão
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>
      </section>
    )}
{abaAtiva === 'meusDados' &&
  usuarioPodeAcessar('meusDados') &&
  renderizarMeusDados()}
{abaAtiva === 'meusDados' && renderizarJanelaMinhaCarteirinha()}
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
                type="file"
                accept="image/*"
                onChange={enviarFotoFachada}
                disabled={enviandoFotoFachada}
              />
            </label>

            {enviandoFotoFachada && <p>Enviando foto...</p>}

            <label>
              Ou cole o link de uma imagem
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

            <button type="submit" disabled={loading || enviandoFotoFachada}>
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
