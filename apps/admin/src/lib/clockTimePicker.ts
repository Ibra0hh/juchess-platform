export type ClockPickerPhase = 'hour' | 'minute'

const DEGREES_PER_HOUR = 30
const DEGREES_PER_MINUTE = 6

function normalizeDegrees(value: number) {
  return (value % 360 + 360) % 360
}

export function clockHandAngle(phase: ClockPickerPhase, value: number) {
  return phase === 'hour'
    ? (value % 12) * DEGREES_PER_HOUR
    : (value % 60) * DEGREES_PER_MINUTE
}

export function clockLabelAngle(phase: ClockPickerPhase, index: number) {
  return phase === 'hour'
    ? ((index + 1) % 12) * DEGREES_PER_HOUR
    : (index % 12) * DEGREES_PER_HOUR
}

export function clockValueFromPoint(
  phase: ClockPickerPhase,
  xFromCenter: number,
  yFromCenter: number,
) {
  const degrees = normalizeDegrees((Math.atan2(yFromCenter, xFromCenter) * 180) / Math.PI + 90)

  if (phase === 'minute') {
    return Math.round(degrees / DEGREES_PER_MINUTE) % 60
  }

  const hour = Math.round(degrees / DEGREES_PER_HOUR) % 12
  return hour || 12
}
