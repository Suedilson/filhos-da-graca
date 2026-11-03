import { fazAniversarioHoje, hojeNaBahia, montarEmailAniversario } from './emailAniversario.js'
import { decodeBase64url, tokenGoogle, urlFirestore } from './google.js'
import { fazerBackup } from './backup.js'

// Worker agendado: todo dia de manhã envia o e-mail de aniversário aos membros
// e, de madrugada, salva uma cópia de segurança do banco no Google Drive (backup.js).
// Segredos (wrangler secret put): FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço), RESEND_API_KEY
// e os GOOGLE_DRIVE_* do backup.

const ADMIN_GERAL = 'suedilsonfilho@gmail.com'
const CRON_BACKUP = '0 6 * * *'
const dominios = new Set(['https://filhosdagraca.com.br', 'https://www.filhosdagraca.com.br', 'https://filhos-da-graca.web.app', 'https://filhos-da-graca.firebaseapp.com', 'http://localhost:5173'])

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
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(evento.cron === CRON_BACKUP ? fazerBackup(env) : enviarAniversariantesDoDia(env))
  },

  // POST /backup: o administrador geral faz uma cópia de segurança na hora.
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
    const rota = new URL(request.url).pathname
    if (!['/teste', '/backup'].includes(rota) || request.method !== 'POST') {
      return Response.json({ mensagem: 'Rota não encontrada.' }, { status: 404, headers })
    }
    let email
    try {
      const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1] || ''
      email = await emailDoToken(token, env.FIREBASE_PROJECT)
    } catch {
      return Response.json({ mensagem: 'Entre novamente na sua conta.' }, { status: 401, headers })
    }
    if (email !== ADMIN_GERAL) return Response.json({ mensagem: 'Somente o administrador geral pode fazer isso.' }, { status: 403, headers })
    if (rota === '/backup') {
      try {
        const resultado = await fazerBackup(env)
        return Response.json({ mensagem: `Backup salvo no Google Drive: ${resultado.arquivo} (${resultado.totalDocumentos} registros).` }, { headers })
      } catch (error) {
        console.error('Falha no backup manual:', error.message)
        return Response.json({ mensagem: 'Não foi possível salvar o backup no Google Drive. Confira a autorização da conta de backup.' }, { status: 502, headers })
      }
    }
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
