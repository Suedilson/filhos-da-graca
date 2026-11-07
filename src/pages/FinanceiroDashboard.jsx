import { useMemo, useState } from 'react'
import './FinanceiroDashboard.css'

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const NOMES_MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const moeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dataBR = (iso) => {
  if (!iso) return '-'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

// Valor curto para os eixos dos gráficos: "R$ 4,5 mil"
const moedaCurta = (valor) => {
  const absoluto = Math.abs(valor)
  if (absoluto >= 1000) {
    return `R$ ${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return `R$ ${Math.round(valor).toLocaleString('pt-BR')}`
}

const hojeISO = () => {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

const fimDoMes = (ano, mes) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`

const inicioDoMes = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}-01`

const somar = (lista) => lista.reduce((total, item) => total + Number(item.valor || 0), 0)

// Data em que a despesa saiu do caixa
const dataSaida = (despesa) => despesa.dataPagamento || despesa.vencimento || ''

// Escala "redonda" para o eixo Y
function escalaBonita(maximo) {
  if (maximo <= 0) return 1000
  // 4 divisões: o passo é o menor valor "redondo" que cobre o máximo
  const potencia = 10 ** Math.floor(Math.log10(maximo / 4))
  const passo = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((f) => f * potencia * 4 >= maximo) * potencia
  return passo * 4
}

function variacao(atual, anterior) {
  if (!anterior) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

function Variacao({ atual, anterior, inverter = false }) {
  const pct = variacao(atual, anterior)
  if (pct === null || !Number.isFinite(pct)) {
    return <small className="fd-kpi-hint">Sem dados do mês anterior</small>
  }
  const subiu = pct >= 0
  const bom = inverter ? !subiu : subiu
  return (
    <small className={`fd-kpi-delta ${bom ? 'fd-good' : 'fd-bad'}`}>
      <span aria-hidden="true">{subiu ? '▲' : '▼'}</span>
      {Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% vs. mês anterior
    </small>
  )
}

function GraficoReceitasDespesas({ meses, mesSelecionado, aoSelecionarMes }) {
  const [hover, setHover] = useState(null)
  const largura = 760
  const altura = 280
  const margem = { topo: 16, direita: 12, base: 30, esquerda: 64 }
  const areaL = largura - margem.esquerda - margem.direita
  const areaA = altura - margem.topo - margem.base
  const maximo = escalaBonita(Math.max(...meses.map((m) => Math.max(m.receitas, m.despesas)), 0))
  const y = (valor) => margem.topo + areaA - (valor / maximo) * areaA
  const grupo = areaL / 12
  const barra = Math.min(16, grupo * 0.3)

  // Barra com cantos arredondados só em cima, apoiada na linha de base
  const caminhoBarra = (x, valor) => {
    const topo = y(valor)
    const base = y(0)
    const h = base - topo
    if (h <= 0.5) return ''
    const r = Math.min(4, h, barra / 2)
    return `M${x},${base} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + barra - r} Q${x + barra},${topo} ${x + barra},${topo + r} V${base} Z`
  }

  const ticks = [0, 1, 2, 3, 4].map((i) => (maximo / 4) * i)
  const mesHover = hover !== null ? meses[hover] : null

  return (
    <div className="fd-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Receitas e despesas por mês">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={margem.esquerda}
              x2={largura - margem.direita}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'fd-axis-line' : 'fd-grid-line'}
            />
            <text x={margem.esquerda - 8} y={y(t) + 4} textAnchor="end" className="fd-axis-text">
              {moedaCurta(t)}
            </text>
          </g>
        ))}

        {meses.map((m, i) => {
          const x0 = margem.esquerda + grupo * i + grupo / 2
          const ativo = i + 1 === mesSelecionado
          const esmaecido = hover !== null ? hover !== i : false
          return (
            <g key={m.mes} className={esmaecido ? 'fd-faded' : ''}>
              {ativo && (
                <rect
                  x={margem.esquerda + grupo * i + 2}
                  y={margem.topo}
                  width={grupo - 4}
                  height={areaA}
                  rx="6"
                  className="fd-selected-band"
                />
              )}
              <path d={caminhoBarra(x0 - barra - 1, m.receitas)} className="fd-bar-receitas" />
              <path d={caminhoBarra(x0 + 1, m.despesas)} className="fd-bar-despesas" />
              <text x={x0} y={altura - 10} textAnchor="middle" className={`fd-axis-text ${ativo ? 'fd-axis-strong' : ''}`}>
                {NOMES_MESES[i]}
              </text>
              {/* Área de toque maior que a barra */}
              <rect
                x={margem.esquerda + grupo * i}
                y={margem.topo}
                width={grupo}
                height={areaA + margem.base}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onClick={() => aoSelecionarMes(i + 1)}
              >
                <title>{`${NOMES_MESES[i]}: receitas ${moeda(m.receitas)}, despesas ${moeda(m.despesas)}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>

      {mesHover && (
        <div
          className="fd-tooltip"
          style={{
            left: `${((margem.esquerda + grupo * hover + grupo / 2) / largura) * 100}%`,
          }}
        >
          <strong>{NOMES_MESES_LONGOS[hover]}</strong>
          <span><i className="fd-swatch fd-swatch-receitas" />Receitas <b>{moeda(mesHover.receitas)}</b></span>
          <span><i className="fd-swatch fd-swatch-despesas" />Despesas <b>{moeda(mesHover.despesas)}</b></span>
          <span className="fd-tooltip-total">
            Resultado <b>{moeda(mesHover.receitas - mesHover.despesas)}</b>
          </span>
          <small>Clique para ver o mês</small>
        </div>
      )}
    </div>
  )
}

function GraficoSaldo({ pontos }) {
  const [hover, setHover] = useState(null)
  const largura = 760
  const altura = 220
  const margem = { topo: 16, direita: 16, base: 30, esquerda: 64 }
  const areaL = largura - margem.esquerda - margem.direita
  const areaA = altura - margem.topo - margem.base
  const valores = pontos.map((p) => p.saldo)
  const maxBruto = Math.max(0, ...valores)
  const minBruto = Math.min(0, ...valores)
  const passo = escalaBonita(Math.max(maxBruto - minBruto, 1)) / 4
  const maximo = Math.ceil(maxBruto / passo) * passo || passo
  const minimo = Math.floor(minBruto / passo) * passo
  const y = (valor) => margem.topo + areaA - ((valor - minimo) / (maximo - minimo)) * areaA
  const grupo = areaL / 12
  const x = (mes) => margem.esquerda + grupo * (mes - 1) + grupo / 2

  const ticks = []
  for (let t = minimo; t <= maximo + 0.001; t += passo) ticks.push(t)

  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.mes)},${y(p.saldo)}`).join(' ')
  const area = pontos.length
    ? `${linha} L${x(pontos[pontos.length - 1].mes)},${y(Math.max(minimo, 0))} L${x(pontos[0].mes)},${y(Math.max(minimo, 0))} Z`
    : ''
  const ultimo = pontos[pontos.length - 1]
  const pontoHover = hover !== null ? pontos.find((p) => p.mes === hover) : null

  return (
    <div className="fd-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Saldo no fim de cada mês">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={margem.esquerda}
              x2={largura - margem.direita}
              y1={y(t)}
              y2={y(t)}
              className={Math.abs(t) < 0.001 ? 'fd-axis-line' : 'fd-grid-line'}
            />
            <text x={margem.esquerda - 8} y={y(t) + 4} textAnchor="end" className="fd-axis-text">
              {moedaCurta(t)}
            </text>
          </g>
        ))}
        {NOMES_MESES.map((nome, i) => (
          <text key={nome} x={x(i + 1)} y={altura - 10} textAnchor="middle" className="fd-axis-text">
            {nome}
          </text>
        ))}

        {pontos.length > 0 && (
          <>
            <path d={area} className="fd-saldo-area" />
            <path d={linha} className="fd-saldo-line" />
          </>
        )}

        {pontoHover && (
          <>
            <line x1={x(pontoHover.mes)} x2={x(pontoHover.mes)} y1={margem.topo} y2={margem.topo + areaA} className="fd-crosshair" />
            <circle cx={x(pontoHover.mes)} cy={y(pontoHover.saldo)} r="5" className="fd-saldo-dot" />
          </>
        )}

        {ultimo && !pontoHover && (
          <>
            <circle cx={x(ultimo.mes)} cy={y(ultimo.saldo)} r="5" className="fd-saldo-dot" />
            <text
              x={x(ultimo.mes) + (ultimo.mes > 10 ? -10 : 10)}
              y={y(ultimo.saldo) - 10}
              textAnchor={ultimo.mes > 10 ? 'end' : 'start'}
              className="fd-direct-label"
            >
              {moeda(ultimo.saldo)}
            </text>
          </>
        )}

        {pontos.map((p) => (
          <rect
            key={p.mes}
            x={x(p.mes) - grupo / 2}
            y={margem.topo}
            width={grupo}
            height={areaA}
            fill="transparent"
            onMouseEnter={() => setHover(p.mes)}
          >
            <title>{`${NOMES_MESES[p.mes - 1]}: saldo ${moeda(p.saldo)}`}</title>
          </rect>
        ))}
      </svg>

      {pontoHover && (
        <div className="fd-tooltip" style={{ left: `${(x(pontoHover.mes) / largura) * 100}%` }}>
          <strong>Fim de {NOMES_MESES_LONGOS[pontoHover.mes - 1]}</strong>
          <span>Saldo <b>{moeda(pontoHover.saldo)}</b></span>
        </div>
      )}
    </div>
  )
}

function BarrasHorizontais({ itens, classe, vazio }) {
  if (itens.length === 0) return <p className="fd-empty">{vazio}</p>
  const maximo = Math.max(...itens.map((i) => i.valor))
  const total = itens.reduce((t, i) => t + i.valor, 0)
  return (
    <ul className="fd-hbars">
      {itens.map((item) => (
        <li key={item.nome}>
          <div className="fd-hbar-label">
            <span>{item.nome}</span>
            <b>{moeda(item.valor)}</b>
          </div>
          <div className="fd-hbar-track" title={`${item.nome}: ${moeda(item.valor)}`}>
            <div className={`fd-hbar-fill ${classe}`} style={{ width: `${Math.max(2, (item.valor / maximo) * 100)}%` }} />
          </div>
          <small>{((item.valor / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do total</small>
        </li>
      ))}
    </ul>
  )
}

export default function FinanceiroDashboard({
  arrecadacoes,
  contasPagar,
  contasBancarias,
  aprovisionamentos,
  aoAbrir,
}) {
  const hoje = hojeISO()
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)

  const dados = useMemo(() => {
    const receitas = arrecadacoes.filter((a) => a.ativo !== false && a.data)
    const pagas = contasPagar.filter(
      (c) => c.status === 'Paga' && c.ativo !== false && dataSaida(c),
    )
    const abertas = contasPagar.filter(
      (c) => c.status !== 'Paga' && c.status !== 'Cancelada' && c.ativo !== false && c.vencimento,
    )
    const saldoInicial = contasBancarias.reduce((t, c) => t + Number(c.saldoInicial || 0), 0)

    const saldoAte = (dataLimite) =>
      saldoInicial +
      somar(receitas.filter((r) => r.data <= dataLimite)) -
      somar(pagas.filter((p) => dataSaida(p) <= dataLimite))

    const doMes = (a, m) => {
      const ini = inicioDoMes(a, m)
      const fim = fimDoMes(a, m)
      const rec = receitas.filter((r) => r.data >= ini && r.data <= fim)
      const desp = pagas.filter((p) => dataSaida(p) >= ini && dataSaida(p) <= fim)
      return { rec, desp, receitas: somar(rec), despesas: somar(desp) }
    }

    const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, ...doMes(ano, i + 1) }))

    const anoAtual = new Date().getFullYear()
    const ultimoMesSaldo = ano < anoAtual ? 12 : ano === anoAtual ? new Date().getMonth() + 1 : 0
    // A linha começa no primeiro mês com movimento (ou em janeiro, se já havia saldo antes)
    const temAntes =
      receitas.some((r) => r.data < inicioDoMes(ano, 1)) ||
      pagas.some((p) => dataSaida(p) < inicioDoMes(ano, 1))
    const primeiroMes = temAntes
      ? 1
      : (meses.find((m) => m.receitas || m.despesas)?.mes ?? ultimoMesSaldo + 1)
    const pontosSaldo = Array.from({ length: Math.max(0, ultimoMesSaldo - primeiroMes + 1) }, (_, i) => ({
      mes: primeiroMes + i,
      saldo: saldoAte(fimDoMes(ano, primeiroMes + i)),
    }))

    const atual = meses[mes - 1]
    const anterior = mes === 1 ? doMes(ano - 1, 12) : meses[mes - 2]
    const fimMes = fimDoMes(ano, mes)
    const iniMes = inicioDoMes(ano, mes)

    const aVencerMes = abertas.filter((c) => c.vencimento >= iniMes && c.vencimento <= fimMes)
    const vencidas = abertas.filter((c) => c.vencimento < hoje)
    const em30 = new Date()
    em30.setDate(em30.getDate() + 30)
    const limite30 = `${em30.getFullYear()}-${String(em30.getMonth() + 1).padStart(2, '0')}-${String(em30.getDate()).padStart(2, '0')}`
    const proximas = abertas
      .filter((c) => c.vencimento <= limite30)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))

    const saldoFimMes = saldoAte(fimMes)
    const abertasAteFimMes = somar(abertas.filter((c) => c.vencimento <= fimMes))
    const reservado = somar(
      aprovisionamentos.filter((a) => a.ativo !== false && a.status === 'Reservado'),
    )

    const agrupar = (lista, campo, padrao) =>
      Object.entries(
        lista.reduce((acc, item) => {
          const chave = (item[campo] || padrao).trim() || padrao
          acc[chave] = (acc[chave] || 0) + Number(item.valor || 0)
          return acc
        }, {}),
      )
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)

    const porConta = [
      ...contasBancarias.map((conta) => ({
        nome: conta.nome,
        saldo:
          Number(conta.saldoInicial || 0) +
          somar(receitas.filter((r) => r.contaBancariaId === conta.id && r.data <= hoje)) -
          somar(pagas.filter((p) => p.contaBancariaId === conta.id && dataSaida(p) <= hoje)),
      })),
    ]
    const idsContas = new Set(contasBancarias.map((c) => c.id))
    const semContaRec = receitas.filter((r) => !idsContas.has(r.contaBancariaId) && r.data <= hoje)
    const semContaDesp = pagas.filter((p) => !idsContas.has(p.contaBancariaId) && dataSaida(p) <= hoje)
    const semConta = somar(semContaRec) - somar(semContaDesp)
    const qtdSemConta = semContaRec.length + semContaDesp.length

    const anoReceitas = meses.reduce((t, m) => t + m.receitas, 0)
    const anoDespesas = meses.reduce((t, m) => t + m.despesas, 0)
    const mesesComMovimento = meses.filter((m) => m.receitas || m.despesas).length || 1

    return {
      meses,
      pontosSaldo,
      atual,
      anterior,
      saldoHoje: saldoAte(hoje),
      saldoFimMes,
      previstoFimMes: saldoFimMes - abertasAteFimMes,
      aVencerMes,
      vencidas,
      proximas,
      reservado,
      receitasPorTipo: agrupar(atual.rec, 'tipo', 'Outros'),
      despesasPorCategoria: agrupar(atual.desp, 'categoria', 'Sem categoria'),
      porConta,
      semConta,
      qtdSemConta,
      anoReceitas,
      anoDespesas,
      mediaDespesas: anoDespesas / mesesComMovimento,
      anos: Array.from(
        new Set([
          new Date().getFullYear(),
          ...receitas.map((r) => Number(r.data.slice(0, 4))),
          ...contasPagar.map((c) => Number((c.vencimento || '').slice(0, 4))).filter(Boolean),
        ]),
      ).sort((a, b) => b - a),
    }
  }, [arrecadacoes, contasPagar, contasBancarias, aprovisionamentos, ano, mes, hoje])

  const nomeMes = `${NOMES_MESES_LONGOS[mes - 1]} de ${ano}`
  const resultadoMes = dados.atual.receitas - dados.atual.despesas
  const resultadoAno = dados.anoReceitas - dados.anoDespesas

  return (
    <section className="fd">
      <header className="fd-toolbar">
        <div>
          <span className="fd-eyebrow">Painel financeiro</span>
          <h2>Visão de {nomeMes}</h2>
        </div>
        <div className="fd-period">
          <button type="button" aria-label="Mês anterior" onClick={() => (mes === 1 ? (setMes(12), setAno(ano - 1)) : setMes(mes - 1))}>‹</button>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mês">
            {NOMES_MESES_LONGOS.map((nome, i) => (
              <option key={nome} value={i + 1}>{nome[0].toUpperCase() + nome.slice(1)}</option>
            ))}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
            {dados.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="button" aria-label="Próximo mês" onClick={() => (mes === 12 ? (setMes(1), setAno(ano + 1)) : setMes(mes + 1))}>›</button>
        </div>
      </header>

      <div className="fd-kpis">
        <article className="fd-kpi fd-kpi-hero">
          <span>Saldo em caixa hoje</span>
          <strong>{moeda(dados.saldoHoje)}</strong>
          <small className="fd-kpi-hint">Tudo o que entrou menos tudo o que foi pago até {dataBR(hoje)}</small>
        </article>
        <article className="fd-kpi">
          <span><i className="fd-swatch fd-swatch-receitas" />Receitas do mês</span>
          <strong>{moeda(dados.atual.receitas)}</strong>
          <Variacao atual={dados.atual.receitas} anterior={dados.anterior.receitas} />
        </article>
        <article className="fd-kpi">
          <span><i className="fd-swatch fd-swatch-despesas" />Despesas pagas no mês</span>
          <strong>{moeda(dados.atual.despesas)}</strong>
          <Variacao atual={dados.atual.despesas} anterior={dados.anterior.despesas} inverter />
        </article>
        <article className="fd-kpi">
          <span>Resultado do mês</span>
          <strong>{moeda(resultadoMes)}</strong>
          <small className={`fd-kpi-delta ${resultadoMes >= 0 ? 'fd-good' : 'fd-bad'}`}>
            <span aria-hidden="true">{resultadoMes >= 0 ? '▲' : '▼'}</span>
            {resultadoMes >= 0 ? 'Sobrou dinheiro no mês' : 'Gastou mais do que entrou'}
          </small>
        </article>
      </div>

      <div className="fd-strip">
        <button type="button" className="fd-strip-item" onClick={() => aoAbrir('pagar')}>
          <span>A vencer em {NOMES_MESES_LONGOS[mes - 1]}</span>
          <strong>{moeda(somar(dados.aVencerMes))}</strong>
          <small>{dados.aVencerMes.length} conta{dados.aVencerMes.length === 1 ? '' : 's'} em aberto</small>
        </button>
        <button
          type="button"
          className={`fd-strip-item ${dados.vencidas.length ? 'fd-strip-alert' : ''}`}
          onClick={() => aoAbrir('pagar')}
        >
          <span>{dados.vencidas.length ? '⚠ Contas vencidas' : 'Contas vencidas'}</span>
          <strong>{moeda(somar(dados.vencidas))}</strong>
          <small>{dados.vencidas.length ? `${dados.vencidas.length} conta(s) atrasada(s)` : '✓ Nenhuma conta atrasada'}</small>
        </button>
        <div className="fd-strip-item">
          <span>Saldo no fim de {NOMES_MESES_LONGOS[mes - 1]}</span>
          <strong>{moeda(dados.saldoFimMes)}</strong>
          <small>Só o que já entrou e foi pago</small>
        </div>
        <div className="fd-strip-item">
          <span>Saldo previsto no fim do mês</span>
          <strong>{moeda(dados.previstoFimMes)}</strong>
          <small>Descontando as contas em aberto até {dataBR(fimDoMes(ano, mes))}</small>
        </div>
        {dados.reservado > 0 && (
          <div className="fd-strip-item">
            <span>Reservado (aprovisionado)</span>
            <strong>{moeda(dados.reservado)}</strong>
            <small>Disponível: {moeda(dados.saldoHoje - dados.reservado)}</small>
          </div>
        )}
      </div>

      <div className="fd-grid">
        <section className="fd-card fd-span-2">
          <div className="fd-card-head">
            <div>
              <h3>Receitas × despesas em {ano}</h3>
              <p>Clique em um mês para ver os detalhes dele.</p>
            </div>
            <div className="fd-legend">
              <span><i className="fd-swatch fd-swatch-receitas" />Receitas</span>
              <span><i className="fd-swatch fd-swatch-despesas" />Despesas pagas</span>
            </div>
          </div>
          <GraficoReceitasDespesas meses={dados.meses} mesSelecionado={mes} aoSelecionarMes={setMes} />
          <div className="fd-year-totals">
            <div><span>Receitas no ano</span><b>{moeda(dados.anoReceitas)}</b></div>
            <div><span>Despesas no ano</span><b>{moeda(dados.anoDespesas)}</b></div>
            <div><span>Resultado do ano</span><b>{moeda(resultadoAno)}</b></div>
            <div><span>Média de despesas/mês</span><b>{moeda(dados.mediaDespesas)}</b></div>
          </div>
        </section>

        <section className="fd-card">
          <div className="fd-card-head">
            <div>
              <h3>Próximos vencimentos</h3>
              <p>Contas em aberto até 30 dias.</p>
            </div>
            <button type="button" className="fd-link" onClick={() => aoAbrir('pagar')}>Ver todas →</button>
          </div>
          {dados.proximas.length === 0 ? (
            <p className="fd-empty">Nenhuma conta para os próximos 30 dias. 🙌</p>
          ) : (
            <ul className="fd-due-list">
              {dados.proximas.slice(0, 7).map((conta) => {
                const atrasada = conta.vencimento < hoje
                const hojeVence = conta.vencimento === hoje
                return (
                  <li key={conta.id}>
                    <div className={`fd-due-date ${atrasada ? 'fd-late' : ''}`}>
                      <b>{conta.vencimento.slice(8, 10)}</b>
                      <small>{NOMES_MESES[Number(conta.vencimento.slice(5, 7)) - 1]}</small>
                    </div>
                    <div className="fd-due-info">
                      <strong>{conta.descricao}</strong>
                      <small>
                        {atrasada ? '⚠ Vencida' : hojeVence ? '● Vence hoje' : conta.categoria || 'Conta a pagar'}
                      </small>
                    </div>
                    <b className="fd-due-value">{moeda(conta.valor)}</b>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="fd-card fd-span-2">
          <div className="fd-card-head">
            <div>
              <h3>Evolução do saldo em {ano}</h3>
              <p>Quanto havia em caixa no último dia de cada mês.</p>
            </div>
          </div>
          {dados.pontosSaldo.length ? (
            <GraficoSaldo pontos={dados.pontosSaldo} />
          ) : (
            <p className="fd-empty">Ainda não há meses fechados em {ano}.</p>
          )}
        </section>

        <section className="fd-card">
          <div className="fd-card-head">
            <div>
              <h3>Saldo por conta</h3>
              <p>Situação hoje.</p>
            </div>
            <button type="button" className="fd-link" onClick={() => aoAbrir('contas')}>Contas →</button>
          </div>
          <ul className="fd-accounts">
            {dados.porConta.map((conta) => (
              <li key={conta.nome}>
                <span>🏦 {conta.nome}</span>
                <b>{moeda(conta.saldo)}</b>
              </li>
            ))}
            {dados.qtdSemConta > 0 && (
              <li className="fd-accounts-warning">
                <span>
                  Sem conta definida
                  <small>{dados.qtdSemConta} lançamentos sem conta bancária escolhida</small>
                </span>
                <b>{moeda(dados.semConta)}</b>
              </li>
            )}
            <li className="fd-accounts-total">
              <span>Total</span>
              <b>{moeda(dados.saldoHoje)}</b>
            </li>
          </ul>
        </section>

        <section className="fd-card">
          <div className="fd-card-head">
            <div>
              <h3>Receitas por tipo</h3>
              <p>{nomeMes[0].toUpperCase() + nomeMes.slice(1)}</p>
            </div>
          </div>
          <BarrasHorizontais itens={dados.receitasPorTipo} classe="fd-fill-receitas" vazio="Nenhuma receita neste mês." />
        </section>

        <section className="fd-card">
          <div className="fd-card-head">
            <div>
              <h3>Despesas por categoria</h3>
              <p>{nomeMes[0].toUpperCase() + nomeMes.slice(1)}</p>
            </div>
          </div>
          <BarrasHorizontais itens={dados.despesasPorCategoria} classe="fd-fill-despesas" vazio="Nenhuma despesa paga neste mês." />
        </section>

        <section className="fd-card">
          <div className="fd-card-head">
            <div>
              <h3>Mês a mês</h3>
              <p>Tabela de {ano}</p>
            </div>
          </div>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr>
              </thead>
              <tbody>
                {dados.meses.map((m) => (
                  <tr
                    key={m.mes}
                    className={m.mes === mes ? 'fd-row-active' : ''}
                    onClick={() => setMes(m.mes)}
                  >
                    <td>{NOMES_MESES[m.mes - 1]}</td>
                    <td>{moeda(m.receitas)}</td>
                    <td>{moeda(m.despesas)}</td>
                    <td className={m.receitas - m.despesas < 0 ? 'fd-negative' : ''}>{moeda(m.receitas - m.despesas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )
}
