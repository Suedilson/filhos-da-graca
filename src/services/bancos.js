import { auth } from './firebase.js'

const endpoint = 'https://filhos-da-graca-aniversarios.filhos-da-graca.workers.dev/bancos'

// Pede ao Worker para buscar agora os extratos da Cora e da Stone (Pluggy).
export async function sincronizarBancosAgora() {
  if (!auth.currentUser) throw new Error('Entre novamente na sua conta.')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  const data = await response.json().catch(() => ({}))
  if (response.status === 409) return { configurado: false, mensagem: data.mensagem }
  if (!response.ok) throw new Error(data.mensagem || 'Não foi possível sincronizar os bancos.')
  return data
}
