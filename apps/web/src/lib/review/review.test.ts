import { describe, expect, it } from 'vitest'
import { lineWinPercent, positionValue, formatEval, type PositionEval } from './evaluation'
import { moveAccuracy, playerAccuracy, estimatedElo } from './accuracy'
import { classifyMove, summarize, type ClassificationInput } from './classification'

const base: ClassificationInput = {
  playedUci: 'e2e4',
  bestUci: 'd2d4',
  winBefore: 55,
  winAfter: 54,
  isBookMove: false,
  isSacrifice: false,
}

describe('win percentage', () => {
  it('is 50 for a dead-equal position', () => {
    expect(lineWinPercent({ cp: 0, pv: [], depth: 20 })).toBeCloseTo(50, 5)
  })

  it('rises above 50 when White is better and below when worse', () => {
    expect(lineWinPercent({ cp: 300, pv: [], depth: 20 })).toBeGreaterThan(60)
    expect(lineWinPercent({ cp: -300, pv: [], depth: 20 })).toBeLessThan(40)
  })

  it('saturates a forced mate to 100 or 0 regardless of distance', () => {
    expect(lineWinPercent({ mate: 1, pv: [], depth: 20 })).toBe(100)
    expect(lineWinPercent({ mate: 8, pv: [], depth: 20 })).toBe(100)
    expect(lineWinPercent({ mate: -2, pv: [], depth: 20 })).toBe(0)
  })
})

describe('eval display', () => {
  const pos = (line: PositionEval['lines'][number]): PositionEval => ({
    lines: [line],
    fen: '',
    blackToMove: false,
  })

  it('formats centipawns as signed pawns', () => {
    expect(formatEval(pos({ cp: 140, pv: [], depth: 20 }))).toBe('+1.4')
    expect(formatEval(pos({ cp: -90, pv: [], depth: 20 }))).toBe('-0.9')
  })

  it('formats mate scores', () => {
    expect(formatEval(pos({ mate: 3, pv: [], depth: 20 }))).toBe('M3')
    expect(formatEval(pos({ mate: -2, pv: [], depth: 20 }))).toBe('-M2')
  })

  it('keeps mate ordering finite and decisive', () => {
    expect(positionValue(pos({ mate: 1, pv: [], depth: 20 }))).toBeGreaterThan(90)
    expect(positionValue(pos({ mate: -1, pv: [], depth: 20 }))).toBeLessThan(-90)
  })
})

describe('accuracy', () => {
  it('is ~100 when no win chances are lost', () => {
    expect(moveAccuracy(60, 60)).toBeGreaterThan(99)
  })

  it('falls sharply as win chances are thrown away', () => {
    expect(moveAccuracy(80, 40)).toBeLessThan(30)
    expect(moveAccuracy(80, 78)).toBeGreaterThan(90)
  })

  it('a single blunder drags the game accuracy down via the harmonic blend', () => {
    const clean = playerAccuracy([99, 99, 99, 99])
    const withBlunder = playerAccuracy([99, 99, 99, 5])
    expect(clean).toBeGreaterThan(95)
    expect(withBlunder).toBeLessThan(clean - 15)
  })

  it('maps accuracy to a plausible, bounded estimated rating', () => {
    expect(estimatedElo(100)).toBeGreaterThan(2500)
    expect(estimatedElo(50)).toBeGreaterThan(900)
    expect(estimatedElo(50)).toBeLessThan(1400)
    expect(estimatedElo(0)).toBeGreaterThanOrEqual(250)
  })
})

describe('move classification', () => {
  it('labels a book move as book even with a tiny wobble', () => {
    expect(classifyMove({ ...base, isBookMove: true, winBefore: 52, winAfter: 49 })).toBe('book')
  })

  it('buckets by win-percentage loss', () => {
    expect(classifyMove({ ...base, bestUci: 'z9z9', winBefore: 55, winAfter: 54.5 })).toBe('excellent')
    expect(classifyMove({ ...base, bestUci: 'z9z9', winBefore: 55, winAfter: 52 })).toBe('good')
    expect(classifyMove({ ...base, bestUci: 'z9z9', winBefore: 55, winAfter: 48 })).toBe('inaccuracy')
    expect(classifyMove({ ...base, bestUci: 'z9z9', winBefore: 55, winAfter: 42 })).toBe('mistake')
    expect(classifyMove({ ...base, bestUci: 'z9z9', winBefore: 55, winAfter: 30 })).toBe('blunder')
  })

  it('marks the engine top move as best when it holds the eval', () => {
    expect(classifyMove({ ...base, playedUci: 'd2d4', bestUci: 'd2d4', winBefore: 55, winAfter: 55 })).toBe('best')
  })

  it('promotes a sound sacrifice that is also best to brilliant', () => {
    expect(classifyMove({
      ...base,
      playedUci: 'd2d4',
      bestUci: 'd2d4',
      isSacrifice: true,
      winBefore: 60,
      winAfter: 59,
    })).toBe('brilliant')
  })

  it('does not call a sacrifice brilliant when the game is already won', () => {
    expect(classifyMove({
      ...base,
      playedUci: 'd2d4',
      bestUci: 'd2d4',
      isSacrifice: true,
      winBefore: 99,
      winAfter: 99,
    })).toBe('best')
  })

  it('marks the only-move-that-holds as a great find', () => {
    expect(classifyMove({
      ...base,
      playedUci: 'd2d4',
      bestUci: 'd2d4',
      secondBestDelta: 25,
      winBefore: 50,
      winAfter: 49,
    })).toBe('great')
  })

  it('calls a dropped winning position a miss', () => {
    expect(classifyMove({ ...base, bestUci: 'z9z9', winBefore: 85, winAfter: 70 })).toBe('miss')
  })

  it('summary counts land in the right buckets', () => {
    const counts = summarize(['best', 'best', 'blunder', 'book', 'good'])
    expect(counts.best).toBe(2)
    expect(counts.blunder).toBe(1)
    expect(counts.book).toBe(1)
    expect(counts.good).toBe(1)
    expect(counts.brilliant).toBe(0)
  })
})
