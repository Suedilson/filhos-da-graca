import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerExtrato, idDoMovimento } from '../src/services/extratoBancario.js'

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261102100000[-3:BRT]<TRNAMT>150.00<FITID>ABC1<MEMO>Pix recebido Maria
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-4500.00<FITID>ABC2<NAME>Aluguel<MEMO>Pagamento boleto
</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1234.56<DTASOF>20261110</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

test('OFX: lê entradas, saídas e saldo', () => {
  const r = lerExtrato('extrato.ofx', OFX)
  assert.equal(r.movimentos.length, 2)
  assert.deepEqual(r.movimentos[0], { data: '2026-11-02', descricao: 'Pix recebido Maria', valor: 150, fitid: 'ABC1' })
  assert.equal(r.movimentos[1].valor, -4500)
  assert.equal(r.movimentos[1].descricao, 'Aluguel - Pagamento boleto')
  assert.equal(r.saldo, 1234.56)
  assert.equal(r.saldoData, '2026-11-10')
})

test('CSV com ponto e vírgula, valor brasileiro e coluna de saldo', () => {
  const csv = 'Extrato da conta\nData;Descrição;Valor;Saldo\n02/11/2026;Pix recebido;1.250,00;1.250,00\n05/11/2026;Tarifa;-12,90;1.237,10\n'
  const r = lerExtrato('extrato.csv', csv)
  assert.equal(r.movimentos.length, 2)
  assert.equal(r.movimentos[0].valor, 1250)
  assert.equal(r.movimentos[1].valor, -12.9)
  assert.equal(r.saldo, 1237.1)
})

test('CSV com colunas de entrada e saída separadas', () => {
  const csv = 'data,historico,credito,debito\n2026-11-03,Oferta,"100,00",\n2026-11-04,Energia,,"136,48"\n'
  const r = lerExtrato('x.csv', csv)
  assert.deepEqual(r.movimentos.map((m) => m.valor), [100, -136.48])
})

test('CSV com valor positivo e coluna de tipo', () => {
  const csv = 'Data;Tipo;Descrição;Valor\n03/11/2026;Crédito;Pix;50,00\n04/11/2026;Débito;Boleto;80,00\n'
  const r = lerExtrato('x.csv', csv)
  assert.deepEqual(r.movimentos.map((m) => m.valor), [50, -80])
})

test('Mesmo movimento gera o mesmo identificador', async () => {
  const m = { data: '2026-11-02', descricao: 'Pix  recebido', valor: 150, fitid: '' }
  assert.equal(await idDoMovimento('cora', m), await idDoMovimento('cora', { ...m, descricao: 'Pix recebido' }))
  assert.notEqual(await idDoMovimento('cora', m), await idDoMovimento('stone', m))
  assert.notEqual(await idDoMovimento('cora', m, 0), await idDoMovimento('cora', m, 1))
})
