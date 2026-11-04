import { auth } from './firebase.js'

const endpoint = 'https://filhos-da-graca-aniversarios.filhos-da-graca.workers.dev/boas-vindas'

async function chamar(corpo) {
  if (!auth.currentUser) throw new Error('Entre novamente na sua conta.')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.mensagem || 'Não foi possível enviar o e-mail de boas-vindas.')
  return data
}

// Pede ao Worker o e-mail de boas-vindas de quem se cadastrou pelo site e acabou de ter o acesso liberado (uma vez só).
export function enviarBoasVindas(uid) {
  return chamar({ uid })
}

// Envio manual para um membro cadastrado (pode repetir).
export function enviarBoasVindasManual(membroId) {
  return chamar({ membroId })
}

// Exemplo do e-mail para o próprio administrador, com o texto que está no editor.
export function enviarTesteBoasVindas(texto) {
  return chamar({ teste: true, texto })
}
