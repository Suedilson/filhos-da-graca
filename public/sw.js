// Service worker do site Filhos da Graça.
// - Páginas: busca a versão nova na internet; se não houver internet (ou demorar mais de 4 s),
//   abre a última versão guardada no aparelho.
// - Arquivos /assets/ (têm o código no nome e nunca mudam): guardados na primeira vez e servidos do aparelho.
// Dados (escalas, letras, cifras) ficam no cache do Firestore, não aqui.

const CACHE = 'filhos-da-graca-v1'
const LIMITE_ARQUIVOS = 80

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== CACHE) await caches.delete(nome)
    await self.clients.claim()
  })())
})

async function guardar(chave, resposta) {
  if (!resposta || !resposta.ok || resposta.type === 'opaque') return
  const cache = await caches.open(CACHE)
  await cache.put(chave, resposta)
  const chaves = await cache.keys()
  // Mantém só os arquivos mais recentes (versões antigas do site saem)
  for (const antiga of chaves.slice(0, Math.max(0, chaves.length - LIMITE_ARQUIVOS))) await cache.delete(antiga)
}

async function pagina(requisicao) {
  const cache = await caches.open(CACHE)
  const guardada = await cache.match('/index.html')
  const daRede = fetch(requisicao).then((resposta) => {
    guardar('/index.html', resposta.clone())
    return resposta
  })
  if (!guardada) return daRede
  const demora = new Promise((resolver) => setTimeout(() => resolver(guardada), 4000))
  try {
    return await Promise.race([daRede, demora])
  } catch {
    return guardada
  }
}

async function arquivo(requisicao) {
  const guardado = await caches.match(requisicao)
  if (guardado) return guardado
  const resposta = await fetch(requisicao)
  guardar(requisicao, resposta.clone())
  return resposta
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request
  if (requisicao.method !== 'GET') return
  const url = new URL(requisicao.url)
  if (url.origin !== self.location.origin) return
  if (requisicao.mode === 'navigate') {
    evento.respondWith(pagina(requisicao))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(arquivo(requisicao))
  }
})
