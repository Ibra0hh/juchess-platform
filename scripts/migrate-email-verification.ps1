param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'
$TableId = 'email_verification_challenges'

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
  & appwrite tables-db create-table --database-id $DatabaseId --table-id $TableId --name 'Email verification challenges' --row-security true | Out-Null
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

function Ensure-Integer([string]$Key, [int]$Minimum, [int]$Maximum, [int]$DefaultValue) {
  if ((Get-Columns).key -contains $Key) { return }
  & appwrite tables-db create-integer-column --database-id $DatabaseId --table-id $TableId --key $Key --required false --min $Minimum --max $Maximum --xdefault $DefaultValue --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Wait-Columns([string[]]$Keys) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $columns = Get-Columns
    $available = @($columns | Where-Object { $_.status -eq 'available' }).key
    if (@($Keys | Where-Object { $available -notcontains $_ }).Count -eq 0) { return }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for $TableId columns to become available."
}

function Ensure-Index([string]$Key, [string[]]$Columns) {
  $json = & appwrite tables-db list-indexes --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read indexes for $TableId." }
  if (@(($json | ConvertFrom-Json).indexes).key -contains $Key) { return }
  $arguments = @('tables-db', 'create-index', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--type', 'key', '--columns') + $Columns
  & appwrite @arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

Ensure-Table
Ensure-Varchar userId 36 $true
Ensure-Varchar emailHash 64 $true
Ensure-Varchar codeHash 64 $true
Ensure-Varchar linkHash 64 $true
Ensure-Datetime expiresAt $true
Ensure-Integer attempts 0 5 0
Ensure-Datetime consumedAt
Ensure-Varchar emailMessageId 36 $true
Ensure-Datetime createdAt $true

Wait-Columns @('userId', 'emailHash', 'codeHash', 'linkHash', 'expiresAt', 'attempts', 'emailMessageId', 'createdAt')
Ensure-Index verification_user @('userId')
Ensure-Index verification_email @('emailHash')

Write-Host 'Two-hour email verification schema migration submitted.'
