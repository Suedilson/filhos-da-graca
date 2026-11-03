const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { generateKeyPairSync } = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { buildSync } = require('esbuild')

test('Worker de aniversários envia uma vez por ano só para quem faz aniversário hoje', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const contaServico = JSON.stringify({
    client_email: 'teste@filhos-da-graca.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  })
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', month: '2-digit', day: '2-digit' }).format(new Date())
  const membros = [
    { id: 'aniversariante', nome: 'Maria Teste', email: 'maria@exemplo.test', nascimento: `1990-${hoje}`, status: 'Ativo' },
    { id: 'sem-email', nome: 'João', email: '', nascimento: `1990-${hoje}`, status: 'Ativo' },
    { id: 'inativo', nome: 'Pedro', email: 'pedro@exemplo.test', nascimento: `1990-${hoje}`, status: 'Inativo' },
    { id: 'nao-quer', nome: 'Ana', email: 'ana@exemplo.test', nascimento: `1990-${hoje}`, status: 'Ativo', receber: false },
    { id: 'outro-dia', nome: 'Rui', email: 'rui@exemplo.test', nascimento: '1990-01-01', status: 'Ativo' },
  ]
  const reservas = new Set()
  const enviados = []
  const bundle = buildSync({ entryPoints: [path.resolve(__dirname, '../cloudflare/aniversarios.js')], bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ modules: true, script: bundle, compatibilityDate: '2026-11-02',
    bindings: { FIREBASE_PROJECT: 'filhos-da-graca', REMETENTE: 'Igreja <contato@filhosdagraca.com.br>', RESEND_API_KEY: 're_teste', FIREBASE_SERVICE_ACCOUNT: contaServico },
    outboundService: async (request) => {
      const url = new URL(request.url)
      if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'token-google' })
      if (url.hostname === 'firestore.googleapis.com' && url.pathname.endsWith('/membros')) {
        return Response.json({ documents: membros.map((m) => ({ name: `x/membros/${m.id}`, fields: {
          nome: { stringValue: m.nome }, email: { stringValue: m.email }, nascimento: { stringValue: m.nascimento },
          status: { stringValue: m.status }, ...(m.receber === false ? { receberEmailAniversario: { booleanValue: false } } : {}),
        } })) })
      }
      if (url.hostname === 'firestore.googleapis.com' && url.pathname.endsWith('/emailsAniversario') && request.method === 'POST') {
        const id = url.searchParams.get('documentId')
        if (reservas.has(id)) return new Response('{}', { status: 409 })
        reservas.add(id)
        return Response.json({})
      }
      if (url.hostname === 'api.resend.com') {
        assert.equal(request.headers.get('Authorization'), 'Bearer re_teste')
        enviados.push(await request.json())
        return Response.json({ id: 'email-1' })
      }
      throw new Error(`Destino não esperado no teste: ${url}`)
    },
  }] }))
  try {
    const worker = await mf.getWorker()
    await worker.scheduled({ cron: '0 11 * * *' })
    assert.equal(enviados.length, 1)
    assert.deepEqual(enviados[0].to, ['maria@exemplo.test'])
    assert.equal(enviados[0].subject, 'Feliz aniversário, Maria! 🎉')
    assert.ok(enviados[0].html.includes('Pr. Cristiano Ribeiro'))
    // O segundo horário do dia não repete o e-mail
    await worker.scheduled({ cron: '0 14 * * *' })
    assert.equal(enviados.length, 1)
    const semLogin = await mf.dispatchFetch('https://worker.test/teste', { method: 'POST', headers: { Origin: 'https://filhosdagraca.com.br' } })
    assert.equal(semLogin.status, 401)
  } finally { await mf.dispose() }
})
