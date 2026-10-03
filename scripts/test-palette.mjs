import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const html = readFileSync(new URL('../apps/web/public/palette/index.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]

function clipboardPage({ nativeCopy, fallbackCopy = () => true } = {}) {
  const messages = []
  let removed = false
  let focusRestored = false
  const previousFocus = { focus: () => { focusRestored = true } }
  const status = { classList: { add() {}, remove() {} } }
  Object.defineProperty(status, 'textContent', { set: value => messages.push(value) })
  const context = vm.createContext({
    navigator: nativeCopy ? { clipboard: { writeText: nativeCopy } } : {},
    window: { clearTimeout() {}, setTimeout() {} },
    document: {
      activeElement: previousFocus,
      getElementById: id => id === 'copy-status' ? status : { addEventListener() {} },
      querySelectorAll: () => [],
      body: { appendChild() {} },
      execCommand: fallbackCopy,
      createElement: () => ({
        style: {}, setAttribute() {},
        select() { context.document.activeElement = this },
        remove() { removed = true },
      }),
    },
  })
  vm.runInContext(script, context)
  return { context, messages, removed: () => removed, focusRestored: () => focusRestored }
}

test('Mocha replaces Antique Gold in the swatch and copied tokens', () => {
  assert.doesNotMatch(html, /a98a3f|antique gold|--ju-gold(?!-soft)/i)
  assert.match(html, /data-copy="#422BAC" aria-label="Copy Mocha color #422BAC"/)
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1]
  const tokens = html.match(/<code id="token-code">([\s\S]*?)<\/code>/)[1].replace(/<[^>]+>/g, '')
  for (const [, name, value] of tokens.matchAll(/(--ju-[a-z-]+):\s*(#[a-f\d]{6});/gi)) {
    assert.ok(style.includes(`${name}: ${value};`), `${name} must match the actual CSS`)
  }
})

test('Cream on Mocha example uses the correct WCAG contrast ratio', () => {
  function luminance(hex) {
    const channels = hex.match(/../g).map(channel => parseInt(channel, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const contrast = (luminance('f5efe3') + 0.05) / (luminance('422bac') + 0.05)
  assert.ok(contrast >= 4.5)
  assert.match(html, new RegExp(`${contrast.toFixed(2)}:1`))
})

test('Native clipboard copies the requested value', async () => {
  let copied
  const page = clipboardPage({ nativeCopy: async value => { copied = value } })
  await vm.runInContext("copyText('#422BAC', 'Mocha copied')", page.context)
  assert.equal(copied, '#422BAC')
  assert.deepEqual(page.messages, ['Mocha copied'])
})

test('Fallback copy cleans up and restores keyboard focus', async () => {
  const page = clipboardPage()
  await vm.runInContext("copyText('#422BAC', 'Mocha copied')", page.context)
  assert.deepEqual(page.messages, ['Mocha copied'])
  assert.ok(page.removed())
  assert.ok(page.focusRestored())
})

for (const fallbackCopy of [() => false, () => { throw new Error('Not allowed') }]) {
  test(`Failed fallback (${fallbackCopy.toString()}) never reports copy success`, async () => {
    const page = clipboardPage({ nativeCopy: async () => { throw new Error('Denied') }, fallbackCopy })
    await vm.runInContext("copyText('#422BAC', 'Mocha copied')", page.context)
    assert.equal(page.messages.length, 1)
    assert.match(page.messages[0], /^Copy unavailable/)
    assert.ok(page.removed())
    assert.ok(page.focusRestored())
  })
}
