// Transposição e leitura de cifras (acordes acima da letra, como em sites de cifra).

const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const INDICE = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0,
}

const ACORDE = /^\(?([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|°|º|\+|-|\d|\(|\)|#|b)*)(?:\/([A-G](?:#|b)?))?\)?$/
const DECORACAO = /^(?:\(?\d+x\)?|x\d+|\||-+|\/|%|\.+)$/i

function moverNota(nota, semitons, usarBemol) {
  const i = INDICE[nota]
  if (i === undefined) return nota
  const n = (((i + semitons) % 12) + 12) % 12
  return (usarBemol ? BEMOIS : SUSTENIDOS)[n]
}

export function transporAcorde(acorde, semitons) {
  if (!semitons) return acorde
  // Acorde entre parênteses, ex.: (E) → transpõe o de dentro
  if (/^\(.*\)$/.test(acorde)) return `(${transporAcorde(acorde.slice(1, -1), semitons)})`
  const m = acorde.match(ACORDE)
  if (!m) return acorde
  const [, raiz, resto = '', baixo] = m
  const usarBemol = raiz.includes('b')
  return `${moverNota(raiz, semitons, usarBemol)}${resto}${baixo ? `/${moverNota(baixo, semitons, usarBemol)}` : ''}`
}

export function transporTom(tom, semitons) {
  const texto = String(tom || '').trim()
  if (!texto || !semitons) return texto
  return transporAcorde(texto, semitons)
}

export function ehLinhaDeAcordes(linha) {
  const tokens = linha.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 &&
    tokens.every((t) => ACORDE.test(t) || DECORACAO.test(t)) &&
    tokens.some((t) => ACORDE.test(t))
}

function ehTablatura(linha) {
  return /^\s*[A-Ga-g]?\|.*[-|]/.test(linha) || /-{3,}|\|-|-\|/.test(linha)
}

// Transpõe uma linha de acordes mantendo o alinhamento com a letra de baixo.
function transporLinha(linha, semitons) {
  if (!semitons) return linha
  let resultado = ''
  let sobra = 0
  for (const parte of linha.split(/(\s+)/)) {
    if (!parte) continue
    if (/^\s+$/.test(parte)) {
      // Compensa acordes que ficaram maiores/menores para não desalinhar
      const largura = Math.max(1, parte.length - sobra)
      resultado += ' '.repeat(largura)
      sobra = 0
    } else {
      const novo = ACORDE.test(parte) ? transporAcorde(parte, semitons) : parte
      sobra += novo.length - parte.length
      resultado += novo
    }
  }
  return resultado
}

/**
 * Divide a cifra em linhas classificadas para exibir:
 * tipo: 'acordes' | 'secao' | 'tab' | 'letra' | 'vazia'
 */
export function linhasDaCifra(texto, semitons = 0) {
  return String(texto || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+Fonte:[\s\S]*$/, '')
    .split('\n')
    .map((linha) => {
      if (!linha.trim()) return { tipo: 'vazia', texto: '' }
      const secao = linha.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
      if (secao) {
        const resto = secao[2] || ''
        return {
          tipo: 'secao',
          texto: secao[1],
          acordes: resto && ehLinhaDeAcordes(resto) ? transporLinha(resto, semitons) : resto,
        }
      }
      if (ehTablatura(linha)) return { tipo: 'tab', texto: linha }
      if (ehLinhaDeAcordes(linha)) return { tipo: 'acordes', texto: transporLinha(linha, semitons) }
      return { tipo: 'letra', texto: linha }
    })
}
