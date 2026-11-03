import { useState } from 'react'

// Campo de senha com botão de olho para mostrar ou ocultar o que foi digitado.
export default function CampoSenha(props) {
  const [visivel, setVisivel] = useState(false)

  return (
    <span className="campo-senha">
      <input {...props} type={visivel ? 'text' : 'password'} />

      <button
        type="button"
        className="campo-senha-olho"
        onClick={() => setVisivel((atual) => !atual)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visivel && <line x1="3" y1="3" x2="21" y2="21" />}
        </svg>
      </button>
    </span>
  )
}
