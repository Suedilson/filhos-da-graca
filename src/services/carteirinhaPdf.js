// Gera o PDF das carteirinhas de membro no tamanho padrão de cartão (CR80: 85,6 × 54 mm).
// Tudo é desenhado em milímetros, então a impressão sai na medida certa
// desde que a impressora esteja em "Tamanho real / 100%" (sem "Ajustar à página").

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

export const CARTAO = { largura: 85.6, altura: 53.98 }

const IGREJA = {
  nome: 'Igreja Evangélica Filhos da Graça',
  cnpj: '69.860.065/0001-03',
  endereco: 'R. José Firmo Dias, 32 - Felícia - Vitória da Conquista/BA',
  site: 'filhosdagraca.com.br',
  pastor: 'Pr. Cristiano Ribeiro',
  cargoPastor: 'Pastor Presidente',
}

const COR = {
  roxo: [23, 16, 95],
  roxoClaro: [59, 42, 168],
  verde: [111, 189, 42],
  dourado: [216, 165, 38],
  texto: [43, 47, 74],
  cinza: [96, 112, 138],
  fundo: [245, 243, 255],
}

export const URL_VERIFICACAO = 'https://filhosdagraca.com.br/carteirinha/'

function dataBR(iso) {
  if (!iso) return '-'
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-')
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : '-'
}

function iniciais(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .filter((_, i, p) => i === 0 || i === p.length - 1)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}

// Foto do Cloudinary já recortada no rosto, no formato 3x4
function urlFotoRecortada(url) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/c_fill,g_face,w_360,h_460,q_auto,f_jpg/')
}

async function imagemParaDataUrl(url) {
  if (!url) return null
  try {
    const resposta = await fetch(url, { mode: 'cors' })
    if (!resposta.ok) return null
    const blob = await resposta.blob()
    return await new Promise((resolve, reject) => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(leitor.result)
      leitor.onerror = reject
      leitor.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Recorta a foto no formato 3x4 (preenche sem distorcer, centralizando um pouco acima do meio)
async function fotoTresPorQuatro(dataUrl) {
  if (!dataUrl) return null
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = dataUrl
    })
    const largura = 360
    const altura = 460
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    const escala = Math.max(largura / img.width, altura / img.height)
    const w = img.width * escala
    const h = img.height * escala
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(img, (largura - w) / 2, Math.min(0, (altura - h) * 0.3), w, h)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return dataUrl
  }
}

let logoCache
async function carregarLogo() {
  if (logoCache === undefined) logoCache = await imagemParaDataUrl('/logo-filhos-colorida.png')
  return logoCache
}

// Quebra o nome em até 2 linhas que caibam na largura
function linhasNome(pdf, nome, largura) {
  const linhas = pdf.splitTextToSize(String(nome || '').toUpperCase(), largura)
  if (linhas.length <= 2) return linhas
  return [linhas[0], `${linhas.slice(1).join(' ').slice(0, 24).trim()}...`]
}

function desenharFrente(pdf, x, y, dados, recursos) {
  const { largura: L, altura: A } = CARTAO

  // Fundo e borda
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(x, y, L, A, 3, 3, 'F')

  // Faixa superior
  pdf.setFillColor(...COR.roxo)
  pdf.roundedRect(x, y, L, 14, 3, 3, 'F')
  pdf.rect(x, y + 10, L, 4, 'F')
  pdf.setFillColor(...COR.roxoClaro)
  pdf.rect(x + L * 0.62, y, L * 0.38 - 3, 14, 'F')
  pdf.setFillColor(...COR.roxo)
  pdf.triangle(x + L * 0.62, y, x + L * 0.62 + 8, y, x + L * 0.62, y + 14, 'F')
  pdf.setFillColor(...COR.roxoClaro)
  pdf.roundedRect(x + L - 6, y, 6, 14, 3, 3, 'F')
  pdf.rect(x + L - 6, y + 10, 6, 4, 'F')

  // Logo num círculo branco
  pdf.setFillColor(255, 255, 255)
  pdf.circle(x + 8.5, y + 7, 5.3, 'F')
  if (recursos.logo) pdf.addImage(recursos.logo, 'PNG', x + 3.7, y + 2.2, 9.6, 9.6)

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.2)
  pdf.text('CARTEIRA DE MEMBRO', x + 16.5, y + 6.2)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(5.6)
  pdf.text(IGREJA.nome, x + 16.5, y + 10)

  // Foto 3x4
  const fx = x + 4
  const fy = y + 17.5
  const fl = 21
  const fa = 27
  pdf.setFillColor(...COR.fundo)
  pdf.roundedRect(fx, fy, fl, fa, 1.5, 1.5, 'F')
  if (recursos.foto) {
    pdf.addImage(recursos.foto, 'JPEG', fx, fy, fl, fa)
  } else {
    pdf.setTextColor(...COR.roxoClaro)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(iniciais(dados.nome) || '?', fx + fl / 2, fy + fa / 2 + 2, { align: 'center' })
  }
  pdf.setDrawColor(...COR.verde)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(fx, fy, fl, fa, 1.5, 1.5, 'S')

  // Dados
  const tx = x + 29
  const larguraTexto = L - 29 - 4
  pdf.setTextColor(...COR.roxo)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.4)
  const nome = linhasNome(pdf, dados.nome, larguraTexto)
  pdf.text(nome, tx, y + 21)
  let cy = y + 21 + nome.length * 3.6 + 0.8

  pdf.setTextColor(...COR.verde)
  pdf.setFontSize(6.4)
  pdf.text(String(dados.funcao || 'Membro').toUpperCase().slice(0, 34), tx, cy)
  cy += 5

  const campo = (rotulo, valor, cx, cyy) => {
    pdf.setTextColor(...COR.cinza)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(4.8)
    pdf.text(rotulo, cx, cyy)
    pdf.setTextColor(...COR.texto)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.6)
    pdf.text(valor, cx, cyy + 3)
  }
  campo('MATRÍCULA', dados.numero || '-', tx, cy)
  campo('VALIDADE', dataBR(dados.validade), tx + 26, cy)
  cy += 7.5
  campo('NASCIMENTO', dataBR(dados.nascimento), tx, cy)
  campo('EMISSÃO', dataBR(dados.emitidaEm), tx + 26, cy)

  // Faixa inferior
  pdf.setFillColor(...COR.verde)
  pdf.rect(x + 3, y + A - 2.2, L * 0.55, 1.2, 'F')
  pdf.setFillColor(...COR.dourado)
  pdf.rect(x + 3 + L * 0.55, y + A - 2.2, L - 6 - L * 0.55, 1.2, 'F')
}

function desenharVerso(pdf, x, y, dados, recursos) {
  const { largura: L, altura: A } = CARTAO

  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(x, y, L, A, 3, 3, 'F')
  pdf.setFillColor(...COR.roxo)
  pdf.roundedRect(x, y + A - 9, L, 9, 3, 3, 'F')
  pdf.rect(x, y + A - 9, L, 4, 'F')

  // Igreja
  pdf.setTextColor(...COR.roxo)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text(IGREJA.nome.toUpperCase(), x + 4, y + 6)
  pdf.setTextColor(...COR.cinza)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(5)
  pdf.text(`CNPJ ${IGREJA.cnpj}`, x + 4, y + 9.2)
  pdf.text(IGREJA.endereco, x + 4, y + 12)

  // Texto livre
  pdf.setTextColor(...COR.texto)
  pdf.setFontSize(5.4)
  const texto = pdf.splitTextToSize(dados.textoVerso || '', L - 4 - 30)
  pdf.text(texto.slice(0, 4), x + 4, y + 18)

  // Assinatura
  pdf.setDrawColor(...COR.texto)
  pdf.setLineWidth(0.2)
  pdf.line(x + 4, y + 36, x + 44, y + 36)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(5.8)
  pdf.text(IGREJA.pastor, x + 24, y + 39, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(4.8)
  pdf.setTextColor(...COR.cinza)
  pdf.text(IGREJA.cargoPastor, x + 24, y + 41.6, { align: 'center' })

  // QR code
  if (recursos.qr) {
    pdf.setFillColor(255, 255, 255)
    pdf.addImage(recursos.qr, 'PNG', x + L - 27, y + 15, 23, 23)
    pdf.setTextColor(...COR.cinza)
    pdf.setFontSize(4.4)
    pdf.text('Confira a autenticidade', x + L - 15.5, y + 40.4, { align: 'center' })
    pdf.text(`Código ${dados.codigo}`, x + L - 15.5, y + 42.6, { align: 'center' })
  }

  // Rodapé
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(5.6)
  pdf.text('GERADOS NO CORAÇÃO DE DEUS', x + 4, y + A - 3.6)
  pdf.setFont('helvetica', 'normal')
  pdf.text(IGREJA.site, x + L - 4, y + A - 3.6, { align: 'right' })
}

async function prepararRecursos(dados) {
  const [logo, foto, qr] = await Promise.all([
    carregarLogo(),
    imagemParaDataUrl(urlFotoRecortada(dados.foto)).then(fotoTresPorQuatro),
    dados.codigo
      ? QRCode.toDataURL(`${URL_VERIFICACAO}${dados.codigo}`, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 360,
          color: { dark: '#17105fff', light: '#ffffffff' },
        })
      : null,
  ])
  return { logo, foto, qr }
}

// Marcas de corte nos quatro cantos de um cartão
function marcasDeCorte(pdf, x, y) {
  const { largura: L, altura: A } = CARTAO
  const t = 3
  const d = 1
  // Contorno bem claro do cartão, como guia de corte
  pdf.setDrawColor(215, 215, 215)
  pdf.setLineWidth(0.1)
  pdf.roundedRect(x, y, L, A, 3, 3, 'S')
  pdf.setDrawColor(150, 150, 150)
  pdf.setLineWidth(0.15)
  ;[
    [x, y], [x + L, y], [x, y + A], [x + L, y + A],
  ].forEach(([cx, cy]) => {
    const sx = cx === x ? -1 : 1
    const sy = cy === y ? -1 : 1
    pdf.line(cx + sx * d, cy, cx + sx * (d + t), cy)
    pdf.line(cx, cy + sy * d, cx, cy + sy * (d + t))
  })
}

/**
 * formato: 'a4' (10 por folha, verso espelhado na folha seguinte) ou 'cartao' (uma página por face, 85,6 × 54 mm)
 */
export async function gerarPdfCarteirinhas(lista, { formato = 'a4', incluirVerso = true } = {}) {
  const recursos = await Promise.all(lista.map(prepararRecursos))
  const { largura: L, altura: A } = CARTAO

  if (formato === 'cartao') {
    const pdf = new jsPDF({ unit: 'mm', format: [L, A], orientation: 'landscape' })
    lista.forEach((dados, i) => {
      if (i > 0) pdf.addPage([L, A], 'landscape')
      desenharFrente(pdf, 0, 0, dados, recursos[i])
      if (incluirVerso) {
        pdf.addPage([L, A], 'landscape')
        desenharVerso(pdf, 0, 0, dados, recursos[i])
      }
    })
    return pdf
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const colunas = 2
  const linhas = 5
  const porFolha = colunas * linhas
  // Espaço entre os cartões para facilitar o corte (margens ficam com ~7,5 mm)
  const espacoX = 6
  const espacoY = 3
  const margemX = (210 - colunas * L - (colunas - 1) * espacoX) / 2
  const margemY = (297 - linhas * A - (linhas - 1) * espacoY) / 2
  const posicao = (indice, espelhar) => {
    const linha = Math.floor(indice / colunas)
    let coluna = indice % colunas
    if (espelhar) coluna = colunas - 1 - coluna
    return [margemX + coluna * (L + espacoX), margemY + linha * (A + espacoY)]
  }

  let primeira = true
  for (let inicio = 0; inicio < lista.length; inicio += porFolha) {
    const grupo = lista.slice(inicio, inicio + porFolha)
    if (!primeira) pdf.addPage('a4', 'portrait')
    primeira = false
    grupo.forEach((dados, i) => {
      const [x, y] = posicao(i, false)
      desenharFrente(pdf, x, y, dados, recursos[inicio + i])
      marcasDeCorte(pdf, x, y)
    })
    pdf.setFontSize(6)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Frente - imprima em "Tamanho real (100%)"', 105, 293, { align: 'center' })

    if (incluirVerso) {
      // Verso espelhado para impressão frente e verso (virar pela borda longa)
      pdf.addPage('a4', 'portrait')
      grupo.forEach((dados, i) => {
        const [x, y] = posicao(i, true)
        desenharVerso(pdf, x, y, dados, recursos[inicio + i])
        marcasDeCorte(pdf, x, y)
      })
      pdf.setFontSize(6)
      pdf.setTextColor(150, 150, 150)
      pdf.text('Verso - frente e verso virando pela borda longa', 105, 293, { align: 'center' })
    }
  }
  return pdf
}
