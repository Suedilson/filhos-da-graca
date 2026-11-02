const ORIGEM = 'https://www.cifraclub.com.br'
const dominios = new Set(['https://filhosdagraca.com.br', 'https://www.filhosdagraca.com.br', 'https://filhos-da-graca.web.app', 'https://filhos-da-graca.firebaseapp.com', 'http://localhost:5173'])
const limites = new Map()
const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const slug = (s) => normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
let chaves
let expiraChaves = 0

function falha(status, mensagem) { return Object.assign(new Error(mensagem), { status }) }
function decode(s) { return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)) }

export async function autenticar(token, projeto) {
  try {
    const partes = token.split('.')
    if (partes.length !== 3) throw new Error('Token inválido')
    const header = JSON.parse(new TextDecoder().decode(decode(partes[0])))
    const payload = JSON.parse(new TextDecoder().decode(decode(partes[1])))
    if (header.alg !== 'RS256' || payload.aud !== projeto || payload.iss !== `https://securetoken.google.com/${projeto}` ||
      !payload.sub || payload.sub.length > 128 || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000 ||
      !Number.isFinite(payload.iat) || payload.iat > Date.now() / 1000 + 60) throw new Error('Token inválido')
    if (!chaves || Date.now() >= expiraChaves) {
      const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', { signal: AbortSignal.timeout(5000) })
      if (!r.ok) throw new Error('Validação indisponível')
      chaves = (await r.json()).keys
      expiraChaves = Date.now() + 3600000
    }
    const jwk = chaves.find((k) => k.kid === header.kid)
    if (!jwk) { expiraChaves = 0; throw new Error('Chave inválida') }
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`))) throw new Error('Assinatura inválida')
    if (payload.email === 'suedilsonfilho@gmail.com') return payload.sub
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents/usuariosPermissoes/${encodeURIComponent(payload.sub)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) throw falha(403, 'Sem permissão para consultar cifras.')
    const campos = (await r.json()).fields
    if (campos?.ativo?.booleanValue !== true || !campos?.permissoes?.arrayValue?.values?.some((v) => v.stringValue === 'louvor')) throw falha(403, 'Sem permissão para consultar cifras.')
    return payload.sub
  } catch (error) {
    if (error.status === 403) throw error
    throw falha(401, 'Entre novamente na sua conta.')
  }
}

async function pagina(caminho) {
  const r = await fetch(`${ORIGEM}${caminho}`, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
  if (!r.ok || !r.headers.get('content-type')?.includes('text/html')) throw falha(502, `A fonte de cifras está indisponível (HTTP ${r.status}).`)
  return r
}

async function consultarCifraClub(titulo, autor) {
  const artista = slug(autor)
  if (!artista) throw falha(400, 'Informe o intérprete.')
  const links = []
  let link
  await new HTMLRewriter().on('a[href]', {
    element(el) {
      const href = el.getAttribute('href')
      link = new RegExp(`^/${artista}/[a-z0-9-]+/$`).test(href || '') ? { href, texto: '' } : null
      const atual = link
      el.onEndTag(() => { if (atual && links.length < 2000) links.push(atual); link = null })
    },
    text(t) { if (link) link.texto += t.text },
  }).transform(await pagina(`/${artista}/`)).arrayBuffer()
  const exato = `/${artista}/${slug(titulo)}/`
  const encontrado = links.find((l) => l.href === exato) || links.find((l) => normalizar(l.texto).includes(normalizar(titulo)))
  if (!encontrado) throw falha(404, 'Nenhuma cifra encontrada para este título e intérprete.')
  let nome = '', cifra = '', tom = '', acordes = false, pre = false, primeiroPre = true, paragrafo
  const paragrafos = []
  await new HTMLRewriter()
    .on('h1', { text(t) { nome += t.text } })
    .on('p', {
      element(el) { paragrafo = { texto: '' }; const atual = paragrafo; el.onEndTag(() => { if (paragrafos.length < 500) paragrafos.push(atual.texto.trim()); paragrafo = null }) },
      text(t) { if (paragrafo) paragrafo.texto += t.text },
    })
    .on('pre', {
      element(el) { pre = primeiroPre; primeiroPre = false; el.onEndTag(() => { pre = false }) },
      text(t) { if (pre && cifra.length < 20000) cifra += t.text },
    })
    .on('pre b', { element() { if (pre) acordes = true } })
    .on('pre br', { element() { if (pre) cifra += '\n' } })
    .on('#cifra_tom a, #cifra_tom b', { text(t) { tom += t.text } })
    .transform(await pagina(encontrado.href)).arrayBuffer()
  if (!tom) tom = paragrafos[paragrafos.indexOf('Tom') + 1] || ''
  cifra = cifra.replace(/\u200b/g, '').trim()
  if (normalizar(nome) !== normalizar(titulo)) throw falha(404, 'A versão encontrada não corresponde ao título informado.')
  if (!acordes || !cifra || cifra.length > 19000 || !/^[A-G](?:#|b)?m?$/.test(tom.trim())) throw falha(404, 'Não foi possível confirmar a cifra e o tom desta versão.')
  const fonte = `${ORIGEM}${encontrado.href}`
  return { tom: tom.trim(), notas: `${cifra}\n\nFonte: Cifra Club\n${fonte}`, fonte }
}

async function consultarTudoCifras(titulo, autor) {
  const fonte = `https://tudocifras.com.br/cancion/${slug(autor)}/${slug(titulo)}`
  const r = await fetch(fonte, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
  if (!r.ok || !r.headers.get('content-type')?.includes('text/html')) throw falha(404, 'Não encontramos uma cifra para este título e intérprete.')
  let nome = '', artista = '', cifra = '', acordes = false, tom = ''
  await new HTMLRewriter()
    .on('h1', { text(t) { nome += t.text } })
    .on('h2', { text(t) { artista += t.text } })
    .on('pre#acorde', { text(t) { if (cifra.length < 20000) cifra += t.text } })
    .on('pre#acorde a', { element() { acordes = true } })
    .on('pre#acorde br', { element() { cifra += '\n' } })
    .on('[data-original-key]', { element(el) { tom = el.getAttribute('data-original-key') || '' } })
    .transform(r).arrayBuffer()
  nome = nome.replace(/\(Cifras\)/gi, '').trim()
  cifra = cifra.replace(/\u00a0/g, ' ').trim()
  if (normalizar(nome) !== normalizar(titulo) || normalizar(artista) !== normalizar(autor)) throw falha(404, 'A versão encontrada não corresponde ao título e intérprete.')
  if (!acordes || !cifra || cifra.length > 19000) throw falha(404, 'Não foi encontrada uma cifra válida nesta versão.')
  if (!/^[A-G](?:#|b)?m?$/.test(tom)) tom = ''
  return { tom, notas: `${cifra}\n\nFonte: TudoCifras\n${fonte}`, fonte }
}

export async function consultarCifra(titulo, autor) {
  try { return await consultarCifraClub(titulo, autor) }
  catch { return consultarTudoCifras(titulo, autor) }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin')
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin && !dominios.has(origin)) return Response.json({ mensagem: 'Origem não autorizada.' }, { status: 403, headers })
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    try {
      if (new URL(request.url).pathname !== '/cifra' || request.method !== 'POST') throw falha(404, 'Rota não encontrada.')
      const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
      if (!token) throw falha(401, 'Entre na sua conta para consultar cifras.')
      const uid = await autenticar(token, env.FIREBASE_PROJECT)
      const minuto = Math.floor(Date.now() / 60000)
      const limite = limites.get(uid)
      if (limite?.minuto === minuto && limite.total >= 5) throw falha(429, 'Aguarde um minuto para buscar novamente.')
      if (limites.size > 1000) limites.clear()
      limites.set(uid, { minuto, total: limite?.minuto === minuto ? limite.total + 1 : 1 })
      const conteudo = await request.text()
      if (conteudo.length > 1500) throw falha(400, 'Consulta muito extensa.')
      const { titulo, autor } = JSON.parse(conteudo)
      if (typeof titulo !== 'string' || typeof autor !== 'string' || titulo.trim().length < 3 || !autor.trim() || titulo.length > 180 || autor.length > 180) throw falha(400, 'Informe o título e o intérprete.')
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${normalizar(titulo)}|${normalizar(autor)}`)))].map((n) => n.toString(16).padStart(2, '0')).join('')
      const chave = new Request(`${new URL(request.url).origin}/cache/${hash}`)
      const cache = caches.default
      const anterior = await cache.match(chave)
      const resultado = anterior ? await anterior.json() : await consultarCifra(titulo.trim(), autor.trim())
      if (!anterior) ctx.waitUntil(cache.put(chave, Response.json(resultado, { headers: { 'Cache-Control': 'public, max-age=86400' } })))
      return Response.json(resultado, { headers })
    } catch (error) {
      if (!error.status) console.error('Falha na consulta de cifra:', error.name, error.message)
      return Response.json({ mensagem: error.status ? error.message : 'Não foi possível consultar a cifra.' }, { status: error.status || 502, headers })
    }
  },
}
