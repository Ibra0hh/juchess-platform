export const boardThemeOptions = [
  { description: 'Club original', id: 'juchess', label: 'JuChess' },
  { description: 'Chess.com collection', id: '8_bit', label: '8-Bit' },
  { description: 'Chess.com collection', id: 'bases', label: 'Bases' },
  { description: 'Chess.com collection', id: 'blue', label: 'Blue' },
  { description: 'Chess.com collection', id: 'brown', label: 'Brown' },
  { description: 'Chess.com collection', id: 'bubblegum', label: 'Bubblegum' },
  { description: 'Chess.com collection', id: 'burled_wood', label: 'Burled Wood' },
  { description: 'Chess.com collection', id: 'dark_wood', label: 'Dark Wood' },
  { description: 'Chess.com collection', id: 'dash', label: 'Dash' },
  { description: 'Chess.com collection', id: 'glass', label: 'Glass' },
  { description: 'Chess.com collection', id: 'graffiti', label: 'Graffiti' },
  { description: 'Chess.com collection', id: 'green', label: 'Green' },
  { description: 'Chess.com collection', id: 'icy_sea', label: 'Icy Sea' },
  { description: 'Chess.com collection', id: 'light', label: 'Light' },
  { description: 'Chess.com collection', id: 'lolz', label: 'Lolz' },
  { description: 'Chess.com collection', id: 'marble', label: 'Marble' },
  { description: 'Chess.com collection', id: 'metal', label: 'Metal' },
  { description: 'Chess.com collection', id: 'neon', label: 'Neon' },
  { description: 'Chess.com collection', id: 'newspaper', label: 'Newspaper' },
  { description: 'Chess.com collection', id: 'orange', label: 'Orange' },
  { description: 'Chess.com collection', id: 'overlay', label: 'Overlay' },
  { description: 'Chess.com collection', id: 'parchment', label: 'Parchment' },
  { description: 'Chess.com collection', id: 'purple', label: 'Purple' },
  { description: 'Chess.com collection', id: 'red', label: 'Red' },
  { description: 'Chess.com collection', id: 'sand', label: 'Sand' },
  { description: 'Chess.com collection', id: 'sky', label: 'Sky' },
  { description: 'Chess.com collection', id: 'stone', label: 'Stone' },
  { description: 'Chess.com collection', id: 'tan', label: 'Tan' },
  { description: 'Chess.com collection', id: 'tournament', label: 'Tournament' },
  { description: 'Chess.com collection', id: 'translucent', label: 'Translucent' },
  { description: 'Chess.com collection', id: 'walnut', label: 'Walnut' },
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
