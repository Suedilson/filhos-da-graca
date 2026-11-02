import { useEffect, useState } from 'react'
import { buscarLetras, normalizarTitulo } from '../services/buscaLouvor'

export default function BuscarLouvor({ musica, musicas, musicaId, onSelecionar }) {
  const [resultado, setResultado] = useState({ chave: '', itens: [], status: '' })
  const [selecionado, setSelecionado] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const chave = `${musica.titulo.trim()}|${musica.autor.trim()}`
  const podeBuscar = musica.titulo.trim().length >= 3 && chave !== selecionado

  useEffect(() => {
    if (!podeBuscar) return
    const controller = new AbortController()
    let limite
    const timer = setTimeout(async () => {
      setResultado({ chave, itens: [], status: 'buscando' })
      limite = setTimeout(() => {
        controller.abort()
        setResultado({ chave, itens: [], status: 'erro' })
      }, 12000)
      try {
        const itens = await buscarLetras(musica.titulo, musica.autor, controller.signal)
        if (!controller.signal.aborted) setResultado({ chave, itens, status: 'pronto' })
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Busca de letras:', error)
          setResultado({ chave, itens: [], status: 'erro' })
        }
      } finally { clearTimeout(limite) }
    }, 700)
    return () => { clearTimeout(timer); clearTimeout(limite); controller.abort() }
  }, [chave, musica.titulo, musica.autor, podeBuscar, tentativa])

  if (!podeBuscar) return null
  const locais = musicas.filter((m) => m.id !== musicaId &&
    normalizarTitulo(m.titulo).includes(normalizarTitulo(musica.titulo)) &&
    (!musica.autor.trim() || normalizarTitulo(m.autor).includes(normalizarTitulo(musica.autor))))
    .slice(0, 6).map((m) => ({ ...m, fonte: 'Repertório da igreja' }))
  const atual = resultado.chave === chave ? resultado : { itens: [], status: 'buscando' }

  function selecionar(item) {
    const alteraria = (musica.letra.trim() && musica.letra !== item.letra) ||
      (item.notas && musica.notas.trim() && item.notas !== musica.notas) ||
      (item.tom && musica.tom.trim() && item.tom !== musica.tom)
    if (alteraria && !window.confirm('Substituir a letra e os dados musicais preenchidos pela versão selecionada?')) return
    onSelecionar({ ...musica, titulo: item.titulo.slice(0, 180), autor: (item.autor || musica.autor).slice(0, 180),
      letra: item.letra || musica.letra, notas: item.notas || musica.notas, tom: item.tom || musica.tom })
    setSelecionado(`${item.titulo.slice(0, 180).trim()}|${(item.autor || musica.autor).slice(0, 180).trim()}`)
  }

  return <div className="worship-lookup" aria-label="Resultados da busca de louvores">
    <strong>Versões encontradas</strong>
    <p role="status">{atual.status === 'buscando' ? 'Buscando letras...' : atual.status === 'erro' ? 'Busca online indisponível. Tente alterar o título ou intérprete.' : !locais.length && !atual.itens.length ? 'Nenhuma letra encontrada. Confira o título ou informe o intérprete.' : ''}</p>
    {atual.status === 'erro' && <button type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar novamente</button>}
    {[...locais, ...atual.itens].map((item) => <button type="button" key={`${item.fonte}-${item.id}`} onClick={() => selecionar(item)}>
      <strong>{item.titulo}</strong>
      <span>{item.autor || 'Intérprete não informado'} · {item.fonte}</span>
      <small>{item.fonte === 'LRCLIB' ? 'Letra' : `Letra${item.notas ? ' · Cifras/notas' : ''}${item.tom ? ` · Tom: ${item.tom}` : ''}`}</small>
    </button>)}
    {atual.itens.length > 0 && <a href="https://lrclib.net" target="_blank" rel="noreferrer">Letras: LRCLIB</a>}
    <a href={`https://www.cifraclub.com.br/?q=${encodeURIComponent(`${musica.titulo} ${musica.autor}`.trim())}`} target="_blank" rel="noreferrer">Consultar cifras no Cifra Club</a>
  </div>
}
