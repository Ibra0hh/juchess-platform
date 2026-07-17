import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, neutralizeSpreadsheetFormula } from '../src/lib/csv.ts'

test('spreadsheet formula prefixes are neutralized, including leading whitespace', () => {
  for (const value of ['=HYPERLINK("https://example.test")', '+SUM(1,2)', '-2+3', '@SUM(1,2)', '  =1+1', '\t+1']) {
    assert.equal(neutralizeSpreadsheetFormula(value), `'${value}`)
  }
})

test('ordinary recruitment values are not changed', () => {
  assert.equal(neutralizeSpreadsheetFormula('Ruba Ibrahim'), 'Ruba Ibrahim')
  assert.equal(neutralizeSpreadsheetFormula('0790123456'), '0790123456')
})

test('CSV cells neutralize formulas and escape quotes', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"')
  assert.equal(csvCell('She said "hello"'), '"She said ""hello"""')
})
