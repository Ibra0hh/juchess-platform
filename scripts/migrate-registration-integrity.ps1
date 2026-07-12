param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'
$TableId = 'registrations'
$IndexKey = 'tournament_profile_unique'

if (-not (Get-Command appwrite -ErrorAction SilentlyContinue)) {
  throw 'Appwrite CLI is required.'
}

if ($ApiKey) {
  & appwrite client --endpoint $Endpoint --project-id $ProjectId --key $ApiKey | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not configure the Appwrite API-key client.' }
}

function Get-RegistrationScore($Row) {
  if ($Row.checkedIn) { return 50 }
  switch ($Row.status) {
    'confirmed' { return 40 }
    'waitlisted' { return 30 }
    'pending' { return 20 }
    'cancelled' { return 10 }
    default { return 0 }
  }
}

$response = & appwrite tables-db list-rows --database-id $DatabaseId --table-id $TableId --limit 500 --json
if ($LASTEXITCODE -ne 0) { throw 'Could not read registration rows.' }
$rows = @(($response | ConvertFrom-Json).rows)

$duplicateGroups = $rows |
  Where-Object { $_.tournamentId -and $_.profileId } |
  Group-Object tournamentId, profileId |
  Where-Object { $_.Count -gt 1 }

$deleted = 0
foreach ($group in $duplicateGroups) {
  $ordered = @($group.Group | Sort-Object `
    @{ Expression = { -(Get-RegistrationScore $_) } }, `
    @{ Expression = { $_.'$createdAt' } })
  $canonical = $ordered[0]

  foreach ($duplicate in $ordered | Select-Object -Skip 1) {
    & appwrite tables-db delete-row `
      --database-id $DatabaseId `
      --table-id $TableId `
      --row-id $duplicate.'$id' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not delete duplicate registration $($duplicate.'$id')." }
    $deleted++
  }

  Write-Host "Kept $($canonical.'$id') for $($canonical.tournamentId)/$($canonical.profileId)."
}

$indexesJson = & appwrite tables-db list-indexes --database-id $DatabaseId --table-id $TableId --limit 100 --json
if ($LASTEXITCODE -ne 0) { throw 'Could not read registration indexes.' }
$indexes = @(($indexesJson | ConvertFrom-Json).indexes)

if ($indexes.key -notcontains $IndexKey) {
  $indexArgs = @(
    'tables-db', 'create-index',
    '--database-id', $DatabaseId,
    '--table-id', $TableId,
    '--key', $IndexKey,
    '--type', 'unique',
    '--columns', 'tournamentId', 'profileId'
  )
  & appwrite @indexArgs | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the unique registration index.' }
  Write-Host "Created $TableId.$IndexKey."
} else {
  Write-Host "$TableId.$IndexKey already exists."
}

Write-Host "Registration integrity migration complete. Removed $deleted duplicate row(s)."
