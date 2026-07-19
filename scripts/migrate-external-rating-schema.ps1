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

if ($columns.key -notcontains 'ratingSource') {
  & appwrite tables-db create-varchar-column `
    --database-id $DatabaseId `
    --table-id profiles `
    --key ratingSource `
    --size 32 `
    --required false `
    --array false | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not create profiles.ratingSource.'
  }
}

if ($columns.key -notcontains 'ratingUpdatedAt') {
  & appwrite tables-db create-datetime-column `
    --database-id $DatabaseId `
    --table-id profiles `
    --key ratingUpdatedAt `
    --required false `
    --array false | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not create profiles.ratingUpdatedAt.'
  }
}

$deadline = (Get-Date).AddSeconds(120)
do {
  Start-Sleep -Seconds 2
  $columns = Get-ProfileColumns
  $source = $columns | Where-Object key -eq 'ratingSource'
  $updatedAt = $columns | Where-Object key -eq 'ratingUpdatedAt'
} while (($source.status -ne 'available' -or $updatedAt.status -ne 'available') -and (Get-Date) -lt $deadline)

if ($source.status -ne 'available' -or $updatedAt.status -ne 'available') {
  throw 'External rating profile columns did not become available before the timeout.'
}

Write-Host 'External rating profile migration complete.'
