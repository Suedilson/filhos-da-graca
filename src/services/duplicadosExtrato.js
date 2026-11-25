// Encontra movimentos do extrato que entraram mais de uma vez (o mesmo extrato enviado em
// arquivos diferentes, ex.: OFX com "Entrada/Saída" e CSV com o nome de quem enviou o Pix).
//
// Mesmo dia + mesmo valor vindos de ORIGENS diferentes (arquivo/sincronização) são o mesmo
// movimento do banco. Fica a cópia com a descrição mais completa; as outras saem.
// Se a cópia que sai estava conciliada:
//   - e a que fica está pendente → o vínculo passa para a que fica;
//   - e a que fica também está conciliada → o lançamento da cópia é duplicado e é cancelado.

const generica = (d) => /^(entrada|sa[ií]da)$/i.test(String(d || '').trim())
const origemDe = (m) => String(m.arquivo || m.origem || 'sem-origem')

export function planejarCorrecaoDuplicados(movimentos) {
  const grupos = {}
  for (const original of movimentos) {
    const m = { ...original }
    const k = `${m.data}|${Number(m.valor).toFixed(2)}`
    ;(grupos[k] = grupos[k] || []).push(m)
  }

  const remover = []
  const moverVinculo = []
  const cancelarLancamentos = []

  for (const lista of Object.values(grupos)) {
    const porOrigem = {}
    for (const m of lista) (porOrigem[origemDe(m)] = porOrigem[origemDe(m)] || []).push(m)
    const origens = Object.values(porOrigem)
    if (origens.length < 2) continue

    // Fica a origem com mais movimentos; no empate, a de descrição mais completa
    const nota = (l) => l.length * 1000 + l.filter((m) => !generica(m.descricao)).length * 10 +
      l.reduce((t, m) => t + String(m.descricao || '').length, 0) / l.length / 100
    origens.sort((a, b) => nota(b) - nota(a))
    const ficam = [...origens[0]]
    // Conciliados primeiro, para os vínculos se encontrarem
    ficam.sort((a, b) => Number(Boolean(b.lancamentoId)) - Number(Boolean(a.lancamentoId)))

    const livres = [...ficam]
    for (const outra of origens.slice(1)) {
      for (const d of outra) {
        if (!livres.length) break
        // Para cópia conciliada, prefere par pendente (o vínculo passa para ele)
        let i = d.lancamentoId ? livres.findIndex((k) => !k.lancamentoId) : livres.findIndex((k) => k.lancamentoId)
        if (i < 0) i = 0
        const [k] = livres.splice(i, 1)
        remover.push(d.id)
        if (!d.lancamentoId) continue
        if (!k.lancamentoId) {
          moverVinculo.push({ de: d.id, para: k.id, lancamentoId: d.lancamentoId, lancamentoTipo: d.lancamentoTipo, descricao: k.descricao })
          k.lancamentoId = d.lancamentoId
        } else if (k.lancamentoId !== d.lancamentoId) {
          cancelarLancamentos.push({ id: d.lancamentoId, tipo: d.lancamentoTipo, valor: Math.abs(Number(d.valor)), data: d.data })
        }
      }
    }
  }

  return { remover, moverVinculo, cancelarLancamentos }
}
