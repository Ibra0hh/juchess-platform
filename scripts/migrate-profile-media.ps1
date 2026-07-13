param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSEdition -ne 'Core') {
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($pwsh) {
    & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Endpoint $Endpoint -ProjectId $ProjectId -DatabaseId $DatabaseId
    exit $LASTEXITCODE
  }
}

if (-not (Get-Command appwrite -ErrorAction SilentlyContinue)) {
  throw 'Appwrite CLI is required.'
}

if ($ApiKey) {
  & appwrite client --endpoint $Endpoint --project-id $ProjectId --key $ApiKey | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not configure the Appwrite API-key client.' }
}

function Get-ProfileColumns {
  $json = & appwrite tables-db list-columns --database-id $DatabaseId --table-id profiles --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read profile columns. Run 'appwrite login' or set APPWRITE_API_KEY." }
  return ($json | ConvertFrom-Json).columns
}

$columns = Get-ProfileColumns
if ($columns.key -contains 'coverFileId') {
  Write-Host 'profiles.coverFileId already exists.'
} else {
  & appwrite tables-db create-varchar-column --database-id $DatabaseId --table-id profiles --key coverFileId --size 128 --required false --array false --encrypt false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create profiles.coverFileId.' }
  Write-Host 'Submitted profiles.coverFileId migration.'
}

$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep -Seconds 2
  $column = Get-ProfileColumns | Where-Object key -eq 'coverFileId'
} while ((-not $column -or $column.status -ne 'available') -and (Get-Date) -lt $deadline)

if (-not $column -or $column.status -ne 'available') {
  throw 'profiles.coverFileId did not become available before the timeout.'
}

$appwriteCommand = Get-Command appwrite
$appwriteCli = Join-Path (Split-Path $appwriteCommand.Source) 'node_modules/appwrite-cli/dist/cli.cjs'
if (-not (Test-Path $appwriteCli)) { throw 'Could not locate the Appwrite CLI entrypoint.' }

& node $appwriteCli storage update-bucket `
  --bucket-id avatars `
  --name Avatars `
  --permissions 'read("any")' 'create("users")' `
  --file-security true `
  --maximum-file-size 5242880 `
  --allowed-file-extensions jpg jpeg png webp `
  --compression gzip `
  --encryption true `
  --antivirus true `
  --transformations true | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict avatar bucket writes to file owners.' }

Write-Host 'Profile avatar and cover-image storage is ready.'
