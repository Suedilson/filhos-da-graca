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

const ACORDE = /^\(?[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|°|º|\+|-|\d|\(|\)|#|b|\/[A-G](?:#|b)?)*\)?$/
const DECORACAO = /^(?:\(?\d+x\)?|x\d+|\||-+|\/|%|\.+)$/i

function linhaDeAcordes(linha) {
  const tokens = linha.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((token) => ACORDE.test(token) || DECORACAO.test(token)) &&
    tokens.some((token) => ACORDE.test(token))
}

function linhaDeTablatura(linha) {
  return /^\s*[A-Ga-g]?\|.*[-|]/.test(linha) || /-{3,}|\|-|-\|/.test(linha)
}

// Monta a letra a partir de uma cifra, removendo acordes, tablaturas e marcações de seção.
export function extrairLetraDaCifra(cifra = '') {
  const texto = formatarCifra(cifra).replace(/\n+Fonte:[\s\S]*$/, '')
  const linhas = texto.split('\n').filter((linha) => {
    const semSecao = linha.replace(/^\s*\[[^\]]*\]/, '')
    if (semSecao !== linha && (!semSecao.trim() || linhaDeAcordes(semSecao))) return false
    if (linhaDeTablatura(linha) || linhaDeAcordes(linha)) return false
    return true
  })

  return linhas
    .map((linha) => linha.replace(/\s+$/, '').replace(/^\s+/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
