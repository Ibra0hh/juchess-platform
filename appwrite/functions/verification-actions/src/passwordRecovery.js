import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { ID, Query } from 'node-appwrite';

const tableId = 'password_recovery_challenges';
export const PASSWORD_RECOVERY_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RECOVERY_MAX_ATTEMPTS = 5;
export const PASSWORD_RECOVERY_RESEND_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RECOVERY_HOURLY_LIMIT = 10;
const UNIFORM_RESPONSE_FLOOR_MS = 600;

export class RecoveryHttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function normalizeRecoveryEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeRecoveryCode(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function generateRecoveryCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashRecoveryValue(kind, challengeId, value, secret) {
  return createHmac('sha256', secret)
    .update(`password-recovery:${kind}:${challengeId}:${String(value)}`)
    .digest('hex');
}

export function hashRecoveryIdentity(kind, value, secret) {
  return createHmac('sha256', secret)
    .update(`password-recovery:${kind}:${String(value)}`)
    .digest('hex');
}

export function recoveryHashMatches(actualHash, expectedHash) {
  if (!/^[a-f0-9]{64}$/i.test(String(actualHash)) || !/^[a-f0-9]{64}$/i.test(String(expectedHash))) {
    return false;
  }
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isRecoveryChallengeExpired(challenge, nowMs = Date.now()) {
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

export function buildPasswordRecoveryEmailHtml({ displayName, code, recoveryUrl }) {
  const safeName = escapeHtml(displayName || 'Player');
  const safeCode = escapeHtml(code);
  const safeUrl = escapeHtml(recoveryUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset your JuChess password</title>
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
      .email-cta-table, .email-cta-cell { width:100% !important; }
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Use the secure link or six-digit code to reset your JuChess password. Both expire in one hour.</div>
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
              <h1 class="email-heading" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:35px;color:#111111;">Reset your password</h1>
              <p class="email-body" style="margin:0 0 12px;font-size:15px;line-height:23px;color:#292621;">Hello ${safeName},</p>
              <p class="email-body" style="margin:0 0 22px;font-size:15px;line-height:23px;color:#514b42;">Choose either method below. Open the secure button on any device, or enter the six-digit code on the JuChess password-reset screen.</p>
              <table class="email-cta-table" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
                <tr><td class="email-cta-cell" align="center" bgcolor="#7a2431" style="border-radius:6px;"><a class="email-cta" href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 24px;border:1px solid #7a2431;border-radius:6px;font-size:14px;line-height:19px;font-weight:bold;text-decoration:none;color:#ffffff;">Reset JuChess password</a></td></tr>
              </table>
              <div style="margin:0 0 8px;font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.1px;text-transform:uppercase;color:#7a2431;">Or enter this code</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 21px;background:#f6f0e3;border:1px solid #d8ccb6;border-radius:6px;">
                <tr><td class="email-code" align="center" style="padding:17px 10px;font-family:'Courier New',monospace;font-size:32px;line-height:38px;font-weight:bold;letter-spacing:8px;color:#111111;">${safeCode}</td></tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 22px;background:#f6f0e3;border-left:4px solid #a98a3f;">
                <tr><td style="padding:13px 14px;font-size:12.5px;line-height:19px;color:#514b42;"><strong style="color:#111111;">Expires in one hour.</strong> Requesting another email disables the previous link and code. If you did not request this, you can safely ignore it.</td></tr>
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

function validateEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    throw new RecoveryHttpError(400, 'Use 8 to 256 characters for your new password.');
  }
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new RecoveryHttpError(400, 'Use at least one uppercase letter and one number in your new password.');
  }
}

async function listChallenges(tablesDB, databaseId, field, value) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal(field, value),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ],
    total: false,
  });
  return Array.isArray(response.rows) ? response.rows : [];
}

function createdWithin(row, durationMs, nowMs) {
  const createdAt = Date.parse(String(row?.createdAt ?? ''));
  return Number.isFinite(createdAt) && nowMs - createdAt < durationMs;
}

function isRateLimited(emailRows, ipRows, nowMs) {
  const newest = emailRows[0];
  if (newest && createdWithin(newest, PASSWORD_RECOVERY_RESEND_COOLDOWN_MS, nowMs)) return true;
  const emailCount = emailRows.filter((row) => createdWithin(row, PASSWORD_RECOVERY_TTL_MS, nowMs)).length;
  const ipCount = ipRows.filter((row) => createdWithin(row, PASSWORD_RECOVERY_TTL_MS, nowMs)).length;
  return emailCount >= PASSWORD_RECOVERY_HOURLY_LIMIT || ipCount >= PASSWORD_RECOVERY_HOURLY_LIMIT;
}

async function waitForUniformResponse(startedAt) {
  const remaining = UNIFORM_RESPONSE_FLOOR_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

function exactCurrentEmailTarget(user) {
  const email = normalizeRecoveryEmail(user?.email);
  return Array.isArray(user?.targets)
    ? user.targets.find((target) => (
        target?.providerType === 'email'
        && !target.expired
        && normalizeRecoveryEmail(target.identifier) === email
      )) ?? null
    : null;
}

function rowData(challenge) {
  return {
    userId: challenge.userId,
    emailHash: challenge.emailHash,
    ipHash: challenge.ipHash,
    codeHash: challenge.codeHash,
    linkHash: challenge.linkHash,
    expiresAt: challenge.expiresAt,
    attempts: Number(challenge.attempts ?? 0),
    consumedAt: challenge.consumedAt ?? null,
    emailMessageId: challenge.emailMessageId,
    createdAt: challenge.createdAt,
  };
}

export async function requestPasswordRecovery({
  tablesDB,
  users,
  messaging,
  databaseId,
  body,
  secret,
  publicWebUrl,
  clientIp,
}) {
  const startedAt = Date.now();
  const email = normalizeRecoveryEmail(body.email);
  if (!validateEmail(email)) {
    throw new RecoveryHttpError(400, 'Enter a valid email address.');
  }

  const emailHash = hashRecoveryIdentity('email', email, secret);
  const effectiveIp = String(clientIp || `email:${emailHash}`);
  const ipHash = hashRecoveryIdentity('ip', effectiveIp, secret);
  const nowMs = Date.now();
  const [emailRows, ipRows] = await Promise.all([
    listChallenges(tablesDB, databaseId, 'emailHash', emailHash),
    listChallenges(tablesDB, databaseId, 'ipHash', ipHash),
  ]);

  if (isRateLimited(emailRows, ipRows, nowMs)) {
    await waitForUniformResponse(startedAt);
    return { accepted: true };
  }

  const listed = await users.list({
    queries: [Query.equal('email', email), Query.limit(1)],
    total: false,
  });
  const user = Array.isArray(listed.users) ? listed.users[0] : null;
  const target = user ? exactCurrentEmailTarget(user) : null;

  // Recovery is intentionally limited to accounts that already have a local
  // password. A Google-only account must continue with Google instead of
  // silently gaining a second sign-in method.
  if (!user || !user.status || !user.password || !target) {
    await waitForUniformResponse(startedAt);
    return { accepted: true };
  }

  const challengeId = ID.unique();
  const code = generateRecoveryCode();
  const linkToken = randomBytes(32).toString('base64url');
  const now = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + PASSWORD_RECOVERY_TTL_MS).toISOString();
  const messageId = `recover_${challengeId}`;
  const recoveryUrl = `${publicWebUrl.replace(/\/$/, '')}/forgot-password?challenge=${encodeURIComponent(challengeId)}&token=${encodeURIComponent(linkToken)}`;

  await tablesDB.createRow({
    databaseId,
    tableId,
    rowId: challengeId,
    data: {
      userId: user.$id,
      emailHash,
      ipHash,
      codeHash: hashRecoveryValue('code', challengeId, code, secret),
      linkHash: hashRecoveryValue('link', challengeId, linkToken, secret),
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
      subject: 'Reset your JuChess password',
      content: buildPasswordRecoveryEmailHtml({
        displayName: user.name,
        code,
        recoveryUrl,
      }),
      targets: [target.$id],
      draft: false,
      html: true,
    });
  } catch (cause) {
    await tablesDB.deleteRow({ databaseId, tableId, rowId: challengeId }).catch(() => undefined);
    throw cause;
  }

  const consumedAt = new Date().toISOString();
  await Promise.all(emailRows
    .filter((row) => !row.consumedAt)
    .map((row) => tablesDB.updateRow({
      databaseId,
      tableId,
      rowId: row.$id,
      data: { consumedAt },
    })));
  await waitForUniformResponse(startedAt);
  return { accepted: true };
}

async function consumeExpired(tablesDB, databaseId, challenge) {
  await tablesDB.updateRow({
    databaseId,
    tableId,
    rowId: challenge.$id,
    data: { consumedAt: new Date().toISOString() },
  }).catch(() => undefined);
}

async function activeChallengeOrThrow({ tablesDB, users, databaseId, challenge, secret }) {
  if (!challenge || challenge.consumedAt) {
    throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  }
  if (isRecoveryChallengeExpired(challenge)) {
    await consumeExpired(tablesDB, databaseId, challenge);
    throw new RecoveryHttpError(410, 'This recovery link or code expired after one hour. Request a fresh email.');
  }
  const user = await users.get({ userId: challenge.userId }).catch(() => null);
  const currentEmailHash = hashRecoveryIdentity('email', normalizeRecoveryEmail(user?.email), secret);
  if (!user || !user.status || !user.password || !recoveryHashMatches(currentEmailHash, challenge.emailHash)) {
    await consumeExpired(tablesDB, databaseId, challenge);
    throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  }
  return user;
}

async function restoreClaim(tablesDB, databaseId, challenge) {
  await tablesDB.createRow({
    databaseId,
    tableId,
    rowId: challenge.$id,
    data: rowData(challenge),
    permissions: [],
  }).catch(() => undefined);
}

async function claimAndReset({ tablesDB, users, databaseId, challenge, user, password, secret }) {
  let stage = 'prepare';
  try {
    await tablesDB.deleteRow({ databaseId, tableId, rowId: challenge.$id });
  } catch {
    throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  }

  try {
    const currentUser = await users.get({ userId: user.$id });
    const currentEmailHash = hashRecoveryIdentity('email', normalizeRecoveryEmail(currentUser?.email), secret);
    if (!currentUser.status || !currentUser.password || !recoveryHashMatches(currentEmailHash, challenge.emailHash)) {
      throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
    }

    // Invalidate every older proof before changing the password. If this
    // operation cannot finish, the selected proof is restored and the
    // credential remains unchanged.
    const remaining = await listChallenges(tablesDB, databaseId, 'userId', currentUser.$id);
    const consumedAt = new Date().toISOString();
    await Promise.all(remaining
      .filter((row) => !row.consumedAt)
      .map((row) => tablesDB.updateRow({
        databaseId,
        tableId,
        rowId: row.$id,
        data: { consumedAt },
      })));

    // Remove existing sessions before changing the credential so a transient
    // revocation failure can never leave the new password active beside an
    // old session. A rejected password restores the still-valid proof.
    stage = 'sessions';
    await users.deleteSessions({ userId: currentUser.$id });
    stage = 'password';
    await users.updatePassword({ userId: currentUser.$id, password });
  } catch (cause) {
    if (!(cause instanceof RecoveryHttpError)) {
      await restoreClaim(tablesDB, databaseId, challenge);
    }
    if (cause instanceof RecoveryHttpError) throw cause;
    if (stage === 'password' && Number(cause?.code ?? 0) >= 400 && Number(cause?.code ?? 0) < 500) {
      throw new RecoveryHttpError(400, 'Choose a different password that meets the JuChess security requirements.');
    }
    throw cause;
  }

  return { reset: true };
}

export async function confirmPasswordRecoveryLink({ tablesDB, users, databaseId, body, secret }) {
  const challengeId = String(body.challengeId ?? '').trim();
  const token = String(body.token ?? '').trim();
  const password = body.password;
  validatePassword(password);
  if (!/^[a-zA-Z0-9._-]{1,36}$/.test(challengeId) || token.length < 32 || token.length > 200) {
    throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  }
  const challenge = await tablesDB.getRow({ databaseId, tableId, rowId: challengeId }).catch(() => null);
  if (!challenge || !recoveryHashMatches(
    hashRecoveryValue('link', challengeId, token, secret),
    challenge.linkHash,
  )) {
    throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  }
  const user = await activeChallengeOrThrow({ tablesDB, users, databaseId, challenge, secret });
  return await claimAndReset({ tablesDB, users, databaseId, challenge, user, password, secret });
}

export async function confirmPasswordRecoveryCode({ tablesDB, users, databaseId, body, secret }) {
  const email = normalizeRecoveryEmail(body.email);
  const code = normalizeRecoveryCode(body.code);
  const password = body.password;
  validatePassword(password);
  if (!validateEmail(email) || !/^\d{6}$/.test(code)) {
    throw new RecoveryHttpError(400, 'Enter the email address and six-digit code from your latest JuChess email.');
  }
  const emailHash = hashRecoveryIdentity('email', email, secret);
  const rows = await listChallenges(tablesDB, databaseId, 'emailHash', emailHash);
  const challenge = rows.find((row) => !row.consumedAt) ?? null;
  if (!challenge) throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  const user = await activeChallengeOrThrow({ tablesDB, users, databaseId, challenge, secret });

  let attempted;
  try {
    attempted = await tablesDB.incrementRowColumn({
      databaseId,
      tableId,
      rowId: challenge.$id,
      column: 'attempts',
      value: 1,
      max: PASSWORD_RECOVERY_MAX_ATTEMPTS,
    });
  } catch {
    await consumeExpired(tablesDB, databaseId, challenge);
    throw new RecoveryHttpError(429, 'Too many incorrect attempts. Request a fresh recovery email.');
  }

  const matches = recoveryHashMatches(
    hashRecoveryValue('code', challenge.$id, code, secret),
    challenge.codeHash,
  );
  if (!matches) {
    if (Number(attempted.attempts ?? 0) >= PASSWORD_RECOVERY_MAX_ATTEMPTS) {
      await consumeExpired(tablesDB, databaseId, attempted);
      throw new RecoveryHttpError(429, 'Too many incorrect attempts. Request a fresh recovery email.');
    }
    throw new RecoveryHttpError(400, 'This recovery link or code is invalid or expired.');
  }

  return await claimAndReset({
    tablesDB,
    users,
    databaseId,
    challenge: attempted,
    user,
    password,
    secret,
  });
}
