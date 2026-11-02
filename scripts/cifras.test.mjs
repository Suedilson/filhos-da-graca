import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extrairCifra } from '../functions/cifras.js'

const pagina = '<h1>Canção teste</h1><div><div><p>Tom</p></div><span><p>G</p></span></div><pre data-chord-content="true"><b data-chord-name="G">G</b>       <b>C</b>\nTexto de teste\n<b>D</b>       <b>G</b>\nOutro verso fictício</pre>'
test('extrai tom e preserva alinhamento dos acordes', () => {
  const r = extrairCifra(pagina, 'Canção teste', 'https://www.cifraclub.com.br/teste/cancao-teste/')
  assert.equal(r.tom, 'G')
  assert.ok(r.notas.includes('G       C\nTexto de teste'))
  assert.ok(r.notas.includes('Fonte: Cifra Club'))
})
test('rejeita música diferente e versão que não tem cifra', () => {
  assert.throws(() => extrairCifra(pagina, 'Outra música', ''), /corresponde/)
  assert.throws(() => extrairCifra('<h1>Canção teste</h1><pre>Somente letra</pre>', 'Canção teste', ''), /acordes/)
})
