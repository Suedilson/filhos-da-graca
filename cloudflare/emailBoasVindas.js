// Modelo do e-mail de boas-vindas enviado a quem se cadastrou pelo site, quando o acesso é liberado.
// O texto pode ser trocado pelo painel (configuracoes/emailBoasVindas); a logo e o layout são fixos.

import { comNome, escapar, mesclarTexto, paragrafosHtml, primeiroNome } from './emailAniversario.js'

const SITE = 'https://filhosdagraca.com.br'
const LOGO = `${SITE}/logo-filhos-colorida.png`

export const TEXTO_PADRAO_BOAS_VINDAS = {
  assunto: 'Seja bem-vindo(a) à família Filhos da Graça, {nome}!',
  titulo: 'Seja bem-vindo(a), {nome}!',
  mensagem: `Que alegria ter você conosco, {nome}! Em nome de toda a Igreja Filhos da Graça, damos as boas-vindas à nossa família.

Aqui caminhamos juntos, servimos com amor e vivemos a Palavra de Deus. Desejamos que você se sinta em casa e encontre em nós uma família para crescer na fé, fazer amizades e servir.

Na Área do Membro do nosso site você acompanha os seus dados de cadastro, e na página inicial encontra a programação dos cultos, os vídeos das mensagens e a nossa Biblioteca de estudos.

Conte conosco para o que precisar. Estamos orando por você e pela sua família.`,
  versiculo: 'Acolhei-vos uns aos outros, como também Cristo nos acolheu.',
  referencia: 'Romanos 15:7',
  despedida: 'Com carinho e orações,',
  assinatura: 'Pr. Cristiano Ribeiro',
  assinaturaComplemento: 'e toda a Igreja Filhos da Graça',
}

export function montarEmailBoasVindas(nome, config = {}) {
  const t = mesclarTexto(config, TEXTO_PADRAO_BOAS_VINDAS)
  const nomeCurto = primeiroNome(nome)
  const assunto = comNome(t.assunto, nomeCurto)
  const mensagem = comNome(t.mensagem, nomeCurto)

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(assunto)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f7;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#2b2f4a;">
        <tr>
          <td style="height:6px;background:linear-gradient(90deg,#17105f,#3b2aa8,#6fbd2a,#d8a526);background-color:#17105f;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding:32px 32px 8px;">
            <img src="${LOGO}" width="200" alt="Igreja Filhos da Graça" style="display:block;width:200px;max-width:70%;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 32px 0;">
            <div style="font-size:40px;line-height:1;">🤝</div>
            <h1 style="margin:14px 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#17105f;">${escapar(comNome(t.titulo, nomeCurto))}</h1>
            <p style="margin:0;color:#6fbd2a;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Você faz parte da nossa família</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 8px;font-size:16px;line-height:1.7;">
            ${paragrafosHtml(mensagem)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 36px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border-left:4px solid #6fbd2a;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.5;color:#17105f;font-style:italic;">
                  “${escapar(t.versiculo)}”
                  <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-style:normal;color:#60708a;">${escapar(t.referencia)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 36px 4px;">
            <a href="${SITE}" style="display:inline-block;padding:13px 26px;border-radius:10px;background:#17105f;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">Visitar o site da igreja</a>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 36px 8px;font-size:16px;line-height:1.7;">
            <p style="margin:0;">${escapar(t.despedida)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 36px 32px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold;color:#17105f;">${escapar(t.assinatura)}</p>
            <p style="margin:2px 0 0;font-size:15px;color:#2b2f4a;">${escapar(t.assinaturaComplemento)}</p>
            <p style="margin:6px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#60708a;">Gerados no coração de Deus</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 24px;background:#17105f;color:#ffffff;font-size:13px;line-height:1.6;">
            <a href="${SITE}" style="color:#ffffff;font-weight:bold;text-decoration:none;">filhosdagraca.com.br</a>
            <div style="color:rgba(255,255,255,0.7);font-size:12px;">Você recebe esta mensagem por fazer parte da família Filhos da Graça.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  const texto = `${comNome(t.titulo, nomeCurto)}

${mensagem}

"${t.versiculo}" (${t.referencia})

${t.despedida}
${t.assinatura}
${t.assinaturaComplemento}
Gerados no coração de Deus
${SITE}`

  return { assunto, html, texto }
}
