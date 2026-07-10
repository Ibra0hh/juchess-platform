param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command appwrite -ErrorAction SilentlyContinue)) {
  throw 'Appwrite CLI is required.'
}

if ($ApiKey) {
  & appwrite client --endpoint $Endpoint --project-id $ProjectId --key $ApiKey | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not configure the Appwrite API-key client.'
  }
}

$columnsJson = & appwrite tables-db list-columns --database-id $DatabaseId --table-id tournaments --limit 100 --json
if ($LASTEXITCODE -ne 0) {
  throw "Could not read tournament columns. Run 'appwrite login' or set APPWRITE_API_KEY."
}

$columns = ($columnsJson | ConvertFrom-Json).columns
if ($columns.key -contains 'playMode') {
  Write-Host 'tournaments.playMode already exists.'
  exit 0
}

& appwrite tables-db create-enum-column `
  --database-id $DatabaseId `
  --table-id tournaments `
  --key playMode `
  --elements inPerson online `
  --required false `
  --xdefault inPerson `
  --array false | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw 'Could not create tournaments.playMode.'
}

Write-Host 'Submitted tournaments.playMode migration.'
