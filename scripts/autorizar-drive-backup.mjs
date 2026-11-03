// Autoriza a conta do Google Drive exclusiva para backups e grava as chaves no Worker.
// Uso (na pasta do projeto): node scripts/autorizar-drive-backup.mjs
// Lê o arquivo client_secret_*.json baixado do Google Cloud (ou pede os valores), abre o login do Google
// e, depois que você entra com a conta de backup, grava os três segredos no Worker com o wrangler.

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { randomBytes } from 'node:crypto'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pastaCloudflare = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cloudflare')
const WRANGLER = ['-y', 'wrangler@4.156.2']

// Usa o arquivo client_secret_*.json mais recente da pasta Downloads; sem ele, pergunta os valores.
async function lerCredenciais() {
  const downloads = path.join(os.homedir(), 'Downloads')
  const arquivos = (await readdir(downloads).catch(() => []))
    .filter((nome) => /^client_secret_.*\.json$/.test(nome))
  if (arquivos.length) {
    const comData = await Promise.all(arquivos.map(async (nome) => ({ nome, data: (await stat(path.join(downloads, nome))).mtimeMs })))
    const maisRecente = path.join(downloads, comData.sort((a, b) => b.data - a.data)[0].nome)
    const dados = JSON.parse(await readFile(maisRecente, 'utf8'))
    const cliente = dados.installed || dados.web || {}
    // Só aceita credenciais do projeto da igreja; arquivos de outros projetos são ignorados.
    if (cliente.client_id && cliente.client_secret && cliente.project_id === 'filhos-da-graca') {
      console.log(`Usando as credenciais de ${maisRecente}`)
      return { clientId: cliente.client_id, clientSecret: cliente.client_secret, arquivo: maisRecente }
    }
  }
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  const clientId = (await leitor.question('ID do cliente OAuth (termina em .apps.googleusercontent.com): ')).trim()
  const clientSecret = (await leitor.question('Chave secreta do cliente OAuth: ')).trim()
  leitor.close()
  return { clientId, clientSecret }
}

const { clientId, clientSecret, arquivo } = await lerCredenciais()

if (!clientId.endsWith('.apps.googleusercontent.com') || !clientSecret) {
  console.error('ID ou chave do cliente inválidos. Confira no Google Cloud Console e tente de novo.')
  process.exit(1)
}

const estado = randomBytes(16).toString('hex')

const codigo = await new Promise((resolve, reject) => {
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname !== '/') { res.writeHead(404).end(); return }
    const erro = url.searchParams.get('error')
    const recebido = url.searchParams.get('code')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    if (erro || url.searchParams.get('state') !== estado || !recebido) {
      res.end('<h2>Autorização não concluída.</h2><p>Volte ao terminal e tente de novo.</p>')
      servidor.close()
      reject(new Error(erro || 'Resposta inválida do Google.'))
      return
    }
    res.end('<h2>Conta autorizada!</h2><p>Pode fechar esta aba e voltar ao terminal.</p>')
    const redirect = `http://127.0.0.1:${servidor.address().port}`
    servidor.close()
    resolve({ code: recebido, redirect })
  })

  servidor.listen(0, '127.0.0.1', () => {
    const redirect = `http://127.0.0.1:${servidor.address().port}`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent',
      state: estado,
    })
    const link = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    console.log('\nAbrindo o navegador. Entre com a CONTA DE BACKUP e clique em Permitir.')
    console.log(`Se o navegador não abrir, copie este endereço:\n${link}\n`)
    spawn('cmd', ['/c', 'start', '', link.replaceAll('&', '^&')], { stdio: 'ignore', detached: true }).unref()
  })
})

const resposta = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: codigo.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: codigo.redirect,
    grant_type: 'authorization_code',
  }),
})
const tokens = await resposta.json()
if (!resposta.ok || !tokens.refresh_token) {
  console.error('O Google não devolveu a autorização permanente. Tente de novo; se repetir, remova o acesso do app em myaccount.google.com/permissions e rode outra vez.')
  process.exit(1)
}

// Grava as três chaves de uma vez com "wrangler secret bulk"; o arquivo temporário é apagado em seguida.
async function gravarSegredos(segredos) {
  const temporario = path.join(os.tmpdir(), `backup-drive-${randomBytes(8).toString('hex')}.json`)
  await writeFile(temporario, JSON.stringify(segredos), { mode: 0o600 })
  try {
    const status = await new Promise((resolve) => {
      const processo = spawn(`npx ${WRANGLER.join(' ')} secret bulk "${temporario}" -c wrangler-aniversarios.jsonc`, {
        cwd: pastaCloudflare,
        shell: true,
        stdio: 'inherit',
      })
      processo.on('exit', resolve)
    })
    if (status !== 0) throw new Error('Falha ao gravar as chaves no Worker.')
  } finally {
    await rm(temporario, { force: true })
  }
}

await gravarSegredos({
  GOOGLE_DRIVE_CLIENT_ID: clientId,
  GOOGLE_DRIVE_CLIENT_SECRET: clientSecret,
  GOOGLE_DRIVE_REFRESH_TOKEN: tokens.refresh_token,
})
if (arquivo) {
  await rm(arquivo)
  console.log(`Arquivo de credenciais apagado da pasta Downloads: ${path.basename(arquivo)}`)
}
console.log('\nPronto! A conta de backup foi autorizada e as chaves estão gravadas no Worker.')
