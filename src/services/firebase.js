import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: 'AIzaSyDCSuNAUP0dIRz5k3zSfLZDSqGQPkj-YhU',
  authDomain: 'filhos-da-graca.firebaseapp.com',
  projectId: 'filhos-da-graca',
  storageBucket: 'filhos-da-graca.firebasestorage.app',
  messagingSenderId: '560004506684',
  appId: '1:560004506684:web:89382b108c7bcae051cf39',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
// Guarda no aparelho tudo o que já foi lido (letras, cifras, escalas...), para funcionar
// com internet lenta ou sem internet. Se o navegador não permitir, usa o modo normal.
function criarFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (error) {
    console.warn('Cache offline indisponível neste navegador.', error)
    return getFirestore(app)
  }
}

export const db = criarFirestore()