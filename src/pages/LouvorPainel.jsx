import { useEffect, useMemo, useRef, useState } from 'react'
import { extrairLetraDaCifra, formatarCifra } from '../services/formatoCifra.js'
import { linhasDaCifra, transporTom } from '../services/transporCifra.js'
import './LouvorPainel.css'

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const hoje = () => new Date().toLocaleDateString('en-CA')

function partesData(data) {
  const [ano, mes, dia] = String(data || '').split('-').map(Number)
  if (!ano || !mes || !dia) return { dia: '--', mes: '', semana: '' }
  return { dia: String(dia).padStart(2, '0'), mes: MESES[mes - 1], semana: SEMANA[new Date(ano, mes - 1, dia).getDay()] }
}

// Linha de acordes com cada acorde destacado, mantendo os espaços
function LinhaAcordes({ texto }) {
  return texto.split(/(\s+)/).map((parte, i) =>
    /^\s+$/.test(parte) || !parte ? parte : <b key={i} className="lv-chord">{parte}</b>)
}

function Leitor({ musicas, inicial, modoInicial, onFechar, titulo }) {
  const [indice, setIndice] = useState(inicial)
  const [modo, setModo] = useState(modoInicial)
  const [semitons, setSemitons] = useState({})
  const [fonte, setFonte] = useState(() => {
    const padrao = window.innerWidth < 480 ? 13 : 16
    try { return Number(localStorage.getItem('louvorFonte')) || padrao } catch { return padrao }
  })
  const [rolagem, setRolagem] = useState(0)
  // Tela cheia: toque no texto esconde as barras e deixa só a letra/cifra
  const [foco, setFoco] = useState(false)
  const corpo = useRef(null)
  const leitor = useRef(null)
  const musica = musicas[indice]
  const tom = semitons[musica.id] || 0

  useEffect(() => {
    try { localStorage.setItem('louvorFonte', String(fonte)) } catch { /* sem armazenamento */ }
  }, [fonte])

  useEffect(() => {
    corpo.current?.scrollTo({ top: 0 })
  }, [indice, modo])

  // Rolagem automática para tocar sem precisar mexer na tela
  useEffect(() => {
    if (!rolagem) return undefined
    const passo = [0, 1, 1, 2][rolagem]
    const intervalo = [0, 70, 40, 35][rolagem]
    const id = setInterval(() => corpo.current?.scrollBy({ top: passo }), intervalo)
    return () => clearInterval(id)
  }, [rolagem, indice, modo])

  // Se o navegador sair da tela cheia (tecla Esc, gesto do sistema), sai do modo foco também
  useEffect(() => {
    const aoMudar = () => {
      if (!document.fullscreenElement) setFoco(false)
    }
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  function alternarFoco() {
    const novo = !foco
    try {
      if (novo && document.fullscreenEnabled && !document.fullscreenElement) {
        leitor.current?.requestFullscreen?.().catch(() => {})
      } else if (!novo && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    } catch { /* navegador sem tela cheia (ex.: iPhone): só esconde as barras */ }
    setFoco(novo)
  }

  // Toque rápido no texto alterna a tela cheia; arrastar para rolar não conta
  const toque = useRef(null)
  const aoTocarTexto = (e) => {
    toque.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }
  const aoSoltarTexto = (e) => {
    const t = toque.current
    toque.current = null
    if (!t) return
    if (Math.abs(e.clientX - t.x) > 10 || Math.abs(e.clientY - t.y) > 10 || Date.now() - t.t > 400) return
    alternarFoco()
  }

  useEffect(() => {
    const teclado = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) return
        if (foco) { setFoco(false); return }
        onFechar()
      }
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(musicas.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', teclado)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclado)
      document.body.style.overflow = anterior
    }
  }, [musicas.length, onFechar, foco])

  const cifra = formatarCifra(musica.notas)
  const letra = (musica.letra || '').trim() || extrairLetraDaCifra(cifra)
  const linhas = useMemo(() => linhasDaCifra(cifra, tom), [cifra, tom])
  const anterior = musicas[indice - 1]
  const proxima = musicas[indice + 1]
  const mudarTom = (d) => setSemitons((s) => ({ ...s, [musica.id]: ((s[musica.id] || 0) + d + 12) % 12 }))

  return (
    <div
      ref={leitor}
      className={`lv-reader ${foco ? 'lv-foco' : ''}`}
      role="dialog"
      aria-label={`${musica.titulo} – ${modo === 'cifra' ? 'cifra' : 'letra'}`}
    >
      <header className="lv-reader-head">
        <button type="button" className="lv-icon-btn" onClick={onFechar} aria-label="Voltar para a escala">‹</button>
        <div className="lv-reader-title">
          <small>{titulo} · {indice + 1} de {musicas.length}</small>
          <h2>{musica.titulo}</h2>
          {musica.autor && <span>{musica.autor}</span>}
        </div>
        {musica.tom && <span className="lv-key-big" title="Tom">{transporTom(musica.tom, tom) || musica.tom}</span>}
      </header>

      <div className="lv-reader-tools">
        <div className="lv-seg" role="tablist">
          <button type="button" className={modo === 'letra' ? 'on' : ''} onClick={() => setModo('letra')}>Letra</button>
          <button type="button" className={modo === 'cifra' ? 'on' : ''} onClick={() => setModo('cifra')}>Cifra</button>
        </div>
        {modo === 'cifra' && (
          <div className="lv-tool" aria-label="Mudar o tom">
            <button type="button" onClick={() => mudarTom(-1)} aria-label="Meio tom abaixo">−½</button>
            <span>Tom{tom ? ` ${tom > 6 ? tom - 12 : `+${tom}`}` : ''}</span>
            <button type="button" onClick={() => mudarTom(1)} aria-label="Meio tom acima">+½</button>
          </div>
        )}
        <div className="lv-tool" aria-label="Tamanho da letra">
          <button type="button" onClick={() => setFonte((f) => Math.max(11, f - 1))} aria-label="Diminuir letra">A−</button>
          <button type="button" onClick={() => setFonte((f) => Math.min(26, f + 1))} aria-label="Aumentar letra">A+</button>
        </div>
        <button
          type="button"
          className={`lv-scroll ${rolagem ? 'on' : ''}`}
          onClick={() => setRolagem((r) => (r + 1) % 4)}
          title="Rolagem automática"
        >
          {rolagem ? `▶ Rolagem ${'•'.repeat(rolagem)}` : '⏵ Rolar sozinho'}
        </button>
      </div>

      <div
        className="lv-reader-body"
        ref={corpo}
        style={{ fontSize: `${fonte}px` }}
        onPointerDown={aoTocarTexto}
        onPointerUp={aoSoltarTexto}
        title={foco ? 'Toque para sair da tela cheia' : 'Toque para ver em tela cheia'}
      >
        {!foco && <p className="lv-tap-hint">Toque no texto para ver em tela cheia</p>}
        {foco && <p className="lv-focus-title">{musica.titulo}{musica.tom ? ` · ${transporTom(musica.tom, tom) || musica.tom}` : ''}</p>}
        {modo === 'letra' ? (
          letra ? <div className="lv-lyrics">{letra}</div> : <p className="lv-empty">Letra não cadastrada para este louvor.</p>
        ) : cifra ? (
          <pre className="lv-sheet">
            {linhas.map((l, i) => {
              if (l.tipo === 'vazia') return <span key={i} className="lv-line">{'\n'}</span>
              if (l.tipo === 'secao') {
                return (
                  <span key={i} className="lv-line">
                    <span className="lv-section">[{l.texto}]</span>
                    {l.acordes ? <> <LinhaAcordes texto={l.acordes} /></> : null}
                    {'\n'}
                  </span>
                )
              }
              if (l.tipo === 'acordes') return <span key={i} className="lv-line"><LinhaAcordes texto={l.texto} />{'\n'}</span>
              if (l.tipo === 'tab') return <span key={i} className="lv-line lv-tab">{l.texto}{'\n'}</span>
              return <span key={i} className="lv-line">{l.texto}{'\n'}</span>
            })}
          </pre>
        ) : (
          <p className="lv-empty">Cifra não cadastrada para este louvor. Cadastre em “Músicas”.</p>
        )}
      </div>

      {foco && (
        <div className="lv-focus-bar">
          <button type="button" onClick={alternarFoco} aria-label="Sair da tela cheia">✕</button>
          <button type="button" disabled={!anterior} onClick={() => setIndice(indice - 1)} aria-label="Música anterior">‹</button>
          <span>{indice + 1}/{musicas.length}</span>
          <button type="button" disabled={!proxima} onClick={() => setIndice(indice + 1)} aria-label="Próxima música">›</button>
          <button type="button" onClick={() => setFonte((f) => Math.max(11, f - 1))} aria-label="Diminuir letra">A−</button>
          <button type="button" onClick={() => setFonte((f) => Math.min(30, f + 1))} aria-label="Aumentar letra">A+</button>
          {rolagem > 0 && <button type="button" onClick={() => setRolagem(0)} aria-label="Parar rolagem">❚❚</button>}
        </div>
      )}

      <nav className="lv-reader-nav">
        <button type="button" disabled={!anterior} onClick={() => setIndice(indice - 1)}>
          <span>‹ Anterior</span>
          <small>{anterior?.titulo || '—'}</small>
        </button>
        <button type="button" className="lv-next" disabled={!proxima} onClick={() => setIndice(indice + 1)}>
          <span>Próxima ›</span>
          <small>{proxima?.titulo || 'Fim do repertório'}</small>
        </button>
      </nav>
    </div>
  )
}

export default function LouvorPainel({
  escalas,
  musicas,
  carregando,
  salvando,
  onIncluirEscala,
  onEditarEscala,
  onAbrirMusicas,
  onSalvarOrdem,
}) {
  const [periodo, setPeriodo] = useState('proximas')
  const [selecionadaId, setSelecionadaId] = useState(null)
  const [ordem, setOrdem] = useState(null)
  const [leitor, setLeitor] = useState(null)

  const lista = useMemo(() => {
    const base = escalas.filter((e) => e.status !== 'Cancelada' || periodo === 'anteriores')
    return periodo === 'proximas'
      ? base.filter((e) => e.data >= hoje()).sort((a, b) => `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`))
      : base.filter((e) => e.data < hoje()).sort((a, b) => `${b.data}${b.horario}`.localeCompare(`${a.data}${a.horario}`))
  }, [escalas, periodo])

  const escala = lista.find((e) => e.id === selecionadaId) || lista[0] || null
  const repertorio = ordem && escala && ordem.id === escala.id ? ordem.itens : escala?.repertorio || []
  const mudouOrdem = Boolean(ordem && escala && ordem.id === escala.id)

  // Dados atuais de cada louvor (letra/cifra podem ter sido melhoradas depois da escala)
  const completas = repertorio.map((r) => {
    const atual = musicas.find((m) => m.id === r.id) || {}
    return { ...atual, ...r, letra: atual.letra || r.letra, notas: atual.notas || r.notas, autor: atual.autor || r.autor, tom: r.tom || atual.tom }
  })

  function mover(indice, direcao) {
    const alvo = indice + direcao
    if (alvo < 0 || alvo >= repertorio.length) return
    const itens = [...repertorio]
    ;[itens[indice], itens[alvo]] = [itens[alvo], itens[indice]]
    setOrdem({ id: escala.id, itens })
  }

  async function salvarOrdem() {
    const ok = await onSalvarOrdem(escala, ordem.itens)
    if (ok) setOrdem(null)
  }

  const d = escala ? partesData(escala.data) : null

  return (
    <section className="lv">
      <header className="lv-hero">
        <div>
          <span className="lv-eyebrow">Ministério de louvor</span>
          <h2>Escala e repertório</h2>
        </div>
        <div className="lv-hero-actions">
          <button type="button" className="lv-btn-primary" onClick={onIncluirEscala}>＋ Incluir escala</button>
          <button type="button" className="lv-btn-glass" onClick={onAbrirMusicas}>🎵 Músicas</button>
        </div>
      </header>

      <div className="lv-switch" role="tablist">
        {[['proximas', 'Próximas'], ['anteriores', 'Anteriores']].map(([id, nome]) => (
          <button key={id} type="button" className={periodo === id ? 'on' : ''}
            onClick={() => { setPeriodo(id); setSelecionadaId(null); setOrdem(null) }}>{nome}</button>
        ))}
      </div>

      {carregando ? (
        <p className="lv-empty-card">Carregando escalas...</p>
      ) : lista.length === 0 ? (
        <div className="lv-empty-card">
          <strong>{periodo === 'proximas' ? 'Nenhuma escala marcada' : 'Nenhuma escala anterior'}</strong>
          <span>Toque em “Incluir escala” para montar a próxima.</span>
        </div>
      ) : (
        <>
          <div className="lv-dates" role="listbox" aria-label="Escolha a escala">
            {lista.map((e) => {
              const p = partesData(e.data)
              const ativa = escala?.id === e.id
              return (
                <button key={e.id} type="button" role="option" aria-selected={ativa}
                  className={`lv-date ${ativa ? 'on' : ''}`}
                  onClick={() => { setSelecionadaId(e.id); setOrdem(null) }}>
                  <small>{p.semana.slice(0, 3)}</small>
                  <strong>{p.dia}</strong>
                  <span>{p.mes}</span>
                  <em>{e.horario}</em>
                </button>
              )
            })}
          </div>

          {escala && (
            <article className="lv-card">
              <div className="lv-card-head">
                <div className="lv-card-date" aria-hidden="true"><strong>{d.dia}</strong><span>{d.mes}</span></div>
                <div className="lv-card-info">
                  <small>{d.semana} · {escala.horario}</small>
                  <h3>{escala.titulo}</h3>
                  <p>🎤 {escala.ministro}</p>
                </div>
                <span className={`lv-status lv-status-${String(escala.status || '').toLowerCase()}`}>{escala.status}</span>
              </div>

              {escala.equipe?.length > 0 && (
                <ul className="lv-team">
                  {escala.equipe.map((p, i) => (
                    <li key={i}><strong>{p.nome}</strong><span>{p.funcao}</span></li>
                  ))}
                </ul>
              )}

              {escala.observacoes && <p className="lv-notes">📝 {escala.observacoes}</p>}

              <div className="lv-set-head">
                <h4>Repertório <span>{repertorio.length}</span></h4>
                {completas.length > 0 && (
                  <button type="button" className="lv-btn-soft" onClick={() => setLeitor({ inicial: 0, modo: 'cifra' })}>
                    ▶ Abrir na ordem
                  </button>
                )}
              </div>

              {completas.length === 0 ? (
                <p className="lv-empty-inline">Nenhum louvor nesta escala ainda.</p>
              ) : (
                <ol className="lv-set">
                  {completas.map((m, i) => (
                    <li key={m.id} className="lv-song">
                      <div className="lv-order">
                        <button type="button" aria-label={`Subir ${m.titulo}`} disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
                        <button type="button" aria-label={`Descer ${m.titulo}`} disabled={i === completas.length - 1} onClick={() => mover(i, 1)}>▼</button>
                      </div>
                      <span className="lv-num">{i + 1}</span>
                      <div className="lv-song-info">
                        <strong>{m.titulo}</strong>
                        <small>{m.autor || m.ministros || 'Louvor'}</small>
                      </div>
                      {m.tom && <span className="lv-key">{m.tom}</span>}
                      <div className="lv-song-actions">
                        <button type="button" onClick={() => setLeitor({ inicial: i, modo: 'letra' })}>Letra</button>
                        <button type="button" className="lv-chords-btn" onClick={() => setLeitor({ inicial: i, modo: 'cifra' })}>Cifra</button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {mudouOrdem && (
                <div className="lv-save-order">
                  <span>Ordem alterada</span>
                  <button type="button" className="lv-btn-ghost" onClick={() => setOrdem(null)}>Desfazer</button>
                  <button type="button" className="lv-btn-primary" disabled={salvando} onClick={salvarOrdem}>
                    {salvando ? 'Salvando...' : 'Salvar ordem'}
                  </button>
                </div>
              )}

              <div className="lv-card-foot">
                <button type="button" className="lv-btn-ghost" onClick={() => onEditarEscala(escala)}>✏️ Editar escala</button>
              </div>
            </article>
          )}
        </>
      )}

      {leitor && completas.length > 0 && (
        <Leitor
          musicas={completas}
          inicial={Math.min(leitor.inicial, completas.length - 1)}
          modoInicial={leitor.modo}
          titulo={escala?.titulo || 'Repertório'}
          onFechar={() => setLeitor(null)}
        />
      )}
    </section>
  )
}
