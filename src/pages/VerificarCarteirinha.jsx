import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import './Carteirinhas.css'

function dataBR(iso) {
  if (!iso) return '-'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Página aberta pelo QR code da carteirinha: mostra só nome, função, matrícula e validade.
export default function VerificarCarteirinha() {
  const codigo = decodeURIComponent(window.location.pathname.split('/')[2] || '').toUpperCase()
  const codigoValido = /^[A-Z0-9]{6,20}$/.test(codigo)
  const [estadoBusca, setEstado] = useState({ carregando: true })
  const estado = codigoValido ? estadoBusca : { carregando: false, cartao: null }

  useEffect(() => {
    if (!codigoValido) return
    getDoc(doc(db, 'carteirinhas', codigo))
      .then((snap) => setEstado({ carregando: false, cartao: snap.exists() ? snap.data() : null }))
      .catch(() => setEstado({ carregando: false, erro: true }))
  }, [codigo, codigoValido])

  const { carregando, cartao, erro } = estado
  const hoje = new Date().toISOString().slice(0, 10)
  const valida = cartao && cartao.ativa !== false && (!cartao.validade || cartao.validade >= hoje)
  const motivo = !cartao
    ? 'Carteirinha não encontrada.'
    : cartao.ativa === false
      ? 'Esta carteirinha foi cancelada ou substituída por uma mais nova.'
      : 'Esta carteirinha está vencida.'

  return (
    <main className="verif">
      <section className="verif-card">
        <img src="/logo-filhos-colorida.png" alt="Igreja Filhos da Graça" className="verif-logo" />
        <span className="verif-eyebrow">Verificação de carteirinha</span>
        {carregando ? (
          <p>Verificando...</p>
        ) : erro ? (
          <p>Não foi possível verificar agora. Tente novamente em instantes.</p>
        ) : (
          <>
            <div className={`verif-status ${valida ? 'ok' : 'bad'}`}>
              <span aria-hidden="true">{valida ? '✓' : '✕'}</span>
              {valida ? 'Carteirinha válida' : 'Carteirinha não válida'}
            </div>
            {cartao && (
              <dl className="verif-data">
                <dt>Membro</dt><dd>{cartao.nome}</dd>
                <dt>Função</dt><dd>{cartao.funcao}</dd>
                <dt>Matrícula</dt><dd>{cartao.numero}</dd>
                <dt>Validade</dt><dd>{dataBR(cartao.validade)}</dd>
              </dl>
            )}
            {!valida && <p className="verif-note">{motivo}</p>}
          </>
        )}
        <a href="/" className="verif-link">Igreja Evangélica Filhos da Graça</a>
      </section>
    </main>
  )
}
