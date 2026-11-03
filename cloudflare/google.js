// Funções comuns para falar com o Google (Firestore e Drive) a partir dos Workers.

export function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeBase64url(texto) {
  return Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
}

// Token de acesso do Google a partir da conta de serviço do Firebase.
export async function tokenGoogle(env) {
  const conta = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const dados = base64url(new TextEncoder().encode(JSON.stringify({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  })))
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const chave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${cabecalho}.${dados}`))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${cabecalho}.${dados}.${base64url(assinatura)}`,
  })
  if (!r.ok) throw new Error(`Falha ao autenticar no Google (HTTP ${r.status})`)
  return (await r.json()).access_token
}

export function urlFirestore(env, caminho) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/${caminho}`
}
