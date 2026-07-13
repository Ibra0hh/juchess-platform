export type BoardThemeOption = {
  asset: string | null
  description: string
  id: string
  label: string
  thumbnail: string | null
}

export type PieceThemeOption = {
  description: string
  extension: 'png' | 'svg' | 'webp'
  id: string
  label: string
  path: string
}

export const annotationColorOptions = [
  { arrow: '#992635', id: 'red', label: 'Red', mark: '#b82b37' },
  { arrow: '#d06a24', id: 'orange', label: 'Orange', mark: '#e0782f' },
  { arrow: '#b58721', id: 'gold', label: 'Gold', mark: '#c99a2d' },
  { arrow: '#3f8248', id: 'green', label: 'Green', mark: '#4c9657' },
  { arrow: '#286db0', id: 'blue', label: 'Blue', mark: '#347fc5' },
  { arrow: '#7049a2', id: 'purple', label: 'Purple', mark: '#825ab6' },
] as const

const chessComBoardIds = [
  '8_bit', 'bases', 'blue', 'brown', 'bubblegum', 'burled_wood', 'dark_wood', 'dash',
  'glass', 'graffiti', 'green', 'icy_sea', 'light', 'lolz', 'marble', 'metal', 'neon',
  'newspaper', 'orange', 'overlay', 'parchment', 'purple', 'red', 'sand', 'sky', 'stone',
  'tan', 'tournament', 'translucent', 'walnut',
] as const

const chessboardJsBoardIds = [
  'chess24', 'dilena', 'leipzig', 'metro', 'symbol', 'uscf', 'wikipedia',
] as const

const lichessBoardAssets = [
  ['blue-marble', 'jpg'], ['blue', 'png'], ['blue2', 'jpg'], ['blue3', 'jpg'],
  ['brown', 'png'], ['canvas2', 'jpg'], ['green-plastic', 'png'], ['green', 'png'],
  ['grey', 'jpg'], ['horsey', 'jpg'], ['ic', 'png'], ['leather', 'jpg'], ['maple', 'jpg'],
  ['maple2', 'jpg'], ['marble', 'jpg'], ['metal', 'jpg'], ['ncf-board', 'png'], ['olive', 'jpg'],
  ['pink-pyramid', 'png'], ['purple-diag', 'png'], ['purple', 'png'], ['wood', 'jpg'],
  ['wood2', 'jpg'], ['wood3', 'jpg'], ['wood4', 'jpg'],
] as const

const lichessThreeDBoardIds = [
  'black-white-aluminium', 'brushed-aluminium', 'china-blue', 'china-green', 'china-grey',
  'china-scarlet', 'china-yellow', 'classic-blue', 'glass', 'gold-silver', 'green-glass',
  'jade', 'light-wood', 'marble', 'power-coated', 'purple-black', 'rosewood', 'wax',
  'wood-glass', 'woodi',
] as const

const chessComPieceIds = [
  '3d_chesskid', '3d_plastic', '3d_staunton', '3d_wood', '8_bit', 'alpha', 'bases',
  'blindfold', 'book', 'bubblegum', 'cases', 'classic', 'club', 'condal', 'dash',
  'game_room', 'glass', 'gothic', 'graffiti', 'icy_sea', 'light', 'lolz', 'marble',
  'maya', 'metal', 'modern', 'nature', 'neo', 'neo_wood', 'neon', 'newspaper', 'ocean',
  'sky', 'space', 'tigers', 'tournament', 'vintage', 'wood',
] as const

const chessboardJsPieceIds = [
  'alpha', 'chess24', 'dilena', 'leipzig', 'metro', 'symbol', 'uscf', 'wikipedia',
] as const

const lichessSvgPieceIds = [
  'alpha', 'anarcandy', 'caliente', 'california', 'cardinal', 'cburnett', 'celtic',
  'chess7', 'chessnut', 'companion', 'cooke', 'disguised', 'dubrovny', 'fantasy',
  'firi', 'fresca', 'gioco', 'governor', 'horsey', 'icpieces', 'kiwen-suwi', 'kosal',
  'leipzig', 'letter', 'maestro', 'merida', 'mpchess', 'papercut', 'pirouetti', 'pixel',
  'reillycraig', 'rhosgfx', 'riohacha', 'shahi-ivory-brown', 'shapes', 'spatial',
  'staunty', 'tatiana', 'totoy', 'xkcd',
] as const

const WORD_LABELS: Record<string, string> = {
  '3d': '3D',
  '8': '8',
  chess24: 'Chess24',
  ic: 'IC',
  icpieces: 'IC Pieces',
  mpchess: 'MP Chess',
  ncf: 'NCF',
  neo: 'Neo',
  reillycraig: 'Reilly Craig',
  rhosgfx: 'RhosGFX',
  uscf: 'USCF',
  xkcd: 'XKCD',
}

function formatLabel(id: string) {
  return id
    .split(/[-_]/)
    .map((word) => WORD_LABELS[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

export const boardThemeOptions = [
  {
    asset: null,
    description: 'Club original',
    id: 'juchess',
    label: 'JuChess',
    thumbnail: null,
  },
  ...chessComBoardIds.map((id) => ({
    asset: `chess-boards/${id}.png`,
    description: 'Chess.com collection',
    id,
    label: formatLabel(id),
    thumbnail: `chess-boards/thumbs/${id}.jpg`,
  })),
  ...chessboardJsBoardIds.map((name) => ({
    asset: `chess-boards/chessboardjs-${name}.png`,
    description: 'Chessboard.js Themes',
    id: `chessboardjs-${name}` as const,
    label: formatLabel(name),
    thumbnail: `chess-boards/thumbs/chessboardjs-${name}.jpg`,
  })),
  {
    asset: 'chess-boards/kiwen-high-contrast.png',
    description: 'Kiwen Suwi',
    id: 'kiwen-high-contrast',
    label: 'Kiwen High Contrast',
    thumbnail: 'chess-boards/thumbs/kiwen-high-contrast.jpg',
  },
  ...lichessBoardAssets.map(([name, extension]) => ({
    asset: `chess-boards/lichess-${name}.${extension}`,
    description: 'Lichess 2D',
    id: `lichess-${name}` as const,
    label: formatLabel(name),
    thumbnail: `chess-boards/thumbs/lichess-${name}.jpg`,
  })),
  ...lichessThreeDBoardIds.map((name) => ({
    asset: `chess-boards/lichess-3d-${name}.png`,
    description: 'Lichess 3D',
    id: `lichess-3d-${name}` as const,
    label: formatLabel(name),
    thumbnail: `chess-boards/thumbs/lichess-3d-${name}.jpg`,
  })),
] satisfies readonly BoardThemeOption[]

export const pieceThemeOptions = [
  {
    description: 'Club original',
    extension: 'png',
    id: 'juchess',
    label: 'JuChess',
    path: 'chess-pieces',
  },
  ...chessComPieceIds.map((id) => ({
    description: 'Chess.com collection',
    extension: 'png' as const,
    id,
    label: formatLabel(id),
    path: id === 'alpha' ? 'chess-pieces/alpha' : `chess-pieces/chesscom/${id}`,
  })),
  ...chessboardJsPieceIds.map((name) => ({
    description: 'Chessboard.js Themes',
    extension: 'png' as const,
    id: `chessboardjs-${name}` as const,
    label: formatLabel(name),
    path: `chess-pieces/chessboardjs/${name}`,
  })),
  {
    description: 'Kiwen Suwi',
    extension: 'png',
    id: 'kiwen-suwi',
    label: 'Kiwen Suwi',
    path: 'chess-pieces/kiwen/suwi',
  },
  {
    description: 'Kiwen Suwi',
    extension: 'png',
    id: 'kiwen-high-contrast',
    label: 'Kiwen High Contrast',
    path: 'chess-pieces/kiwen/high-contrast',
  },
  ...lichessSvgPieceIds.map((name) => ({
    description: 'Lichess collection',
    extension: 'svg' as const,
    id: `lichess-${name}` as const,
    label: formatLabel(name),
    path: `chess-pieces/lichess/${name}`,
  })),
  {
    description: 'Lichess collection',
    extension: 'webp',
    id: 'lichess-monarchy',
    label: 'Monarchy',
    path: 'chess-pieces/lichess/monarchy',
  },
] satisfies readonly PieceThemeOption[]

export type JuBoardTheme = typeof boardThemeOptions[number]['id']
export type JuPieceTheme = typeof pieceThemeOptions[number]['id']
export type JuAnnotationColor = typeof annotationColorOptions[number]['id']

export type BoardPreferences = {
  arrowColor: JuAnnotationColor
  boardTheme: JuBoardTheme
  markColor: JuAnnotationColor
  pieceTheme: JuPieceTheme
}

export const defaultBoardPreferences: BoardPreferences = {
  arrowColor: 'red',
  boardTheme: 'juchess',
  markColor: 'red',
  pieceTheme: 'juchess',
}

const boardThemeById = new Map<string, BoardThemeOption>(
  boardThemeOptions.map((option) => [option.id, option]),
)
const pieceThemeById = new Map<string, PieceThemeOption>(
  pieceThemeOptions.map((option) => [option.id, option]),
)
const annotationColorById = new Map<string, typeof annotationColorOptions[number]>(
  annotationColorOptions.map((option) => [option.id, option]),
)

export function getBoardThemeOption(theme: string) {
  return boardThemeById.get(theme) ?? boardThemeById.get(defaultBoardPreferences.boardTheme)!
}

export function getPieceThemeOption(theme: string) {
  return pieceThemeById.get(theme) ?? pieceThemeById.get(defaultBoardPreferences.pieceTheme)!
}

export function getAnnotationColorOption(color: string) {
  return annotationColorById.get(color) ?? annotationColorById.get(defaultBoardPreferences.arrowColor)!
}

export function annotationColorForModifiers(
  modifiers: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
  fallback: JuAnnotationColor,
): JuAnnotationColor {
  if (modifiers.ctrlKey || modifiers.metaKey) return 'gold'
  if (modifiers.altKey) return 'blue'
  if (modifiers.shiftKey) return 'red'
  return fallback
}

export function boardThemeAssetPath(theme: JuBoardTheme) {
  return getBoardThemeOption(theme).asset
}

export function pieceThemeAssetPath(
  theme: JuPieceTheme,
  color: 'b' | 'w',
  type: 'b' | 'k' | 'n' | 'p' | 'q' | 'r',
) {
  const option = getPieceThemeOption(theme)
  return `${option.path}/${color}${type}.${option.extension}`
}

export function normalizeBoardPreferences(value: unknown): BoardPreferences {
  return mergeBoardPreferences(defaultBoardPreferences, value)
}

export function mergeBoardPreferences(
  current: BoardPreferences,
  value: unknown,
): BoardPreferences {
  if (!value || typeof value !== 'object') return current
  const candidate = value as Partial<BoardPreferences>
  return {
    arrowColor: annotationColorById.has(String(candidate.arrowColor))
      ? candidate.arrowColor as JuAnnotationColor
      : current.arrowColor,
    boardTheme: boardThemeById.has(String(candidate.boardTheme))
      ? candidate.boardTheme as JuBoardTheme
      : current.boardTheme,
    markColor: annotationColorById.has(String(candidate.markColor))
      ? candidate.markColor as JuAnnotationColor
      : current.markColor,
    pieceTheme: pieceThemeById.has(String(candidate.pieceTheme))
      ? candidate.pieceTheme as JuPieceTheme
      : current.pieceTheme,
  }
}
