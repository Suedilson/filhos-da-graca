import { useEffect, useRef, useState } from 'react'
import { consultarCifraCloudflare } from '../services/cifrasCloudflare'
import { extrairLetraDaCifra, formatarCifra } from '../services/formatoCifra.js'

export default function BuscarCifra({ musica, onSelecionar }) {
  const [status, setStatus] = useState('')
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const ultimaTentativa = useRef(0)
  const buscasAutomaticas = useRef(new Set())
  const { titulo, autor, notas, tom } = musica

  useEffect(() => {
    const pedidoManual = tentativa > ultimaTentativa.current
    ultimaTentativa.current = tentativa
    if (titulo.trim().length < 3 || !autor.trim() || (notas.trim() && !pedidoManual)) return
    // A busca automática espera o intérprete completo e não repete a mesma música;
    // assim não gasta o limite de consultas enquanto o nome ainda está sendo digitado.
    const chaveBusca = `${titulo.trim().toLowerCase()}|${autor.trim().toLowerCase()}`
    if (!pedidoManual && (autor.trim().length < 3 || buscasAutomaticas.current.has(chaveBusca))) return
    let ativo = true
    const controller = new AbortController()
    const limite = setTimeout(() => controller.abort(), 28000)
    const timer = setTimeout(async () => {
      if (!pedidoManual) buscasAutomaticas.current.add(chaveBusca)
      setStatus('buscando'); setErro('')
      try {
        const { data } = await consultarCifraCloudflare({ titulo: titulo.trim(), autor: autor.trim() }, controller.signal)
        if (!ativo) return
        if (typeof data?.notas !== 'string' || !data.notas || typeof data.tom !== 'string') throw new Error('Resposta inválida')
        if (data.tom && tom.trim() && tom.trim() !== data.tom && !window.confirm(`A cifra encontrada está em ${data.tom}. Usar esse tom e substituir o tom ${tom}?`)) {
          setStatus(''); return
        }
        onSelecionar((atual) => {
          if (atual.titulo !== titulo || atual.autor !== autor || atual.notas !== notas || atual.tom !== tom) return atual
          const notasNovas = formatarCifra(data.notas)
          // Sem letra cadastrada, aproveita a letra que vem junto com a cifra.
          const letra = atual.letra.trim() ? atual.letra : extrairLetraDaCifra(notasNovas)
          return { ...atual, notas: notasNovas, tom: data.tom || atual.tom, letra }
        })
        setStatus(data.tom ? 'pronto' : 'sem-tom')
      } catch (error) {
        if (!ativo) return
        console.error('Busca de cifra:', error.code || error.message)
        setStatus('erro')
        setErro(error.code === 'cifras/resource-exhausted' ? 'Aguarde um minuto para buscar novamente.' :
          error.code === 'cifras/unauthenticated' ? 'Entre novamente na sua conta para buscar a cifra.' :
          error.code === 'cifras/permission-denied' ? 'Seu usuário não tem permissão para buscar cifras.' :
          error.code === 'cifras/not-found' || error.code === 'cifras/unavailable' && error.message ? error.message :
          'O serviço de cifras não está disponível. Os campos preenchidos foram mantidos.')
      } finally { clearTimeout(limite) }
    }, pedidoManual ? 0 : 2500)
    return () => { ativo = false; clearTimeout(timer); clearTimeout(limite); controller.abort() }
  }, [titulo, autor, notas, tom, tentativa, onSelecionar])

  return <div className="worship-lookup">
    <strong>Cifra e tom</strong>
    <p role="status">{status === 'buscando' ? 'Buscando a cifra desta versão...' : status === 'sem-tom' ? 'Cifra preenchida. A fonte não informou o tom; confirme o tom desta versão.' : notas.trim() ? 'Cifra/notas preenchidas.' : !autor.trim() ? 'Informe o intérprete para buscar a cifra correspondente.' : 'Busca da cifra pelo título e intérprete.'}</p>
    {status === 'erro' && <p role="alert">{erro}</p>}
    <button type="button" disabled={!autor.trim() || titulo.trim().length < 3 || status === 'buscando'} onClick={() => {
      if (notas.trim() && !window.confirm('Substituir as notas e cifras preenchidas pela versão encontrada?')) return
      setTentativa((n) => n + 1)
    }}>Buscar cifra e tom</button>
  </div>
}
