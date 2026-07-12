param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'

function ConvertTo-CliBoolean([bool]$Value) {
  return $Value.ToString().ToLowerInvariant()
}

if (-not (Get-Command appwrite -ErrorAction SilentlyContinue)) {
  throw 'Appwrite CLI is required.'
}

if ($ApiKey) {
  & appwrite client --endpoint $Endpoint --project-id $ProjectId --key $ApiKey | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not configure the Appwrite API-key client.' }
}

function Get-Tables {
  $json = & appwrite tables-db list-tables --database-id $DatabaseId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw 'Could not read Appwrite tables. Run appwrite login or set APPWRITE_API_KEY.' }
  return @(($json | ConvertFrom-Json).tables)
}

function Get-Columns([string]$TableId) {
  $json = & appwrite tables-db list-columns --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read columns for $TableId." }
  return @(($json | ConvertFrom-Json).columns)
}

function Ensure-Table([string]$TableId, [string]$Name, [bool]$RowSecurity = $false) {
  if ((Get-Tables).'$id' -contains $TableId) { Write-Host "$TableId already exists."; return }
  & appwrite tables-db create-table --database-id $DatabaseId --table-id $TableId --name $Name --row-security (ConvertTo-CliBoolean $RowSecurity) | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId." }
  Write-Host "Created $TableId."
}

function Ensure-Varchar([string]$TableId, [string]$Key, [int]$Size, [bool]$Required = $false, [string]$DefaultValue = '') {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  $args = @('tables-db', 'create-varchar-column', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--size', $Size, '--required', (ConvertTo-CliBoolean $Required), '--array', 'false')
  if ($DefaultValue) { $args += @('--xdefault', $DefaultValue) }
  & appwrite @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Integer([string]$TableId, [string]$Key, [int]$Minimum, [int]$Maximum, [bool]$Required = $false) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-integer-column --database-id $DatabaseId --table-id $TableId --key $Key --required (ConvertTo-CliBoolean $Required) --min $Minimum --max $Maximum --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Float([string]$TableId, [string]$Key) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-float-column --database-id $DatabaseId --table-id $TableId --key $Key --required false --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Datetime([string]$TableId, [string]$Key, [bool]$Required = $false) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-datetime-column --database-id $DatabaseId --table-id $TableId --key $Key --required (ConvertTo-CliBoolean $Required) --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Enum([string]$TableId, [string]$Key, [string[]]$Elements, [bool]$Required = $false, [string]$DefaultValue = '') {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  $args = @('tables-db', 'create-enum-column', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--elements') + $Elements + @('--required', (ConvertTo-CliBoolean $Required), '--array', 'false')
  if ($DefaultValue) { $args += @('--xdefault', $DefaultValue) }
  & appwrite @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-LongText([string]$TableId, [string]$Key) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-longtext-column --database-id $DatabaseId --table-id $TableId --key $Key --required false --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Wait-Columns([string]$TableId, [string[]]$Keys) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $available = (Get-Columns $TableId).key
    if (@($Keys | Where-Object { $available -notcontains $_ }).Count -eq 0) { return }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for $TableId columns."
}

function Ensure-Index([string]$TableId, [string]$Key, [string[]]$Columns) {
  $json = & appwrite tables-db list-indexes --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read indexes for $TableId." }
  if (@(($json | ConvertFrom-Json).indexes).key -contains $Key) { return }
  $args = @(
    'tables-db', 'create-index',
    '--database-id', $DatabaseId,
    '--table-id', $TableId,
    '--key', $Key,
    '--type', 'key',
    '--columns'
  ) + $Columns
  & appwrite @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

Ensure-Integer tournaments firstMoveGraceSeconds 5 600
Ensure-Integer tournaments disconnectGraceSeconds 15 600
Ensure-Enum tournaments chatPolicy @('full', 'preset', 'disabled') $false 'full'
Ensure-Enum tournaments fairPlayMode @('standard', 'strict', 'proctored') $false 'standard'

Ensure-Datetime games scheduledStartAt
Ensure-Datetime games firstMoveDeadlineAt
Ensure-Datetime games clockDeadlineAt
Ensure-Enum games terminationReason @('checkmate', 'draw', 'resignation', 'timeout', 'noShow', 'forfeit', 'cancelled')
Ensure-Varchar games forfeitedProfileId 64

Ensure-Table game_messages 'Game messages' $true
Ensure-Varchar game_messages gameId 64 $true
Ensure-Varchar game_messages tournamentId 64 $true
Ensure-Varchar game_messages senderProfileId 64 $true
Ensure-Enum game_messages kind @('text', 'preset', 'system') $false 'text'
Ensure-Varchar game_messages body 500 $true
Ensure-Enum game_messages status @('active', 'removed') $false 'active'
Ensure-Datetime game_messages createdAt $true
Ensure-Datetime game_messages removedAt
Ensure-Varchar game_messages removedByProfileId 64
Wait-Columns game_messages @('gameId', 'tournamentId', 'createdAt')
Ensure-Index game_messages game_created @('gameId', 'createdAt')
Ensure-Index game_messages tournament_created @('tournamentId', 'createdAt')

Ensure-Table fair_play_events 'Fair play events'
Ensure-Varchar fair_play_events gameId 64 $true
Ensure-Varchar fair_play_events tournamentId 64 $true
Ensure-Varchar fair_play_events profileId 64 $true
Ensure-Varchar fair_play_events sessionId 96 $true
Ensure-Enum fair_play_events eventType @('heartbeat', 'tabHidden', 'tabVisible', 'windowBlur', 'windowFocus', 'fullscreenExit', 'disconnect', 'reconnect', 'analysisAttempt') $true
Ensure-Integer fair_play_events durationMs 0 2147483647
Ensure-Varchar fair_play_events metadata 2000
Ensure-Datetime fair_play_events occurredAt $true
Wait-Columns fair_play_events @('gameId', 'tournamentId', 'profileId', 'occurredAt')
Ensure-Index fair_play_events game_time @('gameId', 'occurredAt')
Ensure-Index fair_play_events profile_time @('profileId', 'occurredAt')
Ensure-Index fair_play_events tournament_time @('tournamentId', 'occurredAt')

Ensure-Table fair_play_reviews 'Fair play reviews'
Ensure-Varchar fair_play_reviews gameId 64 $true
Ensure-Varchar fair_play_reviews tournamentId 64 $true
Ensure-Varchar fair_play_reviews profileId 64 $true
Ensure-Enum fair_play_reviews status @('clear', 'watch', 'review', 'confirmed', 'appealed') $true
Ensure-Integer fair_play_reviews riskScore 0 100
Ensure-Float fair_play_reviews accuracy
Ensure-Float fair_play_reviews engineMatchRate
Ensure-Float fair_play_reviews averageCentipawnLoss
Ensure-LongText fair_play_reviews signals
Ensure-Varchar fair_play_reviews reviewedByProfileId 64
Ensure-Datetime fair_play_reviews reviewedAt
Ensure-Datetime fair_play_reviews createdAt $true
Wait-Columns fair_play_reviews @('gameId', 'profileId', 'status')
Ensure-Index fair_play_reviews game_review @('gameId')
Ensure-Index fair_play_reviews profile_review @('profileId', 'status')

Write-Host 'Tournament live-play schema migration submitted.'
