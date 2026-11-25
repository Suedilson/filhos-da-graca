// Sincronização automática dos extratos bancários (Cora, Stone) pela Pluggy / Meu Pluggy,
// do mesmo jeito do projeto "cofre". Os movimentos vão para a coleção extratoBancario,
// a mesma da tela Financeiro → Conciliação.
//
// Segredos (wrangler secret put): PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS
// (ids das conexões do Meu Pluggy, separados por vírgula). Para dizer a qual conta do site
// cada conexão pertence, escreva o nome depois de dois-pontos: "id-da-cora:Cora,id-da-stone:Stone".
// Sem o nome, a ligação é feita pelo nome do banco que aparece na conta (ex.: "Cora" → conta "Cora").

import { tokenGoogle, urlFirestore } from './google.js'

const PLUGGY = 'https://api.pluggy.ai'
const MESES_CARGA_INICIAL = 12
const DIAS_JANELA = 35

const dataBahia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(d))
const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function chavePluggy(env) {
  const r = await fetch(`${PLUGGY}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }),
  })
  if (!r.ok) throw new Error(`Pluggy recusou o acesso (HTTP ${r.status}). Confira PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.`)
  return (await r.json()).apiKey
}

async function pluggyGet(chave, caminho, params = {}) {
  const url = new URL(caminho, PLUGGY)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v)
  const r = await fetch(url, { headers: { 'X-API-KEY': chave } })
  if (!r.ok) throw new Error(`Pluggy ${url.pathname} falhou (HTTP ${r.status})`)
  return r.json()
}

async function transacoes(chave, accountId, dateFrom) {
  const todas = []
  let after
  for (let i = 0; i < 20; i += 1) {
    const r = await pluggyGet(chave, '/v2/transactions', { accountId, dateFrom, after })
    todas.push(...(r.results || []))
    if (!r.next) break
    after = new URL(r.next, PLUGGY).searchParams.get('after') || undefined
    if (!after) break
  }
  return todas
}

// ---------- Firestore (REST) ----------
const caminhoDoc = (env, caminho) =>
  `projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/${caminho}`

function campo(v) {
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  return { stringValue: String(v ?? '') }
}
const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, campo(v)]))
const lerValor = (f) => f?.doubleValue ?? (f?.integerValue !== undefined ? Number(f.integerValue) : f?.stringValue ?? f?.booleanValue)

async function contasDoSite(env, token) {
  const r = await fetch(`${urlFirestore(env, 'contasBancarias')}?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`Falha ao ler as contas bancárias (HTTP ${r.status})`)
  return ((await r.json()).documents || []).map((d) => ({
    id: d.name.split('/').pop(),
    nome: d.fields?.nome?.stringValue || '',
    banco: d.fields?.banco?.stringValue || '',
    ativo: d.fields?.ativo?.booleanValue !== false,
  }))
}

// Movimentos já guardados desta conta (para não duplicar nada)
async function movimentosExistentes(env, token, contaId) {
  const r = await fetch(`https://firestore.googleapis.com/v1/${caminhoDoc(env, '').replace(/\/$/, '')}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'extratoBancario' }],
        where: { fieldFilter: { field: { fieldPath: 'contaBancariaId' }, op: 'EQUAL', value: { stringValue: contaId } } },
        select: { fields: [{ fieldPath: 'data' }, { fieldPath: 'valor' }, { fieldPath: 'origem' }, { fieldPath: 'fitid' }, { fieldPath: 'codigoBanco' }] },
      },
    }),
  })
  if (!r.ok) throw new Error(`Falha ao ler o extrato guardado (HTTP ${r.status})`)
  return (await r.json())
    .filter((x) => x.document)
    .map((x) => ({
      id: x.document.name.split('/').pop(),
      data: lerValor(x.document.fields?.data),
      valor: Number(lerValor(x.document.fields?.valor) || 0),
      origem: lerValor(x.document.fields?.origem) || 'arquivo',
      fitid: lerValor(x.document.fields?.fitid) || '',
      codigoBanco: lerValor(x.document.fields?.codigoBanco) || '',
    }))
}

async function gravar(env, token, writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
    })
    if (!r.ok) throw new Error(`Falha ao gravar o extrato (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`)
  }
}

function contaCorrespondente(contasSite, nomeConector, nomeConta) {
  const alvo = normal(`${nomeConector} ${nomeConta}`)
  return contasSite.find((c) => c.ativo && c.nome && alvo.includes(normal(c.nome).split(' ')[0])) ||
    contasSite.find((c) => c.ativo && c.banco && alvo.includes(normal(c.banco).split(' ')[0]))
}

export async function sincronizarBancos(env) {
  const itens = String(env.PLUGGY_ITEM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => {
      const [id, ...rotulo] = s.split(':')
      return { id: id.trim(), rotulo: rotulo.join(':').trim() }
    })
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET || !itens.length) {
    return { configurado: false, mensagem: 'Sincronização automática ainda não configurada (faltam as chaves da Pluggy).' }
  }

  const [chave, token] = await Promise.all([chavePluggy(env), tokenGoogle(env)])
  const contasSite = await contasDoSite(env, token)
  const resumo = []

  for (const { id: itemId, rotulo } of itens) {
    const item = await pluggyGet(chave, `/items/${itemId}`)
    const conector = item.connector?.name || itemId
    const todasContas = (await pluggyGet(chave, '/accounts', { itemId })).results || []
    const contas = todasContas.filter((a) => a.type === 'BANK')
    const conexao = {
      status: item.status,
      execucao: item.executionStatus,
      atualizadoEm: item.lastUpdatedAt,
      contas: todasContas.map((a) => `${a.type}:${a.subtype || ''}:${a.name || ''}:${a.balance ?? ''}`).join(' | ').slice(0, 300),
      erro: item.error?.message || item.statusDetail?.message || '',
      consentimentoAte: item.consentExpiresAt || '',
      proximaAtualizacao: item.nextAutoSyncAt || '',
    }
    console.log('Pluggy item', itemId, JSON.stringify(conexao))

    // Obs.: conexões do Meu Pluggy não aceitam atualização manual (PATCH); elas espelham
    // a conexão do meu.pluggy.ai, que é atualizada a cada 24 h.

    if (!contas.length) {
      resumo.push({ banco: rotulo || conector, erro: `A conexão não trouxe nenhuma conta corrente (status ${item.status}${conexao.erro ? `: ${conexao.erro}` : ''}).`, conexao })
      continue
    }

    for (const conta of contas) {
      const destino = rotulo
        ? contasSite.find((c) => c.ativo && normal(c.nome) === normal(rotulo))
        : contaCorrespondente(contasSite, conector, conta.marketingName || conta.name)
      if (!destino) {
        resumo.push({
          banco: rotulo || conector,
          conta: conta.marketingName || conta.name,
          erro: rotulo
            ? `Não existe conta "${rotulo}" em Contas bancárias do site.`
            : 'Não deu para saber de qual conta é. Use "id:Cora" ou "id:Stone" em PLUGGY_ITEM_IDS.',
        })
        continue
      }

      const existentes = await movimentosExistentes(env, token, destino.id)
      const ids = new Set(existentes.map((m) => m.id))
      // Código do movimento no banco (FITID do OFX / id do Open Finance) já guardado
      const codigos = new Set(existentes.flatMap((m) => [m.origem !== 'pluggy' ? m.fitid : '', m.codigoBanco]).filter(Boolean))
      // Movimentos que já vieram por arquivo (OFX/CSV): não repete o mesmo valor no mesmo dia
      const porArquivo = {}
      for (const m of existentes.filter((x) => x.origem !== 'pluggy')) {
        const k = `${m.data}|${m.valor.toFixed(2)}`
        porArquivo[k] = (porArquivo[k] || 0) + 1
      }

      const inicio = new Date()
      if (existentes.some((m) => m.origem === 'pluggy')) inicio.setDate(inicio.getDate() - DIAS_JANELA)
      else inicio.setMonth(inicio.getMonth() - MESES_CARGA_INICIAL)

      const recebidas = await transacoes(chave, conta.id, dataBahia(inicio))
      // Pendentes (ex.: Pix de fim de semana ainda em processamento) ficam de fora do extrato
      // até serem confirmados, mas entram no diagnóstico e no saldo bloqueado.
      const pendentes = recebidas.filter((t) => t.status === 'PENDING')
      const lista = recebidas.filter((t) => (t.status || 'POSTED') !== 'PENDING')

      // Saldo direto do banco (Open Finance, sem esperar o ciclo de 24 h)
      let tempoReal
      try {
        const r = await fetch(`${PLUGGY}/accounts/${conta.id}/balance`, { headers: { 'X-API-KEY': chave } })
        tempoReal = r.ok ? { ok: true, ...(await r.json()) } : { ok: false, status: r.status }
      } catch (error) {
        tempoReal = { ok: false, status: error.message }
      }
      const disponivel = Number(tempoReal?.ok ? tempoReal.balance ?? conta.balance : conta.balance) || 0
      const contabil = Number(tempoReal?.ok ? tempoReal.closingBalance ?? conta.bankData?.closingBalance : conta.bankData?.closingBalance)
      const bloqueado = Number.isFinite(contabil) ? Math.round((contabil - disponivel) * 100) / 100 : 0
      const saldoBanco = Number.isFinite(contabil) && contabil > disponivel ? contabil : disponivel
      conexao.saldoDisponivel = disponivel
      conexao.saldoBloqueado = bloqueado
      conexao.investidoAuto = conta.bankData?.automaticallyInvestedBalance ?? null
      conexao.tempoReal = tempoReal?.ok ? `ok${tempoReal.updateDateTime ? ` (${tempoReal.updateDateTime})` : ''}` : `indisponível (${tempoReal?.status})`
      conexao.movimentos = recebidas.length
      conexao.pendentes = pendentes.length
      conexao.valorPendente = Math.round(pendentes.reduce((t, x) => t + (x.type === 'DEBIT' ? -Math.abs(x.amount) : Math.abs(x.amount)), 0) * 100) / 100
      conexao.ultimoMovimento = recebidas.map((t) => t.date).sort().pop() || ''

      const writes = []
      let jaPorArquivo = 0
      for (const t of lista) {
        const id = `pg_${String(t.id).replace(/[^A-Za-z0-9_-]/g, '')}`
        if (ids.has(id)) continue
        const codigoBanco = String(t.providerId || '').slice(0, 120)
        if (codigoBanco && codigos.has(codigoBanco)) { jaPorArquivo += 1; continue }
        const valor = Math.round((t.type === 'DEBIT' ? -Math.abs(t.amount) : Math.abs(t.amount)) * 100) / 100
        const data = dataBahia(t.date)
        const k = `${data}|${valor.toFixed(2)}`
        if (porArquivo[k] > 0) { porArquivo[k] -= 1; jaPorArquivo += 1; continue }
        writes.push({
          update: {
            name: caminhoDoc(env, `extratoBancario/${id}`),
            fields: campos({
              contaBancariaId: destino.id,
              contaBancariaNome: destino.nome,
              data,
              descricao: String(t.description || t.descriptionRaw || (valor > 0 ? 'Entrada' : 'Saída')).slice(0, 300),
              valor,
              fitid: String(t.id).slice(0, 120),
              codigoBanco,
              arquivo: `Pluggy · ${conector}`.slice(0, 120),
              origem: 'pluggy',
              importadoEm: new Date(),
            }),
          },
          currentDocument: { exists: false },
        })
      }

      // Saldo atual informado pelo banco. Se a conexão vier zerada e sem nenhum movimento
      // (a Stone pelo Open Finance às vezes faz isso), mantém o saldo do último extrato enviado.
      const saldoSuspeito = saldoBanco === 0 && recebidas.length === 0
      if (!saldoSuspeito) writes.push({
        update: {
          name: caminhoDoc(env, `extratoSaldos/${destino.id}`),
          fields: campos({ saldo: saldoBanco, saldoDisponivel: disponivel, saldoBloqueado: bloqueado, data: dataBahia(new Date()), origem: 'pluggy', atualizadoEm: new Date() }),
        },
      })

      if (writes.length) await gravar(env, token, writes)
      resumo.push({ banco: rotulo || conector, conta: destino.nome, novos: writes.length - (saldoSuspeito ? 0 : 1), saldoIgnorado: saldoSuspeito, jaPorArquivo, saldo: saldoBanco, recebidos: lista.length, conexao })
    }
  }

  // Registro da última sincronização (aparece na tela de Conciliação)
  await gravar(env, token, [{
    update: {
      name: caminhoDoc(env, 'configuracoes/sincronizacaoBancos'),
      fields: { quando: { timestampValue: new Date().toISOString() }, resumo: { stringValue: JSON.stringify(resumo).slice(0, 4000) } },
    },
  }])

  const novos = resumo.reduce((t, r) => t + (r.novos || 0), 0)
  console.log('Sincronização bancária:', JSON.stringify(resumo))
  return { configurado: true, novos, resumo, mensagem: `Sincronização concluída: ${novos} movimento(s) novo(s).` }
}
