import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { criarRelatorioFinanceiro, montarSecoesFinanceiras } from '../src/services/relatorioFinanceiro.js'

const dados = {
  resumo: { saldoDisponivel: 630.25, saldoFinanceiro: 830.25, totalArrecadacoes: 1200.50,
    resultadoPeriodoFinanceiro: 830.25, totalContasPagas: 370.25, totalContasAbertas: 250,
    totalAprovisionado: 200, contasPagarVencidas: 1, contasPagarVencemHoje: 0, contasPagarProximos7Dias: 1, contas: 1 },
  entradasPorTipo: [{ categoria: 'Ofertas', quantidade: 2, total: 1200.50 }],
  despesasPorCategoria: [{ categoria: 'Despesas fixas', quantidade: 2, totalPago: 370.25, totalAberto: 250, total: 620.25 }],
  reservasPorCategoria: [{ categoria: 'Reserva geral', quantidade: 1, total: 200 }],
  movimentoPorConta: [{ nome: 'Conta principal', banco: 'Banco de exemplo', entradas: 1200.50, despesasPagas: 370.25, despesasAbertas: 250, resultado: 830.25 }],
  arrecadacoes: [{ data: '2026-11-01', tipo: 'Oferta', descricao: 'Culto de celebração', formaPagamento: 'Pix', contaBancariaNome: 'Conta principal', responsavel: 'Tesouraria', ativo: true, valor: 1200.50 }],
  despesas: [{ vencimento: '2026-11-02', dataPagamento: '2026-11-01', fornecedor: 'Fornecedor exemplo', categoria: 'Despesas fixas', descricao: 'Material e manutenção', formaPagamento: 'Transferência', contaBancariaNome: 'Conta principal', statusRelatorio: 'Paga', valor: 370.25 }],
}
const logo = new Uint8Array(fs.readFileSync(new URL('../public/Filhosdagraça.png', import.meta.url)))
const opcoes = { logo, periodo: 'Nov / 2026', emitidoPor: 'Tesouraria da igreja', filtros: 'Despesas: Todas. Fornecedor: Todos.', agora: new Date('2026-11-02T15:00:00Z') }

test('mantém valores, centavos e indicadores recebidos da tela', () => {
  const secoes = montarSecoesFinanceiras(dados)
  assert.equal(secoes.length, 7)
  assert.match(secoes[0].linhas.find((r) => r[0] === 'Resultado do período')[1], /830,25/)
  assert.match(secoes[5].linhas[0].at(-1), /1\.200,50/)
  assert.equal(secoes[6].linhas[0][4], 'Paga')
})

test('gera PDF A4 com logomarca e múltiplas seções', () => {
  const pdf = criarRelatorioFinanceiro(dados, opcoes)
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 210) < .1)
  assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - 297) < .1)
  assert.ok(pdf.getNumberOfPages() >= 2)
  assert.ok(pdf.output().includes('/Subtype /Image'))
  const dir = path.join(os.tmpdir(), 'filhos-da-graca-pdf-qa')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'financeiro-exemplo.pdf'), Buffer.from(pdf.output('arraybuffer')))
})

test('preserva cancelamentos e valores negativos no detalhamento', () => {
  const secoes = montarSecoesFinanceiras({ ...dados, arrecadacoes: [{ ...dados.arrecadacoes[0], ativo: false, valor: -12.34 }] })
  assert.equal(secoes[5].linhas[0][4], 'Cancelada')
  assert.match(secoes[5].linhas[0][5], /-.*12,34/)
})

test('exporta período vazio e pagina muitos lançamentos', () => {
  const vazio = Object.fromEntries(Object.keys(dados).map((k) => [k, k === 'resumo' ? {} : []]))
  assert.doesNotThrow(() => criarRelatorioFinanceiro(vazio, opcoes))
  const extenso = criarRelatorioFinanceiro({ ...dados, arrecadacoes: Array.from({ length: 90 }, () => dados.arrecadacoes[0]) }, opcoes)
  assert.ok(extenso.getNumberOfPages() > 3)
})
