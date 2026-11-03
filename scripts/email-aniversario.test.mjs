import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fazAniversarioHoje, hojeNaBahia, montarEmailAniversario, primeiroNome } from '../cloudflare/emailAniversario.js'

test('monta o e-mail com primeiro nome, logo, versículo e assinatura', () => {
  const { assunto, html, texto } = montarEmailAniversario('Ivna Souza Silveira')
  assert.equal(assunto, 'Feliz aniversário, Ivna! 🎉')
  assert.ok(html.includes('Feliz aniversário, Ivna!'))
  assert.ok(html.includes('https://filhosdagraca.com.br/logo-filhos-colorida.png'))
  assert.ok(html.includes('Pr. Cristiano Ribeiro'))
  assert.ok(html.includes('Números 6:24'))
  assert.ok(texto.includes('e toda a Igreja Filhos da Graça'))
})

test('nome com HTML é exibido como texto', () => {
  const { html } = montarEmailAniversario('<b>Teste</b>')
  assert.ok(!html.includes('<b>Teste'))
  assert.ok(html.includes('&lt;b&gt;Teste'))
  assert.equal(primeiroNome(''), 'irmão(ã)')
})

test('usa a data de Vitória da Conquista e trata 29 de fevereiro', () => {
  // 02:00 UTC de 16/11 ainda é 15/11 na Bahia (UTC-3)
  assert.deepEqual(hojeNaBahia(new Date('2026-11-16T02:00:00Z')), { ano: 2026, mes: '11', dia: '15' })
  const hoje = { ano: 2026, mes: '11', dia: '16' }
  assert.equal(fazAniversarioHoje('2004-11-16', hoje), true)
  assert.equal(fazAniversarioHoje('2004-11-17', hoje), false)
  assert.equal(fazAniversarioHoje('', hoje), false)
  assert.equal(fazAniversarioHoje('2000-02-29', { ano: 2027, mes: '02', dia: '28' }), true)
  assert.equal(fazAniversarioHoje('2000-02-29', { ano: 2028, mes: '02', dia: '28' }), false)
})
