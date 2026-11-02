import { decodeHTML } from 'entities'

export function formatarCifra(valor = '') {
  return decodeHTML(String(valor ?? ''))
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/^\n+|\n+$/g, '')
}
