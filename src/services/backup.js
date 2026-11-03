import { auth } from './firebase.js'

const endpoint = 'https://filhos-da-graca-aniversarios.filhos-da-graca.workers.dev/backup'

// Pede ao Worker uma cópia de segurança imediata no Google Drive (somente administrador geral).
export async function fazerBackupAgora() {
  if (!auth.currentUser) throw new Error('Entre novamente na sua conta.')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.mensagem || 'Não foi possível fazer o backup.')
  return data.mensagem
}
