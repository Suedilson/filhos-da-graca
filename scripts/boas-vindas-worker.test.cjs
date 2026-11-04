const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { generateKeyPairSync, webcrypto } = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { buildSync } = require('esbuild')

test('Boas-vindas: só administrador dispara, envia uma vez e não fala em aprovação', async () => {
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
  const banco = {
    'usuariosPermissoes/novo': { ativo: { booleanValue: true }, origemCadastro: { stringValue: 'autoCadastro' }, membroId: { stringValue: 'm1' }, nome: { stringValue: 'Thiago Muniz' } },
    'usuariosPermissoes/comum': { ativo: { booleanValue: true }, perfil: { stringValue: 'membro' } },
    'membros/m1': { nome: { stringValue: 'Thiago Muniz Lago' }, email: { stringValue: 'thiago@exemplo.test' } },
  }
  const reservas = new Set()
  const enviados = []
  const bundle = buildSync({ entryPoints: [path.resolve(__dirname, '../cloudflare/aniversarios.js')], bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ modules: true, script: bundle, compatibilityDate: '2026-11-02',
    bindings: { FIREBASE_PROJECT: 'filhos-da-graca', REMETENTE: 'Igreja <contato@filhosdagraca.com.br>', RESEND_API_KEY: 're_teste', FIREBASE_SERVICE_ACCOUNT: contaServico },
    outboundService: async (request) => {
      const url = new URL(request.url)
      if (url.hostname === 'www.googleapis.com') return Response.json({ keys: [jwk] })
      if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'token-google' })
      if (url.hostname === 'firestore.googleapis.com') {
        const caminho = decodeURIComponent(url.pathname).split('/documents/')[1]
        if (caminho === 'emailsBoasVindas' && request.method === 'POST') {
          const id = url.searchParams.get('documentId')
          if (reservas.has(id)) return new Response('{}', { status: 409 })
          reservas.add(id)
          return Response.json({})
        }
        return banco[caminho] ? Response.json({ fields: banco[caminho] }) : new Response('{}', { status: 404 })
      }
      if (url.hostname === 'api.resend.com') { enviados.push(await request.json()); return Response.json({ id: 'e1' }) }
      throw new Error(`Destino não esperado: ${url}`)
    },
  }] }))
  const chamar = async (token, corpo) => mf.dispatchFetch('https://worker.test/boas-vindas', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'https://filhosdagraca.com.br', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
  try {
    const admin = await tokenFirebase('admin', 'suedilsonfilho@gmail.com')
    const comum = await tokenFirebase('comum', 'membro@exemplo.test')

    const negado = await chamar(comum, { uid: 'novo' })
    assert.equal(negado.status, 403)
    assert.equal(enviados.length, 0)

    const ok = await chamar(admin, { uid: 'novo' })
    assert.equal(ok.status, 200, await ok.clone().text())
    assert.equal((await ok.json()).enviado, true)
    assert.equal(enviados.length, 1)
    assert.deepEqual(enviados[0].to, ['thiago@exemplo.test'])
    assert.match(enviados[0].subject, /bem-vindo\(a\).*Thiago/)
    assert.ok(enviados[0].html.includes('Pr. Cristiano Ribeiro'))
    assert.ok(enviados[0].html.includes('logo-filhos-colorida.png'))
    assert.ok(!/aprova/i.test(enviados[0].html + enviados[0].text), 'o e-mail não pode falar em aprovação')

    const repetido = await chamar(admin, { uid: 'novo' })
    assert.equal((await repetido.json()).enviado, false)
    assert.equal(enviados.length, 1)
  } finally { await mf.dispose() }
})
