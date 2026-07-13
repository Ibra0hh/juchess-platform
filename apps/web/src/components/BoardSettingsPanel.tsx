import { Palette, Search, Settings2, X } from 'lucide-react'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  annotationColorOptions,
  boardThemeOptions,
  pieceThemeAssetPath,
  pieceThemeOptions,
  type JuAnnotationColor,
  type JuBoardTheme,
  type JuPieceTheme,
} from '../lib/boardAppearance'
import './BoardSettingsPanel.css'

type BoardSettingsPanelProps = {
  arrowColor: JuAnnotationColor
  boardTheme: JuBoardTheme
  children?: ReactNode
  className?: string
  markColor: JuAnnotationColor
  onArrowColorChange: (color: JuAnnotationColor) => void
  onBoardThemeChange: (theme: JuBoardTheme) => void
  onClose: () => void
  onMarkColorChange: (color: JuAnnotationColor) => void
  onPieceThemeChange: (theme: JuPieceTheme) => void
  pieceTheme: JuPieceTheme
}

type SettingsTab = 'boards' | 'pieces' | 'annotations' | 'engine'

export function BoardSettingsPanel({
  arrowColor,
  boardTheme,
  children,
  className,
  markColor,
  onArrowColorChange,
  onBoardThemeChange,
  onClose,
  onMarkColorChange,
  onPieceThemeChange,
  pieceTheme,
}: BoardSettingsPanelProps) {
  const panelId = useId()
  const [activeTab, setActiveTab] = useState<SettingsTab>('boards')
  const [boardQuery, setBoardQuery] = useState('')
  const [pieceQuery, setPieceQuery] = useState('')
  const normalizedBoardQuery = boardQuery.trim().toLocaleLowerCase()
  const normalizedPieceQuery = pieceQuery.trim().toLocaleLowerCase()
  const visibleBoards = normalizedBoardQuery
    ? boardThemeOptions.filter((option) => (
        `${option.label} ${option.description}`.toLocaleLowerCase().includes(normalizedBoardQuery)
      ))
    : boardThemeOptions
  const visiblePieces = normalizedPieceQuery
    ? pieceThemeOptions.filter((option) => (
        `${option.label} ${option.description}`.toLocaleLowerCase().includes(normalizedPieceQuery)
      ))
    : pieceThemeOptions

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
          <span>Appearance, colors and pieces</span>
        </div>
        <button type="button" aria-label="Close board settings" title="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="board-settings-tabs" role="tablist" aria-label="Board settings sections">
        {tab('boards', `Boards (${boardThemeOptions.length})`)}
        {tab('pieces', `Pieces (${pieceThemeOptions.length})`)}
        {tab('annotations', 'Annotations')}
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
                {option.thumbnail === null ? (
                  <i aria-hidden="true" className="board-theme-swatch juchess" />
                ) : (
                  <img
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    loading="lazy"
                    src={`${import.meta.env.BASE_URL}${option.thumbnail}`}
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
          className="piece-theme-panel"
          id={`${panelId}-pieces-panel`}
          role="tabpanel"
        >
          <label className="board-theme-search">
            <Search aria-hidden="true" />
            <input
              aria-label="Search pieces"
              placeholder="Search pieces…"
              type="search"
              value={pieceQuery}
              onChange={(event) => setPieceQuery(event.target.value)}
            />
            <span>{visiblePieces.length}</span>
          </label>
          <div className="piece-theme-options">
            {visiblePieces.map((option) => (
              <button
                type="button"
                aria-label={`Use ${option.label} pieces`}
                aria-pressed={pieceTheme === option.id}
                className={pieceTheme === option.id ? 'active' : undefined}
                key={option.id}
                onClick={() => onPieceThemeChange(option.id)}
              >
                <i aria-hidden="true" className="piece-theme-preview">
                  <img
                    alt=""
                    decoding="async"
                    loading="lazy"
                    src={`${import.meta.env.BASE_URL}${pieceThemeAssetPath(option.id, 'w', 'k')}`}
                  />
                  <img
                    alt=""
                    decoding="async"
                    loading="lazy"
                    src={`${import.meta.env.BASE_URL}${pieceThemeAssetPath(option.id, 'b', 'n')}`}
                  />
                </i>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            ))}
          </div>
          {visiblePieces.length === 0 ? <p className="board-theme-empty">No matching pieces.</p> : null}
        </div>
      ) : null}

      {activeTab === 'annotations' ? (
        <div
          aria-labelledby={`${panelId}-annotations-tab`}
          className="annotation-color-panel"
          id={`${panelId}-annotations-panel`}
          role="tabpanel"
        >
          <div className="annotation-color-intro">
            <Palette aria-hidden="true" />
            <span>Choose separate colors for arrows and square marks.</span>
          </div>
          <AnnotationColorSetting
            label="Arrow color"
            onChange={onArrowColorChange}
            selected={arrowColor}
            type="arrow"
          />
          <AnnotationColorSetting
            label="Mark color"
            onChange={onMarkColorChange}
            selected={markColor}
            type="mark"
          />
          <p className="annotation-modifier-help">
            Arrow shortcuts: Shift + right-drag red, Alt + right-drag blue, Ctrl/Command + right-drag gold.
          </p>
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

function AnnotationColorSetting({
  label,
  onChange,
  selected,
  type,
}: {
  label: string
  onChange: (color: JuAnnotationColor) => void
  selected: JuAnnotationColor
  type: 'arrow' | 'mark'
}) {
  return (
    <fieldset className="annotation-color-setting">
      <legend>{label}</legend>
      <div className="annotation-color-options">
        {annotationColorOptions.map((option) => (
          <button
            type="button"
            aria-label={`Use ${option.label} ${type} color`}
            aria-pressed={selected === option.id}
            className={selected === option.id ? 'active' : undefined}
            key={option.id}
            onClick={() => onChange(option.id)}
            title={option.label}
          >
            <i
              aria-hidden="true"
              className={type === 'arrow' ? 'annotation-arrow-swatch' : 'annotation-mark-swatch'}
              style={{ '--annotation-swatch': type === 'arrow' ? option.arrow : option.mark } as CSSProperties}
            />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
