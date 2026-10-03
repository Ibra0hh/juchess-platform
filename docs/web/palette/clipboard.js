export async function copyText(text, { navigator: nav = navigator, document: doc = document } = {}) {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission-denied clipboard writes can still use the legacy user-gesture path.
  }
  const previousFocus = doc.activeElement;
  const input = doc.createElement('textarea');
  input.value = text;
  input.setAttribute('aria-hidden', 'true');
  input.style.cssText = 'position:fixed;left:-9999px;top:0;';
  doc.body.appendChild(input);
  try {
    input.select();
    return doc.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    input.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}
