// Leitura de extratos bancários (OFX e CSV) exportados pelos apps dos bancos (Cora, Stone etc.).
// Resultado: { movimentos: [{ data, descricao, valor, fitid }], saldo, saldoData }
// valor > 0 = entrada; valor < 0 = saída.

function numeroBR(texto) {
  let t = String(texto ?? '').trim().replace(/R\$|\s/g, '')
  if (!t) return NaN
  let negativo = false
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1) }
  if (t.endsWith('-')) { negativo = true; t = t.slice(0, -1) }
  if (t.startsWith('-')) { negativo = !negativo; t = t.slice(1) }
  if (t.startsWith('+')) t = t.slice(1)
  // 1.234,56 (BR) ou 1,234.56 / 1234.56 (EN)
  if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(/,/g, '')
  const n = Number(t)
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN
}

function dataISO(texto) {
  const t = String(texto ?? '').trim()
  let m = t.match(/^(\d{4})(\d{2})(\d{2})(?:\d|\[|$)/) // OFX: 20261105120000[-3:BRT]
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return ''
}

function limpar(texto) {
  return String(texto ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------- OFX (padrão dos bancos brasileiros) ----------
function campoOfx(bloco, nome) {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : ''
}

export function lerOfx(texto) {
  const movimentos = []
  const blocos = texto.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || []
  for (const bloco of blocos) {
    const valor = numeroBR(campoOfx(bloco, 'TRNAMT'))
    const data = dataISO(campoOfx(bloco, 'DTPOSTED'))
    if (!data || !Number.isFinite(valor) || valor === 0) continue
    const descricao = limpar([campoOfx(bloco, 'NAME'), campoOfx(bloco, 'MEMO')].filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).join(' - ')) || (valor > 0 ? 'Entrada' : 'Saída')
    movimentos.push({ data, descricao, valor: Math.round(valor * 100) / 100, fitid: campoOfx(bloco, 'FITID') })
  }
  const saldoBloco = texto.match(/<LEDGERBAL>[\s\S]*?(<\/LEDGERBAL>|$)/i)?.[0] || ''
  const saldo = numeroBR(campoOfx(saldoBloco, 'BALAMT'))
  return {
    movimentos,
    saldo: Number.isFinite(saldo) ? saldo : null,
    saldoData: dataISO(campoOfx(saldoBloco, 'DTASOF')) || null,
  }
}

// ---------- CSV (colunas detectadas pelo nome) ----------
function separarLinhaCsv(linha, sep) {
  const campos = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i]
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i += 1 } else aspas = !aspas
    } else if (c === sep && !aspas) {
      campos.push(atual); atual = ''
    } else atual += c
  }
  campos.push(atual)
  return campos.map((c) => c.trim())
}

const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function lerCsv(texto) {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length < 2) return { movimentos: [], saldo: null, saldoData: null }
  const sep = [';', ',', '\t'].sort((a, b) => linhas[0].split(b).length - linhas[0].split(a).length)[0]

  // Acha a linha de cabeçalho (algumas exportações têm linhas de título antes)
  let inicio = linhas.findIndex((l) => /data/i.test(normal(l)) && /(valor|entrada|saida|credito|debito|montante)/.test(normal(l)))
  if (inicio < 0) inicio = 0
  const cab = separarLinhaCsv(linhas[inicio], sep).map(normal)
  const col = (...nomes) => cab.findIndex((c) => nomes.some((n) => c === n || c.includes(n)))

  const iData = col('data')
  const iDesc = col('descricao', 'historico', 'lancamento', 'detalhe', 'titulo', 'nome', 'memo')
  const iValor = col('valor', 'montante', 'quantia')
  const iEntrada = col('entrada', 'credito')
  const iSaida = col('saida', 'debito')
  const iTipo = col('tipo', 'natureza', 'operacao')
  const iSaldo = col('saldo')
  const iId = col('identificador', 'id transacao', 'id da transacao', 'codigo', 'end to end')

  const movimentos = []
  let saldo = null
  let saldoData = null
  for (const linha of linhas.slice(inicio + 1)) {
    const c = separarLinhaCsv(linha, sep)
    const data = dataISO(c[iData])
    if (!data) continue
    let valor = NaN
    if (iValor >= 0 && c[iValor]) valor = numeroBR(c[iValor])
    else {
      const e = iEntrada >= 0 ? numeroBR(c[iEntrada]) : NaN
      const s = iSaida >= 0 ? numeroBR(c[iSaida]) : NaN
      if (Number.isFinite(e) && e !== 0) valor = Math.abs(e)
      else if (Number.isFinite(s) && s !== 0) valor = -Math.abs(s)
    }
    if (!Number.isFinite(valor) || valor === 0) continue
    // Coluna "tipo" (Débito/Saída) define o sinal quando o valor vem sempre positivo
    if (iTipo >= 0 && valor > 0 && /(debito|saida|pagamento|enviado|tarifa)/.test(normal(c[iTipo]))) valor = -valor
    const descricao = limpar(c[iDesc]) || (valor > 0 ? 'Entrada' : 'Saída')
    movimentos.push({ data, descricao, valor: Math.round(valor * 100) / 100, fitid: iId >= 0 ? c[iId] : '' })
    if (iSaldo >= 0 && c[iSaldo]) {
      const s = numeroBR(c[iSaldo])
      if (Number.isFinite(s) && (!saldoData || data >= saldoData)) { saldo = s; saldoData = data }
    }
  }
  return { movimentos, saldo, saldoData }
}

export function lerExtrato(nomeArquivo, texto) {
  const ehOfx = /\.ofx$/i.test(nomeArquivo) || /<OFX>|OFXHEADER/i.test(texto)
  return ehOfx ? lerOfx(texto) : lerCsv(texto)
}

// Identificador estável do movimento (evita duplicar quando o mesmo extrato é enviado de novo)
export async function idDoMovimento(contaId, mov, repeticao = 0) {
  const base = mov.fitid
    ? `${contaId}|${mov.fitid}`
    : `${contaId}|${mov.data}|${mov.valor.toFixed(2)}|${normal(mov.descricao)}|${repeticao}`
  const bytes = new TextEncoder().encode(base)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
}
