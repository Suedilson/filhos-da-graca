import { auth } from './firebase.js'

const endpoint = 'https://filhos-da-graca-cifras.filhos-da-graca.workers.dev/cifra'

export async function consultarCifraCloudflare(consulta, signal) {
  if (!auth.currentUser) throw Object.assign(new Error('Entre novamente na sua conta.'), { code: 'cifras/unauthenticated' })
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(endpoint, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(consulta), signal,
  })
  const data = await response.json()
  if (!response.ok) {
    const codigos = { 400: 'invalid-argument', 401: 'unauthenticated', 403: 'permission-denied', 404: 'not-found', 429: 'resource-exhausted' }
    throw Object.assign(new Error(data.mensagem || 'Busca de cifras indisponível.'), { code: `cifras/${codigos[response.status] || 'unavailable'}` })
  }
  return { data }
}
