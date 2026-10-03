import { writeFileSync } from 'node:fs';
import { cssTokens, paletteExport } from '../apps/web/public/palette/palette-data.js';

const directory = new URL('../apps/web/public/palette/', import.meta.url);
writeFileSync(new URL('juchess-palette.css', directory), cssTokens());
writeFileSync(new URL('juchess-palette.json', directory), `${JSON.stringify(paletteExport(), null, 2)}\n`);
