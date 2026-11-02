export function normalizarTitulo(texto = '') {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

const cache = new Map()
const validadeCache = 6 * 60 * 60 * 1000

function aguardar(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const cancelar = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancelar); resolve() }, ms)
    signal?.addEventListener('abort', cancelar, { once: true })
  })
}

function converter(dados, titulo) {
  const encontrados = new Set()
  return dados.filter((item) => {
    const chave = `${normalizarTitulo(item.trackName)}|${normalizarTitulo(item.artistName)}`
    if (!item.plainLyrics || item.instrumental || encontrados.has(chave)) return false
    encontrados.add(chave)
    return true
  }).sort((a, b) => Number(normalizarTitulo(b.trackName) === normalizarTitulo(titulo)) -
    Number(normalizarTitulo(a.trackName) === normalizarTitulo(titulo))).slice(0, 6).map((item) => ({
    id: `lrclib-${item.id}`, titulo: item.trackName || titulo, autor: item.artistName || '',
    letra: item.plainLyrics.slice(0, 40000), fonte: 'LRCLIB',
  }))
}

async function consultar(params, signal) {
  const controller = new AbortController()
  const cancelar = () => controller.abort(signal.reason)
  signal?.throwIfAborted()
  signal?.addEventListener('abort', cancelar, { once: true })
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(`https://lrclib.net/api/search?${params}`, { signal: controller.signal })
    if (!response.ok) return null
    const dados = await response.json()
    return Array.isArray(dados) ? dados : null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancelar)
  }
}

export async function buscarLetras(titulo, autor, signal) {
  signal?.throwIfAborted()
  const chave = `${normalizarTitulo(titulo)}|${normalizarTitulo(autor)}`
  const anterior = cache.get(chave)
  if (anterior && Date.now() - anterior.data < validadeCache) return anterior.itens

  const original = new URLSearchParams({ track_name: titulo.trim() })
  if (autor.trim()) original.set('artist_name', autor.trim())
  const normalizado = new URLSearchParams({ track_name: normalizarTitulo(titulo) })
  if (autor.trim()) normalizado.set('artist_name', normalizarTitulo(autor))
  const amplo = new URLSearchParams({ q: `${normalizarTitulo(titulo)} ${normalizarTitulo(autor)}`.trim() })
  const consultas = [original, normalizado, amplo]
  let respondeu = false
  for (let tentativa = 0; tentativa < consultas.length; tentativa++) {
    if (tentativa) await aguardar(500 * tentativa, signal)
    try {
      const dados = await consultar(consultas[tentativa], signal)
      if (!dados) continue
      respondeu = true
      const itens = converter(dados, titulo)
      if (!itens.length) continue
      cache.set(chave, { data: Date.now(), itens })
      if (cache.size > 30) cache.delete(cache.keys().next().value)
      return itens
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  if (respondeu) return []
  throw new Error('Busca indisponível')
}
