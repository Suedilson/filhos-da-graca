import { auth } from './firebase.js'

const endpoint = 'https://filhos-da-graca-aniversarios.filhos-da-graca.workers.dev/teste'

// Pede ao Worker de aniversários um e-mail de exemplo para o administrador geral.
// Quando recebe um texto, o exemplo usa esse texto mesmo que ainda não esteja salvo.
export async function enviarEmailAniversarioTeste(texto) {
  if (!auth.currentUser) throw new Error('Entre novamente na sua conta.')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: texto ? JSON.stringify(texto) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.mensagem || 'Não foi possível enviar o e-mail de teste.')
  return data.mensagem
}
