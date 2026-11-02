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
test('remove entidades codificadas em várias camadas e permanece estável', () => {
  const entrada = '[Intro]&amp;nbsp;G\n&amp;amp;nbsp;&amp;amp;nbsp;Em7\nLinha&amp;nbsp;de&amp;nbsp;teste'
  const resultado = '[Intro] G\n  Em7\nLinha de teste'
  assert.equal(formatarCifra(entrada), resultado)
  assert.equal(formatarCifra(formatarCifra(entrada)), resultado)
})
test('normaliza quebras de linha sem juntar versos e remove apenas linhas externas vazias', () => {
  assert.equal(formatarCifra('\r\n  A\r\n\r\n  D\r\n'), '  A\n\n  D')
})
test('conteúdo marcado continua sendo texto, sem executar HTML', () => {
  assert.equal(formatarCifra('&lt;script&gt;teste&lt;/script&gt;'), '<script>teste</script>')
  assert.equal(formatarCifra(null), '')
})
