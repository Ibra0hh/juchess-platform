import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Check, ImageIcon, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  clampCropState,
  getCropRect,
  initialCropState,
  nestedPreviewRect,
  profileCropConfig,
  type CropKind,
  type CropRect,
  type CropState,
} from '../lib/profileImageCrop'
import './ProfileImageEditor.css'

type ProfileImageEditorProps = {
  file: File
  kind: CropKind
  onCancel: () => void
  onSave: (file: File) => Promise<void>
}

type Size = { height: number; width: number }

const mobileCoverAspect = 2.2

function ProfileImageEditor({ file, kind, onCancel, onSave }: ProfileImageEditorProps) {
  const titleId = useId()
  const descriptionId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageSize, setImageSize] = useState<Size>({ height: 0, width: 0 })
  const [frameSize, setFrameSize] = useState<Size>({ height: 0, width: 0 })
  const [crop, setCrop] = useState<CropState>({ centerX: 0, centerY: 0, zoom: 1 })
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const config = profileCropConfig[kind]

  useEffect(() => {
    const nextImageUrl = URL.createObjectURL(file)
    setImageUrl(nextImageUrl)
    return () => URL.revokeObjectURL(nextImageUrl)
  }, [file])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel, saving])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const updateSize = () => {
      const rect = frame.getBoundingClientRect()
      setFrameSize({ height: rect.height, width: rect.width })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const cropRect = getCropRect(imageSize.width, imageSize.height, config.aspect, crop)
  const imageStyle = positionedImageStyle(frameSize, imageSize, cropRect)

  const updateCrop = (next: CropState) => {
    setCrop(clampCropState(imageSize.width, imageSize.height, config.aspect, next))
  }

  const handleImageLoad = () => {
    const image = imageRef.current
    if (!image) return
    const size = { height: image.naturalHeight, width: image.naturalWidth }
    setImageSize(size)
    setCrop(initialCropState(size.width, size.height))
    setError('')
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageSize.width || saving) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !frameSize.width) return
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }

    setCrop((current) => {
      const currentRect = getCropRect(imageSize.width, imageSize.height, config.aspect, current)
      const scale = frameSize.width / currentRect.width
      return clampCropState(imageSize.width, imageSize.height, config.aspect, {
        ...current,
        centerX: current.centerX - deltaX / scale,
        centerY: current.centerY - deltaY / scale,
      })
    })
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      setDragging(false)
    }
  }

  const nudgeCrop = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentRect = getCropRect(imageSize.width, imageSize.height, config.aspect, crop)
    const horizontalStep = currentRect.width * 0.025
    const verticalStep = currentRect.height * 0.025
    const delta = {
      ArrowDown: [0, verticalStep],
      ArrowLeft: [-horizontalStep, 0],
      ArrowRight: [horizontalStep, 0],
      ArrowUp: [0, -verticalStep],
    }[event.key]
    if (!delta) return
    event.preventDefault()
    updateCrop({ ...crop, centerX: crop.centerX + delta[0], centerY: crop.centerY + delta[1] })
  }

  const setZoom = (zoom: number) => updateCrop({ ...crop, zoom })

  const handleSave = async () => {
    const image = imageRef.current
    if (!image || !imageSize.width) return
    setSaving(true)
    setError('')
    try {
      const croppedFile = await createCroppedFile(image, cropRect, kind)
      await onSave(croppedFile)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The image could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const mobilePreviewRect = kind === 'cover' ? nestedPreviewRect(cropRect, mobileCoverAspect) : cropRect

  return (
    <div className="profile-image-editor-backdrop" role="presentation">
      <section
        className="profile-image-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="profile-image-editor-header">
          <div>
            <span>{kind === 'avatar' ? 'Profile picture' : 'Profile cover'}</span>
            <h2 id={titleId}>Adjust your {kind === 'avatar' ? 'picture' : 'cover'}</h2>
            <p id={descriptionId}>Drag the image into position, then use zoom to choose the final crop.</p>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Cancel image editing" disabled={saving} onClick={onCancel}>
            <X size={21} />
          </button>
        </header>

        <div className={kind === 'avatar' ? 'profile-crop-layout avatar' : 'profile-crop-layout cover'}>
          <div>
            <div className="profile-crop-label">
              <span>{kind === 'avatar' ? 'Circular profile preview' : 'Desktop cover crop'}</span>
              <small>{Math.round(crop.zoom * 100)}%</small>
            </div>
            <div
              ref={frameRef}
              className={`profile-crop-frame ${kind}${dragging ? ' dragging' : ''}`}
              role="application"
              aria-label={`Reposition ${kind === 'avatar' ? 'profile picture' : 'cover image'}`}
              tabIndex={0}
              onKeyDown={nudgeCrop}
              onPointerCancel={stopDragging}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
            >
              <img
                ref={imageRef}
                src={imageUrl || undefined}
                alt="Selected upload preview"
                draggable={false}
                style={imageStyle}
                onError={() => setError('This image could not be opened. Choose another JPG, PNG, or WebP file.')}
                onLoad={handleImageLoad}
              />
              <span className="profile-crop-guides" aria-hidden="true" />
              {!imageSize.width ? <span className="profile-crop-loading"><ImageIcon size={20} /> Preparing preview...</span> : null}
            </div>
          </div>

          {kind === 'cover' ? (
            <div className="profile-cover-mobile-preview-wrap">
              <div className="profile-crop-label">
                <span>Mobile preview</span>
                <small>Centered view</small>
              </div>
              <CropPreview imageUrl={imageUrl} imageSize={imageSize} rect={mobilePreviewRect} />
              <p>The mobile profile shows the centered area above because its cover is taller.</p>
            </div>
          ) : null}
        </div>

        <div className="profile-image-zoom">
          <button type="button" aria-label="Zoom out" disabled={saving || crop.zoom <= 1} onClick={() => setZoom(crop.zoom - 0.1)}>
            <ZoomOut size={19} />
          </button>
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={crop.zoom}
              disabled={saving || !imageSize.width}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <button type="button" aria-label="Zoom in" disabled={saving || crop.zoom >= 3} onClick={() => setZoom(crop.zoom + 0.1)}>
            <ZoomIn size={19} />
          </button>
          <button
            type="button"
            className="profile-image-reset"
            disabled={saving || !imageSize.width}
            onClick={() => setCrop(initialCropState(imageSize.width, imageSize.height))}
          >
            <RotateCcw size={17} /> Reset
          </button>
        </div>

        {error ? <div className="profile-image-editor-error" role="alert">{error}</div> : null}

        <footer className="profile-image-editor-actions">
          <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" disabled={saving || !imageSize.width} onClick={() => void handleSave()}>
            <Check size={18} /> {saving ? 'Saving...' : `Save ${kind === 'avatar' ? 'picture' : 'cover'}`}
          </button>
        </footer>
      </section>
    </div>
  )
}

function CropPreview({ imageSize, imageUrl, rect }: { imageSize: Size; imageUrl: string; rect: CropRect }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState<Size>({ height: 0, width: 0 })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const updateSize = () => {
      const bounds = frame.getBoundingClientRect()
      setFrameSize({ height: bounds.height, width: bounds.width })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={frameRef} className="profile-cover-mobile-preview" aria-hidden="true">
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} style={positionedImageStyle(frameSize, imageSize, rect)} />
      ) : null}
    </div>
  )
}

function positionedImageStyle(frame: Size, image: Size, rect: CropRect): CSSProperties | undefined {
  if (!frame.width || !image.width || !rect.width) return undefined
  const scale = frame.width / rect.width
  return {
    height: image.height * scale,
    left: frame.width / 2 - (rect.x + rect.width / 2) * scale,
    top: frame.height / 2 - (rect.y + rect.height / 2) * scale,
    width: image.width * scale,
  }
}

async function createCroppedFile(image: HTMLImageElement, rect: CropRect, kind: CropKind) {
  const config = profileCropConfig[kind]
  const canvas = document.createElement('canvas')
  canvas.width = config.outputWidth
  canvas.height = config.outputHeight
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Your browser could not prepare the cropped image.')

  context.fillStyle = '#f5efe3'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const blob = await canvasBlob(canvas, 'image/webp', 0.9)
    || await canvasBlob(canvas, 'image/jpeg', 0.92)
  if (!blob) throw new Error('Your browser could not create the cropped image.')

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `juchess-${kind}-${Date.now()}.${extension}`, { type: blob.type })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export default ProfileImageEditor
