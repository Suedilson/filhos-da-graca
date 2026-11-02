const fs = require('fs')
const path = require('path')
const os = require('os')
const assert = require('node:assert/strict')
const { transformSync } = require('@babel/core')
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')
const { chromium } = require('playwright')

const root = path.resolve(__dirname, '..')
const code = transformSync(fs.readFileSync(path.join(root, 'src/pages/Louvor.jsx'), 'utf8'), {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], ['@babel/preset-react', { runtime: 'automatic' }]],
}).code
const musicas = [{ id: '1', titulo: 'Louvor de teste com um título longo para verificar o alinhamento', autor: 'Autor', ministros: 'Ministro de teste', tom: 'G', ativo: true, letra: 'Letra de teste', notas: '  G         C                              D            G\nLinha fictícia para verificar o alinhamento dos acordes\n\tC        D' }]
const escalas = [{ id: '1', titulo: 'Culto de celebração', data: '2099-11-02', horario: '19:00', ministro: 'Ministro de teste', equipe: [{ nome: 'Integrante com nome completo', funcao: 'Teclado' }], repertorio: musicas, observacoes: '', status: 'Confirmada', versao: 1 }]
function render(aba) {
  let hook = 0
  const local = { exports: {} }
  const customRequire = (id) => {
    if (id.endsWith('.css') || id.includes('services/firebase')) return {}
    if (id === './BuscarLouvor') return { __esModule: true, default: () => null }
    if (id === './BuscarCifra') return { __esModule: true, default: () => null }
    if (id === '../services/formatoCifra.js') return require('../src/services/formatoCifra.js')
    if (id === 'react') return { ...React, useEffect: () => {}, useState: (initial) => {
      const index = hook++
      return [index === 0 ? aba : index === 1 ? musicas : index === 2 ? escalas : index === 3 ? { ...musicas[0] } : index === 10 ? false : typeof initial === 'function' ? initial() : initial, () => {}]
    } }
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(customRequire, local, local.exports)
  return renderToStaticMarkup(React.createElement(local.exports.default, { user: { uid: 'test' } }))
}
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const styles = ['src/index.css', 'src/App.css', 'src/pages/Admin.css', 'src/pages/Louvor.css'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
  try {
    for (const width of [1440, 1024, 768, 390]) {
      for (const aba of ['escalas', 'louvores']) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } })
        const menu = ['Programação', 'Louvor', 'Biblioteca', 'Oração', 'Membros', 'Meus dados', 'Localização', 'Vídeos', 'Financeiro', 'Permissões'].map((s) => ['Vídeos', 'Financeiro'].includes(s) ? `<div class="admin-tab-group"><button>${s} <span>▾</span></button><div class="admin-submenu"><button>Documentos</button></div></div>` : `<button>${s}</button>`).join('')
        await page.setContent(`<style>${styles}</style><main class="admin-page"><nav class="admin-tabs admin-tabs-grouped mobile-open">${menu}</nav>${render(aba)}</main>`)
        await page.locator('details').evaluateAll((itens) => itens.forEach((e) => { e.open = true }))
        const problems = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea, button, .admin-card, .worship-layout, .admin-tabs')].filter((e) => {
          const r = e.getBoundingClientRect()
          return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1 || (!e.matches('input, .worship-chord-input, .worship-chord-display') && e.scrollWidth > e.clientWidth + 2))
        }).map((e) => `${e.tagName}.${e.className}: ${e.textContent.slice(0, 60)}`))
        assert.deepEqual(problems, [], `${width}px ${aba}: overflow`)
        if (aba === 'louvores') {
          const formato = await page.locator('.worship-chord-input').evaluate((e) => ({ fonte: getComputedStyle(e).fontFamily, peso: getComputedStyle(e).fontWeight, espacos: getComputedStyle(e).whiteSpace, wrap: e.wrap }))
          assert.match(formato.fonte, /monospace/)
          assert.equal(formato.peso, '400')
          assert.equal(formato.espacos, 'pre')
          assert.equal(formato.wrap, 'off')
        }
        await page.screenshot({ path: path.join(os.tmpdir(), `louvor-${aba}-${width}.png`), fullPage: true })
        console.log(`PASS ${aba} ${width}px`)
        await page.close()
      }
    }
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
