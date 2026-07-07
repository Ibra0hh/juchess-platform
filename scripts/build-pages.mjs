import { copyFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const env = { ...process.env, GITHUB_PAGES: 'true' }

function run(command) {
  execSync(command, {
    env,
    stdio: 'inherit',
  })
}

run('npm run build:web')
run('npm run build:admin')

copyFileSync('docs/web/index.html', 'docs/404.html')
copyFileSync('docs/web/index.html', 'docs/web/404.html')
copyFileSync('docs/admin/index.html', 'docs/admin/404.html')
