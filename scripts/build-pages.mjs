import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const env = { ...process.env, GITHUB_PAGES: 'true' }

function run(command) {
  execSync(command, {
    env,
    stdio: 'inherit',
  })
}

// GitHub Pages clients can retain an older HTML document briefly. Preserve
// hashed JavaScript bundles across deployments so those cached documents do
// not fail while loading a route chunk after a newer build is published.
const assetDirs = ['docs/web/assets', 'docs/admin/assets']
const retainedAssetsRoot = mkdtempSync(join(tmpdir(), 'juchess-pages-assets-'))

for (const [index, assetDir] of assetDirs.entries()) {
  const retainedDir = join(retainedAssetsRoot, String(index))
  mkdirSync(retainedDir)
  if (!existsSync(assetDir)) continue
  for (const name of readdirSync(assetDir)) {
    if (name.endsWith('.js')) {
      copyFileSync(join(assetDir, name), join(retainedDir, name))
    }
  }
}

try {
  run('npm run build:web')
  run('npm run build:admin')

  for (const [index, assetDir] of assetDirs.entries()) {
    const retainedDir = join(retainedAssetsRoot, String(index))
    for (const name of readdirSync(retainedDir)) {
      const destination = join(assetDir, name)
      if (!existsSync(destination)) {
        copyFileSync(join(retainedDir, name), destination)
      }
    }
  }

  copyFileSync('docs/web/index.html', 'docs/404.html')
  copyFileSync('docs/web/index.html', 'docs/web/404.html')
  copyFileSync('docs/admin/index.html', 'docs/admin/404.html')
} finally {
  rmSync(retainedAssetsRoot, { force: true, recursive: true })
}
