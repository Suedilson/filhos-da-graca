import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buscarLetras, normalizarTitulo } from '../src/services/buscaLouvor.js'

test('normaliza títulos para buscar no repertório', () => {
  assert.equal(normalizarTitulo('  Acláme AO Senhor '), 'aclame ao senhor')
})

test('consulta título e intérprete; remove instrumentais, duplicatas e letras vazias', async (t) => {
  const signal = new AbortController().signal
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const params = new URL(url).searchParams
    assert.equal(params.get('track_name'), 'Canção teste')
    assert.equal(params.get('artist_name'), 'Intérprete')
    assert.equal(options.signal.aborted, false)
    return { ok: true, json: async () => [
      { id: 1, trackName: 'Canção teste', artistName: 'Intérprete', plainLyrics: 'Texto de teste' },
      { id: 2, trackName: 'Cancao teste', artistName: 'Interprete', plainLyrics: 'Duplicata' },
      { id: 3, instrumental: true, plainLyrics: 'Instrumental' },
      { id: 4, trackName: 'Sem letra' },
    ] }
  })
  const itens = await buscarLetras(' Canção teste ', ' Intérprete ', signal)
  assert.equal(itens.length, 1)
  assert.equal(itens[0].fonte, 'LRCLIB')
  assert.equal(itens[0].notas, undefined)
})

test('informa falha do provedor em vez de devolver resultados inexistentes', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }))
  await assert.rejects(buscarLetras('Teste', '', new AbortController().signal), /indisponível/)
})

test('repete automaticamente sem acentos após falha e reutiliza resultado em cache', async (t) => {
  let chamadas = 0
  t.mock.method(globalThis, 'fetch', async (url) => {
    chamadas++
    if (chamadas === 1) return { ok: false, status: 503 }
    assert.equal(new URL(url).searchParams.get('track_name'), 'versao unica')
    return { ok: true, json: async () => [{ id: 95, trackName: 'Versão única', artistName: 'Teste', plainLyrics: 'Letra de teste' }] }
  })
  const signal = new AbortController().signal
  const primeira = await buscarLetras('Versão única', '', signal)
  const segunda = await buscarLetras('Versão única', '', signal)
  assert.equal(chamadas, 2)
  assert.equal(primeira, segunda)
})

test('cancelamento impede buscas de um título antigo', async (t) => {
  const controller = new AbortController()
  let chamadas = 0
  t.mock.method(globalThis, 'fetch', async () => {
    chamadas++
    controller.abort(new Error('Título alterado'))
    return { ok: false, status: 503 }
  })
  await assert.rejects(buscarLetras('Título anterior', '', controller.signal), /Título alterado/)
  assert.equal(chamadas, 1)
})
