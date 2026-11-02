import { useEffect, useRef, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'

const consultar = httpsCallable(getFunctions(undefined, 'us-central1'), 'buscarCifraLouvor', { timeout: 28000 })

export default function BuscarCifra({ musica, onSelecionar }) {
  const [status, setStatus] = useState('')
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const ultimaTentativa = useRef(0)
  const { titulo, autor, notas, tom } = musica

  useEffect(() => {
    const pedidoManual = tentativa > ultimaTentativa.current
    ultimaTentativa.current = tentativa
    if (titulo.trim().length < 3 || !autor.trim() || (notas.trim() && !pedidoManual)) return
    let ativo = true
    const timer = setTimeout(async () => {
      setStatus('buscando'); setErro('')
      try {
        const { data } = await consultar({ titulo: titulo.trim(), autor: autor.trim() })
        if (!ativo) return
        if (typeof data?.notas !== 'string' || !data.notas || typeof data.tom !== 'string') throw new Error('Resposta inválida')
        if (tom.trim() && tom.trim() !== data.tom && !window.confirm(`A cifra encontrada está em ${data.tom}. Usar esse tom e substituir o tom ${tom}?`)) {
          setStatus(''); return
        }
        onSelecionar((atual) => {
          if (atual.titulo !== titulo || atual.autor !== autor || atual.notas !== notas || atual.tom !== tom) return atual
          return { ...atual, notas: data.notas, tom: data.tom }
        })
        setStatus('pronto')
      } catch (error) {
        if (!ativo) return
        console.error('Busca de cifra:', error.code || error.message)
        setStatus('erro')
        setErro(error.code === 'functions/resource-exhausted' ? 'Aguarde um minuto para buscar novamente.' :
          error.code === 'functions/unauthenticated' ? 'Entre novamente na sua conta para buscar a cifra.' :
          error.code === 'functions/permission-denied' ? 'Seu usuário não tem permissão para buscar cifras.' :
          error.code === 'functions/not-found' ? error.message : 'O serviço de cifras não está disponível. Os campos preenchidos foram mantidos.')
      }
    }, 1100)
    return () => { ativo = false; clearTimeout(timer) }
  }, [titulo, autor, notas, tom, tentativa, onSelecionar])

  return <div className="worship-lookup">
    <strong>Cifra e tom</strong>
    <p role="status">{status === 'buscando' ? 'Buscando a cifra desta versão...' : notas.trim() ? 'Cifra/notas preenchidas.' : !autor.trim() ? 'Informe o intérprete para buscar a cifra correspondente.' : 'Busca da cifra pelo título e intérprete.'}</p>
    {status === 'erro' && <p role="alert">{erro}</p>}
    <button type="button" disabled={!autor.trim() || titulo.trim().length < 3 || status === 'buscando'} onClick={() => {
      if (notas.trim() && !window.confirm('Substituir as notas e cifras preenchidas pela versão encontrada?')) return
      setTentativa((n) => n + 1)
    }}>Buscar cifra e tom</button>
  </div>
}
