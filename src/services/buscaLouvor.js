export function normalizarTitulo(texto = '') {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

export async function buscarLetras(titulo, autor, signal) {
  const params = new URLSearchParams({ track_name: titulo.trim() })
  if (autor.trim()) params.set('artist_name', autor.trim())
  const response = await fetch(`https://lrclib.net/api/search?${params}`, { signal })
  if (!response.ok) throw new Error('Busca indisponível')
  const dados = await response.json()
  if (!Array.isArray(dados)) throw new Error('Resposta inválida')
  const encontrados = new Set()
  return dados.filter((item) => {
    const chave = `${normalizarTitulo(item.trackName)}|${normalizarTitulo(item.artistName)}`
    if (!item.plainLyrics || item.instrumental || encontrados.has(chave)) return false
    encontrados.add(chave)
    return true
  }).slice(0, 6).map((item) => ({
    id: `lrclib-${item.id}`, titulo: item.trackName || titulo, autor: item.artistName || '',
    letra: item.plainLyrics.slice(0, 40000), fonte: 'LRCLIB',
  }))
}
