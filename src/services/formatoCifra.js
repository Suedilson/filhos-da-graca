import { decodeHTML } from 'entities'

export function formatarCifra(valor = '') {
  let texto = String(valor ?? '')
  // Some sources encode entities again when serializing the chord sheet.
  for (let camada = 0; camada < 5; camada++) {
    const decodificado = decodeHTML(texto)
    if (decodificado === texto) break
    texto = decodificado
  }
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/^\n+|\n+$/g, '')
}
