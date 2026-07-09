import { Account, Client, ID, Permission, Query, Role, TablesDB, Teams, Users } from 'node-appwrite';

const tableIds = {
  adminProfiles: 'admin_profiles',
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  adminAudit: 'admin_audit',
  identityBlocks: 'identity_blocks',
  ipBlocks: 'ip_blocks',
};

const adminTeamIds = {
  superAdmins: 'admin_super_admins',
  staff: 'admin_staff',
};

function parseBody(req) {
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') {
      return req.bodyJson;
    }
  } catch {
    // Appwrite's bodyJson getter throws when a request has no JSON body.
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const text = req.bodyText ?? req.bodyRaw ?? '';
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function normalizeBracketSnapshot(value) {
  if (value === undefined || value === null || value === '') return null;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!['single', 'double'].includes(parsed.type)) return null;
    return serialized;
  } catch {
    return null;
  }
}

function routeSegments(path = '/') {
  return path.split('/').filter(Boolean);
}

function badRequest(res, message, details = {}) {
  return res.json({ ok: false, error: message, ...details }, 400);
}

function notFound(res, method, path) {
  return res.json({ ok: false, error: `No admin action for ${method} ${path}` }, 404);
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function requireFields(body, fields) {
  return fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
}

function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const compact = raw.replace(/[^\d+]/g, '');
  if (compact.startsWith('+962')) return `+962${compact.slice(4).replace(/\D/g, '')}`;
  if (compact.startsWith('00962')) return `+962${compact.slice(5).replace(/\D/g, '')}`;
  if (compact.startsWith('962')) return `+962${compact.slice(3).replace(/\D/g, '')}`;

  const digits = compact.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+962${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `+962${digits}`;
  return raw;
}

function normalizeIdentityValue(type, value) {
  if (type === 'email') return String(value ?? '').trim().toLowerCase();
  if (type === 'universityId') return String(value ?? '').trim().toLowerCase();
  if (type === 'phone') return normalizePhone(value);
  return String(value ?? '').trim();
}

function actorProfileId(req, body, actor) {
  return body.actorProfileId || actor?.$id || req.headers['x-appwrite-user-id'] || 'system';
}

function generateCheckInCode() {
  // Unambiguous alphabet: no 0/O, 1/I/L so staff can read codes aloud at the venue.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `JU-${code}`;
}

function normalizeResult(value) {
  const result = String(value ?? '').trim();
  if (result === 'Live' || result === 'live' || result === '*') return '*';
  if (['1-0', '0-1', '1/2-1/2'].includes(result)) return result;
  return null;
}

function statusForResult(result, requestedStatus) {
  if (requestedStatus && ['scheduled', 'live', 'completed', 'forfeit'].includes(requestedStatus)) {
    return requestedStatus;
  }

  return result === '*' ? 'live' : 'completed';
}

function normalizeTournamentFormat(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function isSingleEliminationTournament(tournament) {
  const format = normalizeTournamentFormat(tournament.format);
  return format.includes('single elimination') || format.includes('knockout');
}

function isRoundRobinTournament(tournament) {
  const format = normalizeTournamentFormat(tournament.format);
  return format === 'round robin' || format === 'double round robin';
}

function isDoubleRoundRobinTournament(tournament) {
  return normalizeTournamentFormat(tournament.format) === 'double round robin';
}

function isGameDecided(game) {
  return game.status === 'completed' && ['1-0', '0-1', '1/2-1/2'].includes(game.result);
}

function decisiveWinnerProfileId(game) {
  if (game.result === '1-0') return game.whiteProfileId;
  if (game.result === '0-1') return game.blackProfileId;
  return null;
}

function compareRegistrationSeeds(a, b) {
  return (Number(a.seed) || 9999) - (Number(b.seed) || 9999)
    || String(a.$createdAt || '').localeCompare(String(b.$createdAt || ''))
    || String(a.profileId || '').localeCompare(String(b.profileId || ''));
}

function splitSeededPairings(profileIds) {
  const half = Math.ceil(profileIds.length / 2);
  return profileIds.slice(0, half).flatMap((whiteProfileId, index) => {
    const blackProfileId = profileIds[index + half];
    if (!blackProfileId || whiteProfileId === blackProfileId) return [];
    return [{ whiteProfileId, blackProfileId, board: index + 1 }];
  });
}

function buildRoundRobinSchedule(profileIds, doubleCycle = false) {
  if (profileIds.length < 2) return [];

  const entrants = profileIds.length % 2 === 0 ? [...profileIds] : [...profileIds, null];
  let rotation = [...entrants];
  const roundCount = entrants.length - 1;
  const games = [];

  for (let round = 1; round <= roundCount; round += 1) {
    let board = 1;
    for (let index = 0; index < entrants.length / 2; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first && second && first !== second) {
        games.push({
          round,
          board,
          whiteProfileId: round % 2 === 0 ? second : first,
          blackProfileId: round % 2 === 0 ? first : second,
        });
        board += 1;
      }
    }

    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }

  if (!doubleCycle) return games;

  return [
    ...games,
    ...games.map((game) => ({
      round: game.round + roundCount,
      board: game.board,
      whiteProfileId: game.blackProfileId,
      blackProfileId: game.whiteProfileId,
    })),
  ];
}

function isDoubleEliminationTournament(tournament) {
  return normalizeTournamentFormat(tournament.format).includes('double elimination');
}

function isKnockoutTournament(tournament) {
  return isSingleEliminationTournament(tournament) || isDoubleEliminationTournament(tournament);
}

function isSwissTournament(tournament) {
  return normalizeTournamentFormat(tournament.format) === 'swiss';
}

function isMultiStageTournament(tournament) {
  const format = normalizeTournamentFormat(tournament.format);
  return format.includes('multi stage') || format.includes('multistage');
}

function isArenaTournament(tournament) {
  return normalizeTournamentFormat(tournament.format) === 'arena';
}

const SYSTEM_BYE_PROFILE_ID = 'system_bye';

async function ensureSystemByeProfile(tablesDB, databaseId) {
  try {
    await tablesDB.getRow({ databaseId, tableId: tableIds.profiles, rowId: SYSTEM_BYE_PROFILE_ID });
  } catch {
    await tablesDB.createRow({
      databaseId,
      tableId: tableIds.profiles,
      rowId: SYSTEM_BYE_PROFILE_ID,
      data: {
        accountId: SYSTEM_BYE_PROFILE_ID,
        displayName: 'Bye',
        email: 'bye@juchess.internal',
        rating: 0,
        role: 'member',
        status: 'active',
      },
      permissions: [Permission.read(Role.any())],
    });
  }
  return SYSTEM_BYE_PROFILE_ID;
}

// ---------------------------------------------------------------------------
// Knockout structure engine (single + double elimination)
//
// A bracket is a deterministic function of the ordered entrant list. Rounds are
// emitted in play order; every match slot is either an entrant index, a bye
// (null), or a reference to the winner/loser of an earlier emitted match:
//   { e: index } | { win: [roundIndex, matchIndex] } | { lose: [roundIndex, matchIndex] } | null
// Game rows map onto structural rounds that contain at least one real match,
// numbered sequentially from 1 in play order; boards number real matches only.
// ---------------------------------------------------------------------------

function bracketSizeFor(count) {
  let size = 1;
  while (size < count) size *= 2;
  return Math.max(2, size);
}

function bracketStageName(playersInRound) {
  if (playersInRound === 2) return 'Final';
  if (playersInRound === 4) return 'Semifinal';
  if (playersInRound === 8) return 'Quarterfinal';
  return `Round of ${playersInRound}`;
}

function bracketRoundCode(label) {
  const qualifier = /qualifier/i.test(label);
  if (/quarterfinal/i.test(label)) return qualifier ? 'QFQ' : 'QF';
  if (/semifinal/i.test(label)) return qualifier ? 'SFQ' : 'SF';
  if (/grand final/i.test(label)) return 'GF';
  if (/final/i.test(label)) return qualifier ? 'FQ' : 'F';
  const count = /round of\s*(\d+)/i.exec(label)?.[1];
  if (count) return qualifier ? `R${count}Q` : `R${count}`;
  return label.replace(/[^A-Za-z0-9]+/g, '').slice(0, 6) || 'R';
}

function lowerBracketLabelsFromWinnerRounds(winnerRoundLabels) {
  const stages = winnerRoundLabels
    .slice(1, -1)
    .map((label) => label.replace(/^W[-\s]*/i, '').trim())
    .filter(Boolean);
  if (!stages.length) return [];
  return [
    ...stages.flatMap((stage) => [`${stage} Qualifier`, stage]),
    'Final Qualifier',
  ];
}

function openingKnockoutPairs(entrantCount) {
  const size = bracketSizeFor(entrantCount);
  const matchCount = size / 2;
  const byeCount = Math.max(0, size - entrantCount);
  const pairs = [];
  let cursor = 0;

  for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
    const a = cursor < entrantCount ? { e: cursor++ } : null;
    const b = matchIndex >= matchCount - byeCount
      ? null
      : cursor < entrantCount ? { e: cursor++ } : null;
    pairs.push({ a, b });
  }

  return pairs;
}

function buildKnockoutStructure(entrantCount, double) {
  const rounds = [];
  const winnersIndices = [];
  const size = bracketSizeFor(entrantCount);
  const winnersLevelCount = Math.max(1, Math.log2(size));

  const winnerRoundName = (matchCount) => `${double && entrantCount >= 3 ? 'W-' : ''}${bracketStageName(matchCount * 2)}`;
  const emitWinnersRound = (matches) => {
    rounds.push({ side: 'w', name: winnerRoundName(matches.length), matches });
    winnersIndices.push(rounds.length - 1);
    return rounds.length - 1;
  };
  const nextWinnersMatches = (previousIndex, count) => {
    const matches = [];
    for (let m = 0; m < count; m += 1) {
      matches.push({ a: { win: [previousIndex, 2 * m] }, b: { win: [previousIndex, 2 * m + 1] } });
    }
    return matches;
  };

  if (!double || entrantCount < 3) {
    let current = openingKnockoutPairs(entrantCount);
    let previousIndex = emitWinnersRound(current);
    while (current.length > 1) {
      current = nextWinnersMatches(previousIndex, current.length / 2);
      previousIndex = emitWinnersRound(current);
    }
    return { rounds, winnersIndices, losersIndices: [], finalsIndices: [] };
  }

  // Double elimination: interleave winners and losers rounds in play order so
  // game round numbers follow the order matches are actually played.
  const losersIndices = [];
  const winnerLabels = [];
  for (let level = 0, matches = size / 2; level < winnersLevelCount; level += 1, matches /= 2) {
    winnerLabels.push(winnerRoundName(matches));
  }
  const preferredLabels = lowerBracketLabelsFromWinnerRounds(winnerLabels);
  let labelCursor = 0;
  const nextLoserLabel = () => preferredLabels[labelCursor++] ?? `L-Round ${labelCursor}`;

  const structuralLosersOf = (roundIndex) => rounds[roundIndex].matches
    .map((match, matchIndex) => ({ match, matchIndex }))
    .filter(({ match }) => match.a !== null && match.b !== null)
    .map(({ matchIndex }) => ({ lose: [roundIndex, matchIndex] }));

  let pool = [];

  const reducePool = () => {
    if (pool.length < 2) return;
    const pairable = pool.length % 2 === 0 ? pool : pool.slice(0, -1);
    const carry = pool.length % 2 === 0 ? [] : [pool[pool.length - 1]];
    const matches = [];
    for (let index = 0; index + 1 < pairable.length; index += 2) {
      matches.push({ a: pairable[index], b: pairable[index + 1] });
    }
    rounds.push({ side: 'l', name: nextLoserLabel(), matches });
    const roundIndex = rounds.length - 1;
    losersIndices.push(roundIndex);
    pool = [
      ...matches.map((_, matchIndex) => ({ win: [roundIndex, matchIndex] })),
      ...carry,
    ];
  };

  const pairDropIns = (incoming) => {
    if (!incoming.length) return;
    if (!pool.length) {
      pool = [...incoming];
      return;
    }
    const pairCount = Math.min(pool.length, incoming.length);
    const matches = [];
    for (let index = 0; index < pairCount; index += 1) {
      matches.push({ a: pool[index], b: incoming[index] });
    }
    rounds.push({ side: 'l', name: nextLoserLabel(), matches });
    const roundIndex = rounds.length - 1;
    losersIndices.push(roundIndex);
    pool = [
      ...matches.map((_, matchIndex) => ({ win: [roundIndex, matchIndex] })),
      ...pool.slice(pairCount),
      ...incoming.slice(pairCount),
    ];
  };

  let currentMatches = openingKnockoutPairs(entrantCount);
  let previousWinnersIndex = emitWinnersRound(currentMatches);
  pool = structuralLosersOf(previousWinnersIndex);

  for (let level = 1; level < winnersLevelCount; level += 1) {
    const isFinalLevel = level === winnersLevelCount - 1;
    if (isFinalLevel) {
      // Give the losers bracket time to catch up before the winners final.
      while (pool.length > 1) reducePool();
      currentMatches = nextWinnersMatches(previousWinnersIndex, currentMatches.length / 2);
      previousWinnersIndex = emitWinnersRound(currentMatches);
      break;
    }

    reducePool();
    currentMatches = nextWinnersMatches(previousWinnersIndex, currentMatches.length / 2);
    previousWinnersIndex = emitWinnersRound(currentMatches);
    pairDropIns(structuralLosersOf(previousWinnersIndex));
  }
  while (pool.length > 1) reducePool();

  const winnersFinalIndex = previousWinnersIndex;
  const losersChampionRef = pool[0] ?? null;
  rounds.push({
    side: 'l',
    name: 'Final',
    matches: [{ a: { lose: [winnersFinalIndex, 0] }, b: losersChampionRef }],
  });
  losersIndices.push(rounds.length - 1);
  const losersFinalIndex = rounds.length - 1;

  rounds.push({
    side: 'f',
    name: 'Grand Final',
    matches: [{ a: { win: [winnersFinalIndex, 0] }, b: { win: [losersFinalIndex, 0] } }],
  });
  const finalsIndices = [rounds.length - 1];

  return { rounds, winnersIndices, losersIndices, finalsIndices };
}

function knockoutGameRoundMap(structure) {
  // Structural round index -> game round number (1-based), for rounds with real matches.
  const map = new Map();
  let gameRound = 0;
  structure.rounds.forEach((round, index) => {
    const hasReal = round.matches.some((match) => match.a !== null && match.b !== null);
    if (hasReal) {
      gameRound += 1;
      map.set(index, gameRound);
    }
  });
  return map;
}

function knockoutResolver(structure, entrants, games) {
  const roundMap = knockoutGameRoundMap(structure);
  const gamesByKey = new Map();
  for (const game of games) {
    gamesByKey.set(`${Number(game.round)}:${Number(game.board)}`, game);
  }

  const boardOf = (roundIndex, matchIndex) => {
    const matches = structure.rounds[roundIndex].matches;
    let board = 0;
    for (let index = 0; index <= matchIndex; index += 1) {
      const match = matches[index];
      if (match.a !== null && match.b !== null) board += 1;
    }
    return board;
  };

  const gameFor = (roundIndex, matchIndex) => {
    const gameRound = roundMap.get(roundIndex);
    if (!gameRound) return null;
    return gamesByKey.get(`${gameRound}:${boardOf(roundIndex, matchIndex)}`) ?? null;
  };

  // Resolves a slot reference to { known: boolean, profileId: string | null }.
  // profileId === null with known === true means a structural bye (empty slot).
  const resolveRef = (ref) => {
    if (ref === null) return { known: true, profileId: null };
    if (ref.e !== undefined) return { known: true, profileId: entrants[ref.e] ?? null };
    const [roundIndex, matchIndex] = ref.win ?? ref.lose;
    const match = structure.rounds[roundIndex].matches[matchIndex];
    const a = resolveRef(match.a);
    const b = resolveRef(match.b);

    // Structural byes resolve without a game.
    if (a.known && b.known && (a.profileId === null || b.profileId === null)) {
      const advancing = a.profileId ?? b.profileId;
      return ref.win !== undefined
        ? { known: true, profileId: advancing }
        : { known: true, profileId: null };
    }

    const game = gameFor(roundIndex, matchIndex);
    if (!game || !isGameDecided(game)) return { known: false, profileId: null };
    const winner = decisiveWinnerProfileId(game);
    if (!winner) return { known: false, profileId: null };
    const loser = winner === game.whiteProfileId ? game.blackProfileId : game.whiteProfileId;
    return { known: true, profileId: ref.win !== undefined ? winner : loser };
  };

  return { roundMap, boardOf, gameFor, resolveRef };
}

function knockoutEntrantsFromSnapshot(snapshot) {
  if (Array.isArray(snapshot?.entrants) && snapshot.entrants.length >= 2) {
    return snapshot.entrants.map((value) => (value ? String(value) : null)).filter(Boolean);
  }

  const firstRound = snapshot?.type === 'double'
    ? snapshot?.brackets?.winners?.[0]
    : snapshot?.rounds?.[0];
  if (!firstRound || !Array.isArray(firstRound.matches)) return null;

  const entrants = [];
  for (const match of firstRound.matches) {
    if (match.whiteProfileId) entrants.push(String(match.whiteProfileId));
    if (match.blackProfileId) entrants.push(String(match.blackProfileId));
  }
  return entrants.length >= 2 ? entrants : null;
}

function buildKnockoutSnapshot(structure, entrants, games, names, tournament, options = {}) {
  const resolver = knockoutResolver(structure, entrants, games);
  const double = structure.finalsIndices.length > 0;
  const nameOf = (profileId) => names.get(profileId) ?? profileId ?? 'Open seed';

  const describeRef = (ref) => {
    if (ref === null) return 'Bye';
    const resolved = resolver.resolveRef(ref);
    if (resolved.known) return resolved.profileId ? nameOf(resolved.profileId) : 'Bye';
    const [roundIndex, matchIndex] = ref.win ?? ref.lose;
    const code = bracketRoundCode(structure.rounds[roundIndex].name);
    const label = ref.win !== undefined ? 'Winner' : 'Loser';
    return `${label} ${code}-${matchIndex + 1}`;
  };

  const buildRound = (roundIndex) => {
    const round = structure.rounds[roundIndex];
    return {
      name: round.name,
      matches: round.matches
        .filter((match) => !(match.a === null && match.b === null))
        .map((match, visibleIndex) => {
          const game = resolver.gameFor(roundIndex, structure.rounds[roundIndex].matches.indexOf(match));
          const aResolved = resolver.resolveRef(match.a);
          const bResolved = resolver.resolveRef(match.b);
          const white = match.a === null ? 'Bye' : aResolved.known && aResolved.profileId ? nameOf(aResolved.profileId) : describeRef(match.a);
          const black = match.b === null ? 'Bye' : bResolved.known && bResolved.profileId ? nameOf(bResolved.profileId) : describeRef(match.b);
          const decided = game && isGameDecided(game);
          const winnerSide = decided
            ? game.result === '1-0' ? 'white' : game.result === '0-1' ? 'black' : undefined
            : match.a === null ? 'black' : match.b === null ? 'white' : undefined;

          return cleanObject({
            board: visibleIndex + 1,
            white,
            black,
            whiteProfileId: aResolved.profileId ?? undefined,
            blackProfileId: bResolved.profileId ?? undefined,
            whiteScore: decided ? (game.result === '1-0' ? '1' : game.result === '0-1' ? '0' : '½') : undefined,
            blackScore: decided ? (game.result === '0-1' ? '1' : game.result === '1-0' ? '0' : '½') : undefined,
            winner: winnerSide,
            live: Boolean(game && game.status === 'live'),
            pending: !game && !(match.a === null || match.b === null),
          });
        }),
    };
  };

  const base = {
    version: 2,
    generatedAt: new Date().toISOString(),
    format: tournament.format,
    playerCount: entrants.length,
    entrants,
    ...(options.stageTwoFromRound ? { stageTwoFromRound: options.stageTwoFromRound } : {}),
  };

  if (!double) {
    return JSON.stringify({
      ...base,
      type: 'single',
      title: `${tournament.format} bracket`,
      rounds: structure.winnersIndices.map(buildRound),
    });
  }

  return JSON.stringify({
    ...base,
    type: 'double',
    title: 'Double elimination bracket',
    brackets: {
      winners: structure.winnersIndices.map(buildRound),
      losers: structure.losersIndices.map(buildRound),
      final: [
        ...structure.finalsIndices.map(buildRound),
        { name: 'Reset if needed', matches: [{ board: 1, white: 'Winner Grand Final', black: 'Reset only if needed', pending: true }] },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Swiss pairing engine (also used for multi-stage stage one and arena rounds)
// ---------------------------------------------------------------------------

function buildSwissPairings(playerIds, games, seedByProfile, byeProfileId) {
  const stats = new Map(playerIds.map((profileId) => [profileId, {
    points: 0,
    whites: 0,
    blacks: 0,
    opponents: new Set(),
    hadBye: false,
  }]));

  for (const game of games) {
    const white = stats.get(game.whiteProfileId);
    const black = stats.get(game.blackProfileId);
    if (game.blackProfileId === byeProfileId && white) {
      white.hadBye = true;
      if (isGameDecided(game)) white.points += 1;
      continue;
    }
    if (!white || !black) continue;
    white.opponents.add(game.blackProfileId);
    black.opponents.add(game.whiteProfileId);
    white.whites += 1;
    black.blacks += 1;
    if (!isGameDecided(game)) continue;
    if (game.result === '1-0') white.points += 1;
    else if (game.result === '0-1') black.points += 1;
    else {
      white.points += 0.5;
      black.points += 0.5;
    }
  }

  const ordered = [...playerIds].sort((a, b) => (
    (stats.get(b)?.points ?? 0) - (stats.get(a)?.points ?? 0)
    || (seedByProfile.get(a) ?? 9999) - (seedByProfile.get(b) ?? 9999)
    || a.localeCompare(b)
  ));

  let byePlayerId = null;
  let field = ordered;
  if (ordered.length % 2 === 1) {
    // Lowest-ranked player without a previous bye sits out with a full point.
    const reversed = [...ordered].reverse();
    byePlayerId = reversed.find((profileId) => !stats.get(profileId)?.hadBye) ?? reversed[0];
    field = ordered.filter((profileId) => profileId !== byePlayerId);
  }

  const paired = new Set();
  const pairings = [];
  for (let index = 0; index < field.length; index += 1) {
    const playerId = field[index];
    if (paired.has(playerId)) continue;

    const candidates = field.slice(index + 1).filter((candidate) => !paired.has(candidate));
    const opponentId = candidates.find((candidate) => !stats.get(playerId)?.opponents.has(candidate))
      ?? candidates[0];
    if (!opponentId) break;

    paired.add(playerId);
    paired.add(opponentId);

    const playerStats = stats.get(playerId);
    const opponentStats = stats.get(opponentId);
    const playerWhiteNeed = (playerStats?.blacks ?? 0) - (playerStats?.whites ?? 0);
    const opponentWhiteNeed = (opponentStats?.blacks ?? 0) - (opponentStats?.whites ?? 0);
    const playerGetsWhite = playerWhiteNeed === opponentWhiteNeed
      ? pairings.length % 2 === 0
      : playerWhiteNeed > opponentWhiteNeed;

    pairings.push({
      board: pairings.length + 1,
      whiteProfileId: playerGetsWhite ? playerId : opponentId,
      blackProfileId: playerGetsWhite ? opponentId : playerId,
    });
  }

  return { pairings, byePlayerId };
}

async function writeSwissRound(tablesDB, databaseId, tournamentId, round, pairings, byePlayerId, byeProfileId) {
  const games = pairings.map((pairing) => ({ ...pairing, round }));
  if (byePlayerId) {
    games.push({
      round,
      board: pairings.length + 1,
      whiteProfileId: byePlayerId,
      blackProfileId: byeProfileId,
    });
  }

  const created = await createTournamentGames(tablesDB, databaseId, tournamentId, games, round);
  // Score the bye immediately: a full-point bye is a finished "game".
  for (const row of created) {
    if (row.blackProfileId !== byeProfileId) continue;
    await tablesDB.updateRow({
      databaseId,
      tableId: tableIds.games,
      rowId: row.$id,
      data: {
        status: 'completed',
        result: '1-0',
        pgn: 'bye',
        finishedAt: new Date().toISOString(),
      },
    });
  }

  return created;
}

function seededKnockoutOrder(profileIds) {
  // Interleave top and bottom halves so adjacent structural pairs reproduce
  // the classic 1-vs-(n/2+1) seeded first round.
  const half = Math.ceil(profileIds.length / 2);
  const order = [];
  for (let index = 0; index < half; index += 1) {
    order.push(profileIds[index]);
    if (profileIds[index + half]) order.push(profileIds[index + half]);
  }
  return order;
}

function swissRoundsTotal(tournament, playerCount) {
  const declared = Number(tournament.roundsTotal) || 0;
  if (declared > 0) return declared;
  return Math.max(3, Math.ceil(Math.log2(Math.max(2, playerCount))) + 1);
}

function multiStageStageOneRounds(tournament, qualifierCount) {
  const knockoutRounds = Math.ceil(Math.log2(Math.max(2, qualifierCount)));
  const declared = Number(tournament.roundsTotal) || 0;
  if (declared > knockoutRounds) return declared - knockoutRounds;
  return 3;
}

async function loadStandingsOrder(tablesDB, databaseId, tournamentId) {
  const rows = await listRowsByTournament(tablesDB, databaseId, tableIds.standings, tournamentId);
  return rows
    .toSorted((a, b) => (Number(a.rank) || 9999) - (Number(b.rank) || 9999))
    .map((row) => row.profileId)
    .filter(Boolean);
}

async function loadProfileNames(tablesDB, databaseId, profileIds) {
  const names = new Map();
  const unique = Array.from(new Set(profileIds.filter(Boolean)));
  for (const profileId of unique) {
    try {
      const row = await tablesDB.getRow({ databaseId, tableId: tableIds.profiles, rowId: profileId });
      names.set(profileId, row.displayName || row.email || profileId);
    } catch {
      names.set(profileId, profileId);
    }
  }
  return names;
}

async function completeTournament(tablesDB, databaseId, tournament, finalRound) {
  await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: tournament.$id,
    data: cleanObject({
      status: 'completed',
      currentRound: Number(finalRound) || tournament.currentRound,
      endsAt: tournament.endsAt || new Date().toISOString(),
    }),
  });
}

async function setCurrentRound(tablesDB, databaseId, tournamentId, nextRound, roundsTotal) {
  await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: tournamentId,
    data: cleanObject({
      currentRound: nextRound,
      roundsTotal,
    }),
  });
}

async function markRoundLive(tablesDB, databaseId, games, round) {
  for (const game of games) {
    if (Number(game.round) !== Number(round) || game.status !== 'scheduled') continue;
    await tablesDB.updateRow({
      databaseId,
      tableId: tableIds.games,
      rowId: game.$id,
      data: { status: 'live', startedAt: game.startedAt || new Date().toISOString() },
    });
  }
}

function roundIsComplete(games, round) {
  const roundGames = games.filter((game) => Number(game.round) === Number(round));
  return roundGames.length > 0 && roundGames.every((game) => isGameDecided(game));
}

function maxRoundOf(games) {
  return games.reduce((max, game) => Math.max(max, Number(game.round) || 0), 0);
}

// ---------------------------------------------------------------------------
// Per-format advancement
// ---------------------------------------------------------------------------

async function advanceKnockout(tablesDB, databaseId, tournament, games, options = {}) {
  const snapshot = (() => {
    try {
      return tournament.bracketSnapshot ? JSON.parse(tournament.bracketSnapshot) : null;
    } catch {
      return null;
    }
  })();

  const roundOffset = Number(options.roundOffset ?? snapshot?.stageTwoFromRound ?? 1) - 1;
  const bracketGames = games.filter((game) => Number(game.round) > roundOffset)
    .map((game) => ({ ...game, round: Number(game.round) - roundOffset }));

  const entrants = options.entrants ?? knockoutEntrantsFromSnapshot(snapshot)
    ?? (() => {
      const first = bracketGames.filter((game) => Number(game.round) === 1)
        .toSorted((a, b) => Number(a.board) - Number(b.board));
      return first.flatMap((game) => [game.whiteProfileId, game.blackProfileId]).filter(Boolean);
    })();
  if (!entrants || entrants.length < 2) return { advanced: false, reason: 'No bracket entrants found.' };

  const double = options.double ?? isDoubleEliminationTournament(tournament);
  const structure = buildKnockoutStructure(entrants.length, double);
  const resolver = knockoutResolver(structure, entrants, bracketGames);
  const playRounds = Array.from(resolver.roundMap.entries());

  // Regenerate the published snapshot so admin, web and mobile all see live results.
  const names = await loadProfileNames(tablesDB, databaseId, entrants);
  const snapshotJson = buildKnockoutSnapshot(structure, entrants, bracketGames, names, tournament, {
    stageTwoFromRound: snapshot?.stageTwoFromRound,
  });
  await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: tournament.$id,
    data: { bracketSnapshot: snapshotJson },
  }).catch(() => undefined);

  // Find the first structural round whose games are missing or unfinished.
  for (const [structuralIndex, gameRound] of playRounds) {
    const round = structure.rounds[structuralIndex];
    const realMatches = round.matches
      .map((match, matchIndex) => ({ match, matchIndex }))
      .filter(({ match }) => match.a !== null && match.b !== null);
    const roundGames = bracketGames.filter((game) => Number(game.round) === gameRound);

    if (roundGames.length >= realMatches.length) {
      if (!roundGames.every((game) => isGameDecided(game))) {
        return { advanced: false, reason: `Round ${gameRound + roundOffset} is still in progress.` };
      }
      continue;
    }

    // Round games missing: create them if every participant is resolvable.
    const creatable = [];
    for (const { match, matchIndex } of realMatches) {
      const a = resolver.resolveRef(match.a);
      const b = resolver.resolveRef(match.b);
      if (!a.known || !b.known) {
        return { advanced: false, reason: `Waiting on earlier results before round ${gameRound + roundOffset}.` };
      }
      if (!a.profileId || !b.profileId || a.profileId === b.profileId) continue;
      creatable.push({
        round: gameRound + roundOffset,
        board: resolver.boardOf(structuralIndex, matchIndex),
        whiteProfileId: a.profileId,
        blackProfileId: b.profileId,
      });
    }

    if (!creatable.length) continue;
    await createTournamentGames(tablesDB, databaseId, tournament.$id, creatable, gameRound + roundOffset);
    await setCurrentRound(
      tablesDB,
      databaseId,
      tournament.$id,
      gameRound + roundOffset,
      Math.max(Number(tournament.roundsTotal) || 0, gameRound + roundOffset),
    );
    return { advanced: true, currentRound: gameRound + roundOffset };
  }

  // Every structural round is complete. Handle the double-elim reset, then finish.
  if (double) {
    const grandFinalIndex = structure.finalsIndices[0];
    const grandFinalRound = resolver.roundMap.get(grandFinalIndex);
    const grandFinalGame = bracketGames.find((game) => (
      Number(game.round) === grandFinalRound && Number(game.board) === 1
    ));
    if (grandFinalGame && isGameDecided(grandFinalGame)) {
      const winner = decisiveWinnerProfileId(grandFinalGame);
      const winnersFinalist = resolver.resolveRef(structure.rounds[grandFinalIndex].matches[0].a).profileId;
      const resetRound = grandFinalRound + 1;
      const resetGame = bracketGames.find((game) => Number(game.round) === resetRound);
      if (winner && winnersFinalist && winner !== winnersFinalist && !resetGame) {
        // Losers-bracket finalist won the grand final: bracket reset.
        await createTournamentGames(tablesDB, databaseId, tournament.$id, [{
          round: resetRound + roundOffset,
          board: 1,
          whiteProfileId: winner,
          blackProfileId: winnersFinalist,
        }], resetRound + roundOffset);
        await setCurrentRound(
          tablesDB,
          databaseId,
          tournament.$id,
          resetRound + roundOffset,
          Math.max(Number(tournament.roundsTotal) || 0, resetRound + roundOffset),
        );
        return { advanced: true, currentRound: resetRound + roundOffset, reset: true };
      }
      if (resetGame && !isGameDecided(resetGame)) {
        return { advanced: false, reason: 'The bracket reset game is still in progress.' };
      }
    }
  }

  const finalRound = maxRoundOf(games);
  if (roundIsComplete(games, finalRound)) {
    await completeTournament(tablesDB, databaseId, tournament, finalRound);
    return { advanced: true, completed: true };
  }
  return { advanced: false, reason: 'Bracket is still in progress.' };
}

async function advanceRoundRobin(tablesDB, databaseId, tournament, games, completedRound) {
  if (!roundIsComplete(games, completedRound)) {
    return { advanced: false, reason: `Round ${completedRound} is still in progress.` };
  }

  const lastRound = maxRoundOf(games);
  if (Number(completedRound) >= lastRound) {
    await completeTournament(tablesDB, databaseId, tournament, lastRound);
    return { advanced: true, completed: true };
  }

  const nextRound = Number(completedRound) + 1;
  await markRoundLive(tablesDB, databaseId, games, nextRound);
  await setCurrentRound(tablesDB, databaseId, tournament.$id, nextRound, undefined);
  return { advanced: true, currentRound: nextRound };
}

async function advanceSwiss(tablesDB, databaseId, tournament, games, completedRound, options = {}) {
  if (!roundIsComplete(games, completedRound)) {
    return { advanced: false, reason: `Round ${completedRound} is still in progress.` };
  }
  if (maxRoundOf(games) > Number(completedRound)) {
    return { advanced: false, reason: 'A later round already exists.' };
  }

  const registrations = await listConfirmedRegistrations(tablesDB, databaseId, tournament.$id);
  const playerIds = registrations.map((row) => row.profileId).filter(Boolean);
  if (playerIds.length < 2) return { advanced: false, reason: 'Not enough confirmed players.' };

  const totalRounds = options.totalRounds ?? swissRoundsTotal(tournament, playerIds.length);
  if (!options.endless && Number(completedRound) >= totalRounds) {
    await completeTournament(tablesDB, databaseId, tournament, Number(completedRound));
    return { advanced: true, completed: true };
  }

  const byeProfileId = await ensureSystemByeProfile(tablesDB, databaseId);
  const seedByProfile = new Map(registrations.map((row, index) => [row.profileId, Number(row.seed) || index + 1]));
  const { pairings, byePlayerId } = buildSwissPairings(playerIds, games, seedByProfile, byeProfileId);
  if (!pairings.length && !byePlayerId) {
    return { advanced: false, reason: 'Could not build pairings for the next round.' };
  }

  const nextRound = Number(completedRound) + 1;
  await writeSwissRound(tablesDB, databaseId, tournament.$id, nextRound, pairings, byePlayerId, byeProfileId);

  await setCurrentRound(
    tablesDB,
    databaseId,
    tournament.$id,
    nextRound,
    options.endless ? Math.max(Number(tournament.roundsTotal) || 0, nextRound) : totalRounds,
  );
  await recalculateStandings(tablesDB, databaseId, tournament.$id);
  return { advanced: true, currentRound: nextRound };
}

async function advanceMultiStage(tablesDB, databaseId, tournament, games, completedRound) {
  const snapshot = (() => {
    try {
      return tournament.bracketSnapshot ? JSON.parse(tournament.bracketSnapshot) : null;
    } catch {
      return null;
    }
  })();

  if (snapshot?.stageTwoFromRound) {
    return await advanceKnockout(tablesDB, databaseId, tournament, games, {
      roundOffset: snapshot.stageTwoFromRound,
      double: false,
    });
  }

  const registrations = await listConfirmedRegistrations(tablesDB, databaseId, tournament.$id);
  const playerCount = registrations.length;
  const qualifierCount = Math.max(2, Math.min(8, 2 ** Math.floor(Math.log2(Math.max(2, playerCount)))));
  const stageOneRounds = multiStageStageOneRounds(tournament, qualifierCount);

  if (Number(completedRound) < stageOneRounds) {
    return await advanceSwiss(tablesDB, databaseId, tournament, games, completedRound, {
      totalRounds: stageOneRounds + 1, // stage one never auto-completes the event
      endless: false,
    });
  }

  if (!roundIsComplete(games, completedRound)) {
    return { advanced: false, reason: `Stage one round ${completedRound} is still in progress.` };
  }

  // Cutover: seed stage two from final stage-one standings.
  await recalculateStandings(tablesDB, databaseId, tournament.$id);
  const standingsOrder = await loadStandingsOrder(tablesDB, databaseId, tournament.$id);
  const qualifiers = standingsOrder.slice(0, qualifierCount);
  if (qualifiers.length < 2) return { advanced: false, reason: 'Not enough qualifiers for stage two.' };

  const stageTwoFromRound = Number(completedRound) + 1;
  const structure = buildKnockoutStructure(qualifiers.length, false);
  const resolver = knockoutResolver(structure, qualifiers, []);
  const firstRound = structure.rounds[structure.winnersIndices[0]];
  const stageTwoGames = firstRound.matches
    .map((match, matchIndex) => ({ match, matchIndex }))
    .filter(({ match }) => match.a !== null && match.b !== null)
    .map(({ match, matchIndex }) => ({
      round: stageTwoFromRound,
      board: resolver.boardOf(structure.winnersIndices[0], matchIndex),
      whiteProfileId: qualifiers[match.a.e],
      blackProfileId: qualifiers[match.b.e],
    }));

  await createTournamentGames(tablesDB, databaseId, tournament.$id, stageTwoGames, stageTwoFromRound);
  const names = await loadProfileNames(tablesDB, databaseId, qualifiers);
  const snapshotJson = buildKnockoutSnapshot(structure, qualifiers, [], names, tournament, {
    stageTwoFromRound,
  });
  await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: tournament.$id,
    data: cleanObject({
      bracketSnapshot: snapshotJson,
      currentRound: stageTwoFromRound,
      roundsTotal: stageTwoFromRound + Math.ceil(Math.log2(qualifiers.length)) - 1,
    }),
  });
  return { advanced: true, currentRound: stageTwoFromRound, stageTwo: true };
}

async function advanceTournamentIfReady(tablesDB, databaseId, tournamentId, completedRound) {
  const tournament = await tablesDB.getRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: tournamentId,
  });
  if (tournament.status !== 'active') {
    return { advanced: false, reason: 'Tournament is not active.' };
  }

  const games = await listRowsByTournament(tablesDB, databaseId, tableIds.games, tournamentId);
  const round = Number(completedRound) || Number(tournament.currentRound) || 1;

  if (isKnockoutTournament(tournament)) {
    return await advanceKnockout(tablesDB, databaseId, tournament, games);
  }
  if (isMultiStageTournament(tournament)) {
    return await advanceMultiStage(tablesDB, databaseId, tournament, games, round);
  }
  if (isRoundRobinTournament(tournament)) {
    return await advanceRoundRobin(tablesDB, databaseId, tournament, games, round);
  }
  if (isSwissTournament(tournament)) {
    return await advanceSwiss(tablesDB, databaseId, tournament, games, round);
  }
  if (isArenaTournament(tournament)) {
    return await advanceSwiss(tablesDB, databaseId, tournament, games, round, { endless: true });
  }

  // Team and other formats: single published round for now (no team model yet).
  if (roundIsComplete(games, round) && round >= maxRoundOf(games)) {
    await completeTournament(tablesDB, databaseId, tournament, round);
    return { advanced: true, completed: true };
  }
  return { advanced: false, reason: 'This format does not support automatic round advancement yet.' };
}

async function listRowsByTournament(tablesDB, databaseId, tableId, tournamentId) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId,
    queries: [Query.equal('tournamentId', tournamentId), Query.limit(500)],
    total: false,
  });

  return response.rows;
}

async function listConfirmedRegistrations(tablesDB, databaseId, tournamentId) {
  const rows = await listRowsByTournament(tablesDB, databaseId, tableIds.registrations, tournamentId);
  return rows
    .filter((row) => row.status === 'confirmed' || row.checkedIn)
    .filter((row) => row.profileId)
    .toSorted(compareRegistrationSeeds);
}

async function createTournamentGames(tablesDB, databaseId, tournamentId, games, liveRound = 1) {
  const rows = [];
  for (const game of games) {
    const row = await tablesDB.createRow({
      databaseId,
      tableId: tableIds.games,
      rowId: ID.unique(),
      data: cleanObject({
        tournamentId,
        round: Number(game.round),
        board: Number(game.board),
        whiteProfileId: String(game.whiteProfileId),
        blackProfileId: String(game.blackProfileId),
        status: Number(game.round) === liveRound ? 'live' : 'scheduled',
        result: '*',
        startedAt: Number(game.round) === liveRound ? new Date().toISOString() : undefined,
      }),
      permissions: [Permission.read(Role.any())],
    });
    rows.push(row);
  }

  return rows;
}

async function startTournamentIfNeeded(tablesDB, databaseId, tournamentId, nextData = {}) {
  const tournament = await tablesDB.getRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: tournamentId,
  });
  const nextTournament = { ...tournament, ...nextData };

  const existingGames = await listRowsByTournament(tablesDB, databaseId, tableIds.games, tournamentId);
  if (existingGames.length > 0) {
    return { createdGames: [], roundsTotal: nextTournament.roundsTotal || tournament.roundsTotal || 1 };
  }

  const registrations = await listConfirmedRegistrations(tablesDB, databaseId, tournamentId);
  const profileIds = registrations.map((row) => row.profileId).filter(Boolean);
  if (profileIds.length < 2) {
    throw new HttpError(400, 'At least two confirmed players are required before a tournament can go active.');
  }

  if (isKnockoutTournament(nextTournament)) {
    // Freeze the entrant order in the snapshot; the whole bracket structure is
    // derived from it on every advancement.
    const entrants = seededKnockoutOrder(profileIds);
    const double = isDoubleEliminationTournament(nextTournament);
    const structure = buildKnockoutStructure(entrants.length, double);
    const resolver = knockoutResolver(structure, entrants, []);
    const firstRoundIndex = structure.winnersIndices[0];
    const schedule = structure.rounds[firstRoundIndex].matches
      .map((match, matchIndex) => ({ match, matchIndex }))
      .filter(({ match }) => match.a !== null && match.b !== null)
      .map(({ match, matchIndex }) => ({
        round: 1,
        board: resolver.boardOf(firstRoundIndex, matchIndex),
        whiteProfileId: entrants[match.a.e],
        blackProfileId: entrants[match.b.e],
      }));
    if (!schedule.length) {
      throw new HttpError(400, 'Could not build first-round games for this tournament.');
    }

    const createdGames = await createTournamentGames(tablesDB, databaseId, tournamentId, schedule, 1);
    const names = await loadProfileNames(tablesDB, databaseId, entrants);
    const snapshotJson = buildKnockoutSnapshot(structure, entrants, [], names, nextTournament);
    return {
      createdGames,
      roundsTotal: knockoutGameRoundMap(structure).size,
      bracketSnapshot: snapshotJson,
    };
  }

  if (isSwissTournament(nextTournament) || isMultiStageTournament(nextTournament) || isArenaTournament(nextTournament)) {
    const byeProfileId = await ensureSystemByeProfile(tablesDB, databaseId);
    const seedByProfile = new Map(registrations.map((row, index) => [row.profileId, Number(row.seed) || index + 1]));
    const { pairings, byePlayerId } = buildSwissPairings(profileIds, [], seedByProfile, byeProfileId);
    if (!pairings.length) {
      throw new HttpError(400, 'Could not build first-round games for this tournament.');
    }

    const createdGames = await writeSwissRound(tablesDB, databaseId, tournamentId, 1, pairings, byePlayerId, byeProfileId);
    const roundsTotal = isMultiStageTournament(nextTournament)
      ? Number(nextTournament.roundsTotal) || 0
      : swissRoundsTotal(nextTournament, profileIds.length);
    return { createdGames, roundsTotal: roundsTotal || 1 };
  }

  const schedule = isRoundRobinTournament(nextTournament)
    ? buildRoundRobinSchedule(profileIds, isDoubleRoundRobinTournament(nextTournament))
    : splitSeededPairings(profileIds).map((game) => ({ ...game, round: 1 }));
  if (!schedule.length) {
    throw new HttpError(400, 'Could not build first-round games for this tournament.');
  }

  const roundsTotal = Math.max(
    1,
    ...schedule.map((game) => Number(game.round)).filter(Number.isFinite),
    Number(nextTournament.roundsTotal) || 0,
  );
  const createdGames = await createTournamentGames(tablesDB, databaseId, tournamentId, schedule, 1);
  return { createdGames, roundsTotal };
}

async function recalculateStandings(tablesDB, databaseId, tournamentId) {
  const [registrations, games, standings] = await Promise.all([
    listConfirmedRegistrations(tablesDB, databaseId, tournamentId),
    listRowsByTournament(tablesDB, databaseId, tableIds.games, tournamentId),
    listRowsByTournament(tablesDB, databaseId, tableIds.standings, tournamentId),
  ]);
  const existingByProfile = new Map(standings.map((row) => [row.profileId, row]));
  const seedByProfile = new Map(registrations.map((row, index) => [row.profileId, Number(row.seed) || index + 1]));
  const stats = new Map();

  for (const registration of registrations) {
    stats.set(registration.profileId, {
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      tieBreak: 0,
    });
  }

  for (const game of games) {
    if (!isGameDecided(game)) continue;
    const white = stats.get(game.whiteProfileId);
    const black = stats.get(game.blackProfileId);
    if (!white && !black) continue;

    // One-sided games (byes, withdrawn opponents) still credit the tracked player.
    if (!black) {
      if (game.result === '1-0') {
        white.played += 1;
        white.points += 1;
        white.wins += 1;
      }
      continue;
    }
    if (!white) {
      if (game.result === '0-1') {
        black.played += 1;
        black.points += 1;
        black.wins += 1;
      }
      continue;
    }

    white.played += 1;
    black.played += 1;
    if (game.result === '1-0') {
      white.points += 1;
      white.wins += 1;
      black.losses += 1;
    } else if (game.result === '0-1') {
      black.points += 1;
      black.wins += 1;
      white.losses += 1;
    } else {
      white.points += 0.5;
      black.points += 0.5;
      white.draws += 1;
      black.draws += 1;
    }
  }

  const ranked = Array.from(stats.entries()).toSorted(([profileA, a], [profileB, b]) => (
    b.points - a.points ||
    b.wins - a.wins ||
    b.played - a.played ||
    (seedByProfile.get(profileA) ?? 9999) - (seedByProfile.get(profileB) ?? 9999) ||
    profileA.localeCompare(profileB)
  ));

  for (let index = 0; index < ranked.length; index += 1) {
    const [profileId, rowStats] = ranked[index];
    const existing = existingByProfile.get(profileId);
    const data = {
      tournamentId,
      profileId,
      rank: index + 1,
      points: rowStats.points,
      tieBreak: rowStats.tieBreak,
      played: rowStats.played,
      wins: rowStats.wins,
      draws: rowStats.draws,
      losses: rowStats.losses,
    };

    if (existing) {
      await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.standings,
        rowId: existing.$id,
        data,
      });
    } else {
      await tablesDB.createRow({
        databaseId,
        tableId: tableIds.standings,
        rowId: ID.unique(),
        data,
      });
    }
  }
}

async function submitGameResult(tablesDB, databaseId, gameId, body) {
  const result = normalizeResult(body.result);
  if (!result) {
    throw new HttpError(400, 'Unsupported game result.');
  }
  const status = statusForResult(result, body.status);
  const current = await tablesDB.getRow({
    databaseId,
    tableId: tableIds.games,
    rowId: gameId,
  });

  const row = await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.games,
    rowId: gameId,
    data: cleanObject({
      status,
      result,
      pgn: body.pgn,
      startedAt: current.startedAt || body.startedAt || new Date().toISOString(),
      finishedAt: status === 'completed' ? body.finishedAt ?? new Date().toISOString() : undefined,
    }),
  });

  await recalculateStandings(tablesDB, databaseId, row.tournamentId);
  if (status === 'completed') {
    await advanceTournamentIfReady(tablesDB, databaseId, row.tournamentId, row.round);
  }

  return row;
}

async function findTournamentGameByBoard(tablesDB, databaseId, tournamentId, round, board) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.games,
    queries: [
      Query.equal('tournamentId', tournamentId),
      Query.equal('round', Number(round)),
      Query.equal('board', Number(board)),
      Query.limit(1),
    ],
    total: false,
  });

  return response.rows[0] ?? null;
}

async function writeAudit(tablesDB, databaseId, { actorProfileId, action, targetTable, targetRowId, payload }) {
  try {
    await tablesDB.createRow({
      databaseId,
      tableId: tableIds.adminAudit,
      rowId: ID.unique(),
      data: cleanObject({
        actorProfileId,
        action,
        targetTable,
        targetRowId,
        payload: payload ? JSON.stringify(payload).slice(0, 4000) : undefined,
        createdAt: new Date().toISOString(),
      }),
    });
  } catch {
    // Audit writes should not make the primary admin action fail.
  }
}

async function setProfileStatus(tablesDB, databaseId, profileId, status) {
  if (!profileId) return;
  await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.profiles,
    rowId: profileId,
    data: { status },
  });
}

async function listBlockRows(tablesDB, databaseId) {
  const [identityResponse, ipResponse] = await Promise.all([
    tablesDB.listRows({
      databaseId,
      tableId: tableIds.identityBlocks,
      queries: [Query.limit(500)],
      total: false,
    }),
    tablesDB.listRows({
      databaseId,
      tableId: tableIds.ipBlocks,
      queries: [Query.limit(500)],
      total: false,
    }),
  ]);

  return {
    identityBlocks: identityResponse.rows.toSorted(compareCreatedAtDesc),
    ipBlocks: ipResponse.rows.toSorted(compareCreatedAtDesc),
  };
}

function compareCreatedAtDesc(a, b) {
  return String(b.createdAt || b.$createdAt || '').localeCompare(String(a.createdAt || a.$createdAt || ''));
}

async function loadAdminProfile(tablesDB, databaseId, accountId) {
  if (!accountId) return null;

  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.adminProfiles,
    queries: [Query.equal('accountId', accountId), Query.limit(1)],
    total: false,
  });

  return response.rows[0] ?? null;
}

async function getAuthenticatedAccountId(req) {
  const jwt = req.headers['juchess-admin-jwt'] || req.headers['x-appwrite-user-jwt'];
  if (!jwt) {
    throw new HttpError(401, 'Admin session is required.');
  }

  const userClient = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);

  const account = new Account(userClient);
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    throw new HttpError(401, 'Admin session is required.');
  }
}

async function requireAdminActor(req, tablesDB, databaseId) {
  const accountId = await getAuthenticatedAccountId(req);
  const profile = await loadAdminProfile(tablesDB, databaseId, accountId);
  if (!profile) {
    throw new HttpError(403, 'This account is not registered for the admin panel.');
  }

  if (profile.status !== 'active') {
    throw new HttpError(403, 'This admin account is suspended.');
  }

  if (!['superAdmin', 'admin', 'organizer'].includes(profile.role)) {
    throw new HttpError(403, 'This admin role is not allowed.');
  }

  return profile;
}

function requireSuperAdmin(actor) {
  if (actor.role !== 'superAdmin') {
    throw new HttpError(403, 'Only a super admin can manage admin access.');
  }
}

function adminTeamForRole(role) {
  return role === 'superAdmin' ? adminTeamIds.superAdmins : adminTeamIds.staff;
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const users = new Users(client);
  const teams = new Teams(client);
  const databaseId = process.env.JUCHESS_DATABASE_ID ?? 'juchess';
  const method = req.method.toUpperCase();
  const path = req.path || '/';
  const segments = routeSegments(path);
  const body = parseBody(req);

  log(`JuChess admin action ${method} ${path}`);

  if (method === 'GET' && segments.length === 0) {
    return res.json({
      ok: true,
      service: 'juchess-admin-actions',
      databaseId,
      tables: tableIds,
      routes: [
        'POST /tournaments',
        'PATCH /tournaments/:id',
        'DELETE /tournaments/:id',
        'POST /tournaments/:id/pairings/publish',
        'POST /tournaments/:id/pairings/unpublish',
        'POST /tournaments/:id/games/result',
        'POST /tournaments/:id/rounds/next',
        'POST /profiles/lookup',
        'GET /admin/session',
        'GET /admin/admins',
        'POST /admin/admins',
        'POST /admin/admins/:id/status',
        'GET /blocks',
        'POST /blocks/identity',
        'POST /blocks/identity/:id/unblock',
        'POST /blocks/ip',
        'POST /blocks/ip/:id/unblock',
        'POST /registrations/:id/confirm',
        'POST /registrations/:id/status',
        'POST /games/:id/result',
        'POST /profiles/:id/role',
        'POST /profiles/:id/status',
        'POST /announcements',
      ],
    });
  }

  try {
    const actor = await requireAdminActor(req, tablesDB, databaseId);

    if (method === 'GET' && segments[0] === 'admin' && segments[1] === 'session') {
      return res.json({ ok: true, allowed: true, profile: actor });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] === 'lookup') {
      const ids = Array.isArray(body.ids)
        ? Array.from(new Set(body.ids.map((id) => String(id)).filter(Boolean)))
        : [];

      if (!ids.length) {
        return res.json({ ok: true, rows: [] });
      }

      const response = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.profiles,
        queries: [Query.limit(500)],
        total: false,
      });

      return res.json({
        ok: true,
        rows: response.rows.filter((row) => ids.includes(row.$id)),
      });
    }

    if (method === 'GET' && segments[0] === 'admin' && segments[1] === 'admins' && segments.length === 2) {
      requireSuperAdmin(actor);

      const response = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.adminProfiles,
        queries: [Query.limit(500)],
        total: false,
      });

      return res.json({ ok: true, admins: response.rows.toSorted(compareCreatedAtDesc) });
    }

    if (method === 'POST' && segments[0] === 'admin' && segments[1] === 'admins' && segments.length === 2) {
      requireSuperAdmin(actor);

      const missing = requireFields(body, ['email', 'displayName', 'role']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing admin profile fields.', { missing });
      }

      if (!['superAdmin', 'admin', 'organizer'].includes(body.role)) {
        return badRequest(res, 'Unsupported admin role.');
      }

      const email = String(body.email).trim().toLowerCase();
      const displayName = String(body.displayName).trim();
      const teamId = adminTeamForRole(body.role);
      const membership = await teams.createMembership({
        teamId,
        roles: [body.role],
        email: body.accountId ? undefined : email,
        userId: body.accountId || undefined,
        name: displayName,
      });

      const accountId = membership.userId || body.accountId;
      if (!accountId) {
        throw new HttpError(500, 'Admin membership was created without an account ID.');
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.adminProfiles,
        rowId: ID.unique(),
        data: cleanObject({
          accountId,
          email,
          displayName,
          role: body.role,
          status: 'active',
          teamId,
          membershipId: membership.$id,
          createdByAdminId: actor.$id,
          createdAt: new Date().toISOString(),
          notes: body.notes,
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'createAdminProfile',
        targetTable: tableIds.adminProfiles,
        targetRowId: row.$id,
        payload: { email, role: body.role, teamId },
      });

      return res.json({ ok: true, action: 'createAdminProfile', row });
    }

    if (method === 'POST' && segments[0] === 'admin' && segments[1] === 'admins' && segments[2] && segments[3] === 'status') {
      requireSuperAdmin(actor);

      const missing = requireFields(body, ['status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing admin status.', { missing });
      }

      if (!['active', 'suspended'].includes(body.status)) {
        return badRequest(res, 'Unsupported admin status.');
      }

      const target = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.adminProfiles,
        rowId: segments[2],
      });

      if (target.accountId === actor.accountId && body.status === 'suspended') {
        return badRequest(res, 'A super admin cannot suspend their own admin access.');
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.adminProfiles,
        rowId: segments[2],
        data: { status: body.status },
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'updateAdminStatus',
        targetTable: tableIds.adminProfiles,
        targetRowId: row.$id,
        payload: { email: target.email, status: body.status },
      });

      return res.json({ ok: true, action: 'updateAdminStatus', row });
    }

    if (method === 'GET' && segments[0] === 'blocks' && segments.length === 1) {
      const blocks = await listBlockRows(tablesDB, databaseId);
      return res.json({ ok: true, ...blocks });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'identity' && segments.length === 2) {
      const missing = requireFields(body, ['type', 'value']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing identity block fields.', { missing });
      }

      if (!['email', 'universityId', 'phone'].includes(body.type)) {
        return badRequest(res, 'Unsupported identity block type.');
      }

      const value = normalizeIdentityValue(body.type, body.value);
      if (!value) return badRequest(res, 'Block value is empty after normalization.');

      if (body.targetUserId && body.blockAccount !== false) {
        await users.updateStatus({ userId: body.targetUserId, status: false });
        await users.deleteSessions({ userId: body.targetUserId });
      }

      if (body.targetProfileId) {
        await setProfileStatus(tablesDB, databaseId, body.targetProfileId, 'suspended');
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.identityBlocks,
        rowId: ID.unique(),
        data: cleanObject({
          type: body.type,
          value,
          reason: body.reason,
          status: 'active',
          targetUserId: body.targetUserId,
          targetProfileId: body.targetProfileId,
          createdByProfileId: actorProfileId(req, body, actor),
          createdAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
        action: 'blockIdentity',
        targetTable: tableIds.identityBlocks,
        targetRowId: row.$id,
        payload: { type: body.type, value, targetUserId: body.targetUserId, targetProfileId: body.targetProfileId },
      });

      return res.json({ ok: true, action: 'blockIdentity', row });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'identity' && segments[2] && segments[3] === 'unblock') {
      const block = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.identityBlocks,
        rowId: segments[2],
      });

      if (block.targetUserId && body.unblockAccount !== false) {
        await users.updateStatus({ userId: block.targetUserId, status: true });
      }

      if (block.targetProfileId) {
        await setProfileStatus(tablesDB, databaseId, block.targetProfileId, 'active');
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.identityBlocks,
        rowId: segments[2],
        data: cleanObject({
          status: 'lifted',
          liftedByProfileId: actorProfileId(req, body, actor),
          liftedAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
        action: 'unblockIdentity',
        targetTable: tableIds.identityBlocks,
        targetRowId: row.$id,
        payload: { type: block.type, value: block.value, targetUserId: block.targetUserId, targetProfileId: block.targetProfileId },
      });

      return res.json({ ok: true, action: 'unblockIdentity', row });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'ip' && segments.length === 2) {
      const missing = requireFields(body, ['ipRange']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing IP block fields.', { missing });
      }

      const ipRange = String(body.ipRange).trim();
      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.ipBlocks,
        rowId: ID.unique(),
        data: cleanObject({
          ipRange,
          reason: body.reason,
          status: 'active',
          createdByProfileId: actorProfileId(req, body, actor),
          createdAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
        action: 'blockIp',
        targetTable: tableIds.ipBlocks,
        targetRowId: row.$id,
        payload: { ipRange },
      });

      return res.json({ ok: true, action: 'blockIp', row });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'ip' && segments[2] && segments[3] === 'unblock') {
      const block = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.ipBlocks,
        rowId: segments[2],
      });

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.ipBlocks,
        rowId: segments[2],
        data: cleanObject({
          status: 'lifted',
          liftedByProfileId: actorProfileId(req, body, actor),
          liftedAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
        action: 'unblockIp',
        targetTable: tableIds.ipBlocks,
        targetRowId: row.$id,
        payload: { ipRange: block.ipRange },
      });

      return res.json({ ok: true, action: 'unblockIp', row });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments.length === 1) {
      const missing = requireFields(body, ['slug', 'name', 'format', 'timeControl', 'status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing required tournament fields.', { missing });
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: ID.unique(),
        data: cleanObject({
          slug: body.slug,
          name: body.name,
          status: body.status,
          format: body.format,
          timeControl: body.timeControl,
          roundsTotal: body.roundsTotal,
          currentRound: body.currentRound,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          location: body.location,
          capacity: body.capacity,
          description: body.description,
          createdByProfileId: body.createdByProfileId ?? actor.$id,
        }),
      });

      return res.json({ ok: true, action: 'createTournament', row });
    }

    if (method === 'PATCH' && segments[0] === 'tournaments' && segments[1]) {
      const activation = body.status === 'active'
        ? await startTournamentIfNeeded(tablesDB, databaseId, segments[1], body)
        : null;
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: segments[1],
        data: cleanObject({
          slug: body.slug,
          name: body.name,
          status: body.status,
          format: body.format,
          timeControl: body.timeControl,
          currentRound: body.status === 'active' ? body.currentRound ?? 1 : body.currentRound,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          location: body.location,
          capacity: body.capacity,
          description: body.description,
          roundsTotal: activation?.roundsTotal ?? body.roundsTotal,
          // Activation replaces any stale pre-publish snapshot with the freshly
          // generated bracket (knockouts) or clears it (other formats).
          bracketSnapshot: body.status === 'active'
            ? activation?.bracketSnapshot ?? null
            : body.bracketSnapshot,
        }),
      });

      if (activation?.createdGames?.length) {
        await recalculateStandings(tablesDB, databaseId, segments[1]);
      }

      return res.json({ ok: true, action: 'updateTournament', row, createdGames: activation?.createdGames ?? [] });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments[1] && segments[2] === 'pairings' && segments[3] === 'publish') {
      const tournamentId = segments[1];
      const games = Array.isArray(body.games) ? body.games : [];
      const bracketSnapshot = normalizeBracketSnapshot(body.bracketSnapshot);
      if (games.length === 0) {
        return badRequest(res, 'No pairings were provided to publish.');
      }
      if (body.bracketSnapshot !== undefined && !bracketSnapshot) {
        return badRequest(res, 'Bracket snapshot must be valid published bracket JSON.');
      }

      const invalid = games.find((game) => (
        !Number.isInteger(Number(game.round)) ||
        !Number.isInteger(Number(game.board)) ||
        !game.whiteProfileId ||
        !game.blackProfileId ||
        game.whiteProfileId === game.blackProfileId
      ));
      if (invalid) {
        return badRequest(res, 'Published pairings must include round, board, whiteProfileId and blackProfileId.');
      }

      await tablesDB.getRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
      });

      const existing = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.games,
        queries: [Query.equal('tournamentId', tournamentId), Query.limit(500)],
        total: false,
      });

      for (const row of existing.rows) {
        await tablesDB.deleteRow({
          databaseId,
          tableId: tableIds.games,
          rowId: row.$id,
        });
      }

      const rows = [];
      for (const game of games) {
        const row = await tablesDB.createRow({
          databaseId,
          tableId: tableIds.games,
          rowId: ID.unique(),
          data: cleanObject({
            tournamentId,
            round: Number(game.round),
            board: Number(game.board),
            whiteProfileId: String(game.whiteProfileId),
            blackProfileId: String(game.blackProfileId),
            status: game.status && ['scheduled', 'live'].includes(game.status) ? game.status : 'scheduled',
            result: '*',
          }),
          permissions: [Permission.read(Role.any())],
        });
        rows.push(row);
      }

      const roundsTotal = Math.max(...games.map((game) => Number(game.round)).filter(Number.isFinite));
      await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
        data: cleanObject({
          currentRound: 1,
          roundsTotal: roundsTotal > 1 ? roundsTotal : undefined,
          bracketSnapshot,
        }),
      }).catch(() => undefined);

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'publishTournamentPairings',
        targetTable: tableIds.tournaments,
        targetRowId: tournamentId,
        payload: { games: rows.length, roundsTotal, bracketSnapshot: Boolean(bracketSnapshot) },
      });

      return res.json({ ok: true, action: 'publishTournamentPairings', rows });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments[1] && segments[2] === 'pairings' && segments[3] === 'unpublish') {
      const tournamentId = segments[1];

      await tablesDB.getRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
      });

      const existing = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.games,
        queries: [Query.equal('tournamentId', tournamentId), Query.limit(500)],
        total: false,
      });

      for (const row of existing.rows) {
        await tablesDB.deleteRow({
          databaseId,
          tableId: tableIds.games,
          rowId: row.$id,
        });
      }

      await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
        data: { currentRound: null, bracketSnapshot: null },
      }).catch(() => undefined);

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'unpublishTournamentPairings',
        targetTable: tableIds.tournaments,
        targetRowId: tournamentId,
        payload: { games: existing.rows.length },
      });

      return res.json({ ok: true, action: 'unpublishTournamentPairings', deleted: existing.rows.length });
    }

    if (method === 'DELETE' && segments[0] === 'tournaments' && segments[1]) {
      await tablesDB.deleteRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: segments[1],
      });
      return res.json({ ok: true, action: 'deleteTournament', rowId: segments[1] });
    }

    if (
      method === 'POST' &&
      segments[0] === 'registrations' &&
      segments[1] &&
      ['confirm', 'status'].includes(segments[2])
    ) {
      if (body.status && !['pending', 'confirmed', 'waitlisted', 'cancelled'].includes(body.status)) {
        return badRequest(res, 'Unsupported registration status.');
      }

      const nextStatus = body.status ?? 'confirmed';
      const existing = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.registrations,
        rowId: segments[1],
      });
      const checkInCode = nextStatus === 'confirmed' && !existing.checkInCode
        ? generateCheckInCode()
        : undefined;
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.registrations,
        rowId: segments[1],
        data: cleanObject({
          status: nextStatus,
          seed: body.seed,
          checkedIn: nextStatus === 'cancelled' ? false : body.checkedIn,
          checkInCode,
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'updateRegistration',
        targetTable: tableIds.registrations,
        targetRowId: row.$id,
        payload: { status: nextStatus, seed: body.seed, checkedIn: nextStatus === 'cancelled' ? false : body.checkedIn },
      });

      return res.json({ ok: true, action: 'updateRegistration', row });
    }

    if (method === 'POST' && segments[0] === 'games' && segments[1] && segments[2] === 'result') {
      const missing = requireFields(body, ['result']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing game result.', { missing });
      }

      const row = await submitGameResult(tablesDB, databaseId, segments[1], body);

      return res.json({ ok: true, action: 'submitGameResult', row });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments[1] && segments[2] === 'rounds' && segments[3] === 'next') {
      const outcome = await advanceTournamentIfReady(tablesDB, databaseId, segments[1], body.completedRound);
      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'advanceTournamentRound',
        targetTable: tableIds.tournaments,
        targetRowId: segments[1],
        payload: outcome,
      });

      return res.json({ ok: true, action: 'advanceTournamentRound', ...outcome });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments[1] && segments[2] === 'games' && segments[3] === 'result') {
      const missing = requireFields(body, ['round', 'board', 'result']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing tournament game result fields.', { missing });
      }

      const game = await findTournamentGameByBoard(tablesDB, databaseId, segments[1], body.round, body.board);
      if (!game) {
        return badRequest(res, 'No published game exists for that round and board.');
      }

      const row = await submitGameResult(tablesDB, databaseId, game.$id, body);
      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'submitTournamentGameResult',
        targetTable: tableIds.games,
        targetRowId: row.$id,
        payload: { tournamentId: segments[1], round: body.round, board: body.board, result: row.result },
      });

      return res.json({ ok: true, action: 'submitTournamentGameResult', row });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] && segments[2] === 'role') {
      const missing = requireFields(body, ['role']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing profile role.', { missing });
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.profiles,
        rowId: segments[1],
        data: { role: body.role },
      });

      return res.json({ ok: true, action: 'updateProfileRole', row });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] && segments[2] === 'status') {
      const missing = requireFields(body, ['status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing profile status.', { missing });
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.profiles,
        rowId: segments[1],
        data: { status: body.status },
      });

      return res.json({ ok: true, action: 'updateProfileStatus', row });
    }

    if (method === 'POST' && segments[0] === 'announcements' && segments.length === 1) {
      const missing = requireFields(body, ['title', 'body']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing announcement fields.', { missing });
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.announcements,
        rowId: ID.unique(),
        data: cleanObject({
          title: body.title,
          body: body.body,
          audience: body.audience ?? 'public',
          status: body.status ?? 'published',
          publishedAt: body.publishedAt ?? new Date().toISOString(),
          createdByProfileId: body.createdByProfileId ?? actor.$id,
        }),
        permissions: [Permission.read(Role.any())],
      });

      return res.json({ ok: true, action: 'createAnnouncement', row });
    }

    return notFound(res, method, path);
  } catch (cause) {
    error(cause?.message ?? String(cause));
    if (cause instanceof HttpError) {
      return res.json({
        ok: false,
        error: cause.message,
      }, cause.statusCode);
    }

    return res.json({
      ok: false,
      error: 'Admin action failed.',
      detail: cause?.message ?? String(cause),
    }, 500);
  }
};
