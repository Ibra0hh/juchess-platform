import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { colors, typography, rgbFromHex, hslFromHex, colorValue, contrastRatio, contrastChecks, readableText, cssTokens, paletteExport } from '../apps/web/public/palette/palette-data.js';
import { copyText } from '../apps/web/public/palette/clipboard.js';

const source = new URL('../apps/web/public/palette/', import.meta.url);
const expectedHex = ['#FFFCF4', '#F5EFE3', '#5F1B26', '#111111', '#6D625B', '#C9AE6B', '#422B1C', '#7A2431'];
const expectedRgb = [[255, 252, 244], [245, 239, 227], [95, 27, 38], [17, 17, 17], [109, 98, 91], [201, 174, 107], [66, 43, 28], [122, 36, 49]];

test('Eight guideline colors preserve source order and primary/secondary grouping', () => {
  assert.deepEqual(colors.map(color => color.hex), expectedHex);
  assert.deepEqual(colors.map(color => color.group), [...Array(4).fill('primary'), ...Array(4).fill('secondary')]);
  assert.equal(new Set(colors.map(color => color.token)).size, 8);
  assert.equal(colors[6].name, 'Mocha');
  assert.equal(colors[7].name, 'Soft Burgundy');
});

test('RGB values are derived from HEX, including both source corrections', () => {
  assert.deepEqual(colors.map(color => rgbFromHex(color.hex)), expectedRgb);
  assert.deepEqual(rgbFromHex('#abcdef'), [171, 205, 239]);
  for (const invalid of ['#fff', '111111', '#GGFFFF', '#11111111']) assert.throws(() => rgbFromHex(invalid), TypeError);
});

test('HSL handles grayscale, primary colors, and hue wrapping', () => {
  assert.deepEqual(hslFromHex('#000000'), [0, 0, 0]);
  assert.deepEqual(hslFromHex('#FFFFFF'), [0, 0, 100]);
  assert.deepEqual(hslFromHex('#FF0000'), [0, 100, 50]);
  assert.deepEqual(hslFromHex('#00FF00'), [120, 100, 50]);
  assert.deepEqual(hslFromHex('#0000FF'), [240, 100, 50]);
  assert.deepEqual(hslFromHex('#422B1C'), [23.68, 40.43, 18.43]);
  assert.equal(colorValue('#422B1C', 'rgb'), 'rgb(66, 43, 28)');
  assert.equal(colorValue('#422B1C', 'hsl'), 'hsl(23.68, 40.43%, 18.43%)');
});

test('WCAG ratios use linearized sRGB and remain symmetric', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#422B1C', '#422B1C'), 1);
  assert.equal(contrastRatio('#422B1C', '#F5EFE3').toFixed(2), '11.50');
  assert.equal(contrastRatio('#C9AE6B', '#F5EFE3').toFixed(2), '1.88');
  for (const a of colors) for (const b of colors) assert.equal(contrastRatio(a.hex, b.hex), contrastRatio(b.hex, a.hex));
});

test('Accessibility verdicts use the unrounded ratio at each boundary', () => {
  assert.equal(contrastChecks(4.49999)[0].passed, false);
  assert.equal(contrastChecks(4.5)[0].passed, true);
  assert.equal(contrastChecks(2.99999)[1].passed, false);
  assert.equal(contrastChecks(3)[1].passed, true);
  assert.equal(contrastChecks(6.99999)[2].passed, false);
  assert.equal(contrastChecks(7)[2].passed, true);
});

test('Every swatch label has AA normal-text contrast', () => {
  for (const color of colors) assert.ok(contrastRatio(color.hex, readableText(color.hex)) >= 4.5, color.name);
});

test('CSS and JSON exports contain the exact colors and honest font availability', () => {
  const css = cssTokens();
  const exported = JSON.parse(JSON.stringify(paletteExport()));
  assert.deepEqual(exported.colors.map(color => color.hex), expectedHex);
  assert.deepEqual(exported.colors.map(color => color.rgb), expectedRgb);
  for (const color of colors) assert.ok(css.includes(`${color.token}: ${color.hex};`));
  assert.doesNotMatch(css, /a98a3f|422bac|antique gold/i);
  assert.match(exported.roleNote, /Suggested web roles/);
  assert.deepEqual(typography.map(font => font.family), ['Imbue', 'Finland Rounded', 'Kufam']);
  assert.match(typography[1].status, /required/);
});

test('Rendered CSS base tokens match the exported data', () => {
  const css = readFileSync(new URL('palette.css', source), 'utf8');
  for (const color of colors) assert.ok(css.includes(`${color.token}: ${color.hex};`));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});

test('Static downloads match generated exports and work without JavaScript', () => {
  assert.equal(readFileSync(new URL('juchess-palette.css', source), 'utf8'), cssTokens());
  assert.deepEqual(JSON.parse(readFileSync(new URL('juchess-palette.json', source), 'utf8')), paletteExport());
  const html = readFileSync(new URL('index.html', source), 'utf8');
  assert.match(html, /href="\.\/juchess-palette.css" download/);
  assert.match(html, /href="\.\/juchess-palette.json" download/);
});

function clipboardFixture({ nativeCopy, fallbackCopy = () => true } = {}) {
  let removed = false, restored = false, selected = false, value;
  const previous = { focus: () => { restored = true; } };
  const input = { style: {}, setAttribute() {}, select() { selected = true; }, remove() { removed = true; } };
  Object.defineProperty(input, 'value', { set: next => { value = next; } });
  const document = { activeElement: previous, createElement: () => input, body: { appendChild() {} }, execCommand: fallbackCopy };
  return { environment: { navigator: nativeCopy ? { clipboard: { writeText: nativeCopy } } : {}, document }, state: () => ({ removed, restored, selected, value }) };
}

test('Native clipboard copies exact text without the fallback', async () => {
  let actual;
  const fixture = clipboardFixture({ nativeCopy: async text => { actual = text; } });
  assert.equal(await copyText('#422B1C', fixture.environment), true);
  assert.equal(actual, '#422B1C');
  assert.equal(fixture.state().selected, false);
});

test('Denied native clipboard uses fallback and restores focus', async () => {
  const fixture = clipboardFixture({ nativeCopy: async () => { throw new Error('Permission denied'); } });
  assert.equal(await copyText('#422B1C', fixture.environment), true);
  assert.deepEqual(fixture.state(), { removed: true, restored: true, selected: true, value: '#422B1C' });
});

test('Failed or throwing fallback never reports success and cleans up', async () => {
  for (const fallbackCopy of [() => false, () => { throw new Error('Unavailable'); }]) {
    const fixture = clipboardFixture({ fallbackCopy });
    assert.equal(await copyText('tokens', fixture.environment), false);
    assert.equal(fixture.state().removed, true);
    assert.equal(fixture.state().restored, true);
  }
});

test('Source page and both published paths have byte-identical assets', () => {
  function verify(directory, relative = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = `${relative}${entry.name}`;
      if (entry.isDirectory()) verify(new URL(`${entry.name}/`, directory), `${name}/`);
      else for (const target of ['../docs/palette/', '../docs/web/palette/']) {
        assert.deepEqual(readFileSync(new URL(name, source)), readFileSync(new URL(`${target}${name}`, import.meta.url)), name);
      }
    }
  }
  verify(source);
});
