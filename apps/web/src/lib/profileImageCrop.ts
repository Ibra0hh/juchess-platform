export type CropKind = 'avatar' | 'cover'

export type CropState = {
  centerX: number
  centerY: number
  zoom: number
}

export type CropRect = {
  height: number
  width: number
  x: number
  y: number
}

export const profileCropConfig = {
  avatar: {
    aspect: 1,
    outputHeight: 800,
    outputWidth: 800,
  },
  cover: {
    aspect: 1080 / 235,
    outputHeight: 348,
    outputWidth: 1600,
  },
} as const

export function initialCropState(imageWidth: number, imageHeight: number): CropState {
  return {
    centerX: imageWidth / 2,
    centerY: imageHeight / 2,
    zoom: 1,
  }
}

export function getCropRect(
  imageWidth: number,
  imageHeight: number,
  aspect: number,
  state: CropState,
): CropRect {
  if (imageWidth <= 0 || imageHeight <= 0 || aspect <= 0) {
    return { height: 0, width: 0, x: 0, y: 0 }
  }

  const zoom = clamp(state.zoom, 1, 3)
  const imageAspect = imageWidth / imageHeight
  const baseWidth = imageAspect > aspect ? imageHeight * aspect : imageWidth
  const baseHeight = imageAspect > aspect ? imageHeight : imageWidth / aspect
  const width = baseWidth / zoom
  const height = baseHeight / zoom
  const centerX = clamp(state.centerX, width / 2, imageWidth - width / 2)
  const centerY = clamp(state.centerY, height / 2, imageHeight - height / 2)

  return {
    height,
    width,
    x: centerX - width / 2,
    y: centerY - height / 2,
  }
}

export function clampCropState(
  imageWidth: number,
  imageHeight: number,
  aspect: number,
  state: CropState,
): CropState {
  const rect = getCropRect(imageWidth, imageHeight, aspect, state)
  return {
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
    zoom: clamp(state.zoom, 1, 3),
  }
}

export function nestedPreviewRect(rect: CropRect, aspect: number): CropRect {
  if (rect.width <= 0 || rect.height <= 0 || aspect <= 0) return rect

  const currentAspect = rect.width / rect.height
  const width = currentAspect > aspect ? rect.height * aspect : rect.width
  const height = currentAspect > aspect ? rect.height : rect.width / aspect

  return {
    height,
    width,
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
