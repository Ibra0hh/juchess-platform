import { FlipHorizontal2, Search, Settings2, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
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

type SettingsTab = 'boards' | 'pieces' | 'engine'

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
  const panelId = useId()
  const [activeTab, setActiveTab] = useState<SettingsTab>('boards')
  const [boardQuery, setBoardQuery] = useState('')
  const normalizedQuery = boardQuery.trim().toLocaleLowerCase()
  const visibleBoards = normalizedQuery
    ? boardThemeOptions.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
    : boardThemeOptions

  const tab = (id: SettingsTab, label: string) => (
    <button
      type="button"
      aria-controls={`${panelId}-${id}-panel`}
      aria-selected={activeTab === id}
      id={`${panelId}-${id}-tab`}
      role="tab"
      onClick={() => setActiveTab(id)}
    >
      {label}
    </button>
  )

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

      <div className="board-settings-tabs" role="tablist" aria-label="Board settings sections">
        {tab('boards', `Boards (${boardThemeOptions.length})`)}
        {tab('pieces', 'Pieces')}
        {children ? tab('engine', 'Engine') : null}
      </div>

      {activeTab === 'boards' ? (
        <div
          aria-labelledby={`${panelId}-boards-tab`}
          className="board-theme-panel"
          id={`${panelId}-boards-panel`}
          role="tabpanel"
        >
          <label className="board-theme-search">
            <Search aria-hidden="true" />
            <input
              aria-label="Search boards"
              placeholder="Search boards…"
              type="search"
              value={boardQuery}
              onChange={(event) => setBoardQuery(event.target.value)}
            />
            <span>{visibleBoards.length}</span>
          </label>
          <div className="board-theme-options">
            {visibleBoards.map((option) => (
              <button
                type="button"
                aria-label={`Use ${option.label} board`}
                aria-pressed={boardTheme === option.id}
                className={boardTheme === option.id ? 'active' : undefined}
                key={option.id}
                onClick={() => onBoardThemeChange(option.id)}
              >
                {option.id === 'juchess' ? (
                  <i aria-hidden="true" className="board-theme-swatch juchess" />
                ) : (
                  <img
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    loading="lazy"
                    src={`${import.meta.env.BASE_URL}chess-boards/thumbs/${option.id}.jpg`}
                  />
                )}
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            ))}
          </div>
          {visibleBoards.length === 0 ? <p className="board-theme-empty">No matching boards.</p> : null}
        </div>
      ) : null}

      {activeTab === 'pieces' ? (
        <div
          aria-labelledby={`${panelId}-pieces-tab`}
          id={`${panelId}-pieces-panel`}
          role="tabpanel"
        >
          <div className="piece-theme-options">
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
          </div>
        </div>
      ) : null}

      {activeTab === 'engine' && children ? (
        <div
          aria-labelledby={`${panelId}-engine-tab`}
          id={`${panelId}-engine-panel`}
          role="tabpanel"
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}
