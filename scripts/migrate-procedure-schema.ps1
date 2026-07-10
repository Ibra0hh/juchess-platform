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

function Get-Columns([string]$TableId) {
  $json = & appwrite tables-db list-columns --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) {
    throw "Could not read columns for $TableId. Run 'appwrite login' or set APPWRITE_API_KEY."
  }
  return ($json | ConvertFrom-Json).columns
}

function Ensure-IntegerColumn(
  [string]$TableId,
  [string]$Key,
  [int]$Minimum,
  [int]$Maximum,
  [string]$DefaultValue = ''
) {
  if ((Get-Columns $TableId).key -contains $Key) {
    Write-Host "$TableId.$Key already exists."
    return
  }

  $args = @(
    'tables-db', 'create-integer-column',
    '--database-id', $DatabaseId,
    '--table-id', $TableId,
    '--key', $Key,
    '--required', 'false',
    '--min', $Minimum,
    '--max', $Maximum,
    '--array', 'false'
  )
  if ($DefaultValue -ne '') {
    $args += @('--xdefault', $DefaultValue)
  }

  & appwrite @args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create $TableId.$Key."
  }
  Write-Host "Created $TableId.$Key."
}

function Ensure-PgnCapacity {
  $column = Get-Columns 'games' | Where-Object { $_.key -eq 'pgn' } | Select-Object -First 1
  if (-not $column) {
    throw 'games.pgn is missing from the Appwrite schema.'
  }
  if ($column.type -eq 'text') {
    Write-Host 'games.pgn already uses Appwrite large text storage.'
    return
  }
  if ([int64]$column.size -ge 50000) {
    Write-Host 'games.pgn already supports full PGN records.'
    return
  }

  $command = if ($column.type -eq 'varchar') { 'update-varchar-column' } else { 'update-string-column' }
  & appwrite tables-db $command --database-id $DatabaseId --table-id 'games' --key 'pgn' --required 'false' --size 50000 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not expand games.pgn to 50,000 characters.'
  }
  Write-Host 'Expanded games.pgn to 50,000 characters.'
}

Ensure-IntegerColumn -TableId 'tournaments' -Key 'physicalBoards' -Minimum 1 -Maximum 64 -DefaultValue 3
Ensure-IntegerColumn -TableId 'games' -Key 'procedureWave' -Minimum 1 -Maximum 1024
Ensure-IntegerColumn -TableId 'games' -Key 'physicalBoard' -Minimum 1 -Maximum 64
Ensure-IntegerColumn -TableId 'games' -Key 'queuePosition' -Minimum 1 -Maximum 10000
Ensure-PgnCapacity

Write-Host 'Procedure schema migration submitted. Confirm each column is available before deploying the function.'
