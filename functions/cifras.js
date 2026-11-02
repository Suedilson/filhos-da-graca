import { load } from 'cheerio'

export const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const slug = (texto) => normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const origem = 'https://www.cifraclub.com.br'

async function pagina(caminho) {
  const response = await fetch(`${origem}${caminho}`, { signal: AbortSignal.timeout(8000), redirect: 'error' })
  if (!response.ok) throw new Error('Fonte de cifras indisponível')
  const reader = response.body.getReader()
  const partes = []
  let tamanho = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    tamanho += value.length
    if (tamanho > 1500000) { await reader.cancel(); throw new Error('Resposta excedeu o limite') }
    partes.push(value)
  }
  return Buffer.concat(partes).toString('utf8')
}

export function extrairCifra(html, titulo, url) {
  const $ = load(html)
  const nome = $('h1').first().text().trim()
  if (normalizar(nome) !== normalizar(titulo)) throw new Error('A cifra encontrada não corresponde ao título')
  const conteudo = $('pre[data-chord-content], .cifra_cnt pre, pre').first()
  if (!conteudo.find('b[data-chord-name], b').length) throw new Error('Esta versão não contém acordes')
  const cifra = conteudo.text().replace(/\u200b/g, '').trim()
  const tomAtual = $('p').filter((_, el) => $(el).text().trim() === 'Tom').first()
    .parent().parent().find('span p').first().text().trim()
  const tomAntigo = $('#cifra_tom a, #cifra_tom b').first().text().trim()
  const tom = tomAtual || tomAntigo
  if (!/^[A-G](?:#|b)?(?:m)?$/.test(tom)) throw new Error('Não foi possível confirmar o tom desta versão')
  if (!cifra || cifra.length > 19000) throw new Error('Cifra vazia ou muito extensa')
  return { tom, notas: `${cifra}\n\nFonte: Cifra Club\n${url}`, fonte: url }
}

export async function buscarCifra(titulo, autor) {
  const artista = slug(autor)
  if (!artista) throw new Error('Informe o intérprete para buscar a cifra correta')
  const htmlArtista = await pagina(`/${artista}/`)
  const $ = load(htmlArtista)
  const caminhos = [...new Set($('a[href]').toArray().map((el) => $(el).attr('href')))]
    .filter((href) => new RegExp(`^/${artista}/[a-z0-9-]+/$`).test(href))
  const desejado = slug(titulo)
  const semE = slug(titulo.replace(/\bé\b/gi, '').replace(/\be\b/gi, ''))
  const caminho = caminhos.find((href) => href === `/${artista}/${desejado}/`) ||
    caminhos.find((href) => href === `/${artista}/${semE}/`) ||
    caminhos.find((href) => $('a[href]').filter((_, el) => $(el).attr('href') === href)
      .toArray().some((el) => normalizar($(el).text()).includes(normalizar(titulo))))
  if (!caminho) throw new Error('Não encontramos uma cifra correspondente a este título e intérprete')
  return extrairCifra(await pagina(caminho), titulo, `${origem}${caminho}`)
}
