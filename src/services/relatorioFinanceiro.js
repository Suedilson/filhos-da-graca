import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

const azul = [27, 20, 100]
const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const texto = (valor) => String(valor ?? '').trim() || '-'
const data = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor || '') ? valor.split('-').reverse().join('/') : '-'

export function montarSecoesFinanceiras(dados) {
  const r = dados.resumo
  return [
    { titulo: 'Resumo financeiro', cabecalho: ['Indicador', 'Valor'], monetarias: [1], linhas: [
      ['Saldo disponível', moeda(r.saldoDisponivel)], ['Saldo financeiro', moeda(r.saldoFinanceiro)],
      ['Total arrecadado', moeda(r.totalArrecadacoes)], ['Resultado do período', moeda(r.resultadoPeriodoFinanceiro)],
      ['Contas pagas', moeda(r.totalContasPagas)], ['Contas em aberto', moeda(r.totalContasAbertas)],
      ['Aprovisionado', moeda(r.totalAprovisionado)], ['Despesas vencidas', texto(r.contasPagarVencidas)],
      ['Vencem hoje', texto(r.contasPagarVencemHoje)], ['Próximos 7 dias', texto(r.contasPagarProximos7Dias)],
      ['Contas bancárias', texto(r.contas)],
    ] },
    { titulo: 'Entradas por tipo', cabecalho: ['Tipo', 'Quantidade', 'Total'], monetarias: [2],
      linhas: dados.entradasPorTipo.map((i) => [texto(i.categoria), texto(i.quantidade), moeda(i.total)]) },
    { titulo: 'Despesas por categoria', cabecalho: ['Categoria', 'Qtd.', 'Pago', 'Em aberto', 'Total'], monetarias: [2, 3, 4],
      linhas: dados.despesasPorCategoria.map((i) => [texto(i.categoria), texto(i.quantidade), moeda(i.totalPago), moeda(i.totalAberto), moeda(i.total)]) },
    { titulo: 'Aprovisionamentos por categoria', cabecalho: ['Categoria', 'Quantidade', 'Total'], monetarias: [2],
      linhas: dados.reservasPorCategoria.map((i) => [texto(i.categoria), texto(i.quantidade), moeda(i.total)]) },
    { titulo: 'Movimento por conta bancária', cabecalho: ['Conta / banco', 'Entradas', 'Despesas pagas', 'Em aberto', 'Resultado'], monetarias: [1, 2, 3, 4],
      linhas: dados.movimentoPorConta.map((i) => [`${texto(i.nome)}\n${texto(i.banco)}`, moeda(i.entradas), moeda(i.despesasPagas), moeda(i.despesasAbertas), moeda(i.resultado)]) },
    { titulo: 'Arrecadações detalhadas', cabecalho: ['Data', 'Tipo / descrição', 'Conta / recebimento', 'Responsável', 'Status', 'Valor'], monetarias: [5], larguras: [20, 54, 40, 22, 20, 24],
      linhas: dados.arrecadacoes.map((i) => [data(i.data), `${texto(i.tipo)}\n${texto(i.descricao)}`, `${texto(i.contaBancariaNome)}\n${texto(i.formaPagamento)}`, texto(i.responsavel), i.ativo === false ? 'Cancelada' : 'Ativa', moeda(i.valor)]) },
    { titulo: 'Contas a pagar detalhadas', cabecalho: ['Vencimento / pagamento', 'Fornecedor / descrição', 'Categoria / conta', 'Forma', 'Status', 'Valor'], monetarias: [5], larguras: [22, 54, 38, 22, 20, 24],
      linhas: dados.despesas.map((i) => [ `${data(i.vencimento)}\nPgto.: ${data(i.dataPagamento)}`, `${texto(i.fornecedor)}\n${texto(i.descricao)}`, `${texto(i.categoria)}\n${texto(i.contaBancariaNome)}`, texto(i.formaPagamento), texto(i.statusRelatorio), moeda(i.valor)]) },
  ]
}

export function criarRelatorioFinanceiro(dados, { logo, periodo, emitidoPor = '', filtros = '', agora = new Date() } = {}) {
  if (!logo) throw new Error('A logomarca da igreja não foi carregada.')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  pdf.setProperties({ title: 'Relatório Financeiro - Filhos da Graça', author: 'Igreja Filhos da Graça', subject: periodo })
  let y = 53
  for (const secao of montarSecoesFinanceiras(dados)) {
    if (y > 237) { pdf.addPage(); y = 53 }
    const colunas = Object.fromEntries(secao.cabecalho.map((_, index) => [index, {
      ...(secao.monetarias.includes(index) ? { halign: 'right' } : {}),
      ...(secao.larguras ? { cellWidth: secao.larguras[index] } : {}),
    }]))
    autoTable(pdf, {
      startY: y, margin: { left: 15, right: 15, top: 53, bottom: 25 }, tableWidth: 180,
      head: [[{ content: secao.titulo, colSpan: secao.cabecalho.length, styles: { fillColor: azul, textColor: [255, 255, 255], fontSize: 10 } }], secao.cabecalho],
      body: secao.linhas.length ? secao.linhas : [[{ content: 'Nenhum registro nesta seleção.', colSpan: secao.cabecalho.length }]],
      theme: 'grid', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', valign: 'middle', lineColor: [224, 229, 237], lineWidth: .15, textColor: [33, 40, 55] },
      headStyles: { fillColor: [237, 240, 246], textColor: azul, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }, columnStyles: colunas,
    })
    y = pdf.lastAutoTable.finalY + 8
  }
  const paginas = pdf.getNumberOfPages()
  const emissao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bahia' }).format(agora)
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina)
    pdf.addImage(logo, 'PNG', 13, 4, 62, 35, 'logo-igreja')
    pdf.setTextColor(...azul); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13)
    pdf.text('RELATÓRIO FINANCEIRO', 195, 17, { align: 'right' })
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(94, 105, 122)
    pdf.text(`Emissão: ${emissao}`, 195, 25, { align: 'right' })
    pdf.text(pdf.splitTextToSize(`Período: ${periodo || 'Seleção atual'}`, 180).slice(0, 2), 15, 39)
    pdf.setDrawColor(...azul); pdf.setLineWidth(.5); pdf.line(15, 48, 195, 48)
    pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(.2); pdf.line(15, 275, 195, 275)
    pdf.setFontSize(7)
    pdf.text(pdf.splitTextToSize(emitidoPor ? `Emitido por: ${emitidoPor}` : 'Igreja Filhos da Graça', 145).slice(0, 1), 15, 280)
    pdf.text(`Página ${pagina} de ${paginas}`, 195, 280, { align: 'right' })
    pdf.text('Uso interno - Indicadores conforme a tela. Reservas: posição ativa, sem filtro de período.', 15, 285)
    if (filtros) pdf.text(pdf.splitTextToSize(filtros, 180).slice(0, 2), 15, 290)
  }
  return pdf
}

export async function baixarRelatorioFinanceiro(dados, opcoes) {
  const response = await fetch('/Filhosdagraça.png')
  if (!response.ok) throw new Error('Não foi possível carregar a logomarca.')
  const pdf = criarRelatorioFinanceiro(dados, { ...opcoes, logo: new Uint8Array(await response.arrayBuffer()) })
  pdf.save('relatorio-financeiro-filhos-da-graca.pdf')
}
