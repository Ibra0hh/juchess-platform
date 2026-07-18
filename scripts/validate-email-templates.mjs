import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { buildVerificationEmailHtml } from '../appwrite/functions/verification-actions/src/main.js'
import { buildPasswordRecoveryEmailHtml } from '../appwrite/functions/verification-actions/src/passwordRecovery.js'

const templateDir = 'appwrite/email-templates'
const templates = readdirSync(templateDir).filter((name) => name.endsWith('.html'))
const requiredByTemplate = {
  'account-verification.html': ['{{project}}', '{{user}}', '{{redirect}}'],
  'password-recovery.html': ['{{project}}', '{{user}}', '{{redirect}}'],
}
const forbiddenPatterns = [/<script\b/i, /<form\b/i, /javascript:/i, /src=["']data:/i]
const logoUrl = 'https://juchess.page/email/juchess-email-logo.png'
const responsiveMarkup = [
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '@media only screen and (max-width:480px)',
  'class="email-gutter"',
  'class="email-content"',
  'class="email-cta"',
]

if (!templates.length) throw new Error('No email templates were found.')

for (const name of templates) {
  const path = join(templateDir, name)
  const html = readFileSync(path, 'utf8')
  const size = statSync(path).size

  if (!html.toLowerCase().includes('<!doctype html>')) {
    throw new Error(`${name}: missing HTML doctype.`)
  }
  if (!html.includes(logoUrl)) {
    throw new Error(`${name}: missing the stable JuChess email logo URL.`)
  }
  for (const marker of responsiveMarkup) {
    if (!html.includes(marker)) throw new Error(`${name}: missing responsive email markup ${marker}.`)
  }
  for (const token of requiredByTemplate[name] ?? []) {
    if (!html.includes(token)) throw new Error(`${name}: missing required Appwrite token ${token}.`)
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(html)) throw new Error(`${name}: contains unsafe or unsupported email markup (${pattern}).`)
  }
  if (size > 100_000) throw new Error(`${name}: exceeds the 100 KB email HTML budget.`)

  console.log(`OK ${name} (${size} bytes)`)
}

const challengeHtml = buildVerificationEmailHtml({
  displayName: 'JuChess Player',
  code: '123456',
  verificationUrl: 'https://juchess.page/verify-email?challenge=template-check&token=template-check-token',
})
for (const marker of [
  logoUrl,
  '@media only screen and (max-width:480px)',
  'Verify email address',
  '>123456<',
  'Expires in two hours',
]) {
  if (!challengeHtml.includes(marker)) throw new Error(`verification-actions: missing challenge email markup ${marker}.`)
}
for (const pattern of forbiddenPatterns) {
  if (pattern.test(challengeHtml)) throw new Error(`verification-actions: contains unsafe email markup (${pattern}).`)
}
if (Buffer.byteLength(challengeHtml, 'utf8') > 100_000) {
  throw new Error('verification-actions: exceeds the 100 KB email HTML budget.')
}
console.log(`OK verification-actions challenge email (${Buffer.byteLength(challengeHtml, 'utf8')} bytes)`)

const recoveryHtml = buildPasswordRecoveryEmailHtml({
  displayName: 'JuChess Player',
  code: '123456',
  recoveryUrl: 'https://juchess.page/forgot-password?challenge=template-check&token=template-check-token',
})
for (const marker of [
  logoUrl,
  '@media only screen and (max-width:480px)',
  'Reset JuChess password',
  '>123456<',
  'Expires in one hour',
]) {
  if (!recoveryHtml.includes(marker)) throw new Error(`verification-actions: missing recovery email markup ${marker}.`)
}
for (const pattern of forbiddenPatterns) {
  if (pattern.test(recoveryHtml)) throw new Error(`verification-actions: contains unsafe recovery email markup (${pattern}).`)
}
if (Buffer.byteLength(recoveryHtml, 'utf8') > 100_000) {
  throw new Error('verification-actions: recovery email exceeds the 100 KB HTML budget.')
}
console.log(`OK verification-actions recovery email (${Buffer.byteLength(recoveryHtml, 'utf8')} bytes)`)

console.log(`Validated ${templates.length + 2} JuChess email templates.`)
