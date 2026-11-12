// GitHub Pages serves the custom 404 for legacy slug URLs. Forward only the
// tournament pattern to a real static page before the React bundle loads.
export const legacyTournamentRedirect = String.raw`(() => {
  const match = location.pathname.match(/^\/(?:web\/)?tournament\/([^/]+)\/?$/);
  if (!match) return;
  let slug;
  try { slug = decodeURIComponent(match[1]); } catch { return; }
  if (!slug.trim()) return;
  const target = new URL('/tournament/', location.origin);
  target.search = location.search;
  target.searchParams.set('event', slug);
  target.hash = location.hash;
  location.replace(target.href);
})();`;

export function renderTournamentFallback(template) {
  return template.replace(/\r+\n/g, '\n').replace('<head>', () => `<head>\n    <script>${legacyTournamentRedirect}</script>`);
}
