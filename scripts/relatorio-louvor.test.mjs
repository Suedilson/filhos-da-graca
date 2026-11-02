import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { criarRelatorioEscalas } from '../src/services/relatorioLouvor.js'

const logo = new Uint8Array(fs.readFileSync(new URL('../public/Filhosdagraça.png', import.meta.url)))
const opcoes = { logo, emitidoPor: 'Coordenação do Louvor', filtro: 'Escala individual', agora: new Date('2026-11-02T15:00:00Z') }
const escala = {
  titulo: 'Culto de Celebração', data: '2026-11-08', horario: '19:00', status: 'Confirmada',
  ministro: 'Ministro de exemplo', responsavel: 'Secretaria da igreja', versao: 2,
  equipe: ['Voz principal', 'Backing vocal', 'Violão', 'Teclado', 'Baixo', 'Bateria'].map((funcao, i) => ({ nome: `Integrante de exemplo ${i + 1}`, funcao })),
  repertorio: ['Louvor de abertura', 'Canção de celebração', 'Momento de adoração', 'Louvor de encerramento'].map((titulo, i) => ({ titulo, tom: ['G', 'D', 'A', 'C'][i] })),
  observacoes: 'Ensaio às 17h30. Conferir os instrumentos e os microfones antes do início do culto.\nEquipe reunida para oração às 18h45.',
}

test('escala habitual cabe em uma folha A4 com logo e rodapé', () => {
  const pdf = criarRelatorioEscalas([escala], opcoes)
  assert.equal(pdf.getNumberOfPages(), 1)
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 210) < .1)
  assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - 297) < .1)
  assert.ok(pdf.output().includes('/Subtype /Image'))
  const dir = path.join(os.tmpdir(), 'filhos-da-graca-pdf-qa')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'escala-exemplo.pdf'), Buffer.from(pdf.output('arraybuffer')))
  console.log(`Amostra visual: ${path.join(dir, 'escala-exemplo.pdf')}`)
})

test('lista inicia cada escala em nova folha', () => {
  const pdf = criarRelatorioEscalas([escala, { ...escala, titulo: 'Segundo culto' }], opcoes)
  assert.equal(pdf.getNumberOfPages(), 2)
})

test('equipe e observações extensas geram continuação em A4', () => {
  const pdf = criarRelatorioEscalas([{ ...escala,
    equipe: Array.from({ length: 65 }, (_, i) => ({ nome: `Integrante ${i} com nome completo extenso`, funcao: 'Vocal e instrumentos' })),
    observacoes: 'Observação de ensaio e organização da equipe. '.repeat(140),
  }], opcoes)
  assert.ok(pdf.getNumberOfPages() > 1)
})

test('não exporta lista vazia nem relatório sem logomarca', () => {
  assert.throws(() => criarRelatorioEscalas([], opcoes), /Nenhuma escala/)
  assert.throws(() => criarRelatorioEscalas([escala]), /logomarca/)
})
