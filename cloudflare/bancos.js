// Sincronização automática dos extratos bancários (Cora, Stone) pela Pluggy / Meu Pluggy,
// do mesmo jeito do projeto "cofre". Os movimentos vão para a coleção extratoBancario,
// a mesma da tela Financeiro → Conciliação.
//
// Segredos (wrangler secret put): PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS
// (ids das conexões do Meu Pluggy, separados por vírgula).
// Cada conta da Pluggy é ligada à conta do site pelo nome do banco (ex.: "Cora" → conta "Cora").

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
        select: { fields: [{ fieldPath: 'data' }, { fieldPath: 'valor' }, { fieldPath: 'origem' }] },
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
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET || !itens.length) {
    return { configurado: false, mensagem: 'Sincronização automática ainda não configurada (faltam as chaves da Pluggy).' }
  }

  const [chave, token] = await Promise.all([chavePluggy(env), tokenGoogle(env)])
  const contasSite = await contasDoSite(env, token)
  const resumo = []

  for (const itemId of itens) {
    const item = await pluggyGet(chave, `/items/${itemId}`)
    const conector = item.connector?.name || itemId
    const contas = ((await pluggyGet(chave, '/accounts', { itemId })).results || []).filter((a) => a.type === 'BANK')

    for (const conta of contas) {
      const destino = contaCorrespondente(contasSite, conector, conta.marketingName || conta.name)
      if (!destino) {
        resumo.push({ banco: conector, conta: conta.name, erro: 'Sem conta correspondente no site (cadastre uma conta com o nome do banco).' })
        continue
      }

      const existentes = await movimentosExistentes(env, token, destino.id)
      const ids = new Set(existentes.map((m) => m.id))
      // Movimentos que já vieram por arquivo (OFX/CSV): não repete o mesmo valor no mesmo dia
      const porArquivo = {}
      for (const m of existentes.filter((x) => x.origem !== 'pluggy')) {
        const k = `${m.data}|${m.valor.toFixed(2)}`
        porArquivo[k] = (porArquivo[k] || 0) + 1
      }

      const inicio = new Date()
      if (existentes.some((m) => m.origem === 'pluggy')) inicio.setDate(inicio.getDate() - DIAS_JANELA)
      else inicio.setMonth(inicio.getMonth() - MESES_CARGA_INICIAL)

      const lista = (await transacoes(chave, conta.id, dataBahia(inicio)))
        .filter((t) => (t.status || 'POSTED') !== 'PENDING')

      const writes = []
      let jaPorArquivo = 0
      for (const t of lista) {
        const id = `pg_${String(t.id).replace(/[^A-Za-z0-9_-]/g, '')}`
        if (ids.has(id)) continue
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
              arquivo: `Pluggy · ${conector}`.slice(0, 120),
              origem: 'pluggy',
              importadoEm: new Date(),
            }),
          },
          currentDocument: { exists: false },
        })
      }

      // Saldo atual informado pelo banco
      writes.push({
        update: {
          name: caminhoDoc(env, `extratoSaldos/${destino.id}`),
          fields: campos({ saldo: Number(conta.balance || 0), data: dataBahia(new Date()), origem: 'pluggy', atualizadoEm: new Date() }),
        },
      })

      await gravar(env, token, writes)
      resumo.push({ banco: conector, conta: destino.nome, novos: writes.length - 1, jaPorArquivo, saldo: Number(conta.balance || 0) })
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
