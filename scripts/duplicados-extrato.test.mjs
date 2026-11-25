import test from 'node:test'
import assert from 'node:assert/strict'
import { planejarCorrecaoDuplicados } from '../src/services/duplicadosExtrato.js'

const ofx = (id, data, valor, extra = {}) => ({ id, data, valor, descricao: valor > 0 ? 'Entrada' : 'Saída', arquivo: 'cora.ofx', ...extra })
const csv = (id, data, valor, nome, extra = {}) => ({ id, data, valor, descricao: `Transf Pix - ${nome}`, arquivo: 'cora.csv', ...extra })

test('ambos conciliados: cancela o lançamento da cópia genérica', () => {
  const r = planejarCorrecaoDuplicados([
    ofx('o1', '2026-11-15', 200, { lancamentoId: 'A1', lancamentoTipo: 'arrecadacao' }),
    csv('c1', '2026-11-15', 200, 'Franklin', { lancamentoId: 'A2', lancamentoTipo: 'arrecadacao' }),
  ])
  assert.deepEqual(r.remover, ['o1'])
  assert.equal(r.cancelarLancamentos[0].id, 'A1')
  assert.equal(r.moverVinculo.length, 0)
})

test('genérica conciliada e nomeada pendente: o vínculo passa para a nomeada', () => {
  const r = planejarCorrecaoDuplicados([
    ofx('o1', '2026-11-10', 700, { lancamentoId: 'A1', lancamentoTipo: 'arrecadacao' }),
    csv('c1', '2026-11-10', 700, 'Jorge'),
  ])
  assert.deepEqual(r.remover, ['o1'])
  assert.deepEqual(r.moverVinculo, [{ de: 'o1', para: 'c1', lancamentoId: 'A1', lancamentoTipo: 'arrecadacao', descricao: 'Transf Pix - Jorge' }])
  assert.equal(r.cancelarLancamentos.length, 0)
})

test('duas pendentes: só remove a cópia genérica', () => {
  const r = planejarCorrecaoDuplicados([ofx('o1', '2026-11-16', -1000), csv('c1', '2026-11-16', -1000, 'Cristiano')])
  assert.deepEqual(r.remover, ['o1'])
})

test('vários do mesmo valor no mesmo dia se emparelham um a um', () => {
  const r = planejarCorrecaoDuplicados([
    ofx('o1', '2026-11-15', 50, { lancamentoId: 'A1', lancamentoTipo: 'arrecadacao' }),
    ofx('o2', '2026-11-15', 50, { lancamentoId: 'A2', lancamentoTipo: 'arrecadacao' }),
    csv('c1', '2026-11-15', 50, 'Anna', { lancamentoId: 'B1', lancamentoTipo: 'arrecadacao' }),
    csv('c2', '2026-11-15', 50, 'Valeria', { lancamentoId: 'B2', lancamentoTipo: 'arrecadacao' }),
  ])
  assert.deepEqual(r.remover.sort(), ['o1', 'o2'])
  assert.deepEqual(r.cancelarLancamentos.map((c) => c.id).sort(), ['A1', 'A2'])
})

test('mesma origem com valores iguais não é duplicado', () => {
  const r = planejarCorrecaoDuplicados([csv('c1', '2026-11-08', 20, 'Kelly'), csv('c2', '2026-11-08', 20, 'Maria')])
  assert.equal(r.remover.length, 0)
})

test('não altera os objetos recebidos', () => {
  const lista = [ofx('o1', '2026-11-10', 700, { lancamentoId: 'A1' }), csv('c1', '2026-11-10', 700, 'Jorge')]
  planejarCorrecaoDuplicados(lista)
  assert.equal(lista[1].lancamentoId, undefined)
})
