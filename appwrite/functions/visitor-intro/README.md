# Visitor intro

Create the private `visitor_intro` table in the `juchess` database, with no client
permissions, row security off, and a required boolean `completed` column. Deploy this folder as
`visitor-intro` using Node 22, `src/main.js`, and `npm ci`. Grant execute access
to `any`, with dynamic key scopes `rows.read` and `rows.write`, and disable
execution logging. Set `JUCHESS_VISITOR_INTRO_SECRET` as a secret function
variable containing 32 random bytes encoded as 64 hex characters.

The public home page uses POST `/status` and POST `/complete`. Appwrite supplies
the address in `x-appwrite-client-ip`; the function stores only a keyed digest
as the row ID. Do not pass an address from the browser. The digest is specific
to this intro and is not associated with a profile. People sharing a public
IP share the completion marker. Rotating the secret resets network matching;
clearing the table retires the old markers. The browser marker is independent.

This is a welcome interaction, not an authentication or authorization check.
