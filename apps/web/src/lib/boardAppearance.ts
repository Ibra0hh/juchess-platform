export const boardThemeOptions = [
  { description: 'Club burgundy', id: 'juchess', label: 'JuChess' },
  { description: 'Experimental theme', id: 'brown', label: 'Brown' },
] as const

export const pieceThemeOptions = [
  { description: 'Current pieces', id: 'juchess', label: 'JuChess' },
  { description: 'Experimental theme', id: 'alpha', label: 'Alpha' },
] as const

export type JuBoardTheme = typeof boardThemeOptions[number]['id']
export type JuPieceTheme = typeof pieceThemeOptions[number]['id']

export type BoardPreferences = {
  boardTheme: JuBoardTheme
  pieceTheme: JuPieceTheme
}

export const defaultBoardPreferences: BoardPreferences = {
  boardTheme: 'juchess',
  pieceTheme: 'juchess',
}

export function normalizeBoardPreferences(value: unknown): BoardPreferences {
  if (!value || typeof value !== 'object') return defaultBoardPreferences
  const candidate = value as Partial<BoardPreferences>
  return {
    boardTheme: boardThemeOptions.some((option) => option.id === candidate.boardTheme)
      ? candidate.boardTheme as JuBoardTheme
      : defaultBoardPreferences.boardTheme,
    pieceTheme: pieceThemeOptions.some((option) => option.id === candidate.pieceTheme)
      ? candidate.pieceTheme as JuPieceTheme
      : defaultBoardPreferences.pieceTheme,
  }
}
