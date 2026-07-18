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

function Get-TournamentColumns {
  $json = & appwrite tables-db list-columns `
    --database-id $DatabaseId `
    --table-id tournaments `
    --limit 100 `
    --json
  if ($LASTEXITCODE -ne 0) {
    throw "Could not read tournament columns. Run 'appwrite login' or set APPWRITE_API_KEY."
  }
  return ($json | ConvertFrom-Json).columns
}

$columns = Get-TournamentColumns
if ($columns.key -contains 'locationUrl') {
  Write-Host 'tournaments.locationUrl already exists.'
  exit 0
}

& appwrite tables-db create-url-column `
  --database-id $DatabaseId `
  --table-id tournaments `
  --key locationUrl `
  --required false `
  --array false | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw 'Could not create tournaments.locationUrl.'
}

$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep -Seconds 2
  $column = Get-TournamentColumns | Where-Object key -eq 'locationUrl'
} while ($column.status -ne 'available' -and (Get-Date) -lt $deadline)

if ($column.status -ne 'available') {
  throw 'tournaments.locationUrl did not become available before the timeout.'
}

Write-Host 'Tournament location URL migration complete.'
