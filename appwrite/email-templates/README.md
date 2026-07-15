# JuChess authentication email templates

These templates are designed for Appwrite Auth and use only Appwrite-supported
message variables:

- `{{project}}`
- `{{user}}`
- `{{redirect}}`

## Appwrite fields

### Account verification

- Sender name: `JuChess`
- Sender email: `no-reply@juchess.page`
- Reply to: `Juchess180@gmail.com`
- Subject: `Verify your JuChess email`
- Message: paste `account-verification.html`

### Password recovery

- Sender name: `JuChess`
- Sender email: `no-reply@juchess.page`
- Reply to: `Juchess180@gmail.com`
- Subject: `Reset your JuChess password`
- Message: paste `password-recovery.html`

## Activation requirement

Appwrite Cloud's built-in SMTP service sends generic authentication emails and
does not allow custom templates. Configure a custom SMTP server in the Appwrite
project first, authenticate `juchess.page` with that provider, then paste these
templates in **Auth > Templates**.

The logo is served from:

`https://juchess.page/email/juchess-email-logo.png`

Keep this URL stable because previously delivered emails may load it later.

Run `npm run check:email-templates` before deploying template changes.
