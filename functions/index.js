import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { createHash } from 'node:crypto'
import { buscarCifra, normalizar } from './cifras.js'

initializeApp()
const db = getFirestore()

export const buscarCifraLouvor = onCall({ region: 'us-central1', maxInstances: 1, concurrency: 20,
  timeoutSeconds: 30, memory: '256MiB', minInstances: 0 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta novamente.')
  const { uid, token } = request.auth
  const permissao = (await db.doc(`usuariosPermissoes/${uid}`).get()).data()
  const superAdmin = token.email === 'suedilsonfilho@gmail.com' && token.email_verified === true
  if (!superAdmin && !(permissao?.ativo === true && permissao.permissoes?.includes('louvor'))) {
    throw new HttpsError('permission-denied', 'Você não tem acesso ao ministério de louvor.')
  }
  const { titulo, autor } = request.data || {}
  if (typeof titulo !== 'string' || typeof autor !== 'string' || titulo.trim().length < 3 ||
    !autor.trim() || titulo.length > 180 || autor.length > 180) {
    throw new HttpsError('invalid-argument', 'Informe o título e o intérprete da música.')
  }
  const agora = Date.now()
  await db.runTransaction(async (transaction) => {
    const ref = db.doc(`louvorLimites/${uid}`)
    const atual = (await transaction.get(ref)).data()
    const recente = atual && agora - atual.inicio < 60000
    if (recente && atual.quantidade >= 5) throw new HttpsError('resource-exhausted', 'Aguarde um minuto antes de buscar mais cifras.')
    transaction.set(ref, { inicio: recente ? atual.inicio : agora, quantidade: recente ? atual.quantidade + 1 : 1 })
  })
  const chave = createHash('sha256').update(`${normalizar(titulo)}|${normalizar(autor)}`).digest('hex')
  const refCache = db.doc(`louvorCifrasCache/${chave}`)
  const anterior = (await refCache.get()).data()
  if (anterior?.expiraEm?.toMillis() > agora) return anterior.resultado
  let resultado
  try { resultado = await buscarCifra(titulo.trim(), autor.trim()) }
  catch (error) { throw new HttpsError('not-found', error.message) }
  await refCache.set({ resultado, expiraEm: Timestamp.fromMillis(agora + 86400000) })
  return resultado
})
