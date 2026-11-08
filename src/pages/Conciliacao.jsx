import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { mostrarAviso } from '../services/avisos'
import { idDoMovimento, lerExtrato } from '../services/extratoBancario'
import { sincronizarBancosAgora } from '../services/bancos'
import './Conciliacao.css'

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '-')
const diasEntre = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000)
const dataSaida = (d) => d.dataPagamento || d.vencimento || ''

export default function Conciliacao({
  contasBancarias,
  arrecadacoes,
  contasPagar,
  tiposArrecadacao,
  categoriasContaPagar,
  aoAtualizar,
}) {
  const contasAtivas = contasBancarias.filter((c) => c.ativo !== false)
  const [contaId, setContaId] = useState(contasAtivas[0]?.id || '')
  const [movimentos, setMovimentos] = useState([])
  const [saldos, setSaldos] = useState([])
  const [filtro, setFiltro] = useState('pendentes')
  const [importando, setImportando] = useState(false)
  const [processando, setProcessando] = useState('')
  const [lancando, setLancando] = useState(null)
  const [sincronia, setSincronia] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)

  async function buscar() {
    const [m, s, sync] = await Promise.all([
      getDocs(collection(db, 'extratoBancario')),
      getDocs(collection(db, 'extratoSaldos')),
      getDoc(doc(db, 'configuracoes', 'sincronizacaoBancos')).catch(() => null),
    ])
    let ultima = null
    if (sync?.exists()) {
      const dados = sync.data()
      let resumo
      try { resumo = JSON.parse(dados.resumo || '[]') } catch { resumo = [] }
      ultima = { quando: dados.quando?.toDate?.() || null, resumo }
    }
    return {
      movimentos: m.docs.map((d) => ({ id: d.id, ...d.data() })),
      saldos: s.docs.map((d) => ({ id: d.id, ...d.data() })),
      sincronia: ultima,
    }
  }

  async function recarregar() {
    try {
      const r = await buscar()
      setMovimentos(r.movimentos)
      setSaldos(r.saldos)
      setSincronia(r.sincronia)
    } catch (error) {
      console.error(error)
      mostrarAviso('Não foi possível carregar o extrato.', 'erro')
    }
  }

  useEffect(() => {
    let ativo = true
    buscar()
      .then((r) => {
        if (!ativo) return
        setMovimentos(r.movimentos)
        setSaldos(r.saldos)
        setSincronia(r.sincronia)
      })
      .catch((error) => console.error('Erro ao carregar o extrato.', error))
    return () => {
      ativo = false
    }
  }, [])

  const conta = contasBancarias.find((c) => c.id === contaId)
  const daConta = movimentos.filter((m) => m.contaBancariaId === contaId)

  // Lançamentos do site já vinculados a algum movimento do banco
  const vinculados = useMemo(() => new Set(movimentos.filter((m) => m.lancamentoId).map((m) => m.lancamentoId)), [movimentos])

  // Sugere um lançamento do site com o mesmo valor e data próxima (até 3 dias)
  function sugestao(mov) {
    if (mov.valor > 0) {
      return arrecadacoes
        .filter((a) => a.ativo !== false && !vinculados.has(a.id) && Math.abs(Number(a.valor) - mov.valor) < 0.005 &&
          a.data && diasEntre(a.data, mov.data) <= 3)
        .sort((a, b) => diasEntre(a.data, mov.data) - diasEntre(b.data, mov.data))[0]
    }
    return contasPagar
      .filter((d) => d.status === 'Paga' && d.ativo !== false && !vinculados.has(d.id) &&
        Math.abs(Number(d.valor) + mov.valor) < 0.005 && dataSaida(d) && diasEntre(dataSaida(d), mov.data) <= 3)
      .sort((a, b) => diasEntre(dataSaida(a), mov.data) - diasEntre(dataSaida(b), mov.data))[0]
  }

  const situacao = (m) => (m.lancamentoId ? 'conciliado' : m.ignorado ? 'ignorado' : 'pendente')
  const lista = daConta
    .filter((m) => filtro === 'todos' || (filtro === 'pendentes' ? situacao(m) === 'pendente' : situacao(m) !== 'pendente'))
    .sort((a, b) => b.data.localeCompare(a.data))

  const pendentes = daConta.filter((m) => situacao(m) === 'pendente')
  const entradasPend = pendentes.filter((m) => m.valor > 0).reduce((t, m) => t + m.valor, 0)
  const saidasPend = pendentes.filter((m) => m.valor < 0).reduce((t, m) => t - m.valor, 0)
  const saldoBanco = saldos.find((s) => s.id === contaId)

  // Saldo desta conta no site até a data do saldo informado pelo banco
  const saldoSite = (() => {
    if (!conta) return 0
    const limite = saldoBanco?.data || '9999-12-31'
    return Number(conta.saldoInicial || 0) +
      arrecadacoes.filter((a) => a.ativo !== false && a.contaBancariaId === contaId && (a.data || '') <= limite)
        .reduce((t, a) => t + Number(a.valor || 0), 0) -
      contasPagar.filter((d) => d.status === 'Paga' && d.ativo !== false && d.contaBancariaId === contaId && dataSaida(d) <= limite)
        .reduce((t, d) => t + Number(d.valor || 0), 0)
  })()

  async function importar(event) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return
    if (!conta) {
      mostrarAviso('Escolha a conta bancária do extrato antes de enviar.', 'erro')
      return
    }
    setImportando(true)
    try {
      const buffer = await arquivo.arrayBuffer()
      // Muitos bancos exportam em Latin-1; tenta UTF-8 e cai para Latin-1 se vier com caracteres quebrados
      let texto = new TextDecoder('utf-8').decode(buffer)
      if (texto.includes('�')) texto = new TextDecoder('iso-8859-1').decode(buffer)
      const { movimentos: lidos, saldo, saldoData } = lerExtrato(arquivo.name, texto)
      if (!lidos.length) {
        mostrarAviso('Não encontrei movimentações nesse arquivo. Envie o extrato em OFX ou CSV.', 'erro')
        return
      }
      const existentes = new Set(movimentos.map((m) => m.id))
      const repeticoes = {}
      const novos = []
      for (const mov of lidos) {
        const chave = `${mov.data}|${mov.valor}|${mov.descricao}`
        repeticoes[chave] = (repeticoes[chave] || 0) + 1
        const id = await idDoMovimento(contaId, mov, repeticoes[chave] - 1)
        if (!existentes.has(id)) novos.push({ id, ...mov })
      }
      for (let i = 0; i < novos.length; i += 400) {
        const lote = writeBatch(db)
        novos.slice(i, i + 400).forEach((m) => {
          lote.set(doc(db, 'extratoBancario', m.id), {
            contaBancariaId: contaId,
            contaBancariaNome: conta.nome || '',
            data: m.data,
            descricao: m.descricao.slice(0, 300),
            valor: m.valor,
            fitid: String(m.fitid || '').slice(0, 120),
            arquivo: arquivo.name.slice(0, 120),
            origem: 'arquivo',
            importadoEm: serverTimestamp(),
          })
        })
        await lote.commit()
      }
      if (saldo !== null && saldoData) {
        const lote = writeBatch(db)
        lote.set(doc(db, 'extratoSaldos', contaId), { saldo, data: saldoData, atualizadoEm: serverTimestamp() })
        await lote.commit()
      }
      await recarregar()
      mostrarAviso(
        `${lidos.length} movimentações lidas: ${novos.length} novas` +
          (lidos.length - novos.length ? `, ${lidos.length - novos.length} já estavam importadas` : '') + '.',
        'sucesso',
      )
    } catch (error) {
      console.error(error)
      mostrarAviso('Não foi possível importar o extrato.', 'erro')
    } finally {
      setImportando(false)
    }
  }

  async function sincronizar() {
    setSincronizando(true)
    try {
      const r = await sincronizarBancosAgora()
      if (!r.configurado) {
        mostrarAviso(r.mensagem || 'A sincronização automática ainda não foi configurada.', 'erro')
        return
      }
      await recarregar()
      const problemas = (r.resumo || []).filter((x) => x.erro)
      mostrarAviso(problemas.length ? `${r.mensagem} Atenção: ${problemas.map((x) => `${x.banco}: ${x.erro}`).join(' ')}` : r.mensagem, problemas.length ? 'erro' : 'sucesso')
    } catch (error) {
      mostrarAviso(error.message, 'erro')
    } finally {
      setSincronizando(false)
    }
  }

  async function marcar(mov, dados, aviso) {
    setProcessando(mov.id)
    try {
      await updateDoc(doc(db, 'extratoBancario', mov.id), { ...dados, atualizadoEm: serverTimestamp() })
      await recarregar()
      if (aviso) mostrarAviso(aviso, 'sucesso')
    } catch (error) {
      console.error(error)
      mostrarAviso('Não foi possível atualizar o movimento.', 'erro')
    } finally {
      setProcessando('')
    }
  }

  const vincular = (mov, lanc) =>
    marcar(mov, { lancamentoId: lanc.id, lancamentoTipo: mov.valor > 0 ? 'arrecadacao' : 'despesa', ignorado: false }, 'Movimento conciliado.')
  const desfazer = (mov) => marcar(mov, { lancamentoId: '', lancamentoTipo: '', ignorado: false })
  const ignorar = (mov) => marcar(mov, { ignorado: true }, 'Movimento ignorado.')

  function abrirLancamento(mov) {
    setLancando({
      mov,
      descricao: mov.descricao,
      tipo: mov.valor > 0 ? 'Oferta' : '',
      categoria: mov.valor < 0 ? (categoriasContaPagar.includes('Outros') ? 'Outros' : categoriasContaPagar[0]) : '',
      formaPagamento: /pix/i.test(mov.descricao) ? 'Pix' : /boleto/i.test(mov.descricao) ? 'Boleto' : 'Transferência',
      fornecedor: '',
    })
  }

  // Cria a arrecadação ou a despesa a partir do movimento do banco e já concilia
  async function lancar() {
    const { mov } = lancando
    setProcessando(mov.id)
    try {
      const base = {
        descricao: lancando.descricao.trim() || mov.descricao,
        valor: Math.abs(mov.valor),
        formaPagamento: lancando.formaPagamento,
        contaBancariaId: contaId,
        contaBancariaNome: conta?.nome || '',
        comprovante: '',
        comprovantePublicId: '',
        observacoes: 'Lançado pela conciliação bancária',
        ativo: true,
        atualizadoEm: serverTimestamp(),
        criadoEm: serverTimestamp(),
      }
      const ref = mov.valor > 0
        ? await addDoc(collection(db, 'arrecadacoes'), { ...base, data: mov.data, tipo: lancando.tipo, responsavel: '' })
        : await addDoc(collection(db, 'contasPagar'), {
          ...base,
          fornecedor: lancando.fornecedor.trim(),
          categoria: lancando.categoria,
          vencimento: mov.data,
          dataPagamento: mov.data,
          status: 'Paga',
          recorrente: false,
          parcelada: false,
          numeroParcelas: 1,
        })
      await updateDoc(doc(db, 'extratoBancario', mov.id), {
        lancamentoId: ref.id,
        lancamentoTipo: mov.valor > 0 ? 'arrecadacao' : 'despesa',
        ignorado: false,
        atualizadoEm: serverTimestamp(),
      })
      setLancando(null)
      await Promise.all([recarregar(), aoAtualizar()])
      mostrarAviso(mov.valor > 0 ? 'Arrecadação lançada e conciliada.' : 'Despesa lançada e conciliada.', 'sucesso')
    } catch (error) {
      console.error(error)
      mostrarAviso('Não foi possível lançar.', 'erro')
    } finally {
      setProcessando('')
    }
  }

  if (contasAtivas.length === 0) {
    return (
      <section className="admin-card cc">
        <h2>Conciliação bancária</h2>
        <p>Cadastre primeiro as contas bancárias (Cora, Stone) na aba Contas bancárias.</p>
      </section>
    )
  }

  return (
    <section className="cc">
      <header className="cc-head">
        <div>
          <span className="admin-section-label">Conciliação bancária</span>
          <h2>Extrato do banco × lançamentos do site</h2>
          <p>Envie o extrato baixado no app do banco (OFX ou CSV). Cada movimento é conferido com as arrecadações e despesas.</p>
        </div>
      </header>

      <div className="cc-top">
        <div className="cc-accounts" role="tablist">
          {contasAtivas.map((c) => (
            <button key={c.id} type="button" className={c.id === contaId ? 'on' : ''} onClick={() => setContaId(c.id)}>
              🏦 {c.nome}
            </button>
          ))}
        </div>
        <label className={`cc-upload ${importando ? 'busy' : ''}`}>
          <input type="file" accept=".ofx,.csv,.txt,text/csv,application/x-ofx" onChange={importar} disabled={importando} />
          {importando ? 'Importando...' : `⬆ Enviar extrato da ${conta?.nome || 'conta'}`}
        </label>
      </div>

      <div className="cc-sync">
        <div>
          <strong>🔄 Sincronização automática</strong>
          <small>
            {sincronia?.quando
              ? `Última: ${sincronia.quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ` +
                (sincronia.resumo.length
                  ? sincronia.resumo.map((r) => (r.erro ? `${r.banco}: ${r.erro}` : `${r.conta}: ${r.novos} novo(s)`)).join(' · ')
                  : 'nenhuma conta conectada')
              : 'Todo dia às 6h30 o site busca os extratos da Cora e da Stone. Ainda não houve sincronização.'}
          </small>
        </div>
        <button type="button" onClick={sincronizar} disabled={sincronizando}>
          {sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
      </div>

      <div className="cc-summary">
        <article>
          <span>Saldo no banco</span>
          <strong>{saldoBanco ? moeda(saldoBanco.saldo) : '—'}</strong>
          <small>{saldoBanco ? `em ${dataBR(saldoBanco.data)}, conforme o extrato` : 'O OFX informa o saldo; o CSV, se tiver coluna de saldo'}</small>
        </article>
        <article>
          <span>Saldo da conta no site</span>
          <strong>{moeda(saldoSite)}</strong>
          <small>{saldoBanco ? `até ${dataBR(saldoBanco.data)}` : 'lançamentos com esta conta'}</small>
        </article>
        <article className={saldoBanco && Math.abs(saldoBanco.saldo - saldoSite) > 0.009 ? 'cc-alert' : 'cc-ok'}>
          <span>Diferença</span>
          <strong>{saldoBanco ? moeda(saldoBanco.saldo - saldoSite) : '—'}</strong>
          <small>{saldoBanco ? (Math.abs(saldoBanco.saldo - saldoSite) > 0.009 ? 'Há movimentos a lançar ou lançamentos sem esta conta' : '✓ Banco e site batem') : ''}</small>
        </article>
        <article>
          <span>Pendentes</span>
          <strong>{pendentes.length}</strong>
          <small>+{moeda(entradasPend)} · −{moeda(saidasPend)}</small>
        </article>
      </div>

      <div className="cc-filter" role="tablist">
        {[['pendentes', 'Pendentes'], ['resolvidos', 'Conciliados / ignorados'], ['todos', 'Todos']].map(([id, nome]) => (
          <button key={id} type="button" className={filtro === id ? 'on' : ''} onClick={() => setFiltro(id)}>{nome}</button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="cc-empty">
          {daConta.length === 0 ? 'Nenhum extrato enviado para esta conta ainda.' : 'Nada por aqui. 🎉'}
        </p>
      ) : (
        <ul className="cc-list">
          {lista.map((m) => {
            const s = situacao(m)
            const sug = s === 'pendente' ? sugestao(m) : null
            const ocupado = processando === m.id
            return (
              <li key={m.id} className={`cc-item cc-${s}`}>
                <div className="cc-date"><b>{m.data.slice(8, 10)}</b><small>{m.data.slice(5, 7)}/{m.data.slice(2, 4)}</small></div>
                <div className="cc-desc">
                  <strong>{m.origem === 'pluggy' && <span className="cc-auto" title="Veio pela sincronização automática">⚡</span>}{m.descricao}</strong>
                  <small>
                    {s === 'conciliado' && `✓ Conciliado com ${m.lancamentoTipo === 'arrecadacao' ? 'arrecadação' : 'despesa'} do site`}
                    {s === 'ignorado' && 'Ignorado (não é lançamento da igreja)'}
                    {s === 'pendente' && (sug
                      ? `Parece ser: ${sug.descricao} · ${dataBR(sug.data || dataSaida(sug))}`
                      : 'Ainda não lançado no site')}
                  </small>
                </div>
                <span className={`cc-value ${m.valor > 0 ? 'in' : 'out'}`}>{m.valor > 0 ? '+' : '−'}{moeda(Math.abs(m.valor))}</span>
                <div className="cc-actions">
                  {s === 'pendente' && sug && (
                    <button type="button" className="cc-btn-ok" disabled={ocupado} onClick={() => vincular(m, sug)}>✓ É este</button>
                  )}
                  {s === 'pendente' && (
                    <button type="button" className="cc-btn-main" disabled={ocupado} onClick={() => abrirLancamento(m)}>
                      Lançar {m.valor > 0 ? 'entrada' : 'saída'}
                    </button>
                  )}
                  {s === 'pendente' && (
                    <button type="button" className="cc-btn-ghost" disabled={ocupado} onClick={() => ignorar(m)}>Ignorar</button>
                  )}
                  {s !== 'pendente' && (
                    <button type="button" className="cc-btn-ghost" disabled={ocupado} onClick={() => desfazer(m)}>Desfazer</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {lancando && (
        <div className="finance-modal-backdrop" onClick={() => setLancando(null)}>
          <section className="finance-modal-card cc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="finance-modal-header">
              <div>
                <span className="admin-section-label">{lancando.mov.valor > 0 ? 'Nova arrecadação' : 'Nova despesa paga'}</span>
                <h2>{moeda(Math.abs(lancando.mov.valor))} · {dataBR(lancando.mov.data)}</h2>
              </div>
              <button type="button" className="finance-modal-close" onClick={() => setLancando(null)}>×</button>
            </div>
            <div className="cc-form">
              <label className="cc-wide">
                Descrição
                <input value={lancando.descricao} maxLength={200} onChange={(e) => setLancando({ ...lancando, descricao: e.target.value })} />
              </label>
              {lancando.mov.valor > 0 ? (
                <label>
                  Tipo
                  <select value={lancando.tipo} onChange={(e) => setLancando({ ...lancando, tipo: e.target.value })}>
                    {tiposArrecadacao.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Categoria
                    <select value={lancando.categoria} onChange={(e) => setLancando({ ...lancando, categoria: e.target.value })}>
                      {categoriasContaPagar.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label>
                    Fornecedor
                    <input value={lancando.fornecedor} maxLength={150} onChange={(e) => setLancando({ ...lancando, fornecedor: e.target.value })} />
                  </label>
                </>
              )}
              <label>
                Forma
                <select value={lancando.formaPagamento} onChange={(e) => setLancando({ ...lancando, formaPagamento: e.target.value })}>
                  {['Pix', 'Transferência', 'Boleto', 'Cartão de débito', 'Dinheiro', 'Outros'].map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
              <p className="cc-wide cc-note">Conta: <b>{conta?.nome}</b>. O lançamento fica marcado como conciliado com este movimento do banco.</p>
              <div className="cc-wide cc-form-actions">
                <button type="button" onClick={lancar} disabled={processando === lancando.mov.id}>
                  {processando === lancando.mov.id ? 'Lançando...' : 'Lançar no site'}
                </button>
                <button type="button" className="cancel-button" onClick={() => setLancando(null)}>Cancelar</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
