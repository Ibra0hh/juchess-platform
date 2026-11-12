import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const functions = new URL('../appwrite/functions/', import.meta.url);
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this script with npm run install:functions.');

for (const directory of readdirSync(functions, { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const cwd = fileURLToPath(new URL(directory.name + '/', functions));
  if (!readdirSync(cwd).includes('package-lock.json')) continue;
  const { error, status } = spawnSync(process.execPath, [npm, 'ci'], { cwd, stdio: 'inherit' });
  if (error) throw error;
  if (status !== 0) process.exit(status ?? 1);
}
