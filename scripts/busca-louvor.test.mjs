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
    assert.equal(options.signal, signal)
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
