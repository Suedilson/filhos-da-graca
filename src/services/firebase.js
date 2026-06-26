import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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
export const db = getFirestore(app)