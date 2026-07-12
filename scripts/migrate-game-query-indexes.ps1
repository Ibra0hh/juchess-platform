param(
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'
$TableId = 'games'

if (-not (Get-Command appwrite -ErrorAction SilentlyContinue)) {
  throw 'Appwrite CLI is required.'
}

if ($ApiKey) {
  & appwrite client --endpoint $Endpoint --project-id $ProjectId --key $ApiKey | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not configure the Appwrite API-key client.' }
}

$indexesJson = & appwrite tables-db list-indexes `
  --database-id $DatabaseId `
  --table-id $TableId `
  --limit 100 `
  --json
if ($LASTEXITCODE -ne 0) {
  throw "Could not read indexes for $TableId. Run 'appwrite login' or set APPWRITE_API_KEY."
}
$indexes = @(($indexesJson | ConvertFrom-Json).indexes)

$definitions = @(
  @{ key = 'game_status'; columns = @('status') },
  @{ key = 'white_profile_status'; columns = @('whiteProfileId', 'status') },
  @{ key = 'black_profile_status'; columns = @('blackProfileId', 'status') },
  @{ key = 'tournament_status'; columns = @('tournamentId', 'status') }
)

foreach ($definition in $definitions) {
  if ($indexes.key -contains $definition.key) {
    Write-Host "$TableId.$($definition.key) already exists."
    continue
  }

  $arguments = @(
    'tables-db', 'create-index',
    '--database-id', $DatabaseId,
    '--table-id', $TableId,
    '--key', $definition.key,
    '--type', 'key',
    '--columns'
  ) + $definition.columns

  & appwrite @arguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create $TableId.$($definition.key)."
  }
  Write-Host "Submitted $TableId.$($definition.key)."
}

Write-Host 'Game query index migration complete.'
