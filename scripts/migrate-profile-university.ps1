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

function Get-ProfileColumns {
  $json = & appwrite tables-db list-columns `
    --database-id $DatabaseId `
    --table-id profiles `
    --limit 100 `
    --json
  if ($LASTEXITCODE -ne 0) {
    throw "Could not read profile columns. Run 'appwrite login' or set APPWRITE_API_KEY."
  }
  return ($json | ConvertFrom-Json).columns
}

$columns = Get-ProfileColumns
if ($columns.key -contains 'university') {
  Write-Host 'profiles.university already exists.'
  exit 0
}

& appwrite tables-db create-varchar-column `
  --database-id $DatabaseId `
  --table-id profiles `
  --key university `
  --size 160 `
  --required false `
  --array false `
  --encrypt false | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw 'Could not create profiles.university.'
}

$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep -Seconds 2
  $column = (Get-ProfileColumns | Where-Object key -eq 'university')
} while ($column.status -ne 'available' -and (Get-Date) -lt $deadline)

if ($column.status -ne 'available') {
  throw 'profiles.university did not become available before the timeout.'
}

Write-Host 'profiles.university is available.'
