import { FlipHorizontal2, Settings2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  boardThemeOptions,
  pieceThemeOptions,
  type JuBoardTheme,
  type JuPieceTheme,
} from '../lib/boardAppearance'
import './BoardSettingsPanel.css'

type BoardSettingsPanelProps = {
  boardTheme: JuBoardTheme
  children?: ReactNode
  className?: string
  flipped: boolean
  onBoardThemeChange: (theme: JuBoardTheme) => void
  onClose: () => void
  onFlip: () => void
  onPieceThemeChange: (theme: JuPieceTheme) => void
  pieceTheme: JuPieceTheme
}

export function BoardSettingsPanel({
  boardTheme,
  children,
  className,
  flipped,
  onBoardThemeChange,
  onClose,
  onFlip,
  onPieceThemeChange,
  pieceTheme,
}: BoardSettingsPanelProps) {
  return (
    <section
      aria-label="Board settings"
      className={['board-settings-panel', className].filter(Boolean).join(' ')}
    >
      <header className="board-settings-head">
        <Settings2 aria-hidden="true" />
        <div>
          <strong>Board settings</strong>
          <span>Appearance and orientation</span>
        </div>
        <button type="button" aria-label="Close board settings" title="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="board-orientation-setting">
        <div>
          <strong>Orientation</strong>
          <span>{flipped ? 'Black at the bottom' : 'White at the bottom'}</span>
        </div>
        <button type="button" aria-label="Flip board" onClick={onFlip}>
          <FlipHorizontal2 aria-hidden="true" />
          Flip board
        </button>
      </div>

      <fieldset className="board-theme-options">
        <legend>Board</legend>
        {boardThemeOptions.map((option) => (
          <button
            type="button"
            aria-label={`Use ${option.label} board`}
            aria-pressed={boardTheme === option.id}
            className={boardTheme === option.id ? 'active' : undefined}
            key={option.id}
            onClick={() => onBoardThemeChange(option.id)}
          >
            <i
              aria-hidden="true"
              className={`board-theme-swatch ${option.id}`}
              style={option.id === 'brown'
                ? { backgroundImage: `url(${import.meta.env.BASE_URL}chess-boards/brown.png)` }
                : undefined}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </fieldset>

      <fieldset className="piece-theme-options">
        <legend>Pieces</legend>
        {pieceThemeOptions.map((option) => (
          <button
            type="button"
            aria-label={`Use ${option.label} pieces`}
            aria-pressed={pieceTheme === option.id}
            className={pieceTheme === option.id ? 'active' : undefined}
            key={option.id}
            onClick={() => onPieceThemeChange(option.id)}
          >
            <img
              alt=""
              aria-hidden="true"
              src={`${import.meta.env.BASE_URL}chess-pieces/${option.id === 'alpha' ? 'alpha/' : ''}wk.png`}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </fieldset>

      {children}
    </section>
  )
}
