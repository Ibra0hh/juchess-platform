import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadExternalPlayerRating,
  parseChessComRatings,
  parseLichessRatings,
  refreshNextExternalPlayerRating,
  selectExternalRating,
} from '../src/main.js';

test('provider payloads only produce ratings for pools with real games', () => {
  assert.deepEqual(parseChessComRatings({
    chess_rapid: { last: { rating: 1712 } },
    chess_blitz: { last: { rating: 1604 } },
    chess_bullet: { last: { rating: 0 } },
  }), [
    { rating: 1712, source: 'chess.com:rapid' },
    { rating: 1604, source: 'chess.com:blitz' },
  ]);

  assert.deepEqual(parseLichessRatings({
    perfs: {
      rapid: { games: 24, rating: 1840 },
      blitz: { games: 0, rating: 1500 },
      classical: { games: 3, rating: 1766 },
    },
  }), [
    { rating: 1840, source: 'lichess:rapid' },
    { rating: 1766, source: 'lichess:classical' },
  ]);
});

test('rating selection prioritizes comparable pools and keeps the provider source', () => {
  assert.deepEqual(selectExternalRating([
    { rating: 1900, source: 'chess.com:blitz' },
    { rating: 1800, source: 'lichess:rapid' },
    { rating: 2000, source: 'lichess:bullet' },
  ]), { rating: 1800, source: 'lichess:rapid' });
});

test('provider failures do not prevent a rating from the other linked account', async () => {
  const calls = [];
  const result = await loadExternalPlayerRating({
    chessComUsername: 'missing',
    lichessUsername: 'working',
  }, {
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('chess.com')) throw new Error('provider unavailable');
      return {
        ok: true,
        status: 200,
        async json() { return { perfs: { rapid: { games: 7, rating: 1777 } } }; },
      };
    },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(result, {
    rating: 1777,
    source: 'lichess:rapid',
    providerFailures: 1,
  });
});

test('scheduled refresh stores attribution and refreshes only the oldest due profile', async () => {
  const updates = [];
  const tablesDB = {
    async listRows() {
      return {
        rows: [
          { $id: 'fresh', chessComUsername: 'fresh-user', ratingUpdatedAt: '2026-07-19T09:30:00.000Z' },
          { $id: 'oldest', lichessUsername: 'old-user', ratingUpdatedAt: '2026-07-17T09:30:00.000Z' },
          { $id: 'never', chessComUsername: 'never-user' },
        ],
      };
    },
    async updateRow(options) {
      updates.push(options);
      return options.data;
    },
  };

  const result = await refreshNextExternalPlayerRating(tablesDB, 'juchess', {
    now: new Date('2026-07-19T10:00:00.000Z'),
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      async json() {
        assert.match(url, /never-user/);
        return { chess_rapid: { last: { rating: 1666 } } };
      },
    }),
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].rowId, 'never');
  assert.deepEqual(updates[0].data, {
    rating: 1666,
    ratingSource: 'chess.com:rapid',
    ratingUpdatedAt: '2026-07-19T10:00:00.000Z',
  });
  assert.equal(result.remaining, 1);
});
