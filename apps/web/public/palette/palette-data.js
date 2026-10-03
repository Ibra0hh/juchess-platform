export const colors = Object.freeze([
  { id: 'surface', name: 'Ivory Surface', hex: '#FFFCF4', group: 'primary', role: 'Content surfaces', token: '--ju-surface' },
  { id: 'cream', name: 'Cream', hex: '#F5EFE3', group: 'primary', role: 'Page backgrounds', token: '--ju-cream' },
  { id: 'burgundy-dark', name: 'Deep Burgundy', hex: '#5F1B26', group: 'primary', role: 'Primary brand & actions', token: '--ju-burgundy-dark' },
  { id: 'ink', name: 'Ink', hex: '#111111', group: 'primary', role: 'Text & dark surfaces', token: '--ju-ink' },
  { id: 'muted', name: 'Warm Muted', hex: '#6D625B', group: 'secondary', role: 'Supporting text on light surfaces', token: '--ju-muted' },
  { id: 'gold-soft', name: 'Soft Gold', hex: '#C9AE6B', group: 'secondary', role: 'Decorative accents', token: '--ju-gold-soft' },
  { id: 'mocha', name: 'Mocha', hex: '#422B1C', group: 'secondary', role: 'Warm contrasting surfaces', token: '--ju-mocha' },
  { id: 'burgundy', name: 'Soft Burgundy', hex: '#7A2431', group: 'secondary', role: 'Supporting brand accent', token: '--ju-burgundy' },
].map(Object.freeze));

export const typography = Object.freeze([
  { family: 'Imbue', role: 'English headings and titles', status: 'bundled', weights: [300, 400, 700], license: 'SIL Open Font License 1.1' },
  { family: 'Finland Rounded', role: 'English descriptions and details', status: 'licensed webfont required; system fallback in preview', weights: [100, 400, 700], license: 'Commercial web license required' },
  { family: 'Kufam', role: 'Arabic typography', status: 'bundled', weights: [400, 500, 700], license: 'SIL Open Font License 1.1' },
]);

export function rgbFromHex(hex) {
  if (!/^#[a-f\d]{6}$/i.test(hex)) throw new TypeError('Expected a six-digit HEX color');
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

export function hslFromHex(hex) {
  const [r, g, b] = rgbFromHex(hex).map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0, saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const round = value => Math.round(value * 100) / 100;
  return [round(hue) % 360, round(saturation * 100), round(lightness * 100)];
}

export function colorValue(hex, format) {
  if (format === 'rgb') return `rgb(${rgbFromHex(hex).join(', ')})`;
  if (format === 'hsl') {
    const [h, s, l] = hslFromHex(hex);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  return hex;
}

function luminance(hex) {
  const channels = rgbFromHex(hex).map(value => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function contrastChecks(ratio) {
  return [{ label: 'AA normal text', passed: ratio >= 4.5 }, { label: 'AA large text', passed: ratio >= 3 }, { label: 'AAA normal text', passed: ratio >= 7 }, { label: 'Non-text contrast', passed: ratio >= 3 }];
}

export function readableText(background) {
  return contrastRatio(background, '#111111') > contrastRatio(background, '#FFFCF4') ? '#111111' : '#FFFCF4';
}

export function cssTokens() {
  return `/* JuChess 2026 brand palette\n   Source: https://canva.link/t3uq1yb2fuwphok\n   Semantic aliases below are suggested web roles. */\n:root {\n${colors.map(color => `  ${color.token}: ${color.hex};`).join('\n')}\n\n  --ju-background: var(--ju-cream);\n  --ju-text: var(--ju-ink);\n  --ju-text-secondary: var(--ju-muted);\n  --ju-action: var(--ju-burgundy-dark);\n  --ju-action-text: var(--ju-surface);\n  --ju-border: var(--ju-muted);\n}\n`;
}

export function paletteExport() {
  return { name: 'JuChess 2026 Brand Palette', source: 'https://canva.link/t3uq1yb2fuwphok', roleNote: 'Suggested web roles; not additional rules in the source guideline.', colors: colors.map(color => ({ ...color, rgb: rgbFromHex(color.hex), hsl: hslFromHex(color.hex) })), typography, corrections: ['Warm Muted RGB: 109, 98, 91', 'Soft Gold RGB: 201, 174, 107', 'Moka normalized to Mocha', 'Burgundy spelling standardized'] };
}
