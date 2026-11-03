// Modelo do e-mail de aniversário enviado aos membros.

const SITE = 'https://filhosdagraca.com.br'
const LOGO = `${SITE}/logo-filhos-colorida.png`

function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'irmão(ã)'
}

export function montarEmailAniversario(nome) {
  const nomeCurto = escapar(primeiroNome(nome))
  const assunto = `Feliz aniversário, ${primeiroNome(nome)}! 🎉`

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
            <div style="font-size:40px;line-height:1;">🎂</div>
            <h1 style="margin:14px 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;color:#17105f;">Feliz aniversário, ${nomeCurto}!</h1>
            <p style="margin:0;color:#6fbd2a;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Hoje é um dia especial</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 8px;font-size:16px;line-height:1.7;">
            <p style="margin:0 0 16px;">Querido(a) ${nomeCurto},</p>
            <p style="margin:0 0 16px;">Hoje celebramos a sua vida e agradecemos a Deus por cada dia que Ele tem lhe concedido. Você é parte da nossa família, e a sua presença faz diferença na nossa igreja.</p>
            <p style="margin:0 0 16px;">Que este novo ano seja cheio da graça, da paz e do cuidado do Senhor. Que cada passo seu seja guiado por Ele, e que não falte alegria, saúde e motivos para agradecer.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 36px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border-left:4px solid #6fbd2a;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.5;color:#17105f;font-style:italic;">
                  “O Senhor te abençoe e te guarde.”
                  <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-style:normal;color:#60708a;">Números 6:24</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 8px;font-size:16px;line-height:1.7;">
            <p style="margin:0;">Com carinho e orações,</p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 36px 32px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold;color:#17105f;">Pr. Cristiano Ribeiro</p>
            <p style="margin:2px 0 0;font-size:15px;color:#2b2f4a;">e toda a Igreja Filhos da Graça</p>
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

  const texto = `Feliz aniversário, ${primeiroNome(nome)}!

Hoje celebramos a sua vida e agradecemos a Deus por cada dia que Ele tem lhe concedido. Você é parte da nossa família, e a sua presença faz diferença na nossa igreja.

Que este novo ano seja cheio da graça, da paz e do cuidado do Senhor. Que cada passo seu seja guiado por Ele, e que não falte alegria, saúde e motivos para agradecer.

"O Senhor te abençoe e te guarde." (Números 6:24)

Com carinho e orações,
Pr. Cristiano Ribeiro
e toda a Igreja Filhos da Graça
Gerados no coração de Deus
${SITE}`

  return { assunto, html, texto }
}

// Data de hoje no fuso da igreja (Vitória da Conquista - BA, sem horário de verão).
export function hojeNaBahia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
  const [ano, mes, dia] = partes.split('-')
  return { ano: Number(ano), mes, dia }
}

// Aniversário de 29/02 é comemorado em 28/02 nos anos que não são bissextos.
export function fazAniversarioHoje(nascimento, hoje) {
  const [, mes, dia] = String(nascimento || '').split('-')
  if (!mes || !dia) return false
  if (mes === hoje.mes && dia === hoje.dia) return true

  const bissexto = (hoje.ano % 4 === 0 && hoje.ano % 100 !== 0) || hoje.ano % 400 === 0
  return mes === '02' && dia === '29' && !bissexto && hoje.mes === '02' && hoje.dia === '28'
}
