import { fazAniversarioHoje, hojeNaBahia, montarEmailAniversario } from './emailAniversario.js'
import { decodeBase64url, tokenGoogle, urlFirestore } from './google.js'
import { fazerBackup } from './backup.js'
import { montarEmailBoasVindas } from './emailBoasVindas.js'

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

// Marca o envio antes de mandar o e-mail; se a marca já existe, a pessoa já recebeu.
async function reservarEnvio(env, token, id, colecao = 'emailsAniversario') {
  const r = await fetch(`${urlFirestore(env, colecao)}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { enviadoEm: { timestampValue: new Date().toISOString() } } }),
  })
  if (r.status === 409) return false
  if (!r.ok) throw new Error(`Falha ao registrar envio (HTTP ${r.status})`)
  return true
}

async function liberarEnvio(env, token, id, colecao = 'emailsAniversario') {
  await fetch(urlFirestore(env, `${colecao}/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Texto do e-mail salvo pelo administrador no painel; sem ele, vale o texto padrão.
async function carregarTextoEmail(env, token, caminho = 'configuracoes/emailAniversario') {
  const r = await fetch(urlFirestore(env, caminho), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (r.status === 404) return {}
  if (!r.ok) throw new Error(`Falha ao ler o texto do e-mail (HTTP ${r.status})`)
  const campos = (await r.json()).fields || {}
  return Object.fromEntries(Object.entries(campos).map(([chave, valor]) => [chave, valor.stringValue || '']))
}

// Lê um documento do Firestore e devolve os campos de texto e verdadeiro/falso (null se não existir).
async function lerDocumento(env, token, caminho) {
  const r = await fetch(urlFirestore(env, caminho), { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Falha ao ler ${caminho} (HTTP ${r.status})`)
  const campos = (await r.json()).fields || {}
  return Object.fromEntries(Object.entries(campos).map(([chave, valor]) =>
    [chave, valor.booleanValue ?? valor.stringValue ?? '']))
}

async function enviarResend(env, para, { assunto, html, texto }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.REMETENTE, to: [para], subject: assunto, html, text: texto }),
  })
  if (!r.ok) throw new Error(`Resend recusou o envio (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`)
}

async function enviarEmail(env, para, nome, config = {}) {
  await enviarResend(env, para, montarEmailAniversario(nome, config))
}

// Boas-vindas para quem se cadastrou pelo site, enviado uma única vez, quando o acesso é liberado.
export async function enviarBoasVindas(env, uid) {
  const token = await tokenGoogle(env)
  const permissao = await lerDocumento(env, token, `usuariosPermissoes/${encodeURIComponent(uid)}`)
  if (!permissao || permissao.ativo !== true || permissao.origemCadastro !== 'autoCadastro') {
    return { enviado: false, motivo: 'Cadastro não liberado ou não feito pelo site.' }
  }
  const membro = permissao.membroId ? await lerDocumento(env, token, `membros/${encodeURIComponent(permissao.membroId)}`) : null
  const email = String(membro?.email || permissao.email || '').trim()
  if (!email.includes('@')) return { enviado: false, motivo: 'Cadastro sem e-mail.' }
  if (!await reservarEnvio(env, token, uid, 'emailsBoasVindas')) return { enviado: false, motivo: 'Boas-vindas já enviado.' }
  try {
    const config = await carregarTextoEmail(env, token, 'configuracoes/emailBoasVindas')
    await enviarResend(env, email, montarEmailBoasVindas(membro?.nome || permissao.nome, config))
    return { enviado: true, email }
  } catch (error) {
    await liberarEnvio(env, token, uid, 'emailsBoasVindas')
    throw error
  }
}

// Envio manual pelo painel: manda as boas-vindas para o e-mail do membro, mesmo que já tenha recebido antes.
export async function enviarBoasVindasManual(env, membroId) {
  const token = await tokenGoogle(env)
  const membro = await lerDocumento(env, token, `membros/${encodeURIComponent(membroId)}`)
  if (!membro) return { enviado: false, motivo: 'Membro não encontrado.' }
  const email = String(membro.email || '').trim()
  if (!email.includes('@')) return { enviado: false, motivo: 'Este membro não tem e-mail cadastrado.' }
  const config = await carregarTextoEmail(env, token, 'configuracoes/emailBoasVindas')
  await enviarResend(env, email, montarEmailBoasVindas(membro.nome, config))
  return { enviado: true, email }
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
async function usuarioDoToken(token, projeto) {
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
  return { uid: payload.sub, email: payload.email }
}

// Administrador geral ou perfil Administrador ativo.
async function ehAdministrador(env, usuario) {
  if (usuario.email === ADMIN_GERAL) return true
  const permissao = await lerDocumento(env, await tokenGoogle(env), `usuariosPermissoes/${encodeURIComponent(usuario.uid)}`)
  return permissao?.ativo === true && permissao.perfil === 'admin'
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
    if (!['/teste', '/backup', '/boas-vindas'].includes(rota) || request.method !== 'POST') {
      return Response.json({ mensagem: 'Rota não encontrada.' }, { status: 404, headers })
    }
    let usuario
    try {
      const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1] || ''
      usuario = await usuarioDoToken(token, env.FIREBASE_PROJECT)
    } catch {
      return Response.json({ mensagem: 'Entre novamente na sua conta.' }, { status: 401, headers })
    }
    // POST /boas-vindas { uid }: chamado pelo painel ao liberar o acesso de quem se cadastrou pelo site (uma vez só).
    // POST /boas-vindas { membroId }: envio manual; { teste: true, texto }: exemplo para o próprio administrador.
    if (rota === '/boas-vindas') {
      try {
        if (!await ehAdministrador(env, usuario)) {
          return Response.json({ mensagem: 'Somente administradores podem enviar as boas-vindas.' }, { status: 403, headers })
        }
        const corpo = await request.json().catch(() => ({})) || {}
        const idValido = (id) => typeof id === 'string' && id && id.length <= 128 && !id.includes('/')
        // { teste: true, texto }: manda um exemplo para o próprio administrador (texto ainda não salvo).
        if (corpo.teste === true) {
          if (!String(usuario.email || '').includes('@')) return Response.json({ mensagem: 'Sua conta não tem e-mail.' }, { status: 400, headers })
          const texto = corpo.texto && typeof corpo.texto === 'object' && !Array.isArray(corpo.texto)
            ? corpo.texto
            : await carregarTextoEmail(env, await tokenGoogle(env), 'configuracoes/emailBoasVindas')
          await enviarResend(env, usuario.email, montarEmailBoasVindas('Fulano de Tal', texto))
          return Response.json({ mensagem: `E-mail de teste enviado para ${usuario.email}.`, enviado: true, email: usuario.email }, { headers })
        }
        // { membroId }: envio manual para um membro cadastrado.
        if (corpo.membroId !== undefined) {
          if (!idValido(corpo.membroId)) return Response.json({ mensagem: 'Membro inválido.' }, { status: 400, headers })
          const resultado = await enviarBoasVindasManual(env, corpo.membroId)
          return Response.json({ mensagem: resultado.enviado ? `E-mail de boas-vindas enviado para ${resultado.email}.` : resultado.motivo, ...resultado }, { headers })
        }
        const { uid } = corpo
        if (!idValido(uid)) {
          return Response.json({ mensagem: 'Usuário inválido.' }, { status: 400, headers })
        }
        const resultado = await enviarBoasVindas(env, uid)
        return Response.json({ mensagem: resultado.enviado ? `E-mail de boas-vindas enviado para ${resultado.email}.` : resultado.motivo, ...resultado }, { headers })
      } catch (error) {
        console.error('Falha no e-mail de boas-vindas:', error.message)
        return Response.json({ mensagem: 'Não foi possível enviar o e-mail de boas-vindas.' }, { status: 502, headers })
      }
    }
    const email = usuario.email
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
