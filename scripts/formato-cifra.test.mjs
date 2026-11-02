import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatarCifra } from '../src/services/formatoCifra.js'

test('decodifica espaços e acentos sem deslocar acordes', () => {
  assert.equal(formatarCifra('&nbsp;&nbsp;A9&nbsp;&nbsp;&nbsp;&nbsp;D9\nLinha fict&iacute;cia &amp; outra'), '  A9    D9\nLinha fictícia & outra')
})
test('preserva tabs, espaços consecutivos e indentação da primeira linha', () => {
  const cifra = '   G\tC\nLinha de teste\n    D      G'
  assert.equal(formatarCifra(cifra), cifra)
})
test('normaliza quebras de linha sem juntar versos e remove apenas linhas externas vazias', () => {
  assert.equal(formatarCifra('\r\n  A\r\n\r\n  D\r\n'), '  A\n\n  D')
})
test('conteúdo marcado continua sendo texto, sem executar HTML', () => {
  assert.equal(formatarCifra('&lt;script&gt;teste&lt;/script&gt;'), '<script>teste</script>')
  assert.equal(formatarCifra(null), '')
})
