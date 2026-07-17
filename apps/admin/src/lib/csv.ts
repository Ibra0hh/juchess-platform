const spreadsheetFormulaPrefix = /^[\t\r\n ]*[=+@-]/

export function neutralizeSpreadsheetFormula(value: string) {
  return spreadsheetFormulaPrefix.test(value) ? `'${value}` : value
}

export function csvCell(value: string) {
  const safeValue = neutralizeSpreadsheetFormula(value)
  return `"${safeValue.replace(/"/g, '""')}"`
}
