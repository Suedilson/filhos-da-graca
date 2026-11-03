import { tokenGoogle, urlFirestore } from './google.js'

// Cópia de segurança diária do Firestore em uma conta do Google Drive exclusiva para backups.
// Segredos: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET e GOOGLE_DRIVE_REFRESH_TOKEN
// (gerados com scripts/autorizar-drive-backup.mjs). Usa a conta de serviço para ler o banco.

const PASTA = 'Backups Filhos da Graça'
const MANTER = 60 // cópias mais recentes guardadas no Drive
// Subcoleções conhecidas, que não aparecem na listagem das coleções principais.
const SUBCOLECOES = { louvorEscalas: ['historico'] }

async function listarColecoes(env, token) {
  const colecoes = []
  let pagina = ''
  do {
    const r = await fetch(`${urlFirestore(env, '')}`.replace(/\/$/, ':listCollectionIds'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize: 100, ...(pagina ? { pageToken: pagina } : {}) }),
    })
    if (!r.ok) throw new Error(`Falha ao listar coleções (HTTP ${r.status})`)
    const dados = await r.json()
    colecoes.push(...(dados.collectionIds || []))
    pagina = dados.nextPageToken || ''
  } while (pagina)
  return colecoes.sort()
}

async function listarDocumentos(env, token, caminho) {
  const documentos = []
  let pagina = ''
  do {
    const r = await fetch(`${urlFirestore(env, caminho)}?pageSize=300${pagina ? `&pageToken=${pagina}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) throw new Error(`Falha ao ler ${caminho} (HTTP ${r.status})`)
    const dados = await r.json()
    documentos.push(...(dados.documents || []))
    pagina = dados.nextPageToken || ''
  } while (pagina)
  return documentos
}

// Lê todas as coleções e guarda os documentos no formato do Firestore (preserva os tipos dos campos).
export async function lerBancoCompleto(env, token) {
  const colecoes = {}
  for (const colecao of await listarColecoes(env, token)) {
    const documentos = await listarDocumentos(env, token, colecao)
    colecoes[colecao] = documentos
    for (const sub of SUBCOLECOES[colecao] || []) {
      for (const documento of documentos) {
        const id = documento.name.split('/').pop()
        const filhos = await listarDocumentos(env, token, `${colecao}/${id}/${sub}`)
        if (filhos.length) colecoes[`${colecao}/${id}/${sub}`] = filhos
      }
    }
  }
  return colecoes
}

async function tokenDrive(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
      client_id: env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    }),
  })
  if (!r.ok) throw new Error(`Falha ao autenticar no Google Drive (HTTP ${r.status})`)
  return (await r.json()).access_token
}

async function pastaDeBackups(token) {
  const busca = encodeURIComponent(`name='${PASTA}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${busca}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`Falha ao procurar a pasta de backups (HTTP ${r.status})`)
  const existente = (await r.json()).files?.[0]
  if (existente) return existente.id
  const criada = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: PASTA, mimeType: 'application/vnd.google-apps.folder' }),
  })
  if (!criada.ok) throw new Error(`Falha ao criar a pasta de backups (HTTP ${criada.status})`)
  return (await criada.json()).id
}

async function enviarArquivo(token, pasta, nome, conteudo) {
  const separador = `backup-${crypto.randomUUID()}`
  const corpo = [
    `--${separador}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: nome, parents: [pasta], mimeType: 'application/json' }),
    `--${separador}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    conteudo,
    `--${separador}--`,
  ].join('\r\n')
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${separador}` },
    body: corpo,
  })
  if (!r.ok) throw new Error(`Falha ao enviar o backup ao Drive (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

// Apaga as cópias mais antigas, mantendo as MANTER mais recentes.
async function limparAntigos(token, pasta) {
  const busca = encodeURIComponent(`'${pasta}' in parents and trashed=false`)
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${busca}&orderBy=createdTime desc&pageSize=1000&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return 0
  const antigos = ((await r.json()).files || []).slice(MANTER)
  for (const arquivo of antigos) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${arquivo.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  return antigos.length
}

export async function fazerBackup(env, agora = new Date()) {
  const colecoes = await lerBancoCompleto(env, await tokenGoogle(env))
  const totalDocumentos = Object.values(colecoes).reduce((total, docs) => total + docs.length, 0)
  const conteudo = JSON.stringify({ projeto: env.FIREBASE_PROJECT, geradoEm: agora.toISOString(), totalDocumentos, colecoes })
  const data = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(agora).replace(' ', '_').replace(':', 'h')
  const token = await tokenDrive(env)
  const pasta = await pastaDeBackups(token)
  const arquivo = await enviarArquivo(token, pasta, `backup-filhos-da-graca-${data}.json`, conteudo)
  const removidos = await limparAntigos(token, pasta)
  console.log(`Backup ${arquivo.name}: ${totalDocumentos} documentos em ${Object.keys(colecoes).length} coleções; ${removidos} cópias antigas removidas.`)
  return { arquivo: arquivo.name, totalDocumentos, colecoes: Object.keys(colecoes).length }
}
