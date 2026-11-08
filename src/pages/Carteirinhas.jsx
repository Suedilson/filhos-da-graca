import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { mostrarAviso } from '../services/avisos'
import { gerarPdfCarteirinhas, TEXTO_VERSO_PADRAO } from '../services/carteirinhaPdf'
import './Carteirinhas.css'

const hojeISO = () => new Date().toISOString().slice(0, 10)

function somarAnos(iso, anos) {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a + anos, m - 1, d)
  return data.toISOString().slice(0, 10)
}

function dataBR(iso) {
  if (!iso) return '-'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Código individual, sem letras que se confundem (0/O, 1/I)
function gerarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const valores = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(valores, (v) => alfabeto[v % alfabeto.length]).join('')
}

export default function Carteirinhas({ membros }) {
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [validade, setValidade] = useState(somarAnos(hojeISO(), 2))
  const [formato, setFormato] = useState('a4')
  const [incluirVerso, setIncluirVerso] = useState(true)
  const [textoVerso, setTextoVerso] = useState(TEXTO_VERSO_PADRAO)
  const [funcoes, setFuncoes] = useState({})
  const [emitidas, setEmitidas] = useState([])
  const [gerando, setGerando] = useState(false)
  const [previa, setPrevia] = useState('')
  const urlPrevia = useRef('')

  const ativos = useMemo(
    () =>
      membros
        .filter((m) => m.status !== 'Inativo' && m.ativo !== false)
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')),
    [membros],
  )

  const filtrados = ativos.filter((m) => {
    const termo = busca.trim().toLowerCase()
    return !termo || String(m.nome || '').toLowerCase().includes(termo) || String(m.ministerio || '').toLowerCase().includes(termo)
  })

  const ultimaPorMembro = useMemo(() => {
    const mapa = {}
    for (const c of emitidas) {
      if (c.ativa !== false && (!mapa[c.membroId] || c.numeroSeq > mapa[c.membroId].numeroSeq)) mapa[c.membroId] = c
    }
    return mapa
  }, [emitidas])

  async function buscarEmitidas() {
    const snap = await getDocs(collection(db, 'carteirinhas'))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.numeroSeq || 0) - (a.numeroSeq || 0))
  }

  async function carregarEmitidas() {
    try {
      setEmitidas(await buscarEmitidas())
    } catch (error) {
      console.error('Erro ao carregar carteirinhas.', error)
    }
  }

  useEffect(() => {
    let ativo = true
    buscarEmitidas()
      .then((lista) => ativo && setEmitidas(lista))
      .catch((error) => console.error('Erro ao carregar carteirinhas.', error))
    return () => {
      ativo = false
    }
  }, [])

  const funcaoDe = (m) => funcoes[m.id] ?? (m.ministerio || 'Membro')

  function dadosDoCartao(m, extra = {}) {
    return {
      nome: m.nome,
      foto: m.foto,
      nascimento: m.nascimento,
      funcao: funcaoDe(m),
      validade,
      emitidaEm: hojeISO(),
      textoVerso,
      numero: extra.numero || 'FG-0000',
      codigo: extra.codigo || 'PREVIA0000',
    }
  }

  // Prévia do primeiro selecionado, no formato de cartão (mesmo desenho do PDF final)
  const primeiro = ativos.find((m) => m.id === selecionados[0])
  useEffect(() => {
    let cancelado = false
    if (!primeiro) return undefined
    const timer = setTimeout(async () => {
      try {
        const pdf = await gerarPdfCarteirinhas([dadosDoCartao(primeiro)], { formato: 'cartao', incluirVerso: true })
        if (cancelado) return
        if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current)
        urlPrevia.current = URL.createObjectURL(pdf.output('blob'))
        setPrevia(`${urlPrevia.current}#toolbar=0&navpanes=0&view=Fit`)
      } catch (error) {
        console.error('Erro na prévia da carteirinha.', error)
      }
    }, 450)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primeiro?.id, primeiro?.foto, validade, textoVerso, funcoes])

  function alternar(id) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  function selecionarTodos() {
    const ids = filtrados.map((m) => m.id)
    const todos = ids.every((id) => selecionados.includes(id))
    setSelecionados((atual) => (todos ? atual.filter((id) => !ids.includes(id)) : Array.from(new Set([...atual, ...ids]))))
  }

  function baixar(pdf, nome) {
    pdf.save(nome)
  }

  // Emite (grava no banco) e baixa o PDF
  async function emitir() {
    const lista = ativos.filter((m) => selecionados.includes(m.id))
    if (lista.length === 0) {
      mostrarAviso('Selecione pelo menos um membro.', 'erro')
      return
    }
    if (!validade) {
      mostrarAviso('Informe a validade.', 'erro')
      return
    }
    setGerando(true)
    try {
      const maiorSeq = emitidas.reduce((maior, c) => Math.max(maior, c.numeroSeq || 0), 0)
      const batch = writeBatch(db)
      const cartoes = lista.map((m, i) => {
        const numeroSeq = maiorSeq + i + 1
        const codigo = gerarCodigo()
        const dados = dadosDoCartao(m, { numero: `FG-${String(numeroSeq).padStart(4, '0')}`, codigo })
        // A carteirinha anterior do membro deixa de valer
        const anterior = ultimaPorMembro[m.id]
        if (anterior) batch.update(doc(db, 'carteirinhas', anterior.id), { ativa: false, substituidaEm: serverTimestamp() })
        batch.set(doc(db, 'carteirinhas', codigo), {
          membroId: m.id,
          nome: m.nome,
          funcao: dados.funcao,
          numero: dados.numero,
          numeroSeq,
          validade,
          emitidaEm: dados.emitidaEm,
          ativa: true,
          criadoEm: serverTimestamp(),
        })
        return dados
      })
      await batch.commit()
      const pdf = await gerarPdfCarteirinhas(cartoes, { formato, incluirVerso })
      baixar(pdf, lista.length === 1 ? `carteirinha-${lista[0].nome.split(' ')[0].toLowerCase()}.pdf` : `carteirinhas-${hojeISO()}.pdf`)
      mostrarAviso(`${lista.length} carteirinha(s) emitida(s). O PDF foi baixado.`, 'sucesso')
      setSelecionados([])
      await carregarEmitidas()
    } catch (error) {
      console.error(error)
      mostrarAviso('Não foi possível emitir as carteirinhas.', 'erro')
    } finally {
      setGerando(false)
    }
  }

  async function reimprimir(c) {
    const membro = membros.find((m) => m.id === c.membroId) || {}
    const pdf = await gerarPdfCarteirinhas(
      [{
        nome: c.nome,
        foto: membro.foto,
        nascimento: membro.nascimento,
        funcao: c.funcao,
        validade: c.validade,
        emitidaEm: c.emitidaEm,
        textoVerso,
        numero: c.numero,
        codigo: c.id,
      }],
      { formato, incluirVerso },
    )
    baixar(pdf, `carteirinha-${c.numero}.pdf`)
  }

  async function cancelar(c) {
    if (!confirm(`Cancelar a carteirinha ${c.numero} de ${c.nome}? O QR code passará a mostrar que ela não é válida.`)) return
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'carteirinhas', c.id), { ativa: false, canceladaEm: serverTimestamp() })
      await batch.commit()
      await carregarEmitidas()
      mostrarAviso('Carteirinha cancelada.', 'sucesso')
    } catch (error) {
      console.error(error)
      mostrarAviso('Não foi possível cancelar.', 'erro')
    }
  }

  const situacao = (c) => {
    if (c.ativa === false) return { texto: c.canceladaEm ? 'Cancelada' : 'Substituída', classe: 'off' }
    if (c.validade && c.validade < hojeISO()) return { texto: 'Vencida', classe: 'warn' }
    return { texto: 'Válida', classe: 'ok' }
  }

  return (
    <section className="admin-card cart">
      <div className="cart-head">
        <div>
          <span className="admin-section-label">Carteirinhas</span>
          <h2>🪪 Carteirinhas de membro</h2>
          <p>Escolha os membros, confira a prévia e gere o PDF no tamanho padrão de cartão (85,6 × 54 mm).</p>
        </div>
      </div>

      <div className="cart-layout">
        <div className="cart-col">
          <div className="cart-step"><b>1</b> Escolha os membros</div>
          <div className="cart-search">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou ministério"
            />
            <button type="button" className="cancel-button" onClick={selecionarTodos}>
              {filtrados.length && filtrados.every((m) => selecionados.includes(m.id)) ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <ul className="cart-list">
            {filtrados.map((m) => {
              const marcado = selecionados.includes(m.id)
              const atual = ultimaPorMembro[m.id]
              return (
                <li key={m.id} className={marcado ? 'on' : ''}>
                  <label>
                    <input type="checkbox" checked={marcado} onChange={() => alternar(m.id)} />
                    {m.foto ? <img src={m.foto} alt="" /> : <span className="cart-avatar">{(m.nome || '?')[0]}</span>}
                    <span className="cart-member">
                      <strong>{m.nome}</strong>
                      <small>
                        {m.foto ? '' : '⚠ sem foto · '}
                        {atual ? `Carteirinha ${atual.numero} até ${dataBR(atual.validade)}` : 'Nenhuma carteirinha emitida'}
                      </small>
                    </span>
                  </label>
                  {marcado && (
                    <input
                      className="cart-role"
                      value={funcaoDe(m)}
                      onChange={(e) => setFuncoes({ ...funcoes, [m.id]: e.target.value })}
                      maxLength={34}
                      aria-label={`Função de ${m.nome} na carteirinha`}
                      title="Função que aparece na carteirinha"
                    />
                  )}
                </li>
              )
            })}
            {filtrados.length === 0 && <li className="cart-empty">Nenhum membro ativo encontrado.</li>}
          </ul>
          <small className="member-field-hint">
            Membros sem foto saem com as iniciais. Para colocar a foto, edite o cadastro do membro.
          </small>
        </div>

        <div className="cart-col">
          <div className="cart-step"><b>2</b> Ajuste e confira</div>
          <div className="cart-options">
            <label>
              Validade
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </label>
            <label>
              Formato do PDF
              <select value={formato} onChange={(e) => setFormato(e.target.value)}>
                <option value="a4">Folha A4 – 10 por folha (impressora comum)</option>
                <option value="cartao">Cartão 85,6 × 54 mm (impressora de PVC)</option>
              </select>
            </label>
            <label className="cart-check">
              <input type="checkbox" checked={incluirVerso} onChange={(e) => setIncluirVerso(e.target.checked)} />
              Incluir o verso
            </label>
            <label className="cart-wide">
              Texto do verso
              <textarea rows={3} maxLength={220} value={textoVerso} onChange={(e) => setTextoVerso(e.target.value)} />
            </label>
          </div>

          <div className="cart-preview">
            {previa && primeiro ? (
              <iframe title="Prévia da carteirinha" src={previa} />
            ) : (
              <p>Marque um membro para ver a prévia da frente e do verso.</p>
            )}
          </div>

          <button type="button" className="cart-emit" onClick={emitir} disabled={gerando || selecionados.length === 0}>
            {gerando ? 'Gerando...' : `Emitir e baixar PDF${selecionados.length ? ` (${selecionados.length})` : ''}`}
          </button>
          <small className="member-field-hint">
            Ao imprimir, escolha <b>Tamanho real / 100%</b> (não use “Ajustar à página”). No A4, use papel de 180 g ou mais e
            frente e verso virando pela borda longa. A emissão cancela a carteirinha anterior do membro.
          </small>
        </div>
      </div>

      <div className="cart-issued">
        <div className="cart-step"><b>3</b> Carteirinhas emitidas</div>
        {emitidas.length === 0 ? (
          <p className="cart-empty">Nenhuma carteirinha emitida ainda.</p>
        ) : (
          <div className="cart-table-wrap">
            <table className="cart-table">
              <thead>
                <tr><th>Matrícula</th><th>Membro</th><th>Função</th><th>Emissão</th><th>Validade</th><th>Situação</th><th /></tr>
              </thead>
              <tbody>
                {emitidas.map((c) => {
                  const s = situacao(c)
                  return (
                    <tr key={c.id}>
                      <td>{c.numero}</td>
                      <td>{c.nome}</td>
                      <td>{c.funcao}</td>
                      <td>{dataBR(c.emitidaEm)}</td>
                      <td>{dataBR(c.validade)}</td>
                      <td><span className={`cart-badge ${s.classe}`}>{s.texto}</span></td>
                      <td className="cart-actions">
                        <button type="button" className="edit-button" onClick={() => reimprimir(c)}>Reimprimir</button>
                        {c.ativa !== false && (
                          <button type="button" className="deactivate-button" onClick={() => cancelar(c)}>Cancelar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
