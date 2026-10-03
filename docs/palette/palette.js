import { colors, colorValue, rgbFromHex, readableText, contrastRatio, contrastChecks, cssTokens } from './palette-data.js';
import { copyText } from './clipboard.js';

const byId = id => document.getElementById(id);
const colorById = id => colors.find(color => color.id === id);
let format = 'hex';
let messageTimeout;

function announce(message) {
  const status = byId('copy-status');
  status.textContent = message;
  status.classList.add('visible');
  window.clearTimeout(messageTimeout);
  messageTimeout = window.setTimeout(() => status.classList.remove('visible'), 3500);
}

async function copy(value, label) {
  const copied = await copyText(value);
  announce(copied ? `${label} copied` : 'Could not copy. Select the value and copy it manually.');
}

function renderColors() {
  for (const group of ['primary', 'secondary']) {
    const list = byId(`${group}-colors`);
    list.replaceChildren();
    for (const color of colors.filter(item => item.group === group)) {
      const value = colorValue(color.hex, format);
      const item = document.createElement('li');
      item.className = 'swatch-item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.backgroundColor = color.hex;
      button.style.color = readableText(color.hex);
      button.dataset.color = color.id;
      button.title = `Copy ${color.name}: ${value}`;
      button.setAttribute('aria-label', `Copy ${color.name} color ${value}`);
      const index = document.createElement('span');
      index.className = 'swatch-index';
      index.textContent = String(colors.indexOf(color) + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'swatch-name';
      name.textContent = color.name;
      const icon = document.createElement('span');
      icon.className = 'icon copy';
      icon.setAttribute('aria-hidden', 'true');
      button.append(index, name, icon);
      button.addEventListener('click', () => copy(value, color.name));
      const details = document.createElement('div');
      details.className = 'swatch-details';
      const code = document.createElement('code');
      code.textContent = value;
      const rgb = document.createElement('span');
      rgb.className = 'rgb-value';
      rgb.textContent = format === 'hex' ? `RGB ${rgbFromHex(color.hex).join(', ')}` : color.hex;
      const role = document.createElement('p');
      role.textContent = color.role;
      details.append(code, rgb, role);
      item.append(button, details);
      list.append(item);
    }
  }
}

document.querySelectorAll('[data-format]').forEach(button => {
  button.addEventListener('click', () => {
    format = button.dataset.format;
    document.querySelectorAll('[data-format]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderColors();
  });
});

function updateContrast() {
  const foreground = colorById(byId('foreground').value);
  const background = colorById(byId('background').value);
  const ratio = contrastRatio(foreground.hex, background.hex);
  const preview = byId('contrast-preview');
  preview.style.color = foreground.hex;
  preview.style.backgroundColor = background.hex;
  byId('preview-values').textContent = `${foreground.hex} / ${background.hex}`;
  byId('contrast-ratio').textContent = `${ratio.toFixed(2)}:1`;
  const list = byId('contrast-checks');
  list.replaceChildren();
  for (const check of contrastChecks(ratio)) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = check.label;
    const result = document.createElement('strong');
    result.textContent = check.passed ? 'Pass' : 'Fail';
    result.className = check.passed ? 'pass' : 'fail';
    item.append(name, result);
    list.append(item);
  }
}

for (const id of ['foreground', 'background']) {
  const select = byId(id);
  for (const color of colors) {
    const option = document.createElement('option');
    option.value = color.id;
    option.textContent = `${color.name} ${color.hex}`;
    select.append(option);
  }
  select.value = id === 'foreground' ? 'surface' : 'burgundy-dark';
  select.addEventListener('change', updateContrast);
}
byId('swap-colors').addEventListener('click', () => {
  const previous = byId('foreground').value;
  byId('foreground').value = byId('background').value;
  byId('background').value = previous;
  updateContrast();
});

for (const [textId, backgroundId] of [['surface', 'burgundy-dark'], ['ink', 'cream'], ['cream', 'mocha'], ['ink', 'gold-soft'], ['muted', 'surface'], ['surface', 'burgundy']]) {
  const foreground = colorById(textId), background = colorById(backgroundId);
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pairing-button';
  button.style.backgroundColor = background.hex;
  button.style.color = foreground.hex;
  button.title = `Check ${foreground.name} on ${background.name}`;
  button.setAttribute('aria-label', button.title);
  const sample = document.createElement('span');
  sample.className = 'pairing-sample';
  sample.textContent = 'Aa';
  const name = document.createElement('span');
  name.className = 'pairing-name';
  name.textContent = `${foreground.name} on ${background.name}`;
  const ratio = document.createElement('strong');
  ratio.textContent = `${contrastRatio(foreground.hex, background.hex).toFixed(2)}:1`;
  button.append(sample, name, ratio);
  button.addEventListener('click', () => {
    byId('foreground').value = textId;
    byId('background').value = backgroundId;
    updateContrast();
    byId('foreground').focus({ preventScroll: true });
    byId('contrast-preview').scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  item.append(button);
  byId('pairings').append(item);
}

byId('token-code').textContent = cssTokens();
byId('copy-tokens').addEventListener('click', () => copy(cssTokens(), 'CSS tokens'));
renderColors();
updateContrast();
