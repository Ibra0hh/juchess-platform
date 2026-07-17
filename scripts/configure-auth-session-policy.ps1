[CmdletBinding()]
param(
  [ValidateRange(2, 100)]
  [int]$Total = 5
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command appwrite -ErrorAction SilentlyContinue)) {
  throw 'The Appwrite CLI is required. Install it and run appwrite login first.'
}

Write-Host "Configuring the JuChess project to allow $Total active player sessions per account..."
& appwrite project update-session-limit-policy --total $Total
if ($LASTEXITCODE -ne 0) {
  throw 'Appwrite rejected the session policy update. Run appwrite login, then retry this command.'
}

Write-Host 'Five-device account sessions are enabled. The admin app separately enforces one active admin-panel lease per account.'
