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

function ConvertTo-CliBoolean([bool]$Value) {
  return $Value.ToString().ToLowerInvariant()
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

function Ensure-Table([string]$TableId, [string]$Name) {
  if ((Get-Tables).'$id' -contains $TableId) { Write-Host "$TableId already exists."; return }
  & appwrite tables-db create-table --database-id $DatabaseId --table-id $TableId --name $Name --row-security true | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId." }
  Write-Host "Created $TableId."
}

function Ensure-Varchar([string]$TableId, [string]$Key, [int]$Size, [bool]$Required = $false, [bool]$Array = $false) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-varchar-column --database-id $DatabaseId --table-id $TableId --key $Key --size $Size --required (ConvertTo-CliBoolean $Required) --array (ConvertTo-CliBoolean $Array) --encrypt false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Text([string]$TableId, [string]$Key, [bool]$Required = $false) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-text-column --database-id $DatabaseId --table-id $TableId --key $Key --required (ConvertTo-CliBoolean $Required) --array false --encrypt false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Datetime([string]$TableId, [string]$Key, [bool]$Required = $false) {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  & appwrite tables-db create-datetime-column --database-id $DatabaseId --table-id $TableId --key $Key --required (ConvertTo-CliBoolean $Required) --array false | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Ensure-Enum([string]$TableId, [string]$Key, [string[]]$Elements, [string]$DefaultValue = '') {
  if ((Get-Columns $TableId).key -contains $Key) { return }
  $arguments = @('tables-db', 'create-enum-column', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--elements') + $Elements + @('--required', 'false', '--array', 'false')
  if ($DefaultValue) { $arguments += @('--xdefault', $DefaultValue) }
  & appwrite @arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

function Wait-Columns([string]$TableId, [string[]]$Keys) {
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    $available = @((Get-Columns $TableId) | Where-Object status -eq 'available' | ForEach-Object key)
    if (@($Keys | Where-Object { $available -notcontains $_ }).Count -eq 0) { return }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for $TableId columns."
}

function Ensure-Index([string]$TableId, [string]$Key, [string]$Type, [string[]]$Columns) {
  $json = & appwrite tables-db list-indexes --database-id $DatabaseId --table-id $TableId --limit 100 --json
  if ($LASTEXITCODE -ne 0) { throw "Could not read indexes for $TableId." }
  if (@(($json | ConvertFrom-Json).indexes).key -contains $Key) { return }
  $arguments = @('tables-db', 'create-index', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key, '--type', $Type, '--columns') + $Columns
  & appwrite @arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create $TableId.$Key." }
}

$applications = 'crew_applications'
$reviews = 'crew_application_reviews'

Ensure-Table $applications 'Crew applications'
Ensure-Varchar $applications profileId 64 $true
Ensure-Varchar $applications accountId 64 $true
Ensure-Varchar $applications interests 64 $true $true
Ensure-Text $applications skills $true
Ensure-Text $applications contribution $true
Ensure-Text $applications developmentGoals
Ensure-Varchar $applications availability 512 $true
Ensure-Varchar $applications portfolioUrl 1024
Ensure-Enum $applications status @('submitted', 'reviewing', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn') 'submitted'
Ensure-Datetime $applications submittedAt $true
Ensure-Datetime $applications updatedAt $true
Wait-Columns $applications @('profileId', 'accountId', 'interests', 'status', 'updatedAt')
Ensure-Index $applications profile_unique unique @('profileId')
Ensure-Index $applications status_updated key @('status', 'updatedAt')

Ensure-Table $reviews 'Crew application reviews'
Ensure-Varchar $reviews applicationId 64 $true
Ensure-Text $reviews internalNotes
Ensure-Datetime $reviews interviewAt
Ensure-Varchar $reviews assignedTo 128
Ensure-Varchar $reviews updatedByAdminId 64 $true
Ensure-Datetime $reviews updatedAt $true
Wait-Columns $reviews @('applicationId', 'updatedByAdminId', 'updatedAt')
Ensure-Index $reviews application_unique unique @('applicationId')

Write-Host 'Recruitment schema migration submitted.'
