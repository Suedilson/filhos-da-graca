const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { generateKeyPairSync, webcrypto } = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { buildSync } = require('esbuild')

test('Bancos: busca na Pluggy, liga à conta do site, não duplica e respeita permissão', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const contaServico = JSON.stringify({ client_email: 'teste@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })
  const chaves = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = { ...await webcrypto.subtle.exportKey('jwk', chaves.publicKey), kid: 'teste', alg: 'RS256', use: 'sig' }
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  async function tokenFirebase(sub, email) {
    const agora = Math.floor(Date.now() / 1000)
    const inicio = `${b64({ alg: 'RS256', kid: 'teste' })}.${b64({ aud: 'filhos-da-graca', iss: 'https://securetoken.google.com/filhos-da-graca', sub, email, iat: agora, exp: agora + 3600 })}`
    const assinatura = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', chaves.privateKey, Buffer.from(inicio))
    return `${inicio}.${Buffer.from(assinatura).toString('base64url')}`
  }

  // "Banco de dados" em memória
  const docs = {
    'contasBancarias/cora1': { nome: { stringValue: 'Cora' }, ativo: { booleanValue: true } },
    'contasBancarias/stone1': { nome: { stringValue: 'Stone' }, ativo: { booleanValue: true } },
    // movimento que já veio por arquivo OFX: o mesmo valor no mesmo dia não pode ser repetido
    'extratoBancario/arq1': { contaBancariaId: { stringValue: 'cora1' }, data: { stringValue: '2026-11-03' }, valor: { doubleValue: -136.48 }, origem: { stringValue: 'arquivo' } },
    'usuariosPermissoes/tes': { ativo: { booleanValue: true }, permissoes: { arrayValue: { values: [{ stringValue: 'financeiro' }] } } },
    'usuariosPermissoes/comum': { ativo: { booleanValue: true }, permissoes: { arrayValue: { values: [{ stringValue: 'meusDados' }] } } },
  }
  const transacoesPluggy = {
    accC: [
      { id: 't1', date: '2026-11-02T13:00:00Z', description: 'Pix recebido', amount: 200, type: 'CREDIT', status: 'POSTED' },
      { id: 't2', date: '2026-11-03T12:00:00Z', description: 'Energia', amount: -136.48, type: 'DEBIT', status: 'POSTED' },
      { id: 't3', date: '2026-11-04T12:00:00Z', description: 'Pendente', amount: 50, type: 'CREDIT', status: 'PENDING' },
    ],
    accS: [{ id: 's1', date: '2026-11-05T12:00:00Z', description: 'Venda maquininha', amount: 80, type: 'CREDIT' }],
  }
  const chamadasPluggy = []

  const bundle = buildSync({ entryPoints: [path.resolve(__dirname, '../cloudflare/aniversarios.js')], bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ modules: true, script: bundle, compatibilityDate: '2026-11-02',
    bindings: { FIREBASE_PROJECT: 'filhos-da-graca', FIREBASE_SERVICE_ACCOUNT: contaServico, PLUGGY_CLIENT_ID: 'id', PLUGGY_CLIENT_SECRET: 'segredo', PLUGGY_ITEM_IDS: 'itemCora, itemStone:Stone' },
    outboundService: async (request) => {
      const url = new URL(request.url)
      if (url.hostname === 'www.googleapis.com') return Response.json({ keys: [jwk] })
      if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'token-google' })
      if (url.hostname === 'api.pluggy.ai') {
        chamadasPluggy.push(url.pathname)
        if (url.pathname === '/auth') return Response.json({ apiKey: 'chave' })
        if (url.pathname === '/items/itemCora') return Response.json({ id: 'itemCora', connector: { name: 'Cora PJ' } })
        if (url.pathname === '/items/itemStone') return Response.json({ id: 'itemStone', connector: { name: 'MeuPluggy' } })
        if (url.pathname === '/accounts') {
          const item = url.searchParams.get('itemId')
          return Response.json({ results: item === 'itemCora'
            ? [{ id: 'accC', type: 'BANK', name: 'Conta corrente', balance: 1063.52 }, { id: 'cartao', type: 'CREDIT', name: 'Cartão' }]
            : [{ id: 'accS', type: 'BANK', name: 'Conta de pagamento', balance: 80 }] })
        }
        if (url.pathname === '/v2/transactions') return Response.json({ results: transacoesPluggy[url.searchParams.get('accountId')] || [], next: null })
      }
      if (url.hostname === 'firestore.googleapis.com') {
        const caminho = decodeURIComponent(url.pathname).split('/documents')[1] || ''
        if (caminho === ':runQuery') {
          const corpo = await request.json()
          const conta = corpo.structuredQuery.where.fieldFilter.value.stringValue
          return Response.json(Object.entries(docs)
            .filter(([k, f]) => k.startsWith('extratoBancario/') && f.contaBancariaId?.stringValue === conta)
            .map(([k, f]) => ({ document: { name: `projects/x/databases/(default)/documents/${k}`, fields: f } })))
        }
        if (caminho === ':commit') {
          const corpo = await request.json()
          for (const w of corpo.writes) {
            const k = w.update.name.split('/documents/')[1]
            if (w.currentDocument?.exists === false && docs[k]) return new Response('{}', { status: 409 })
            docs[k] = w.update.fields
          }
          return Response.json({})
        }
        const k = caminho.replace(/^\//, '')
        if (k === 'contasBancarias') {
          return Response.json({ documents: Object.entries(docs).filter(([d]) => d.startsWith('contasBancarias/'))
            .map(([d, f]) => ({ name: `projects/x/databases/(default)/documents/${d}`, fields: f })) })
        }
        return docs[k] ? Response.json({ fields: docs[k] }) : new Response('{}', { status: 404 })
      }
      throw new Error(`Destino não esperado: ${url}`)
    },
  }] }))
  const chamar = async (token) => mf.dispatchFetch('https://worker.test/bancos', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://filhosdagraca.com.br' },
  })
  try {
    const negado = await chamar(await tokenFirebase('comum', 'membro@exemplo.test'))
    assert.equal(negado.status, 403)

    const ok = await chamar(await tokenFirebase('tes', 'tesoureiro@exemplo.test'))
    const corpo = await ok.json()
    assert.equal(ok.status, 200, JSON.stringify(corpo))
    assert.equal(corpo.novos, 2, JSON.stringify(corpo.resumo))

    const pluggy = Object.keys(docs).filter((k) => k.startsWith('extratoBancario/pg_'))
    assert.deepEqual(pluggy.sort(), ['extratoBancario/pg_s1', 'extratoBancario/pg_t1'])
    assert.equal(docs['extratoBancario/pg_t1'].contaBancariaId.stringValue, 'cora1')
    assert.equal(docs['extratoBancario/pg_s1'].contaBancariaId.stringValue, 'stone1')
    assert.equal(Number(docs['extratoBancario/pg_t1'].valor.integerValue ?? docs['extratoBancario/pg_t1'].valor.doubleValue), 200)
    assert.equal(docs['extratoBancario/pg_t1'].data.stringValue, '2026-11-02')
    assert.equal(docs['extratoSaldos/cora1'].saldo.doubleValue, 1063.52)
    assert.ok(docs['configuracoes/sincronizacaoBancos'])
    assert.ok(!chamadasPluggy.some((c) => c.includes('cartao')))

    // Segunda vez: nada novo
    const denovo = await (await chamar(await tokenFirebase('tes', 'tesoureiro@exemplo.test'))).json()
    assert.equal(denovo.novos, 0)
  } finally { await mf.dispose() }
})
