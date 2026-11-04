import { useEffect, useState } from 'react'
import { collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import './Louvor.css'
import BuscarLouvor from './BuscarLouvor'
import BuscarCifra from './BuscarCifra'
import { formatarCifra } from '../services/formatoCifra.js'

const novaMusica = () => ({ titulo: '', autor: '', letra: '', tom: '', notas: '', ministros: '', ativo: true })
const novaEscala = () => ({ titulo: '', data: '', horario: '', ministro: '', observacoes: '', status: 'Confirmada', equipe: [{ nome: '', funcao: '' }], repertorio: [] })
const hoje = () => new Date().toLocaleDateString('en-CA')
const dataLegivel = (data) => data?.split('-').reverse().join('/') || ''
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
function partesData(data) {
  const [ano, mes, dia] = String(data || '').split('-').map(Number)
  if (!ano || !mes || !dia) return { dia: '--', mes: '', semana: '' }
  return { dia: String(dia).padStart(2, '0'), mes: MESES[mes - 1], semana: SEMANA[new Date(ano, mes - 1, dia).getDay()] }
}
const classeStatus = (status) => `worship-status status-${String(status || '').toLowerCase()}`

export default function Louvor({ user }) {
  const [aba, setAba] = useState('escalas')
  const [musicas, setMusicas] = useState([])
  const [escalas, setEscalas] = useState([])
  const [musica, setMusica] = useState(novaMusica)
  const [escala, setEscala] = useState(novaEscala)
  const [musicaId, setMusicaId] = useState(null)
  const [escalaId, setEscalaId] = useState(null)
  const [versao, setVersao] = useState(0)
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('proximas')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [historico, setHistorico] = useState(null)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  async function imprimirRelatorio(itens, filtro) {
    if (!itens.length) return
    setGerandoPdf(true); setErro('')
    try {
      const { baixarRelatorioEscalas } = await import('../services/relatorioLouvor')
      await baixarRelatorioEscalas(itens, { emitidoPor: user.email || '', filtro })
    } catch (error) {
      console.error(error)
      setErro('Não foi possível gerar o PDF. Tente novamente.')
    } finally { setGerandoPdf(false) }
  }

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const [m, e] = await Promise.all([
        getDocs(collection(db, 'louvorMusicas')),
        getDocs(collection(db, 'louvorEscalas')),
      ])
      setMusicas(m.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')))
      setEscalas(e.docs.map((d) => ({ ...d.data(), id: d.id })))
    } catch (error) {
      console.error(error)
      setErro('Não foi possível carregar o ministério de louvor. Tente novamente.')
    } finally { setCarregando(false) }
  }

  // Initial loading synchronizes this panel with Firestore.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  async function salvarMusica(event) {
    event.preventDefault()
    setSalvando(true); setErro(''); setMensagem('')
    try {
      const ref = musicaId ? doc(db, 'louvorMusicas', musicaId) : doc(collection(db, 'louvorMusicas'))
      await setDoc(ref, { ...musica, titulo: musica.titulo.trim(), notas: formatarCifra(musica.notas), atualizadoEm: serverTimestamp(), atualizadoPor: user.uid }, { merge: true })
      setMusica(novaMusica()); setMusicaId(null)
      await carregar()
      setMensagem('Louvor salvo.')
    } catch (error) { console.error(error); setErro('Não foi possível salvar o louvor.') }
    finally { setSalvando(false) }
  }

  async function salvarEscala(event) {
    event.preventDefault()
    if (!escala.equipe.length || escala.equipe.some((p) => !p.nome.trim() || !p.funcao.trim())) {
      setErro('Preencha o nome e a função de cada integrante da escala.'); return
    }
    setSalvando(true); setErro(''); setMensagem('')
    try {
      const ref = escalaId ? doc(db, 'louvorEscalas', escalaId) : doc(collection(db, 'louvorEscalas'))
      await runTransaction(db, async (transaction) => {
        const atual = await transaction.get(ref)
        if ((atual.data()?.versao || 0) !== versao) throw new Error('CONFLITO')
        const dados = { ...escala, titulo: escala.titulo.trim(), versao: versao + 1,
          atualizadoEm: serverTimestamp(), atualizadoPor: user.uid,
          responsavel: user.email || user.uid }
        transaction.set(ref, dados)
        transaction.set(doc(ref, 'historico', String(dados.versao)), dados)
      })
      setEscala(novaEscala()); setEscalaId(null); setVersao(0)
      await carregar()
      setMensagem('Escala salva e registrada no histórico.')
    } catch (error) {
      console.error(error)
      setErro(error.message === 'CONFLITO' ? 'Esta escala foi alterada por outra pessoa. Atualize a lista e abra a escala novamente.' : 'Não foi possível salvar a escala.')
    } finally { setSalvando(false) }
  }

  async function abrirHistorico(item) {
    setCarregandoHistorico(true); setErro(''); setHistorico(null)
    try {
      const snapshot = await getDocs(query(collection(db, 'louvorEscalas', item.id, 'historico'), orderBy('versao', 'desc')))
      setHistorico({ titulo: item.titulo, versoes: snapshot.docs.map((d) => d.data()) })
    } catch (error) { console.error(error); setErro('Não foi possível carregar o histórico.') }
    finally { setCarregandoHistorico(false) }
  }

  function editarEscala(item) {
    setEscala({ titulo: item.titulo, data: item.data, horario: item.horario,
      ministro: item.ministro, observacoes: item.observacoes, status: item.status,
      equipe: item.equipe, repertorio: item.repertorio })
    setEscalaId(item.id); setVersao(item.versao); setHistorico(null)
    setMensagem(''); setErro('')
  }

  function selecionarMusica(id) {
    const item = musicas.find((m) => m.id === id)
    if (!item || escala.repertorio.some((m) => m.id === id)) return
    setEscala({ ...escala, repertorio: [...escala.repertorio, {
      id: item.id, titulo: item.titulo, tom: item.tom, ministros: item.ministros,
      letra: item.letra, notas: formatarCifra(item.notas),
    }] })
  }

  const termo = busca.toLocaleLowerCase('pt-BR')
  const listaMusicas = musicas.filter((m) => `${m.titulo} ${m.autor} ${m.ministros}`.toLocaleLowerCase('pt-BR').includes(termo))
  const listaEscalas = escalas.filter((e) => (periodo === 'todas' || (periodo === 'proximas' ? e.data >= hoje() : e.data < hoje())) &&
    `${e.titulo} ${e.ministro} ${e.equipe.map((p) => p.nome).join(' ')}`.toLocaleLowerCase('pt-BR').includes(termo))
    .sort((a, b) => periodo === 'proximas' ? `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`) : `${b.data}${b.horario}`.localeCompare(`${a.data}${a.horario}`))

  const proximas = escalas.filter((e) => e.data >= hoje() && e.status !== 'Cancelada').length
  const ativos = musicas.filter((m) => m.ativo).length

  return <section className="worship-area">
    <header className="worship-hero">
      <div className="worship-hero-text">
        <span className="worship-eyebrow">Ministério de louvor</span>
        <h2>Escalas e repertório</h2>
        <p>Organize quem toca e canta em cada culto e mantenha as letras e cifras do ministério em um só lugar.</p>
      </div>
      <div className="worship-hero-stats">
        <div><strong>{proximas}</strong><span>próximas escalas</span></div>
        <div><strong>{ativos}</strong><span>louvores no repertório</span></div>
      </div>
      <div className="worship-tabs" role="tablist" aria-label="Ministério de louvor">
        {[['escalas', '📅', 'Escalas'], ['louvores', '🎵', 'Louvores']].map(([id, icone, nome]) => <button key={id} type="button" role="tab" aria-selected={aba === id}
          className={aba === id ? 'active' : ''} onClick={() => { setAba(id); setBusca(''); setErro(''); setMensagem('') }}><span aria-hidden="true">{icone}</span>{nome}</button>)}
      </div>
    </header>

    {erro && <p role="alert" className="worship-banner worship-banner-erro">{erro}</p>}
    {mensagem && <p role="status" className="worship-banner worship-banner-ok">{mensagem}</p>}

    <div className="worship-layout">
      {aba === 'louvores' ? <form className="admin-card worship-form" onSubmit={salvarMusica}>
        <div className="worship-form-head">
          <span className="worship-eyebrow">{musicaId ? 'Editando' : 'Novo louvor'}</span>
          <h3>{musicaId ? musica.titulo || 'Editar louvor' : 'Cadastrar louvor'}</h3>
        </div>
        <fieldset disabled={salvando || carregando}>
          <div className="worship-section">
            <label>Título<input required maxLength={180} value={musica.titulo} onChange={(e) => setMusica({ ...musica, titulo: e.target.value })} placeholder="Ex: Grande é o Senhor" /></label>
            <label>Autor / intérprete<input maxLength={180} value={musica.autor} onChange={(e) => setMusica({ ...musica, autor: e.target.value })} placeholder="Ex: Adhemar de Campos" /></label>
            <BuscarLouvor musica={musica} musicas={musicas} musicaId={musicaId} onSelecionar={setMusica} />
          </div>
          <div className="worship-section worship-pair">
            <label>Tom<input maxLength={40} value={musica.tom} onChange={(e) => setMusica({ ...musica, tom: e.target.value })} placeholder="Ex: G" /></label>
            <label>Ministros que cantam<input maxLength={500} value={musica.ministros} onChange={(e) => setMusica({ ...musica, ministros: e.target.value })} placeholder="Nomes" /></label>
          </div>
          <BuscarCifra musica={musica} onSelecionar={setMusica} />
          <label>Letra<textarea rows={10} maxLength={40000} value={musica.letra} onChange={(e) => setMusica({ ...musica, letra: e.target.value })} /></label>
          <label>Notas, cifras e observações<textarea className="worship-chord-input" wrap="off" rows={12} maxLength={20000} value={musica.notas} onChange={(e) => setMusica({ ...musica, notas: e.target.value })} /></label>
          <label className="worship-check"><input type="checkbox" checked={musica.ativo} onChange={(e) => setMusica({ ...musica, ativo: e.target.checked })} />Ativo no repertório</label>
          <div className="worship-form-actions">
            <button type="submit" className="worship-primary">{salvando ? 'Salvando...' : 'Salvar louvor'}</button>
            {musicaId && <button type="button" className="worship-ghost" onClick={() => { setMusica(novaMusica()); setMusicaId(null) }}>Cancelar edição</button>}
          </div>
        </fieldset>
      </form> : <form className="admin-card worship-form" onSubmit={salvarEscala}>
        <div className="worship-form-head">
          <span className="worship-eyebrow">{escalaId ? 'Editando escala' : 'Nova escala'}</span>
          <h3>{escalaId ? escala.titulo || 'Editar escala' : 'Montar escala'}</h3>
        </div>
        <fieldset disabled={salvando || carregando}>
          <div className="worship-section">
            <span className="worship-section-title">Culto</span>
            <label>Culto / evento<input required maxLength={180} value={escala.titulo} onChange={(e) => setEscala({ ...escala, titulo: e.target.value })} placeholder="Ex: Culto da Família" /></label>
            <div className="worship-pair">
              <label>Data<input type="date" required value={escala.data} onChange={(e) => setEscala({ ...escala, data: e.target.value })} /></label>
              <label>Horário<input type="time" required value={escala.horario} onChange={(e) => setEscala({ ...escala, horario: e.target.value })} /></label>
            </div>
            <div className="worship-pair">
              <label>Ministro de louvor<input required maxLength={180} value={escala.ministro} onChange={(e) => setEscala({ ...escala, ministro: e.target.value })} /></label>
              <label>Status<select value={escala.status} onChange={(e) => setEscala({ ...escala, status: e.target.value })}>{['Confirmada', 'Rascunho', 'Realizada', 'Cancelada'].map((st) => <option key={st}>{st}</option>)}</select></label>
            </div>
          </div>

          <div className="worship-section">
            <span className="worship-section-title">Músicos e vocalistas</span>
            {escala.equipe.map((pessoa, index) => <div className="worship-person" key={index}>
              <label>Nome<input required maxLength={180} value={pessoa.nome} onChange={(e) => setEscala({ ...escala, equipe: escala.equipe.map((p, i) => i === index ? { ...p, nome: e.target.value } : p) })} /></label>
              <label>Instrumento / função<input required maxLength={100} value={pessoa.funcao} onChange={(e) => setEscala({ ...escala, equipe: escala.equipe.map((p, i) => i === index ? { ...p, funcao: e.target.value } : p) })} placeholder="Ex: Teclado, Voz" /></label>
              <button type="button" className="worship-icon-button" title="Remover integrante" aria-label="Remover integrante" onClick={() => setEscala({ ...escala, equipe: escala.equipe.filter((_, i) => i !== index) })}>×</button>
            </div>)}
            <button type="button" className="worship-add" onClick={() => setEscala({ ...escala, equipe: [...escala.equipe, { nome: '', funcao: '' }] })}>+ Adicionar integrante</button>
          </div>

          <div className="worship-section">
            <span className="worship-section-title">Repertório</span>
            <label className="worship-sr-label">Adicionar louvor<select value="" onChange={(e) => selecionarMusica(e.target.value)}><option value="">+ Adicionar louvor ao repertório</option>{musicas.filter((m) => m.ativo && !escala.repertorio.some((r) => r.id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.titulo} {m.tom && `(${m.tom})`}</option>)}</select></label>
            {escala.repertorio.length > 0 && <ol className="worship-setlist">{escala.repertorio.map((m, index) => <li key={m.id} className="worship-song-row">
              <span className="worship-song-number">{index + 1}</span>
              <span className="worship-song-title">{m.titulo}</span>
              <label>Tom<input maxLength={40} value={m.tom} onChange={(e) => setEscala({ ...escala, repertorio: escala.repertorio.map((r, i) => i === index ? { ...r, tom: e.target.value } : r) })} /></label>
              <button type="button" className="worship-icon-button" title="Remover louvor" aria-label={`Remover ${m.titulo}`} onClick={() => setEscala({ ...escala, repertorio: escala.repertorio.filter((r) => r.id !== m.id) })}>×</button>
            </li>)}</ol>}
          </div>

          <label>Observações / ensaio<textarea maxLength={10000} value={escala.observacoes} onChange={(e) => setEscala({ ...escala, observacoes: e.target.value })} placeholder="Horário do ensaio, recados para a equipe..." /></label>
          <div className="worship-form-actions">
            <button type="submit" className="worship-primary">{salvando ? 'Salvando...' : 'Salvar escala'}</button>
            {escalaId && <button type="button" className="worship-ghost" onClick={() => { setEscala(novaEscala()); setEscalaId(null); setVersao(0) }}>Cancelar edição</button>}
          </div>
        </fieldset>
      </form>}

      <section className="worship-records">
        <div className="worship-filters">
          <label className="worship-search">Buscar<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={aba === 'escalas' ? 'Culto, ministro ou integrante' : 'Título, autor ou ministro'} /></label>
          {aba === 'escalas' && <label>Período<select value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="proximas">Próximas escalas</option><option value="anteriores">Escalas anteriores</option><option value="todas">Todo o histórico</option></select></label>}
          <button type="button" className="worship-ghost" disabled={carregando || salvando} onClick={carregar}>↻ Atualizar</button>
        </div>
        {aba === 'escalas' && <div className="worship-report-actions">
          <span>{listaEscalas.length} escala(s)</span>
          <button type="button" className="worship-ghost" disabled={gerandoPdf || carregando || !listaEscalas.length}
            onClick={() => imprimirRelatorio(listaEscalas, `${{ proximas: 'Próximas escalas', anteriores: 'Escalas anteriores', todas: 'Todo o histórico' }[periodo]}${busca.trim() ? ` - Busca: ${busca.trim()}` : ''}`)}>
            {gerandoPdf ? 'Gerando PDF...' : '📄 Relatório PDF'}</button>
        </div>}
        {carregando && <p role="status" className="worship-empty">Carregando...</p>}
        {!carregando && (aba === 'escalas' ? listaEscalas : listaMusicas).length === 0 && <div className="worship-empty">
          <strong>{aba === 'escalas' ? 'Nenhuma escala encontrada' : 'Nenhum louvor encontrado'}</strong>
          <span>{busca ? 'Tente outra busca.' : aba === 'escalas' ? 'Monte a primeira escala pelo formulário ao lado.' : 'Cadastre o primeiro louvor pelo formulário ao lado.'}</span>
        </div>}

        {aba === 'louvores' ? listaMusicas.map((m) => <article className={`admin-card worship-song-card ${m.ativo ? '' : 'is-archived'}`} key={m.id}>
          <div className="worship-song-card-head">
            <span className="worship-song-icon" aria-hidden="true">🎵</span>
            <div>
              <h3>{m.titulo}</h3>
              <p className="worship-meta">{m.autor || 'Autor não informado'}</p>
            </div>
            <div className="worship-badges">
              {m.tom && <span className="worship-key">{m.tom}</span>}
              {!m.ativo && <span className="worship-status status-cancelada">Arquivado</span>}
            </div>
          </div>
          <p className="worship-meta">🎤 {m.ministros || 'Ministros não informados'}</p>
          <details><summary>Letra e cifra</summary><pre>{m.letra || 'Letra não cadastrada.'}</pre><pre className="worship-chord-display">{formatarCifra(m.notas)}</pre></details>
          <div className="worship-card-actions">
            <button type="button" className="worship-outline" disabled={salvando} onClick={() => { const { id, ...dados } = m; setMusica({ ...dados, notas: formatarCifra(dados.notas) }); setMusicaId(id); setMensagem('') }}>Editar louvor</button>
          </div>
        </article>) : listaEscalas.map((e) => {
          const d = partesData(e.data)
          return <article className={`admin-card worship-event-card ${e.status === 'Cancelada' ? 'is-cancelled' : ''}`} key={e.id}>
            <div className="worship-event-head">
              <div className="worship-date" aria-hidden="true"><strong>{d.dia}</strong><span>{d.mes}</span></div>
              <div className="worship-event-info">
                <span className="worship-meta">{d.semana} · {dataLegivel(e.data)} · {e.horario}</span>
                <h3>{e.titulo}</h3>
                <p className="worship-meta">🎤 Ministro: <strong>{e.ministro}</strong></p>
              </div>
              <span className={classeStatus(e.status)}>{e.status}</span>
            </div>
            <ul className="worship-team">{e.equipe.map((p, i) => <li key={i}><strong>{p.nome}</strong><span>{p.funcao}</span></li>)}</ul>
            <details className="worship-setlist-details"><summary>🎶 Repertório ({e.repertorio.length})</summary>
              <ol className="worship-setlist">{e.repertorio.map((m, index) => <li key={m.id} className="worship-song-row is-readonly">
                <span className="worship-song-number">{index + 1}</span>
                <div className="worship-song-title"><strong>{m.titulo}</strong>
                  <details><summary>Letra e cifra</summary><pre>{m.letra}</pre><pre className="worship-chord-display">{formatarCifra(m.notas)}</pre></details>
                </div>
                <span className="worship-key">{m.tom || '—'}</span>
              </li>)}</ol>
            </details>
            {e.observacoes && <p className="worship-prewrap worship-notes">{e.observacoes}</p>}
            <div className="worship-card-actions">
              <button type="button" className="worship-outline" disabled={salvando} onClick={() => editarEscala(e)}>Editar escala</button>
              <button type="button" className="worship-ghost" disabled={carregandoHistorico} onClick={() => abrirHistorico(e)}>Histórico</button>
              <button type="button" className="worship-ghost" disabled={gerandoPdf} onClick={() => imprimirRelatorio([e], 'Escala individual')}>Imprimir / PDF</button>
            </div>
          </article>
        })}
        {carregandoHistorico && <p role="status" className="worship-empty">Carregando histórico...</p>}
        {historico && <section className="worship-history">
          <div className="worship-history-head"><h3>Histórico: {historico.titulo}</h3><button type="button" className="worship-ghost" onClick={() => setHistorico(null)}>Fechar histórico</button></div>
          {historico.versoes.map((v) => <article className="admin-card worship-history-item" key={v.versao}>
            <h4>Versão {v.versao} · <span className={classeStatus(v.status)}>{v.status}</span></h4><p className="worship-meta">{v.atualizadoEm?.toDate().toLocaleString('pt-BR')} · {v.responsavel}</p>
            <p>{v.titulo} · {dataLegivel(v.data)} · {v.horario} · {v.ministro}</p>
            <ul className="worship-team">{v.equipe.map((p, i) => <li key={i}><strong>{p.nome}</strong><span>{p.funcao}</span></li>)}</ul>
            <ol>{v.repertorio.map((m) => <li key={m.id}>{m.titulo} · {m.tom}<details><summary>Letra e cifra</summary><pre>{m.letra}</pre><pre className="worship-chord-display">{formatarCifra(m.notas)}</pre></details></li>)}</ol><p className="worship-prewrap">{v.observacoes}</p>
          </article>)}
        </section>}
      </section>
    </div>
  </section>
}
