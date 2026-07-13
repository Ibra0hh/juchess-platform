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
  if ($LASTEXITCODE -ne 0) { throw 'Could not configure the Appwrite API-key client.' }
}

function Get-ProfileColumns {
  $json = & appwrite tables-db list-columns --database-id $DatabaseId --table-id profiles --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read profile columns. Run 'appwrite login' or set APPWRITE_API_KEY." }
  return ($json | ConvertFrom-Json).columns
}

$columns = Get-ProfileColumns
foreach ($key in @('boardTheme', 'pieceTheme')) {
  if ($columns.key -contains $key) {
    Write-Host "profiles.$key already exists."
    continue
  }

  & appwrite tables-db create-varchar-column --database-id $DatabaseId --table-id profiles --key $key --size 120 --required false --array false --encrypt false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create profiles.$key." }
  Write-Host "Submitted profiles.$key migration."
}

$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep -Seconds 2
  $columns = Get-ProfileColumns
  $ready = @('boardTheme', 'pieceTheme') | ForEach-Object {
    $column = $columns | Where-Object key -eq $_
    $column -and $column.status -eq 'available'
  }
} while (($ready -contains $false) -and (Get-Date) -lt $deadline)

if ($ready -contains $false) { throw 'Profile board-preference columns did not become available before the timeout.' }
Write-Host 'Profile board preferences are ready.'
