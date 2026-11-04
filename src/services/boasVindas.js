import { auth } from './firebase.js'

const endpoint = 'https://filhos-da-graca-aniversarios.filhos-da-graca.workers.dev/boas-vindas'

// Pede ao Worker o e-mail de boas-vindas de quem se cadastrou pelo site e acabou de ter o acesso liberado.
export async function enviarBoasVindas(uid) {
  if (!auth.currentUser) throw new Error('Entre novamente na sua conta.')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.mensagem || 'Não foi possível enviar o e-mail de boas-vindas.')
  return data
}
