param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'
$TableId = 'attendance_confirmations'

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

function Get-Columns {
  $json = & appwrite tables-db list-columns --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read columns for $TableId." }
  return @(($json | ConvertFrom-Json).columns)
}

function Ensure-Table {
  if ((Get-Tables).'$id' -contains $TableId) { Write-Host "$TableId already exists."; return }
  & appwrite tables-db create-table --database-id $DatabaseId --table-id $TableId --name 'Attendance confirmations' --row-security true | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId." }
  Write-Host "Created $TableId."
}

function Ensure-Varchar([string]$Key, [int]$Size, [bool]$Required = $false) {
  if ((Get-Columns).key -contains $Key) { return }
  & appwrite tables-db create-varchar-column --database-id $DatabaseId --table-id $TableId --key $Key --size $Size --required (ConvertTo-CliBoolean $Required) --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Datetime([string]$Key, [bool]$Required = $false) {
  if ((Get-Columns).key -contains $Key) { return }
  & appwrite tables-db create-datetime-column --database-id $DatabaseId --table-id $TableId --key $Key --required (ConvertTo-CliBoolean $Required) --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Enum([string]$Key, [string[]]$Elements, [string]$DefaultValue = '') {
  if ((Get-Columns).key -contains $Key) { return }
  $arguments = @('tables-db', 'create-enum-column', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--elements') + $Elements + @('--required', 'false', '--array', 'false')
  if ($DefaultValue) { $arguments += @('--xdefault', $DefaultValue) }
  & appwrite @arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Wait-Columns([string[]]$Keys) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $available = (Get-Columns).key
    if (@($Keys | Where-Object { $available -notcontains $_ }).Count -eq 0) { return }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for $TableId columns."
}

function Ensure-Index([string]$Key, [string]$Type, [string[]]$Columns) {
  $json = & appwrite tables-db list-indexes --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read indexes for $TableId." }
  if (@(($json | ConvertFrom-Json).indexes).key -contains $Key) { return }
  $arguments = @('tables-db', 'create-index', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--type', $Type, '--columns') + $Columns
  & appwrite @arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

Ensure-Table
Ensure-Varchar tournamentId 64 $true
Ensure-Varchar profileId 64 $true
Ensure-Varchar registrationId 64 $true
Ensure-Varchar accountId 64 $true
Ensure-Enum status @('pending', 'confirmed', 'declined') 'pending'
Ensure-Varchar tokenNonce 32 $true
Ensure-Varchar tokenHash 64
Ensure-Datetime tokenExpiresAt
Ensure-Datetime reminderSentAt
Ensure-Enum reminderEmailStatus @('pending', 'sent', 'unavailable', 'failed', 'skipped') 'pending'
Ensure-Enum reminderPushStatus @('pending', 'sent', 'unavailable', 'failed', 'skipped') 'pending'
Ensure-Varchar emailMessageId 36
Ensure-Varchar pushMessageId 36
Ensure-Varchar lastDeliveryError 1000
Ensure-Datetime respondedAt
Ensure-Enum responseSource @('web', 'app', 'email')
Ensure-Datetime createdAt $true
Ensure-Datetime updatedAt $true

Wait-Columns @('tournamentId', 'profileId', 'registrationId', 'status', 'tokenHash')
Ensure-Index registration_unique unique @('registrationId')
Ensure-Index tournament_status key @('tournamentId', 'status')
Ensure-Index profile_status key @('profileId', 'status')
Ensure-Index token_lookup key @('tokenHash')

Write-Host 'Attendance confirmation schema migration submitted.'
