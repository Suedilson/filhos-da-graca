const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { webcrypto } = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { buildSync } = require('esbuild')

test('Worker autentica, extrai cifra, bloqueia acesso externo e reutiliza cache', async () => {
  const keys = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = { ...await webcrypto.subtle.exportKey('jwk', keys.publicKey), kid: 'teste', alg: 'RS256', use: 'sig' }
  const codificar = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const agora = Math.floor(Date.now() / 1000)
  const inicio = `${codificar({ alg: 'RS256', kid: 'teste' })}.${codificar({ aud: 'filhos-da-graca', iss: 'https://securetoken.google.com/filhos-da-graca', sub: 'membro-teste', iat: agora, exp: agora + 3600 })}`
  const assinatura = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, Buffer.from(inicio))
  const token = `${inicio}.${Buffer.from(assinatura).toString('base64url')}`
  let chamadasFonte = 0
  let bloquearPrincipal = false
  let ativo = true
  const bundle = buildSync({ entryPoints: [path.resolve(__dirname, '../cloudflare/worker.js')], bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ modules: true, script: bundle, compatibilityDate: '2026-11-02', bindings: { FIREBASE_PROJECT: 'filhos-da-graca' },
    outboundService: async (request) => {
      const url = new URL(request.url)
      if (url.hostname === 'www.googleapis.com') return Response.json({ keys: [jwk] })
      if (url.hostname === 'firestore.googleapis.com') return Response.json({ fields: { ativo: { booleanValue: ativo }, permissoes: { arrayValue: { values: [{ stringValue: 'louvor' }] } } } })
      if (url.hostname === 'tudocifras.com.br') return new Response('<h1>C&acirc;ntico novo (Cifras)</h1><h2>Intérprete Novo</h2><pre id="acorde">&nbsp;&nbsp;<a>D</a>&nbsp;&nbsp;&nbsp;&nbsp;<a>G</a><br>Texto fictício da alternativa &amp; final</pre>', { headers: { 'Content-Type': 'text/html' } })
      if (url.hostname === 'www.cifraclub.com.br') {
        chamadasFonte++
        if (bloquearPrincipal) return new Response('Sem acesso', { status: 403 })
        return new Response(url.pathname === '/adhemar-de-campos/' ? '<a href="/adhemar-de-campos/grande-o-senhor/">Grande É o Senhor</a>' : '<h1>Grande É o Senhor</h1><div><p>Tom</p><p>A</p></div><pre data-chord-content="true"><b>A</b>      <b>D</b>\nTexto fictício de teste</pre>', { headers: { 'Content-Type': 'text/html' } })
      }
      throw new Error('Destino externo não permitido no teste')
    },
  }] }))
  try {
    const url = 'https://worker.test/cifra'
    const headers = { Authorization: `Bearer ${token}`, Origin: 'https://filhosdagraca.com.br', 'Content-Type': 'application/json' }
    const body = JSON.stringify({ titulo: 'Grande é o Senhor', autor: 'Adhemar de Campos' })
    const semLogin = await mf.dispatchFetch(url, { method: 'POST', body })
    assert.equal(semLogin.status, 401)
    const proibido = await mf.dispatchFetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://outro-site.test' }, body })
    assert.equal(proibido.status, 403)
    const preflight = await mf.dispatchFetch(url, { method: 'OPTIONS', headers: { Origin: headers.Origin } })
    assert.equal(preflight.status, 204)
    const valido = await mf.dispatchFetch(url, { method: 'POST', headers, body })
    assert.equal(valido.status, 200, await valido.clone().text())
    const cifra = await valido.json()
    assert.equal(cifra.tom, 'A')
    assert.ok(cifra.notas.includes('A      D\nTexto fictício'))
    assert.equal(chamadasFonte, 2)
    const repetido = await mf.dispatchFetch(url, { method: 'POST', headers, body })
    assert.equal(repetido.status, 200)
    assert.equal(chamadasFonte, 2)
    const invalido = await mf.dispatchFetch(url, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token.slice(0, -5)}xxxxx` }, body })
    assert.equal(invalido.status, 401)
    bloquearPrincipal = true
    const alternativo = await mf.dispatchFetch(url, { method: 'POST', headers, body: JSON.stringify({ titulo: 'Cântico novo', autor: 'Intérprete Novo' }) })
    assert.equal(alternativo.status, 200, await alternativo.clone().text())
    const cifraAlternativa = await alternativo.json()
    assert.equal(cifraAlternativa.tom, '')
    assert.ok(cifraAlternativa.notas.startsWith('  D    G\nTexto fictício'))
    assert.ok(cifraAlternativa.notas.includes(' & final'))
    assert.ok(!cifraAlternativa.notas.includes('&nbsp;'))
    assert.ok(cifraAlternativa.fonte.startsWith('https://tudocifras.com.br/'))
    ativo = false
    const semPermissao = await mf.dispatchFetch(url, { method: 'POST', headers, body })
    assert.equal(semPermissao.status, 403)
  } finally { await mf.dispose() }
})
