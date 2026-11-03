const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { generateKeyPairSync } = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { buildSync } = require('esbuild')

test('Backup diário lê todas as coleções e salva no Google Drive, mantendo só as cópias recentes', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const contaServico = JSON.stringify({
    client_email: 'teste@filhos-da-graca.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  })
  const banco = {
    membros: [{ name: 'projects/x/databases/(default)/documents/membros/m1', fields: { nome: { stringValue: 'Maria' } } }],
    arrecadacoes: [{ name: 'projects/x/databases/(default)/documents/arrecadacoes/a1', fields: { valor: { doubleValue: 150.5 } } }],
    louvorEscalas: [{ name: 'projects/x/databases/(default)/documents/louvorEscalas/e1', fields: { titulo: { stringValue: 'Culto' } } }],
    'louvorEscalas/e1/historico': [{ name: 'projects/x/databases/(default)/documents/louvorEscalas/e1/historico/1', fields: { versao: { integerValue: '1' } } }],
  }
  let upload = ''
  let pastaCriada = 0
  const apagados = []
  const bundle = buildSync({ entryPoints: [path.resolve(__dirname, '../cloudflare/aniversarios.js')], bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ modules: true, script: bundle, compatibilityDate: '2026-11-02',
    bindings: {
      FIREBASE_PROJECT: 'filhos-da-graca', FIREBASE_SERVICE_ACCOUNT: contaServico,
      GOOGLE_DRIVE_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_DRIVE_CLIENT_SECRET: 'segredo', GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh',
    },
    outboundService: async (request) => {
      const url = new URL(request.url)
      if (url.hostname === 'oauth2.googleapis.com') {
        const corpo = await request.text()
        return Response.json({ access_token: corpo.includes('refresh_token') ? 'token-drive' : 'token-firestore' })
      }
      if (url.hostname === 'firestore.googleapis.com') {
        assert.equal(request.headers.get('Authorization'), 'Bearer token-firestore')
        if (url.pathname.endsWith(':listCollectionIds')) return Response.json({ collectionIds: ['membros', 'arrecadacoes', 'louvorEscalas'] })
        const caminho = decodeURIComponent(url.pathname).split('/documents/')[1]
        return Response.json({ documents: banco[caminho] || [] })
      }
      if (url.hostname === 'www.googleapis.com' && url.pathname === '/drive/v3/files' && request.method === 'GET') {
        assert.equal(request.headers.get('Authorization'), 'Bearer token-drive')
        const q = url.searchParams.get('q')
        if (q.includes('mimeType')) return Response.json({ files: [] })
        return Response.json({ files: Array.from({ length: 62 }, (_, i) => ({ id: `arquivo-${i}` })) })
      }
      if (url.hostname === 'www.googleapis.com' && url.pathname === '/drive/v3/files' && request.method === 'POST') {
        pastaCriada++
        return Response.json({ id: 'pasta-1' })
      }
      if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/upload/drive/v3/files')) {
        upload = await request.text()
        return Response.json({ id: 'backup-1', name: 'backup.json' })
      }
      if (url.hostname === 'www.googleapis.com' && request.method === 'DELETE') {
        apagados.push(url.pathname.split('/').pop())
        return new Response(null, { status: 204 })
      }
      throw new Error(`Destino não esperado no teste: ${request.method} ${url}`)
    },
  }] }))
  try {
    const worker = await mf.getWorker()
    await worker.scheduled({ cron: '0 6 * * *' })
    assert.equal(pastaCriada, 1)
    assert.ok(upload.includes('"parents":["pasta-1"]'))
    assert.match(upload, /"name":"backup-filhos-da-graca-\d{4}-\d{2}-\d{2}_\d{2}h\d{2}\.json"/)
    const json = JSON.parse(upload.split('\r\n\r\n')[2].split('\r\n--')[0])
    assert.equal(json.totalDocumentos, 4)
    assert.deepEqual(Object.keys(json.colecoes).sort(), ['arrecadacoes', 'louvorEscalas', 'louvorEscalas/e1/historico', 'membros'])
    assert.equal(json.colecoes.arrecadacoes[0].fields.valor.doubleValue, 150.5)
    assert.deepEqual(apagados, ['arquivo-60', 'arquivo-61'])
    const semLogin = await mf.dispatchFetch('https://worker.test/backup', { method: 'POST', headers: { Origin: 'https://filhosdagraca.com.br' } })
    assert.equal(semLogin.status, 401)
  } finally { await mf.dispose() }
})
