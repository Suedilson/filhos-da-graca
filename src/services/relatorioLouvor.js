import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

const azul = [27, 20, 100]
const cinza = [94, 105, 122]
const texto = (valor) => String(valor ?? '').trim() || 'Não informado'
const data = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor || '') ? valor.split('-').reverse().join('/') : 'Não informada'

export function criarRelatorioEscalas(escalas, { logo, emitidoPor = '', filtro = '', agora = new Date() } = {}) {
  if (!escalas.length) throw new Error('Nenhuma escala selecionada para o relatório.')
  if (!logo) throw new Error('A logomarca da igreja não foi carregada.')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: 'Escalas do Ministério de Louvor - Filhos da Graça', author: 'Igreja Filhos da Graça', subject: 'Equipe e repertório dos cultos' })
  const emissao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bahia' }).format(agora)
  const inteira = (conteudo, estilo = {}) => [{ content: conteudo, colSpan: 3, styles: estilo }]
  const secao = (nome) => inteira(nome, { fillColor: [237, 240, 246], textColor: azul, fontStyle: 'bold', cellPadding: 2.5 })

  escalas.forEach((escala, indice) => {
    if (indice) pdf.addPage('a4', 'portrait')
    const equipe = escala.equipe || []
    const repertorio = escala.repertorio || []
    const linhas = [
      [`Data: ${data(escala.data)}`, `Horário: ${texto(escala.horario)}`, `Status: ${texto(escala.status)}`],
      inteira(`Ministro de louvor: ${texto(escala.ministro)}`, { fontStyle: 'bold' }),
      secao('EQUIPE ESCALADA'),
      [{ content: '#', styles: { fontStyle: 'bold' } }, { content: 'Músico / vocalista', styles: { fontStyle: 'bold' } }, { content: 'Instrumento / função', styles: { fontStyle: 'bold' } }],
      ...(equipe.length ? equipe.map((pessoa, i) => [String(i + 1).padStart(2, '0'), texto(pessoa.nome), texto(pessoa.funcao)]) : [inteira('Equipe não informada.')]),
      secao('REPERTÓRIO - ORDEM DE MINISTRAÇÃO'),
      [{ content: '#', styles: { fontStyle: 'bold' } }, { content: 'Louvor', styles: { fontStyle: 'bold' } }, { content: 'Tom', styles: { fontStyle: 'bold' } }],
      ...(repertorio.length ? repertorio.map((musica, i) => [String(i + 1).padStart(2, '0'), texto(musica.titulo), texto(musica.tom)]) : [inteira('Repertório não informado.')]),
      secao('OBSERVAÇÕES E ENSAIO'),
      inteira(escala.observacoes?.trim() || 'Sem observações.'),
      inteira(`Responsável pelo registro: ${texto(escala.responsavel)}\nVersão da escala: ${escala.versao || 1}`, { fontSize: 8, textColor: cinza }),
    ]
    autoTable(pdf, {
      startY: 51, margin: { top: 51, bottom: 22, left: 15, right: 15 },
      tableWidth: 180, theme: 'plain', rowPageBreak: 'avoid',
      head: [[{ content: texto(escala.titulo), colSpan: 3 }]], body: linhas,
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.8, overflow: 'linebreak', textColor: [33, 40, 55], lineColor: [226, 230, 237], lineWidth: { bottom: .15 }, valign: 'middle' },
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontSize: 13, fontStyle: 'bold', cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 99 }, 2: { cellWidth: 47 } },
    })
  })

  const paginas = pdf.getNumberOfPages()
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina)
    pdf.addImage(logo, 'PNG', 13, 4, 62, 35, 'logo-igreja')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(...azul)
    pdf.text('MINISTÉRIO DE LOUVOR', 195, 17, { align: 'right' })
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
    pdf.text('Relatório de escalas', 195, 24, { align: 'right' })
    pdf.setFontSize(8); pdf.setTextColor(...cinza)
    pdf.text(`Emissão: ${emissao}`, 195, 31, { align: 'right' })
    const resumo = filtro ? `Seleção: ${filtro}` : `${escalas.length} escala(s) selecionada(s)`
    pdf.text(pdf.splitTextToSize(resumo, 180).slice(0, 2), 15, 41)
    pdf.setDrawColor(...azul); pdf.setLineWidth(.5); pdf.line(15, 47, 195, 47)
    pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(.2); pdf.line(15, 279, 195, 279)
    pdf.setFontSize(7.5); pdf.setTextColor(...cinza)
    const autor = emitidoPor ? `Emitido por: ${emitidoPor}` : 'Igreja Filhos da Graça'
    pdf.text(pdf.splitTextToSize(autor, 140).slice(0, 2), 15, 284)
    pdf.text(`Página ${pagina} de ${paginas}`, 195, 284, { align: 'right' })
    pdf.text('Documento interno - Ministério de Louvor', 15, 291)
  }
  return pdf
}

export async function baixarRelatorioEscalas(escalas, opcoes) {
  const response = await fetch('/Filhosdagraça.png')
  if (!response.ok) throw new Error('Não foi possível carregar a logomarca da igreja.')
  const logo = new Uint8Array(await response.arrayBuffer())
  const pdf = criarRelatorioEscalas(escalas, { ...opcoes, logo })
  pdf.save('escalas-louvor-filhos-da-graca.pdf')
}
