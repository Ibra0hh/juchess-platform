import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import {
  Account,
  Client,
  ID,
  Messaging,
  Query,
  TablesDB,
  Users,
} from 'node-appwrite';

const tableId = 'email_verification_challenges';
export const VERIFICATION_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseBody(req) {
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  } catch {
    // Appwrite's bodyJson getter throws when a request has no JSON body.
  }
  if (req.body && typeof req.body === 'object') return req.body;
  const text = req.bodyText ?? req.bodyRaw ?? '';
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function routeSegments(path = '/') {
  return path.split('/').filter(Boolean);
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeVerificationCode(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashVerificationValue(kind, challengeId, value, secret) {
  return createHmac('sha256', secret)
    .update(`${kind}:${challengeId}:${String(value)}`)
    .digest('hex');
}

export function hashVerificationEmail(email, secret) {
  return createHmac('sha256', secret)
    .update(`email:${normalizeEmail(email)}`)
    .digest('hex');
}

export function secureHashMatches(actualHash, expectedHash) {
  if (!/^[a-f0-9]{64}$/i.test(String(actualHash)) || !/^[a-f0-9]{64}$/i.test(String(expectedHash))) {
    return false;
  }
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isVerificationChallengeExpired(challenge, nowMs = Date.now()) {
  const expiresAt = Date.parse(String(challenge?.expiresAt ?? ''));
  return !Number.isFinite(expiresAt) || nowMs >= expiresAt;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildVerificationEmailHtml({ displayName, code, verificationUrl }) {
  const safeName = escapeHtml(displayName || 'Player');
  const safeCode = escapeHtml(code);
  const safeUrl = escapeHtml(verificationUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verify your JuChess email</title>
  <style>
    @media only screen and (max-width:480px) {
      .email-gutter { padding:12px 8px !important; }
      .email-card { border-radius:6px !important; }
      .email-header { padding:18px 14px 17px !important; }
      .email-logo { width:58px !important; height:58px !important; margin-bottom:9px !important; }
      .email-brand { font-size:23px !important; line-height:27px !important; }
      .email-content { padding:23px 17px 22px !important; }
      .email-heading { font-size:24px !important; line-height:29px !important; }
      .email-body { font-size:14px !important; line-height:21px !important; }
      .email-cta-table { width:100% !important; }
      .email-cta-cell { width:100% !important; }
      .email-cta { display:block !important; padding:12px 14px !important; font-size:14px !important; line-height:18px !important; text-align:center !important; }
      .email-code { font-size:28px !important; line-height:34px !important; letter-spacing:6px !important; }
      .email-link, .email-link-label { font-size:11px !important; line-height:16px !important; }
      .email-footer { padding:17px 14px !important; }
      .email-footer p, .email-footer a { font-size:10.5px !important; line-height:16px !important; }
      .email-footer-separator { display:block !important; height:4px !important; font-size:0 !important; line-height:0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#efe8d8;color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Use the secure link or six-digit code to verify your JuChess email. Both expire in two hours.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#efe8d8;">
    <tr>
      <td class="email-gutter" align="center" style="padding:28px 12px;">
        <table class="email-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;background:#fffdf8;border:1px solid #d8ccb6;border-radius:8px;overflow:hidden;">
          <tr><td style="height:7px;background:#7a2431;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td class="email-header" align="center" style="padding:24px 22px 22px;background:#111111;">
              <img class="email-logo" src="https://juchess.page/email/juchess-email-logo.png" width="72" height="72" alt="JuChess crest" style="display:block;width:72px;height:72px;margin:0 auto 12px;border:0;">
              <div class="email-brand" style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:30px;font-weight:bold;color:#f8f3e7;">JuChess</div>
              <div style="padding-top:5px;font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#cdbf9f;">University of Jordan Chess Club</div>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:32px 34px 30px;background:#fffdf8;">
              <div style="margin-bottom:9px;font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7a2431;">Account security</div>
              <h1 class="email-heading" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:35px;color:#111111;">Verify your email</h1>
              <p class="email-body" style="margin:0 0 12px;font-size:15px;line-height:23px;color:#292621;">Hello ${safeName},</p>
              <p class="email-body" style="margin:0 0 22px;font-size:15px;line-height:23px;color:#514b42;">Choose either method below. Open the link on any phone or computer, or enter the six-digit code on the JuChess verification screen.</p>
              <table class="email-cta-table" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
                <tr><td class="email-cta-cell" align="center" bgcolor="#7a2431" style="border-radius:6px;"><a class="email-cta" href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 24px;border:1px solid #7a2431;border-radius:6px;font-size:14px;line-height:19px;font-weight:bold;text-decoration:none;color:#ffffff;">Verify email address</a></td></tr>
              </table>
              <div style="margin:0 0 8px;font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.1px;text-transform:uppercase;color:#7a2431;">Or enter this code</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 21px;background:#f6f0e3;border:1px solid #d8ccb6;border-radius:6px;">
                <tr><td class="email-code" align="center" style="padding:17px 10px;font-family:'Courier New',monospace;font-size:32px;line-height:38px;font-weight:bold;letter-spacing:8px;color:#111111;">${safeCode}</td></tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 22px;background:#f6f0e3;border-left:4px solid #a98a3f;">
                <tr><td style="padding:13px 14px;font-size:12.5px;line-height:19px;color:#514b42;"><strong style="color:#111111;">Expires in two hours.</strong> Requesting another email immediately disables this link and code. JuChess will never ask for your password by email.</td></tr>
              </table>
              <p class="email-link-label" style="margin:0 0 7px;font-size:11.5px;line-height:17px;color:#756d60;">If the button does not work, open this secure link:</p>
              <p class="email-link" style="margin:0;font-size:11.5px;line-height:17px;word-break:break-all;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#7a2431;text-decoration:underline;">${safeUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding:20px 24px;background:#181715;border-top:1px solid #2e2a25;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;line-height:17px;color:#d8ccb6;">JuChess / University of Jordan Chess Club / Amman</p>
              <p style="margin:0;font-size:11px;line-height:17px;"><a href="https://juchess.page/" style="color:#f8f3e7;text-decoration:none;">juchess.page</a><span class="email-footer-separator" style="color:#746d62;"> &nbsp;|&nbsp; </span><a href="mailto:Juchess180@gmail.com" style="color:#f8f3e7;text-decoration:none;">Contact the club</a><span class="email-footer-separator" style="color:#746d62;"> &nbsp;|&nbsp; </span><a href="https://www.instagram.com/ju.chess" style="color:#f8f3e7;text-decoration:none;">Instagram @ju.chess</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function requireSecret() {
  const secret = String(process.env.JUCHESS_VERIFICATION_SECRET ?? '');
  if (secret.length < 32) throw new HttpError(503, 'Email verification is not configured yet.');
  return secret;
}

async function requireAccount(req) {
  const jwt = req.headers['juchess-account-jwt'] || req.headers['x-appwrite-user-jwt'];
  if (!jwt) throw new HttpError(401, 'Sign in again before requesting a verification email.');

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);

  try {
    return await new Account(client).get();
  } catch {
    throw new HttpError(401, 'Sign in again before requesting a verification email.');
  }
}

async function listChallenges(tablesDB, databaseId, field, value) {
  const rows = [];
  let cursor = '';

  do {
    const queries = [Query.equal(field, value), Query.orderDesc('$createdAt'), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const response = await tablesDB.listRows({
      databaseId,
      tableId,
      queries,
      total: false,
    });
    const page = Array.isArray(response.rows) ? response.rows : [];
    rows.push(...page);
    cursor = page.length === 100 ? String(page.at(-1)?.$id ?? '') : '';
  } while (cursor);

  return rows.toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

async function invalidateActiveChallenges(tablesDB, databaseId, rows, consumedAt) {
  await Promise.all(rows
    .filter((row) => !row.consumedAt)
    .map((row) => tablesDB.updateRow({
      databaseId,
      tableId,
      rowId: row.$id,
      data: { consumedAt },
    })));
}

export async function createVerificationChallenge({ tablesDB, messaging, databaseId, user, secret, publicWebUrl }) {
  if (user.emailVerification) return { alreadyVerified: true, expiresAt: null };

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const existing = await listChallenges(tablesDB, databaseId, 'userId', user.$id);
  const newest = existing[0];
  if (newest && !newest.consumedAt && nowMs - Date.parse(newest.createdAt) < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, 'Wait a few seconds before requesting another verification email.');
  }
  const challengeId = ID.unique();
  const code = generateVerificationCode();
  const linkToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(nowMs + VERIFICATION_TTL_MS).toISOString();
  const messageId = `verify_${challengeId}`;
  const emailHash = hashVerificationEmail(user.email, secret);
  const verificationUrl = `${publicWebUrl.replace(/\/$/, '')}/verify-email?challenge=${encodeURIComponent(challengeId)}&token=${encodeURIComponent(linkToken)}`;

  await tablesDB.createRow({
    databaseId,
    tableId,
    rowId: challengeId,
    data: {
      userId: user.$id,
      emailHash,
      codeHash: hashVerificationValue('code', challengeId, code, secret),
      linkHash: hashVerificationValue('link', challengeId, linkToken, secret),
      expiresAt,
      attempts: 0,
      consumedAt: null,
      emailMessageId: messageId,
      createdAt: now,
    },
    permissions: [],
  });

  try {
    await messaging.createEmail({
      messageId,
      subject: 'Verify your JuChess email',
      content: buildVerificationEmailHtml({
        displayName: user.name,
        code,
        verificationUrl,
      }),
      users: [user.$id],
      draft: false,
      html: true,
    });
  } catch (cause) {
    await tablesDB.deleteRow({ databaseId, tableId, rowId: challengeId }).catch(() => undefined);
    throw cause;
  }

  // Keep the previous proof usable until Appwrite has accepted the replacement
  // email. A temporary messaging failure must never strand the player with no
  // working verification method.
  await invalidateActiveChallenges(tablesDB, databaseId, existing, now);

  return { alreadyVerified: false, expiresAt };
}

export function challengeMatchesCurrentEmail(challenge, user, secret) {
  return secureHashMatches(
    hashVerificationEmail(user?.email, secret),
    challenge?.emailHash,
  );
}

async function consumeChallenge(tablesDB, databaseId, challenge) {
  await tablesDB.updateRow({
    databaseId,
    tableId,
    rowId: challenge.$id,
    data: { consumedAt: new Date().toISOString() },
  });
}

async function completeChallenge(tablesDB, users, databaseId, challenge, secret) {
  const user = await users.get({ userId: challenge.userId });
  if (!challengeMatchesCurrentEmail(challenge, user, secret)) {
    await consumeChallenge(tablesDB, databaseId, challenge).catch(() => undefined);
    throw new HttpError(400, 'This verification link or code is invalid or expired. Request a fresh email.');
  }
  const alreadyVerified = Boolean(user.emailVerification);
  if (!alreadyVerified) {
    await users.updateEmailVerification({
      userId: challenge.userId,
      emailVerification: true,
    });
  }
  await consumeChallenge(tablesDB, databaseId, challenge);
  return { verified: true, alreadyVerified };
}

async function activeChallengeOrThrow(tablesDB, users, databaseId, challenge, secret) {
  if (challenge.consumedAt) {
    const user = await users.get({ userId: challenge.userId }).catch(() => null);
    if (user?.emailVerification && challengeMatchesCurrentEmail(challenge, user, secret)) {
      return { alreadyVerified: true };
    }
    throw new HttpError(400, 'This verification link or code is invalid or expired.');
  }
  if (isVerificationChallengeExpired(challenge)) {
    await tablesDB.updateRow({
      databaseId,
      tableId,
      rowId: challenge.$id,
      data: { consumedAt: new Date().toISOString() },
    }).catch(() => undefined);
    throw new HttpError(410, 'This verification link or code expired after two hours. Request a fresh email.');
  }
  return null;
}

export async function confirmLink({ tablesDB, users, databaseId, body, secret }) {
  const challengeId = String(body.challengeId ?? '').trim();
  const token = String(body.token ?? '').trim();
  if (!/^[a-zA-Z0-9._-]{1,36}$/.test(challengeId) || token.length < 32 || token.length > 200) {
    throw new HttpError(400, 'This verification link or code is invalid or expired.');
  }

  const challenge = await tablesDB.getRow({ databaseId, tableId, rowId: challengeId })
    .catch(() => null);
  if (!challenge) throw new HttpError(400, 'This verification link or code is invalid or expired.');
  const actualHash = hashVerificationValue('link', challengeId, token, secret);
  if (!secureHashMatches(actualHash, challenge.linkHash)) {
    throw new HttpError(400, 'This verification link or code is invalid or expired.');
  }
  const inactive = await activeChallengeOrThrow(tablesDB, users, databaseId, challenge, secret);
  if (inactive?.alreadyVerified) return { verified: true, alreadyVerified: true };
  return await completeChallenge(tablesDB, users, databaseId, challenge, secret);
}

export async function confirmCode({ tablesDB, users, databaseId, body, secret }) {
  const email = normalizeEmail(body.email);
  const code = normalizeVerificationCode(body.code);
  if (!email || !/^\d{6}$/.test(code)) {
    throw new HttpError(400, 'Enter the email address and six-digit code from your latest JuChess email.');
  }

  const rows = await listChallenges(tablesDB, databaseId, 'emailHash', hashVerificationEmail(email, secret));
  const challenge = rows.find((row) => !row.consumedAt) ?? rows[0] ?? null;
  if (!challenge) throw new HttpError(400, 'This verification link or code is invalid or expired.');
  const actualHash = hashVerificationValue('code', challenge.$id, code, secret);
  if (!secureHashMatches(actualHash, challenge.codeHash)) {
    if (challenge.consumedAt || isVerificationChallengeExpired(challenge)) {
      throw new HttpError(400, 'This verification link or code is invalid or expired.');
    }
    if (Number(challenge.attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many incorrect attempts. Request a fresh verification email.');
    }
    const attempts = Number(challenge.attempts ?? 0) + 1;
    await tablesDB.updateRow({
      databaseId,
      tableId,
      rowId: challenge.$id,
      data: {
        attempts,
        consumedAt: attempts >= MAX_CODE_ATTEMPTS ? new Date().toISOString() : null,
      },
    });
    throw new HttpError(400, attempts >= MAX_CODE_ATTEMPTS
      ? 'Too many incorrect attempts. Request a fresh verification email.'
      : 'This verification link or code is invalid or expired.');
  }

  const inactive = await activeChallengeOrThrow(tablesDB, users, databaseId, challenge, secret);
  if (inactive?.alreadyVerified) return { verified: true, alreadyVerified: true };
  return await completeChallenge(tablesDB, users, databaseId, challenge, secret);
}

export default async ({ req, res, log, error }) => {
  const serverClient = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const tablesDB = new TablesDB(serverClient);
  const users = new Users(serverClient);
  const messaging = new Messaging(serverClient);
  const databaseId = process.env.JUCHESS_DATABASE_ID ?? 'juchess';
  const publicWebUrl = process.env.JUCHESS_PUBLIC_WEB_URL ?? 'https://juchess.page';
  const method = req.method.toUpperCase();
  const path = req.path || '/';
  const segments = routeSegments(path);
  const body = parseBody(req);

  if (method === 'GET' && segments.length === 0) {
    return res.json({
      ok: true,
      service: 'juchess-verification-actions',
      expiresInSeconds: VERIFICATION_TTL_MS / 1000,
      routes: ['POST /send', 'POST /confirm-link', 'POST /confirm-code'],
    });
  }

  try {
    const secret = requireSecret();
    if (method === 'POST' && segments[0] === 'send') {
      const user = await requireAccount(req);
      const result = await createVerificationChallenge({
        tablesDB,
        messaging,
        databaseId,
        user,
        secret,
        publicWebUrl,
      });
      if (!result.alreadyVerified) log('Sent one two-hour email verification challenge.');
      return res.json({ ok: true, ...result });
    }
    if (method === 'POST' && segments[0] === 'confirm-link') {
      const result = await confirmLink({ tablesDB, users, databaseId, body, secret });
      log('Completed an email verification challenge by link.');
      return res.json({ ok: true, ...result });
    }
    if (method === 'POST' && segments[0] === 'confirm-code') {
      const result = await confirmCode({ tablesDB, users, databaseId, body, secret });
      log('Completed an email verification challenge by code.');
      return res.json({ ok: true, ...result });
    }
    return res.json({ ok: false, error: `No verification action for ${method} ${path}` }, 404);
  } catch (caught) {
    if (!(caught instanceof HttpError)) error(caught?.message ?? String(caught));
    return res.json({
      ok: false,
      error: caught instanceof HttpError
        ? caught.message
        : 'Email verification could not be completed right now.',
    }, caught instanceof HttpError ? caught.statusCode : 500);
  }
};
