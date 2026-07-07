/* JuChess shared mock data + helpers. Loaded as a plain helmet script; exposes window.JU */
(function () {
  var PIECE = { p: '\u265F', n: '\u265E', b: '\u265D', r: '\u265C', q: '\u265B', k: '\u265A' };

  function fenBoard(fen) {
    var rows = (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').split(' ')[0].split('/');
    var cells = [];
    for (var r = 0; r < 8; r++) {
      var row = rows[r] || '8', f = 0;
      for (var i = 0; i < row.length; i++) {
        var c = row[i];
        if (c >= '1' && c <= '8') {
          for (var k = 0; k < +c; k++) { cells.push({ g: '', w: false, dark: (r + f) % 2 === 1, key: r + '-' + f }); f++; }
        } else {
          cells.push({ g: PIECE[c.toLowerCase()] || '', w: c === c.toUpperCase(), dark: (r + f) % 2 === 1, key: r + '-' + f });
          f++;
        }
      }
    }
    return cells;
  }

  var players = [
    { name: 'Ibrahim Ahmad', rating: 1810, username: 'ibrahim_ju' },
    { name: 'Omar Saleh', rating: 1740, username: 'omar_saleh' },
    { name: 'Leen Haddad', rating: 1685, username: 'leenh' },
    { name: 'Yazan Khaled', rating: 1602, username: 'ykhaled' },
    { name: 'Sara Nasser', rating: 1550, username: 'sara_n' },
    { name: 'Mohammad Al-Khatib', rating: 1490, username: 'mohammad_ak' },
    { name: 'Rania Odeh', rating: 1465, username: 'rania_o' },
    { name: 'Khaled Mansour', rating: 1430, username: 'kmansour' },
    { name: 'Tala Suleiman', rating: 1395, username: 'tala_s' },
    { name: 'Hasan Qasem', rating: 1370, username: 'hqasem' },
    { name: 'Noor Barakat', rating: 1340, username: 'noorb' },
    { name: 'Zaid Hamdan', rating: 1310, username: 'zhamdan' }
  ];
  function P(i) { return players[i].name; }
  function R(i) { return players[i].rating; }

  /* ---- sample positions (mid-game FENs) ---- */
  var FENS = [
    'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R',
    'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1',
    'r2q1rk1/pp1bppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R',
    'r1bqk2r/pp2bppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R',
    'r3r1k1/pp3ppp/2p2n2/3q4/3P4/2NB4/PP3PPP/R2Q1RK1',
    '2r2rk1/pb2qppp/1pn1pn2/8/2PP4/1PN1PN2/PB2QPPP/2R2RK1',
    'r4rk1/1pp1qppp/p1np1n2/4p3/2B1P1b1/2NP1N2/PPP1QPPP/R1B2RK1',
    '3r2k1/5ppp/2p5/1pQ5/8/1P4P1/P4P1P/3q2K1',
    '8/5pk1/6p1/8/3K4/8/5PP1/8'
  ];

  var MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Nc3', 'Nxe4', 'O-O', 'Bxc3', 'd5', 'Bf6', 'Re1', 'Ne7', 'Rxe4', 'd6', 'Bg5', 'Bxg5', 'Nxg5', 'h6', 'Qe2', 'hxg5', 'Re1', 'Be6', 'dxe6', 'f6', 'Qd3', 'gxe6', 'Rxe6', 'Kf7', 'Qb3', 'Qd7', 'Rae1', 'Rhe8'];
  var CLASSES = ['Book', 'Book', 'Book', 'Book', 'Book', 'Book', 'Best', 'Best', 'Best', 'Great', 'Best', 'Book', 'Best', 'Mistake', 'Best', 'Best', 'Great', 'Best', 'Best', 'Best', 'Brilliant', 'Best', 'Best', 'Mistake', 'Best', 'Blunder', 'Best', 'Best', 'Best', 'Mistake', 'Great', 'Best', 'Best', 'Blunder', 'Brilliant', 'Best', 'Best', 'Best', 'Great', 'Best'];
  var EVALS = [0.2, 0.2, 0.3, 0.2, 0.4, 0.3, 0.4, 0.4, 0.5, 0.3, 0.4, 0.4, 0.6, 1.1, 1.2, 1.0, 1.4, 1.3, 1.4, 1.5, 2.2, 2.0, 2.1, 2.9, 3.0, 4.6, 4.4, 4.5, 4.6, 5.4, 5.6, 5.5, 5.7, 7.2, 8.5, 8.3, 8.6, 8.8, 9.4, 9.6];

  function mkGame(id, wi, bi, result, date, opening, srcRound) {
    return {
      id: id, white: P(wi), black: P(bi), wRating: R(wi), bRating: R(bi),
      result: result, date: date, opening: opening, round: srcRound || '',
      fen: FENS[id % FENS.length], moves: MOVES, classes: CLASSES, evals: EVALS,
      wAcc: [91.4, 84.2, 88.7, 79.3, 93.1, 86.5][id % 6],
      bAcc: [83.6, 88.9, 76.2, 90.4, 81.7, 74.9][id % 6]
    };
  }

  var gamesBySource = {
    'chess.com': [
      mkGame(1, 0, 3, '1-0', 'Jun 30, 2026', 'Italian Game: Classical'),
      mkGame(2, 1, 0, '0-1', 'Jun 28, 2026', 'Sicilian Defense: Najdorf'),
      mkGame(3, 0, 5, '\u00BD-\u00BD', 'Jun 26, 2026', 'Queen\u2019s Gambit Declined'),
      mkGame(4, 2, 0, '0-1', 'Jun 22, 2026', 'Ruy Lopez: Berlin'),
      mkGame(5, 0, 4, '1-0', 'Jun 19, 2026', 'Caro-Kann: Advance'),
      mkGame(6, 0, 1, '1-0', 'Jun 15, 2026', 'English Opening'),
      mkGame(7, 3, 0, '\u00BD-\u00BD', 'Jun 12, 2026', 'French Defense: Tarrasch'),
      mkGame(8, 0, 2, '1-0', 'Jun 8, 2026', 'Scotch Game')
    ],
    'lichess': [
      mkGame(2, 4, 1, '0-1', 'Jul 1, 2026', 'King\u2019s Indian Defense'),
      mkGame(5, 1, 2, '1-0', 'Jun 29, 2026', 'Vienna Game'),
      mkGame(7, 3, 1, '\u00BD-\u00BD', 'Jun 25, 2026', 'Slav Defense'),
      mkGame(1, 1, 5, '1-0', 'Jun 21, 2026', 'Italian Game: Evans Gambit'),
      mkGame(4, 2, 3, '1-0', 'Jun 18, 2026', 'Nimzo-Indian Defense'),
      mkGame(3, 5, 1, '0-1', 'Jun 14, 2026', 'Pirc Defense')
    ],
    'tournament': [
      mkGame(1, 0, 1, '1-0', 'Jul 2, 2026', 'Ruy Lopez: Closed', 'Swiss \u00B7 R4'),
      mkGame(6, 2, 3, '\u00BD-\u00BD', 'Jul 2, 2026', 'Catalan Opening', 'Swiss \u00B7 R4'),
      mkGame(3, 4, 5, '1-0', 'Jul 2, 2026', 'Sicilian: Alapin', 'Swiss \u00B7 R4'),
      mkGame(8, 1, 4, '1-0', 'Jun 27, 2026', 'Queen\u2019s Gambit Accepted', 'Single elimination \u00B7 QF'),
      mkGame(2, 3, 2, '0-1', 'Jun 27, 2026', 'London System', 'Single elimination \u00B7 QF'),
      mkGame(5, 0, 5, '1-0', 'Jun 20, 2026', 'Italian Game: Giuoco Piano', 'Double round robin \u00B7 R3')
    ]
  };

  /* ---- tournaments ---- */
  function live(id, wi, bi, board, round) {
    return { id: id, white: P(wi), black: P(bi), wRating: R(wi), bRating: R(bi), result: 'LIVE', round: round, board: board, fen: FENS[id % FENS.length], moves: MOVES, classes: CLASSES, evals: EVALS, wAcc: 0, bAcc: 0, live: true };
  }

  var tournaments = [
    {
      id: 'swiss', name: 'Swiss', format: 'Swiss', status: 'Active',
      timeControl: '15+10 Rapid', date: 'Jun 14 \u2013 Jul 12, 2026', location: 'Student Union Hall B', participants: 12,
      round: 'Round 4 of 7', desc: 'The club\u2019s flagship open \u2014 seven Swiss rounds across four weekends, open to all JU students and staff.',
      standings: [
        { rank: 1, p: 0, pts: 3.5, w: 3, d: 1, l: 0, tb: 9.5, opp: 'Omar Saleh', st: 'Playing' },
        { rank: 2, p: 1, pts: 3.0, w: 3, d: 0, l: 1, tb: 9.0, opp: 'Ibrahim Ahmad', st: 'Playing' },
        { rank: 3, p: 2, pts: 3.0, w: 2, d: 2, l: 0, tb: 8.5, opp: 'Yazan Khaled', st: 'Playing' },
        { rank: 4, p: 3, pts: 2.5, w: 2, d: 1, l: 1, tb: 8.0, opp: 'Leen Haddad', st: 'Playing' },
        { rank: 5, p: 4, pts: 2.5, w: 2, d: 1, l: 1, tb: 7.5, opp: 'Mohammad Al-Khatib', st: 'Finished' },
        { rank: 6, p: 5, pts: 2.0, w: 2, d: 0, l: 2, tb: 7.0, opp: 'Sara Nasser', st: 'Finished' },
        { rank: 7, p: 6, pts: 2.0, w: 1, d: 2, l: 1, tb: 6.5, opp: 'Khaled Mansour', st: 'Finished' },
        { rank: 8, p: 7, pts: 1.5, w: 1, d: 1, l: 2, tb: 6.0, opp: 'Rania Odeh', st: 'Finished' },
        { rank: 9, p: 8, pts: 1.5, w: 1, d: 1, l: 2, tb: 5.5, opp: 'Hasan Qasem', st: 'Finished' },
        { rank: 10, p: 9, pts: 1.0, w: 1, d: 0, l: 3, tb: 5.0, opp: 'Tala Suleiman', st: 'Finished' },
        { rank: 11, p: 10, pts: 1.0, w: 0, d: 2, l: 2, tb: 4.5, opp: 'Zaid Hamdan', st: 'Bye' },
        { rank: 12, p: 11, pts: 0.5, w: 0, d: 1, l: 3, tb: 4.0, opp: 'Noor Barakat', st: 'Bye' }
      ],
      liveGames: [live(101, 0, 1, 1, 'R4'), live(102, 2, 3, 2, 'R4'), live(103, 4, 5, 3, 'R4')],
      doneGames: [mkGame(11, 0, 3, '1-0', 'Jun 28', 'Ruy Lopez', 'R3'), mkGame(12, 1, 2, '1-0', 'Jun 28', 'Sicilian Najdorf', 'R3'), mkGame(13, 5, 4, '\u00BD-\u00BD', 'Jun 28', 'Caro-Kann', 'R3'), mkGame(14, 2, 0, '0-1', 'Jun 21', 'Italian Game', 'R2'), mkGame(15, 3, 1, '0-1', 'Jun 21', 'French Defense', 'R2')],
      results: [
        { round: 'Round 3 \u00B7 Jun 28', rows: ['Ibrahim Ahmad 1\u20130 Yazan Khaled', 'Omar Saleh 1\u20130 Leen Haddad', 'Mohammad Al-Khatib \u00BD\u2013\u00BD Sara Nasser', 'Rania Odeh 1\u20130 Hasan Qasem', 'Khaled Mansour \u00BD\u2013\u00BD Tala Suleiman', 'Noor Barakat 1\u20130 Zaid Hamdan'] },
        { round: 'Round 2 \u00B7 Jun 21', rows: ['Leen Haddad 0\u20131 Ibrahim Ahmad', 'Yazan Khaled 0\u20131 Omar Saleh', 'Sara Nasser 1\u20130 Rania Odeh', 'Mohammad Al-Khatib 1\u20130 Khaled Mansour', 'Tala Suleiman \u00BD\u2013\u00BD Noor Barakat', 'Zaid Hamdan 0\u20131 Hasan Qasem'] },
        { round: 'Round 1 \u00B7 Jun 14', rows: ['Ibrahim Ahmad 1\u20130 Rania Odeh', 'Omar Saleh 1\u20130 Khaled Mansour', 'Leen Haddad 1\u20130 Tala Suleiman', 'Yazan Khaled 1\u20130 Hasan Qasem', 'Sara Nasser \u00BD\u2013\u00BD Noor Barakat', 'Mohammad Al-Khatib 1\u20130 Zaid Hamdan'] }
      ],
      schedule: [
        { when: 'Sat Jun 14 \u00B7 2:00 PM', what: 'Round 1', where: 'Hall B', done: true },
        { when: 'Sat Jun 21 \u00B7 2:00 PM', what: 'Round 2', where: 'Hall B', done: true },
        { when: 'Sat Jun 28 \u00B7 2:00 PM', what: 'Round 3', where: 'Hall B', done: true },
        { when: 'Fri Jul 3 \u00B7 5:00 PM', what: 'Round 4', where: 'Hall B', now: true },
        { when: 'Sat Jul 5 \u00B7 2:00 PM', what: 'Round 5', where: 'Hall B' },
        { when: 'Sat Jul 11 \u00B7 2:00 PM', what: 'Round 6', where: 'Hall B' },
        { when: 'Sun Jul 12 \u00B7 2:00 PM', what: 'Round 7 \u00B7 Final round', where: 'Hall B' }
      ]
    },
    {
      id: 'round-robin', name: 'Round robin', format: 'Round robin', status: 'Active',
      timeControl: '10+5 Rapid', date: 'May 3 \u2013 May 31, 2026', location: 'Engineering Lounge', participants: 6,
      round: 'Final \u00B7 5 rounds', desc: 'Six faculty champions, everyone plays everyone once.',
      rrPlayers: [0, 1, 2, 3, 4, 5],
      rrGrid: [
        ['\u2014', '1', '\u00BD', '1', '1', '1'],
        ['0', '\u2014', '1', '\u00BD', '1', '1'],
        ['\u00BD', '0', '\u2014', '1', '\u00BD', '1'],
        ['0', '\u00BD', '0', '\u2014', '1', '\u00BD'],
        ['0', '0', '\u00BD', '0', '\u2014', '1'],
        ['0', '0', '0', '\u00BD', '0', '\u2014']
      ],
      standings: [
        { rank: 1, p: 0, pts: 4.5, w: 4, d: 1, l: 0, tb: 11.25, opp: '\u2014', st: 'Final' },
        { rank: 2, p: 1, pts: 3.5, w: 3, d: 1, l: 1, tb: 8.0, opp: '\u2014', st: 'Final' },
        { rank: 3, p: 2, pts: 3.0, w: 2, d: 2, l: 1, tb: 7.25, opp: '\u2014', st: 'Final' },
        { rank: 4, p: 3, pts: 2.0, w: 1, d: 2, l: 2, tb: 4.5, opp: '\u2014', st: 'Final' },
        { rank: 5, p: 4, pts: 1.5, w: 1, d: 1, l: 3, tb: 3.25, opp: '\u2014', st: 'Final' },
        { rank: 6, p: 5, pts: 0.5, w: 0, d: 1, l: 4, tb: 1.0, opp: '\u2014', st: 'Final' }
      ],
      doneGames: [mkGame(21, 0, 1, '1-0', 'May 31', 'Ruy Lopez', 'R5'), mkGame(22, 2, 3, '1-0', 'May 31', 'Sicilian', 'R5'), mkGame(23, 4, 5, '1-0', 'May 31', 'QGD', 'R5'), mkGame(24, 1, 2, '1-0', 'May 24', 'English', 'R4')],
      results: [
        { round: 'Round 5 \u00B7 May 31', rows: ['Ibrahim Ahmad 1\u20130 Omar Saleh', 'Leen Haddad 1\u20130 Yazan Khaled', 'Sara Nasser 1\u20130 Mohammad Al-Khatib'] },
        { round: 'Round 4 \u00B7 May 24', rows: ['Omar Saleh 1\u20130 Leen Haddad', 'Ibrahim Ahmad 1\u20130 Sara Nasser', 'Yazan Khaled \u00BD\u2013\u00BD Mohammad Al-Khatib'] },
        { round: 'Round 3 \u00B7 May 17', rows: ['Ibrahim Ahmad \u00BD\u2013\u00BD Leen Haddad', 'Omar Saleh 1\u20130 Mohammad Al-Khatib', 'Yazan Khaled 1\u20130 Sara Nasser'] }
      ],
      schedule: [
        { when: 'Sun May 3 \u00B7 4:00 PM', what: 'Rounds 1\u20132', where: 'Engineering Lounge', done: true },
        { when: 'Sun May 17 \u00B7 4:00 PM', what: 'Round 3', where: 'Engineering Lounge', done: true },
        { when: 'Sun May 24 \u00B7 4:00 PM', what: 'Round 4', where: 'Engineering Lounge', done: true },
        { when: 'Sun May 31 \u00B7 4:00 PM', what: 'Round 5 \u00B7 Closing', where: 'Engineering Lounge', done: true }
      ]
    },
    {
      id: 'double-round-robin', name: 'Double round robin', format: 'Double round robin', status: 'Active',
      timeControl: '25+10 Classical', date: 'Jun 1 \u2013 Jul 20, 2026', location: 'Library Seminar Room 2', participants: 4,
      round: 'Cycle 2 \u00B7 Round 5 of 6', desc: 'Top four club ratings meet twice \u2014 once with each color.',
      rrPlayers: [0, 1, 2, 3], drr: true,
      rrGrid: [
        ['\u2014', '1 / \u00BD', '\u00BD / 1', '1 / \u2026'],
        ['0 / \u00BD', '\u2014', '1 / 1', '\u00BD / \u2026'],
        ['\u00BD / 0', '0 / 0', '\u2014', '1 / \u00BD'],
        ['0 / \u2026', '\u00BD / \u2026', '0 / \u00BD', '\u2014']
      ],
      standings: [
        { rank: 1, p: 0, pts: 4.0, w: 3, d: 2, l: 0, tb: 9.75, opp: 'Yazan Khaled', st: 'Playing' },
        { rank: 2, p: 1, pts: 3.0, w: 2, d: 2, l: 1, tb: 7.5, opp: 'Leen Haddad', st: 'Playing' },
        { rank: 3, p: 2, pts: 2.0, w: 1, d: 2, l: 2, tb: 5.0, opp: 'Omar Saleh', st: 'Playing' },
        { rank: 4, p: 3, pts: 1.0, w: 0, d: 2, l: 3, tb: 2.75, opp: 'Ibrahim Ahmad', st: 'Playing' }
      ],
      liveGames: [live(104, 0, 3, 1, 'C2 R5'), live(105, 1, 2, 2, 'C2 R5')],
      doneGames: [mkGame(31, 0, 1, '1-0', 'Jun 22', 'Catalan', 'C2 R4'), mkGame(32, 2, 3, '1-0', 'Jun 22', 'Slav', 'C2 R4'), mkGame(33, 1, 0, '\u00BD-\u00BD', 'Jun 15', 'Berlin', 'C2 R3')],
      results: [
        { round: 'Cycle 2 \u00B7 Round 4 \u00B7 Jun 22', rows: ['Ibrahim Ahmad (W) 1\u20130 Omar Saleh', 'Leen Haddad (W) 1\u20130 Yazan Khaled'] },
        { round: 'Cycle 2 \u00B7 Round 3 \u00B7 Jun 15', rows: ['Omar Saleh (W) \u00BD\u2013\u00BD Ibrahim Ahmad', 'Yazan Khaled (W) \u00BD\u2013\u00BD Leen Haddad'] },
        { round: 'Cycle 1 complete \u00B7 Jun 8', rows: ['Ibrahim Ahmad 2\u00BD / 3', 'Omar Saleh 2 / 3', 'Leen Haddad 1 / 3', 'Yazan Khaled \u00BD / 3'] }
      ],
      schedule: [
        { when: 'Jun 1 \u2013 Jun 8', what: 'Cycle 1 \u00B7 Rounds 1\u20133', where: 'Seminar Room 2', done: true },
        { when: 'Mon Jun 15 \u00B7 5:00 PM', what: 'Cycle 2 \u00B7 Round 3', where: 'Seminar Room 2', done: true },
        { when: 'Mon Jun 22 \u00B7 5:00 PM', what: 'Cycle 2 \u00B7 Round 4', where: 'Seminar Room 2', done: true },
        { when: 'Fri Jul 3 \u00B7 5:30 PM', what: 'Cycle 2 \u00B7 Round 5', where: 'Seminar Room 2', now: true },
        { when: 'Mon Jul 20 \u00B7 5:00 PM', what: 'Cycle 2 \u00B7 Round 6 \u00B7 Final', where: 'Seminar Room 2' }
      ]
    },
    {
      id: 'single-elimination', name: 'Single elimination', format: 'Single elimination', status: 'Active',
      timeControl: '10+0 Blitz', date: 'Jun 20 \u2013 Jul 10, 2026', location: 'Hall A', participants: 16,
      round: 'Semifinals', desc: 'Sixteen enter, one lifts the cup. Straight knockout, no second chances.',
      bracket: {
        rounds: ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'],
        matches: [
          [
            { a: 'Ibrahim Ahmad', b: 'Zaid Hamdan', sa: 1, sb: 0, w: 'a' },
            { a: 'Hasan Qasem', b: 'Sara Nasser', sa: 0, sb: 1, w: 'b' },
            { a: 'Leen Haddad', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Khaled Mansour', b: 'Yazan Khaled', sa: 0, sb: 1, w: 'b' },
            { a: 'Omar Saleh', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Rania Odeh', b: 'Mohammad Al-Khatib', sa: 0, sb: 1, w: 'b' },
            { a: 'Amr Zaidan', b: 'Lina Shami', sa: 1, sb: 0, w: 'a' },
            { a: 'Fadi Rimawi', b: 'Dana Aqel', sa: 0, sb: 1, w: 'b' }
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Sara Nasser', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Yazan Khaled', sa: 1, sb: 0, w: 'a' },
            { a: 'Omar Saleh', b: 'Mohammad Al-Khatib', sa: 1, sb: 0, w: 'a' },
            { a: 'Amr Zaidan', b: 'Dana Aqel', sa: 0, sb: 1, w: 'b' }
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Leen Haddad', live: true },
            { a: 'Omar Saleh', b: 'Dana Aqel', live: true }
          ],
          [
            { a: 'TBD', b: 'TBD' }
          ]
        ]
      },
      liveGames: [live(106, 0, 2, 1, 'SF'), live(107, 1, 8, 2, 'SF')],
      doneGames: [mkGame(41, 0, 4, '1-0', 'Jun 27', 'Sicilian', 'QF'), mkGame(42, 2, 3, '1-0', 'Jun 27', 'Italian', 'QF'), mkGame(43, 1, 5, '1-0', 'Jun 27', 'QGD', 'QF')],
      results: [
        { round: 'Quarterfinals \u00B7 Jun 27', rows: ['Ibrahim Ahmad 1\u20130 Sara Nasser', 'Leen Haddad 1\u20130 Yazan Khaled', 'Omar Saleh 1\u20130 Mohammad Al-Khatib', 'Dana Aqel 1\u20130 Amr Zaidan'] },
        { round: 'Round of 16 \u00B7 Jun 20', rows: ['Ibrahim Ahmad 1\u20130 Zaid Hamdan', 'Sara Nasser 1\u20130 Hasan Qasem', 'Leen Haddad 1\u20130 Noor Barakat', 'Yazan Khaled 1\u20130 Khaled Mansour', 'Omar Saleh 1\u20130 Tala Suleiman', 'Mohammad Al-Khatib 1\u20130 Rania Odeh', 'Amr Zaidan 1\u20130 Lina Shami', 'Dana Aqel 1\u20130 Fadi Rimawi'] }
      ],
      schedule: [
        { when: 'Sat Jun 20 \u00B7 3:00 PM', what: 'Round of 16', where: 'Hall A', done: true },
        { when: 'Sat Jun 27 \u00B7 3:00 PM', what: 'Quarterfinals', where: 'Hall A', done: true },
        { when: 'Fri Jul 3 \u00B7 6:00 PM', what: 'Semifinals', where: 'Hall A', now: true },
        { when: 'Fri Jul 10 \u00B7 6:00 PM', what: 'Final', where: 'Hall A \u00B7 Main stage' }
      ]
    },
    {
      id: 'double-elimination', name: 'Double elimination', format: 'Double elimination', status: 'Active',
      timeControl: '5+3 Blitz', date: 'Jun 26 \u2013 Jul 5, 2026', location: 'Hall A', participants: 12,
      round: 'Losers Round 3', desc: 'Twelve blitz players, two lives each. Lose once, drop to the losers bracket; lose twice, you\u2019re out.',
      winners: {
        rounds: ['Round 1', 'Round 2', 'Semifinal', 'W-Final'],
        matches: [
          [
            { a: 'Sara Nasser', b: 'Zaid Hamdan', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Mohammad Al-Khatib', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Rania Odeh', b: 'Hasan Qasem', sa: 0, sb: 1, w: 'b' }
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Sara Nasser', sa: 1, sb: 0, w: 'a' },
            { a: 'Omar Saleh', b: 'Yazan Khaled', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Mohammad Al-Khatib', sa: 1, sb: 0, w: 'a' },
            { a: 'Khaled Mansour', b: 'Hasan Qasem', sa: 1, sb: 0, w: 'a' }
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Omar Saleh', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Khaled Mansour', sa: 1, sb: 0, w: 'a' }
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Leen Haddad', live: true }
          ]
        ]
      },
      losers: {
        rounds: ['L-Round 1', 'L-Round 2', 'L-Round 3', 'L-Final'],
        matches: [
          [
            { a: 'Zaid Hamdan', b: 'Noor Barakat', sa: 0, sb: 1, w: 'b' },
            { a: 'Tala Suleiman', b: 'Rania Odeh', sa: 1, sb: 0, w: 'a' }
          ],
          [
            { a: 'Sara Nasser', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Mohammad Al-Khatib', b: 'Hasan Qasem', sa: 1, sb: 0, w: 'a' }
          ],
          [
            { a: 'Omar Saleh', b: 'Sara Nasser', live: true },
            { a: 'Khaled Mansour', b: 'Yazan Khaled', live: true },
            { a: 'Mohammad Al-Khatib', b: 'bye', sa: 1, sb: 0, w: 'a' }
          ],
          [
            { a: 'TBD', b: 'TBD' }
          ]
        ]
      },
      finals: {
        rounds: ['Grand Final'],
        matches: [[{ a: 'Winners champion', b: 'Losers champion' }]]
      },
      liveGames: [live(108, 0, 2, 1, 'W-Final'), live(109, 1, 4, 2, 'L-R3'), live(110, 7, 3, 3, 'L-R3')],
      doneGames: [mkGame(51, 0, 1, '1-0', 'Jul 1', 'Vienna', 'W-SF'), mkGame(52, 2, 7, '1-0', 'Jul 1', 'Pirc', 'W-SF')],
      results: [
        { round: 'Winners Semifinal \u00B7 Jul 1', rows: ['Ibrahim Ahmad 1\u20130 Omar Saleh', 'Leen Haddad 1\u20130 Khaled Mansour'] },
        { round: 'Losers Round 2 \u00B7 Jun 30', rows: ['Sara Nasser 1\u20130 Noor Barakat', 'Yazan Khaled 1\u20130 Tala Suleiman', 'Mohammad Al-Khatib 1\u20130 Hasan Qasem'] },
        { round: 'Winners Round 2 \u00B7 Jun 28', rows: ['Ibrahim Ahmad 1\u20130 Sara Nasser', 'Omar Saleh 1\u20130 Yazan Khaled', 'Leen Haddad 1\u20130 Mohammad Al-Khatib', 'Khaled Mansour 1\u20130 Hasan Qasem'] }
      ],
      schedule: [
        { when: 'Fri Jun 26 \u00B7 6:00 PM', what: 'Winners Round 1', where: 'Hall A', done: true },
        { when: 'Sun Jun 28 \u00B7 6:00 PM', what: 'Winners Round 2 \u00B7 Losers Round 1', where: 'Hall A', done: true },
        { when: 'Tue Jun 30 \u00B7 6:00 PM', what: 'Losers Round 2', where: 'Hall A', done: true },
        { when: 'Fri Jul 3 \u00B7 7:00 PM', what: 'Winners Final \u00B7 Losers Round 3', where: 'Hall A', now: true },
        { when: 'Sun Jul 5 \u00B7 6:00 PM', what: 'Losers Final \u00B7 Grand Final', where: 'Hall A' }
      ]
    },
    {
      id: 'league', name: 'League', format: 'League', status: 'Active',
      timeControl: '15+10 Rapid', date: 'Feb 8 \u2013 Nov 22, 2026', location: 'Rotating campuses', participants: 8,
      round: 'Week 14 of 22', desc: 'Season-long league \u2014 one fixture a week, three points for a win.',
      league: [
        { rank: 1, team: 'JU Knights', pl: 13, w: 10, d: 2, l: 1, gf: 34.5, pts: 32 },
        { rank: 2, team: 'GJU Gambits', pl: 13, w: 9, d: 2, l: 2, gf: 31.0, pts: 29 },
        { rank: 3, team: 'PSUT Rooks', pl: 13, w: 8, d: 1, l: 4, gf: 28.5, pts: 25 },
        { rank: 4, team: 'HU Bishops', pl: 13, w: 6, d: 3, l: 4, gf: 26.0, pts: 21 },
        { rank: 5, team: 'YU Pawns', pl: 13, w: 5, d: 2, l: 6, gf: 22.5, pts: 17 },
        { rank: 6, team: 'MU Castles', pl: 13, w: 3, d: 4, l: 6, gf: 20.0, pts: 13 },
        { rank: 7, team: 'AAU Checks', pl: 13, w: 2, d: 3, l: 8, gf: 17.5, pts: 9 },
        { rank: 8, team: 'ZU Squares', pl: 13, w: 1, d: 3, l: 9, gf: 15.0, pts: 6 }
      ],
      fixtures: [
        { week: 'Week 14 \u00B7 Jul 4', rows: [{ h: 'JU Knights', a: 'PSUT Rooks', s: 'Sat 3:00 PM', live: false }, { h: 'GJU Gambits', a: 'HU Bishops', s: 'Sat 3:00 PM' }, { h: 'YU Pawns', a: 'MU Castles', s: 'Sat 5:00 PM' }, { h: 'AAU Checks', a: 'ZU Squares', s: 'Sat 5:00 PM' }] },
        { week: 'Week 13 \u00B7 Jun 27 \u00B7 Results', rows: [{ h: 'JU Knights', a: 'GJU Gambits', s: '2\u00BD \u2013 1\u00BD' }, { h: 'PSUT Rooks', a: 'YU Pawns', s: '3 \u2013 1' }, { h: 'HU Bishops', a: 'AAU Checks', s: '2 \u2013 2' }, { h: 'MU Castles', a: 'ZU Squares', s: '2\u00BD \u2013 1\u00BD' }] },
        { week: 'Week 12 \u00B7 Jun 20 \u00B7 Results', rows: [{ h: 'GJU Gambits', a: 'PSUT Rooks', s: '3 \u2013 1' }, { h: 'JU Knights', a: 'HU Bishops', s: '3\u00BD \u2013 \u00BD' }, { h: 'ZU Squares', a: 'YU Pawns', s: '1 \u2013 3' }, { h: 'MU Castles', a: 'AAU Checks', s: '2 \u2013 2' }] }
      ],
      doneGames: [mkGame(61, 0, 1, '1-0', 'Jun 27', 'Catalan', 'Wk 13 \u00B7 Bd 1'), mkGame(62, 2, 3, '\u00BD-\u00BD', 'Jun 27', 'Slav', 'Wk 13 \u00B7 Bd 2'), mkGame(63, 4, 5, '1-0', 'Jun 27', 'Najdorf', 'Wk 13 \u00B7 Bd 3')],
      results: [
        { round: 'Week 13 \u00B7 Jun 27', rows: ['JU Knights 2\u00BD \u2013 1\u00BD GJU Gambits', 'PSUT Rooks 3 \u2013 1 YU Pawns', 'HU Bishops 2 \u2013 2 AAU Checks', 'MU Castles 2\u00BD \u2013 1\u00BD ZU Squares'] },
        { round: 'Week 12 \u00B7 Jun 20', rows: ['GJU Gambits 3 \u2013 1 PSUT Rooks', 'JU Knights 3\u00BD \u2013 \u00BD HU Bishops', 'YU Pawns 3 \u2013 1 ZU Squares', 'MU Castles 2 \u2013 2 AAU Checks'] }
      ],
      schedule: [
        { when: 'Sat Jun 27 \u00B7 3:00 PM', what: 'Week 13 fixtures', where: 'JU Campus', done: true },
        { when: 'Sat Jul 4 \u00B7 3:00 PM', what: 'Week 14 fixtures', where: 'PSUT Campus', now: true },
        { when: 'Sat Jul 11 \u00B7 3:00 PM', what: 'Week 15 fixtures', where: 'GJU Campus' },
        { when: 'Sat Jul 18 \u00B7 3:00 PM', what: 'Week 16 fixtures', where: 'HU Campus' }
      ]
    },
    {
      id: 'team', name: 'Team', format: 'Team', status: 'Active',
      timeControl: '25+10 Classical', date: 'Jun 13, 2026', location: 'JU Main Auditorium', participants: 8,
      round: 'Final score 2\u00BD \u2013 1\u00BD', desc: 'Annual four-board friendly against German Jordanian University.',
      teamScore: { home: 'JU', away: 'GJU', hs: '2\u00BD', as: '1\u00BD' },
      boards: [
        { bd: 1, home: 'Ibrahim Ahmad', hr: 1810, away: 'Karim Nabulsi', ar: 1795, res: '1\u20130' },
        { bd: 2, home: 'Omar Saleh', hr: 1740, away: 'Samer Ayyad', ar: 1752, res: '\u00BD\u2013\u00BD' },
        { bd: 3, home: 'Leen Haddad', hr: 1685, away: 'Nadia Faris', ar: 1670, res: '1\u20130' },
        { bd: 4, home: 'Yazan Khaled', hr: 1602, away: 'Basel Hourani', ar: 1615, res: '0\u20131' }
      ],
      teamStandings: [
        { rank: 1, team: 'JU', mp: 3, w: 2, d: 1, l: 0, bp: 8.0, pts: 5 },
        { rank: 2, team: 'GJU', mp: 3, w: 1, d: 1, l: 1, bp: 6.5, pts: 3 },
        { rank: 3, team: 'PSUT', mp: 3, w: 0, d: 2, l: 1, bp: 5.0, pts: 2 },
        { rank: 4, team: 'HU', mp: 3, w: 0, d: 2, l: 1, bp: 4.5, pts: 2 }
      ],
      doneGames: [mkGame(71, 0, 1, '1-0', 'Jun 13', 'Ruy Lopez', 'Bd 1'), mkGame(72, 1, 2, '\u00BD-\u00BD', 'Jun 13', 'Grunfeld', 'Bd 2'), mkGame(73, 2, 3, '1-0', 'Jun 13', 'Italian', 'Bd 3'), mkGame(74, 3, 4, '0-1', 'Jun 13', 'Sicilian', 'Bd 4')],
      results: [
        { round: 'Match result \u00B7 Jun 13', rows: ['Board 1 \u00B7 Ibrahim Ahmad 1\u20130 Karim Nabulsi', 'Board 2 \u00B7 Omar Saleh \u00BD\u2013\u00BD Samer Ayyad', 'Board 3 \u00B7 Leen Haddad 1\u20130 Nadia Faris', 'Board 4 \u00B7 Yazan Khaled 0\u20131 Basel Hourani'] }
      ],
      schedule: [
        { when: 'Sat Jun 13 \u00B7 1:00 PM', what: 'Opening ceremony', where: 'Main Auditorium', done: true },
        { when: 'Sat Jun 13 \u00B7 2:00 PM', what: 'Boards 1\u20134', where: 'Main Auditorium', done: true },
        { when: 'Sat Jun 13 \u00B7 6:00 PM', what: 'Trophy presentation', where: 'Main Auditorium', done: true }
      ]
    },
    {
      id: 'arena', name: 'Arena', format: 'Arena', status: 'Active',
      timeControl: '3+2 Blitz', date: 'Jul 3, 2026 \u00B7 7:00\u20139:00 PM', location: 'Online \u00B7 Club room', participants: 12,
      round: 'In progress \u00B7 ends 9:00 PM', desc: 'Two hours, unlimited games, streak bonuses. Highest score wins.',
      arena: {
        endsIn: 47 * 60,
        board: [
          { rank: 1, p: 1, score: 24, games: 9, streak: 4 },
          { rank: 2, p: 0, score: 22, games: 8, streak: 2 },
          { rank: 3, p: 3, score: 17, games: 9, streak: 0 },
          { rank: 4, p: 2, score: 15, games: 7, streak: 1 },
          { rank: 5, p: 5, score: 12, games: 8, streak: 0 },
          { rank: 6, p: 4, score: 11, games: 6, streak: 2 },
          { rank: 7, p: 6, score: 9, games: 7, streak: 0 },
          { rank: 8, p: 8, score: 7, games: 6, streak: 0 },
          { rank: 9, p: 7, score: 6, games: 5, streak: 1 },
          { rank: 10, p: 9, score: 5, games: 6, streak: 0 },
          { rank: 11, p: 10, score: 3, games: 4, streak: 0 },
          { rank: 12, p: 11, score: 2, games: 4, streak: 0 }
        ],
        feed: ['Omar Saleh beat Yazan Khaled \u00B7 +3 streak', 'Ibrahim Ahmad beat Sara Nasser \u00B7 +2', 'Leen Haddad drew Mohammad Al-Khatib \u00B7 +1', 'Rania Odeh beat Tala Suleiman \u00B7 +2', 'Khaled Mansour lost to Omar Saleh', 'Hasan Qasem beat Zaid Hamdan \u00B7 +2']
      },
      liveGames: [live(111, 1, 3, 1, 'Arena'), live(112, 0, 4, 2, 'Arena'), live(113, 2, 5, 3, 'Arena'), live(114, 6, 8, 4, 'Arena'), live(115, 7, 9, 5, 'Arena'), live(116, 10, 11, 6, 'Arena')],
      doneGames: [mkGame(81, 1, 3, '1-0', 'Jul 3', 'Vienna', 'Arena'), mkGame(82, 0, 4, '1-0', 'Jul 3', 'Scotch', 'Arena')],
      results: [
        { round: 'Recent arena results', rows: ['Omar Saleh 1\u20130 Yazan Khaled', 'Ibrahim Ahmad 1\u20130 Sara Nasser', 'Leen Haddad \u00BD\u2013\u00BD Mohammad Al-Khatib', 'Rania Odeh 1\u20130 Tala Suleiman'] }
      ],
      schedule: [
        { when: 'Fri Jul 3 \u00B7 7:00 PM', what: 'Arena opens', where: 'Club room', done: true },
        { when: 'Fri Jul 3 \u00B7 9:00 PM', what: 'Arena closes \u00B7 podium', where: 'Club room', now: true }
      ]
    },
    {
      id: 'multi-stage', name: 'Multi-stage', format: 'Multi-stage', status: 'Active',
      timeControl: '15+10 Rapid', date: 'May 10 \u2013 Jul 25, 2026', location: 'Hall A + Hall B', participants: 12,
      round: 'Stage 2 \u00B7 Quarterfinals', desc: 'Stage 1: 12-player Swiss qualifies the top eight. Stage 2: knockout for the university title.',
      stages: ['Stage 1 \u00B7 Swiss', 'Stage 2 \u00B7 Knockout'],
      standings: [
        { rank: 1, p: 0, pts: 5.5, w: 5, d: 1, l: 1, tb: 24.5, opp: '\u2014', st: 'Qualified' },
        { rank: 2, p: 1, pts: 5.0, w: 5, d: 0, l: 2, tb: 23.0, opp: '\u2014', st: 'Qualified' },
        { rank: 3, p: 2, pts: 5.0, w: 4, d: 2, l: 1, tb: 22.5, opp: '\u2014', st: 'Qualified' },
        { rank: 4, p: 3, pts: 4.5, w: 4, d: 1, l: 2, tb: 21.0, opp: '\u2014', st: 'Qualified' },
        { rank: 5, p: 4, pts: 4.0, w: 3, d: 2, l: 2, tb: 19.5, opp: '\u2014', st: 'Qualified' },
        { rank: 6, p: 5, pts: 4.0, w: 4, d: 0, l: 3, tb: 18.0, opp: '\u2014', st: 'Qualified' },
        { rank: 7, p: 6, pts: 3.5, w: 3, d: 1, l: 3, tb: 17.0, opp: '\u2014', st: 'Qualified' },
        { rank: 8, p: 7, pts: 3.5, w: 3, d: 1, l: 3, tb: 16.5, opp: '\u2014', st: 'Qualified' },
        { rank: 9, p: 8, pts: 3.0, w: 2, d: 2, l: 3, tb: 15.0, opp: '\u2014', st: 'Eliminated' },
        { rank: 10, p: 9, pts: 2.5, w: 2, d: 1, l: 4, tb: 13.5, opp: '\u2014', st: 'Eliminated' },
        { rank: 11, p: 10, pts: 2.0, w: 1, d: 2, l: 4, tb: 12.0, opp: '\u2014', st: 'Eliminated' },
        { rank: 12, p: 11, pts: 1.5, w: 1, d: 1, l: 5, tb: 10.5, opp: '\u2014', st: 'Eliminated' }
      ],
      bracket: {
        rounds: ['Quarterfinal', 'Semifinal', 'Final'],
        matches: [
          [
            { a: 'Ibrahim Ahmad', b: 'Khaled Mansour', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Sara Nasser', live: true },
            { a: 'Leen Haddad', b: 'Mohammad Al-Khatib', live: true },
            { a: 'Omar Saleh', b: 'Rania Odeh', sa: 1, sb: 0, w: 'a' }
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'TBD' },
            { a: 'Omar Saleh', b: 'TBD' }
          ],
          [
            { a: 'TBD', b: 'TBD' }
          ]
        ]
      },
      liveGames: [live(117, 3, 4, 1, 'Stage 2 QF'), live(118, 2, 5, 2, 'Stage 2 QF')],
      doneGames: [mkGame(91, 0, 7, '1-0', 'Jun 29', 'Catalan', 'Stage 2 QF'), mkGame(92, 1, 6, '1-0', 'Jun 29', 'Najdorf', 'Stage 2 QF')],
      results: [
        { round: 'Stage 2 \u00B7 Quarterfinals \u00B7 Jun 29', rows: ['Ibrahim Ahmad 1\u20130 Khaled Mansour', 'Omar Saleh 1\u20130 Rania Odeh'] },
        { round: 'Stage 1 \u00B7 Final Swiss standings \u00B7 Jun 21', rows: ['1. Ibrahim Ahmad 5\u00BD/7', '2. Omar Saleh 5/7', '3. Leen Haddad 5/7', '4. Yazan Khaled 4\u00BD/7 \u00B7 top 8 qualify'] }
      ],
      schedule: [
        { when: 'May 10 \u2013 Jun 21', what: 'Stage 1 \u00B7 Swiss rounds 1\u20137', where: 'Hall B', done: true },
        { when: 'Mon Jun 29 \u00B7 5:00 PM', what: 'Stage 2 \u00B7 Quarterfinals', where: 'Hall A', done: true },
        { when: 'Fri Jul 3 \u00B7 5:00 PM', what: 'Remaining quarterfinals', where: 'Hall A', now: true },
        { when: 'Sat Jul 18 \u00B7 4:00 PM', what: 'Semifinals', where: 'Hall A' },
        { when: 'Sat Jul 25 \u00B7 4:00 PM', what: 'Final \u00B7 Title match', where: 'Main Auditorium' }
      ]
    }
  ];

  /* ================= round-based game generation (realistic per format) ================= */
  var OPEN = ['Ruy Lopez', 'Italian Game', 'Sicilian: Najdorf', 'Caro-Kann', 'French Defense', 'Queen\u2019s Gambit Declined', 'Slav Defense', 'English Opening', 'Catalan', 'Nimzo-Indian', 'King\u2019s Indian', 'Vienna Game', 'Scotch Game', 'London System', 'Petroff Defense', 'Gr\u00FCnfeld'];
  var _gid = 3000;
  function nameRating(n) { for (var i = 0; i < players.length; i++) if (players[i].name === n) return players[i].rating; return 1500 + ((n.length * 7) % 260); }
  function G(w, b, res, live) {
    _gid++;
    return {
      id: _gid, white: w, black: b, wRating: nameRating(w), bRating: nameRating(b),
      result: live ? 'LIVE' : res, live: !!live, round: '', board: 0,
      opening: OPEN[_gid % OPEN.length],
      fen: FENS[_gid % FENS.length], moves: MOVES, classes: CLASSES, evals: EVALS,
      wAcc: [91.4, 84.2, 88.7, 79.3, 93.1, 86.5][_gid % 6], bAcc: [83.6, 88.9, 76.2, 90.4, 81.7, 74.9][_gid % 6]
    };
  }
  function res2(a, b, salt) {
    var h = Math.abs(a * 7 + b * 13 + salt * 5) % 10;
    if (h < 2) return '\u00BD-\u00BD';
    return (R(a) >= R(b)) ? (h < 7 ? '1-0' : '0-1') : (h < 7 ? '0-1' : '1-0');
  }
  function circle(ids) {
    var arr = ids.slice();
    if (arr.length % 2) arr.push(-1);
    var n = arr.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var pr = [];
      for (var i = 0; i < n / 2; i++) { var a = arr[i], b = arr[n - 1 - i]; if (a !== -1 && b !== -1) pr.push([a, b]); }
      arr.splice(1, 0, arr.pop());
      rounds.push(pr);
    }
    return rounds;
  }
  function fromBracket(br) {
    var out = [];
    br.rounds.forEach(function (rn, ri) {
      var ms = br.matches[ri] || [], games = [], anyLive = false;
      ms.forEach(function (m) {
        if (!m.a || !m.b) return;
        if (/TBD|bye|champion/i.test(m.a) || /TBD|bye|champion/i.test(m.b)) return;
        var res = m.live ? 'LIVE' : (m.w === 'a' ? '1-0' : (m.w === 'b' ? '0-1' : '\u00BD-\u00BD'));
        if (m.live) anyLive = true;
        games.push(G(m.a, m.b, res, m.live));
      });
      if (games.length) out.push({ label: rn, live: anyLive, games: games });
    });
    return out;
  }
  function buildRounds(t) {
    var rounds = [];
    if (t.format === 'Round robin' || t.format === 'Double round robin') {
      var ids = t.rrPlayers.slice();
      var base = circle(ids);
      var cycles = (t.format === 'Double round robin') ? 2 : 1;
      var all = [];
      for (var c = 0; c < cycles; c++) {
        base.forEach(function (pr, ri) {
          var games = pr.map(function (mm) {
            var a = (c === 0) ? mm[0] : mm[1], b = (c === 0) ? mm[1] : mm[0];
            return G(P(a), P(b), res2(a, b, ri + c * 3), false);
          });
          all.push({ label: (cycles > 1 ? 'Cycle ' + (c + 1) + ' \u00B7 ' : '') + 'Round ' + (ri + 1), live: false, games: games });
        });
      }
      var showRR = (cycles > 1) ? all.length - 1 : all.length;
      rounds = all.slice(0, showRR);
      if (rounds.length) { var lastR = rounds[rounds.length - 1]; lastR.live = true; lastR.games.forEach(function (g) { g.result = 'LIVE'; g.live = true; }); }
    } else if (t.format === 'Swiss') {
      var sids = t.standings.map(function (s) { return s.p; });
      var sched = circle(sids);
      var mm2 = /(\d+)\s*of\s*(\d+)/i.exec(t.round) || /Round\s*(\d+)/i.exec(t.round);
      var cur = mm2 ? parseInt(mm2[1], 10) : Math.min(4, sched.length);
      cur = Math.min(cur, sched.length);
      for (var ri2 = 0; ri2 < cur; ri2++) {
        var liveR = (ri2 === cur - 1);
        var g2 = sched[ri2].map(function (pp) { return G(P(pp[0]), P(pp[1]), res2(pp[0], pp[1], ri2), liveR); });
        rounds.push({ label: 'Round ' + (ri2 + 1), live: liveR, games: g2 });
      }
    } else if (t.format === 'Single elimination') {
      rounds = fromBracket(t.bracket);
    } else if (t.format === 'Double elimination') {
      rounds = fromBracket(t.winners).map(function (r) { return { label: 'Winners \u00B7 ' + r.label, live: r.live, games: r.games }; })
        .concat(fromBracket(t.losers).map(function (r) { return { label: 'Losers \u00B7 ' + r.label, live: r.live, games: r.games }; }));
    } else if (t.format === 'Multi-stage') {
      var q = t.standings.map(function (s) { return s.p; });
      var st1 = circle(q);
      for (var si = 0; si < Math.min(7, st1.length); si++) {
        rounds.push({ label: 'Stage 1 \u00B7 Round ' + (si + 1), live: false, games: st1[si].map(function (pp) { return G(P(pp[0]), P(pp[1]), res2(pp[0], pp[1], si), false); }) });
      }
      fromBracket(t.bracket).forEach(function (r) { rounds.push({ label: 'Stage 2 \u00B7 ' + r.label, live: r.live, games: r.games }); });
    } else if (t.format === 'Team') {
      rounds = [{ label: 'Match boards', live: false, games: t.boards.map(function (b) { return G(b.home, b.away, b.res === '1\u20130' ? '1-0' : (b.res === '0\u20131' ? '0-1' : '\u00BD-\u00BD'), false); }) }];
    } else if (t.format === 'League') {
      var wk = /Week\s*(\d+)/i.exec(t.round);
      var curW = wk ? parseInt(wk[1], 10) : 14;
      var boardsPer = [[0, 1], [2, 3], [4, 5], [6, 7]];
      for (var w = 0; w < 3; w++) {
        var wn = curW - w, liveW = (w === 0);
        rounds.push({ label: 'Week ' + wn, live: liveW, games: boardsPer.map(function (pp) { return G(P((pp[0] + w) % 8), P((pp[1] + w) % 8), res2(pp[0] + w, pp[1] + w, w), liveW); }) });
      }
    } else if (t.format === 'Arena') {
      var lg = (t.liveGames || []).slice();
      var dg = (t.doneGames || []).slice();
      if (lg.length) rounds.push({ label: 'Live now', live: true, games: lg });
      if (dg.length) rounds.push({ label: 'Recent games', live: false, games: dg });
    }
    rounds.forEach(function (rd) { rd.games.forEach(function (g, i) { g.board = i + 1; g.round = rd.label; }); });
    return rounds;
  }
  tournaments.forEach(function (t) { t.gameRounds = buildRounds(t); });

  window.JU = {
    players: players,
    tournaments: tournaments,
    gamesBySource: gamesBySource,
    fenBoard: fenBoard,
    getTournament: function (id) {
      for (var i = 0; i < tournaments.length; i++) if (tournaments[i].id === id) return tournaments[i];
      return tournaments[0];
    },
    findGame: function (id) {
      var pools = [gamesBySource['chess.com'], gamesBySource['lichess'], gamesBySource['tournament']];
      tournaments.forEach(function (t) { if (t.liveGames) pools.push(t.liveGames); if (t.doneGames) pools.push(t.doneGames); if (t.gameRounds) t.gameRounds.forEach(function (rd) { pools.push(rd.games); }); });
      for (var i = 0; i < pools.length; i++) for (var j = 0; j < pools[i].length; j++) if (String(pools[i][j].id) === String(id)) return pools[i][j];
      return null;
    },
    auth: {
      get: function () { try { return JSON.parse(localStorage.getItem('ju_auth') || 'null'); } catch (e) { return null; } },
      set: function (u) { try { localStorage.setItem('ju_auth', JSON.stringify(u)); } catch (e) {} },
      clear: function () { try { localStorage.removeItem('ju_auth'); } catch (e) {} },
      initials: function (name) { return (name || '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
    }
  };
})();
