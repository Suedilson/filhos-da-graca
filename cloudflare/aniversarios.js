import { fazAniversarioHoje, hojeNaBahia, montarEmailAniversario } from './emailAniversario.js'

// Worker agendado: todo dia de manhã envia o e-mail de aniversário aos membros.
// Segredos (wrangler secret put): FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço) e RESEND_API_KEY.

const ADMIN_GERAL = 'suedilsonfilho@gmail.com'
const dominios = new Set(['https://filhosdagraca.com.br', 'https://www.filhosdagraca.com.br', 'https://filhos-da-graca.web.app', 'https://filhos-da-graca.firebaseapp.com', 'http://localhost:5173'])

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64url(texto) {
  return Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
}

// Token de acesso do Google a partir da conta de serviço do Firebase.
async function tokenGoogle(env) {
  const conta = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const dados = base64url(new TextEncoder().encode(JSON.stringify({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  })))
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const chave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${cabecalho}.${dados}`))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${cabecalho}.${dados}.${base64url(assinatura)}`,
  })
  if (!r.ok) throw new Error(`Falha ao autenticar no Google (HTTP ${r.status})`)
  return (await r.json()).access_token
}

function urlFirestore(env, caminho) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/${caminho}`
}

async function listarMembros(env, token) {
  const membros = []
  let pagina = ''
  do {
    const campos = ['nome', 'email', 'nascimento', 'status', 'receberEmailAniversario']
      .map((campo) => `mask.fieldPaths=${campo}`).join('&')
    const r = await fetch(`${urlFirestore(env, 'membros')}?pageSize=300&${campos}${pagina ? `&pageToken=${pagina}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) throw new Error(`Falha ao ler membros (HTTP ${r.status})`)
    const dados = await r.json()
    for (const documento of dados.documents || []) {
      const f = documento.fields || {}
      membros.push({
        id: documento.name.split('/').pop(),
        nome: f.nome?.stringValue || '',
        email: f.email?.stringValue || '',
        nascimento: f.nascimento?.stringValue || '',
        status: f.status?.stringValue || 'Ativo',
        receberEmailAniversario: f.receberEmailAniversario?.booleanValue !== false,
      })
    }
    pagina = dados.nextPageToken || ''
  } while (pagina)
  return membros
}

// Marca o envio do ano antes de mandar o e-mail; se a marca já existe, o membro já recebeu.
async function reservarEnvio(env, token, id) {
  const r = await fetch(`${urlFirestore(env, 'emailsAniversario')}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { enviadoEm: { timestampValue: new Date().toISOString() } } }),
  })
  if (r.status === 409) return false
  if (!r.ok) throw new Error(`Falha ao registrar envio (HTTP ${r.status})`)
  return true
}

async function liberarEnvio(env, token, id) {
  await fetch(urlFirestore(env, `emailsAniversario/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Texto do e-mail salvo pelo administrador no painel; sem ele, vale o texto padrão.
async function carregarTextoEmail(env, token) {
  const r = await fetch(urlFirestore(env, 'configuracoes/emailAniversario'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (r.status === 404) return {}
  if (!r.ok) throw new Error(`Falha ao ler o texto do e-mail (HTTP ${r.status})`)
  const campos = (await r.json()).fields || {}
  return Object.fromEntries(Object.entries(campos).map(([chave, valor]) => [chave, valor.stringValue || '']))
}

async function enviarEmail(env, para, nome, config = {}) {
  const { assunto, html, texto } = montarEmailAniversario(nome, config)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.REMETENTE, to: [para], subject: assunto, html, text: texto }),
  })
  if (!r.ok) throw new Error(`Resend recusou o envio (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`)
}

export async function enviarAniversariantesDoDia(env, agora = new Date()) {
  const hoje = hojeNaBahia(agora)
  const token = await tokenGoogle(env)
  const membros = await listarMembros(env, token)
  const config = await carregarTextoEmail(env, token)
  const aniversariantes = membros.filter((m) =>
    m.email.includes('@') &&
    m.receberEmailAniversario &&
    m.status !== 'Inativo' &&
    fazAniversarioHoje(m.nascimento, hoje))

  let enviados = 0
  for (const membro of aniversariantes) {
    const id = `${membro.id}-${hoje.ano}`
    if (!await reservarEnvio(env, token, id)) continue
    try {
      await enviarEmail(env, membro.email, membro.nome, config)
      enviados++
    } catch (error) {
      console.error('Falha no e-mail de aniversário:', membro.id, error.message)
      await liberarEnvio(env, token, id)
    }
  }
  console.log(`Aniversários ${hoje.dia}/${hoje.mes}: ${aniversariantes.length} encontrados, ${enviados} enviados.`)
  return { encontrados: aniversariantes.length, enviados }
}

// Confere o login do Firebase de quem pediu o e-mail de teste.
let chavesGoogle
let expiraChaves = 0
async function emailDoToken(token, projeto) {
  const [h, p, s] = token.split('.')
  const header = JSON.parse(new TextDecoder().decode(decodeBase64url(h)))
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(p)))
  if (header.alg !== 'RS256' || payload.aud !== projeto || payload.iss !== `https://securetoken.google.com/${projeto}` ||
    !(payload.exp > Date.now() / 1000)) throw new Error('Token inválido')
  if (!chavesGoogle || Date.now() >= expiraChaves) {
    const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    chavesGoogle = (await r.json()).keys
    expiraChaves = Date.now() + 3600000
  }
  const jwk = chavesGoogle.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('Chave inválida')
  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, decodeBase64url(s), new TextEncoder().encode(`${h}.${p}`))) {
    throw new Error('Assinatura inválida')
  }
  return payload.email
}

export default {
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(enviarAniversariantesDoDia(env))
  },

  // POST /teste: o administrador geral recebe um exemplo do e-mail no próprio endereço.
  // O corpo pode trazer um texto ainda não salvo; sem ele, usa o texto salvo no painel.
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin && !dominios.has(origin)) return Response.json({ mensagem: 'Origem não autorizada.' }, { status: 403, headers })
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (new URL(request.url).pathname !== '/teste' || request.method !== 'POST') {
      return Response.json({ mensagem: 'Rota não encontrada.' }, { status: 404, headers })
    }
    let email
    try {
      const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1] || ''
      email = await emailDoToken(token, env.FIREBASE_PROJECT)
    } catch {
      return Response.json({ mensagem: 'Entre novamente na sua conta.' }, { status: 401, headers })
    }
    if (email !== ADMIN_GERAL) return Response.json({ mensagem: 'Somente o administrador geral pode enviar o teste.' }, { status: 403, headers })
    try {
      const corpo = await request.json().catch(() => null)
      const config = corpo && typeof corpo === 'object' && !Array.isArray(corpo)
        ? corpo
        : await carregarTextoEmail(env, await tokenGoogle(env))
      await enviarEmail(env, email, 'Suedilson', config)
      return Response.json({ mensagem: `E-mail de teste enviado para ${email}.` }, { headers })
    } catch (error) {
      console.error('Falha no e-mail de teste:', error.message)
      return Response.json({ mensagem: 'Não foi possível enviar o e-mail de teste. Confira a chave do Resend e o domínio.' }, { status: 502, headers })
    }
  },
}
