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

function Get-Columns([string]$TableId) {
  $json = & appwrite tables-db list-columns --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read columns for $TableId. Run 'appwrite login' or set APPWRITE_API_KEY." }
  return ($json | ConvertFrom-Json).columns
}

function Ensure-EnumColumn([string]$TableId, [string]$Key, [string[]]$Elements) {
  if ((Get-Columns $TableId).key -contains $Key) { Write-Host "$TableId.$Key already exists."; return }
  & appwrite tables-db create-enum-column --database-id $DatabaseId --table-id $TableId --key $Key --elements $Elements --required false --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
  Write-Host "Created $TableId.$Key."
}

function Ensure-IntegerColumn([string]$TableId, [string]$Key, [int]$Minimum, [int]$Maximum, [string]$DefaultValue = '') {
  if ((Get-Columns $TableId).key -contains $Key) { Write-Host "$TableId.$Key already exists."; return }
  $args = @('tables-db', 'create-integer-column', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--required', 'false', '--min', $Minimum, '--max', $Maximum, '--array', 'false')
  if ($DefaultValue -ne '') { $args += @('--xdefault', $DefaultValue) }
  & appwrite @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
  Write-Host "Created $TableId.$Key."
}

function Ensure-DatetimeColumn([string]$TableId, [string]$Key) {
  if ((Get-Columns $TableId).key -contains $Key) { Write-Host "$TableId.$Key already exists."; return }
  & appwrite tables-db create-datetime-column --database-id $DatabaseId --table-id $TableId --key $Key --required false --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
  Write-Host "Created $TableId.$Key."
}

Ensure-EnumColumn -TableId 'tournaments' -Key 'onlinePlatform' -Elements @('chessCom', 'lichess', 'juchess')
Ensure-IntegerColumn -TableId 'games' -Key 'moveVersion' -Minimum 0 -Maximum 2147483647 -DefaultValue 0
Ensure-IntegerColumn -TableId 'games' -Key 'whiteTimeMs' -Minimum 0 -Maximum 2147483647
Ensure-IntegerColumn -TableId 'games' -Key 'blackTimeMs' -Minimum 0 -Maximum 2147483647
Ensure-DatetimeColumn -TableId 'games' -Key 'lastMoveAt'
Ensure-DatetimeColumn -TableId 'games' -Key 'turnStartedAt'

Write-Host 'Online tournament schema migration submitted.'
