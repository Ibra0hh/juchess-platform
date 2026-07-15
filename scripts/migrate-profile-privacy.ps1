param(
  [switch]$FinalizePublicFields,
  [string]$Endpoint = 'https://cloud.appwrite.io/v1',
  [string]$ProjectId = 'juchess-platform',
  [string]$DatabaseId = 'juchess',
  [string]$ApiKey = $env:APPWRITE_API_KEY
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Windows PowerShell 5 can otherwise negotiate an obsolete TLS version for
# direct REST calls even though the Node-based Appwrite CLI works normally.
[Net.ServicePointManager]::SecurityProtocol = `
  [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$PublicTableId = 'profiles'
$PrivateTableId = 'profile_private'
$PrivateFieldKeys = @('profileId', 'accountId', 'email', 'universityId', 'phone')
$PublicPrivateFieldKeys = @('accountId', 'email', 'universityId', 'phone')
$CanonicalPublicTablePermissions = @(
  'read("team:admin_super_admins")',
  'read("team:admin_staff")'
)
$PageSize = 100

$appwriteCommand = Get-Command appwrite -ErrorAction SilentlyContinue
if (-not $appwriteCommand) {
  throw 'Appwrite CLI is required.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required to invoke the Appwrite CLI safely on Windows.'
}

# Calling the JavaScript entrypoint directly preserves JSON objects and quoted
# permission strings when this script runs under Windows PowerShell.
$AppwriteCli = Join-Path (Split-Path $appwriteCommand.Source) 'node_modules\appwrite-cli\dist\cli.cjs'
if (-not (Test-Path -LiteralPath $AppwriteCli)) {
  throw "Appwrite CLI entrypoint was not found at $AppwriteCli"
}

function Restore-EnvironmentValue {
  param([string]$Name, [AllowNull()][string]$Value)
  if ($null -eq $Value) {
    Remove-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
  } else {
    Set-Item -Path "Env:$Name" -Value $Value
  }
}

function Invoke-AppwriteRaw {
  param(
    [Parameter(Mandatory)][string[]]$CliArgs,
    [Parameter(Mandatory)][string]$Context
  )

  $previousCi = $env:CI
  $previousUpdateNotifier = $env:NO_UPDATE_NOTIFIER
  try {
    $env:CI = '1'
    $env:NO_UPDATE_NOTIFIER = '1'
    $output = @(& node $AppwriteCli @CliArgs 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    Restore-EnvironmentValue -Name CI -Value $previousCi
    Restore-EnvironmentValue -Name NO_UPDATE_NOTIFIER -Value $previousUpdateNotifier
  }

  if ($exitCode -ne 0) {
    throw "$Context failed. Appwrite output was withheld to prevent private data disclosure."
  }

  return @($output | ForEach-Object { [string]$_ })
}

function ConvertFrom-AppwriteJson {
  param(
    [Parameter(Mandatory)][object[]]$Output,
    [Parameter(Mandatory)][string]$Context
  )

  $lines = @($Output | ForEach-Object { [string]$_ })
  $cleanLines = @($lines | Where-Object {
    $_ -notmatch 'newer version|appwrite update|Run .*update'
  })
  $clean = ($cleanLines -join "`n") -replace "$([char]27)\[[0-9;]*[A-Za-z]", ''
  $start = $clean.IndexOf('{')
  $end = $clean.LastIndexOf('}')
  if ($start -lt 0 -or $end -lt $start) {
    throw "$Context returned no JSON object. Output was withheld."
  }

  try {
    return ($clean.Substring($start, $end - $start + 1) | ConvertFrom-Json)
  } catch {
    throw "$Context returned invalid JSON. Output was withheld."
  }
}

function Invoke-AppwriteJson {
  param(
    [Parameter(Mandatory)][string[]]$CliArgs,
    [Parameter(Mandatory)][string]$Context
  )
  $output = Invoke-AppwriteRaw -CliArgs ($CliArgs + @('--json')) -Context $Context
  return ConvertFrom-AppwriteJson -Output $output -Context $Context
}

function Invoke-AppwriteMutation {
  param(
    [Parameter(Mandatory)][string[]]$CliArgs,
    [Parameter(Mandatory)][string]$Context
  )
  $null = Invoke-AppwriteRaw -CliArgs ($CliArgs + @('--json')) -Context $Context
}

function Get-PropertyValue {
  param([Parameter(Mandatory)]$Object, [Parameter(Mandatory)][string]$Name)
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Test-StringSetEqual {
  param([object[]]$Left, [object[]]$Right)
  $leftValues = @($Left | ForEach-Object { [string]$_ } | Sort-Object -Unique)
  $rightValues = @($Right | ForEach-Object { [string]$_ } | Sort-Object -Unique)
  return @((Compare-Object -ReferenceObject $leftValues -DifferenceObject $rightValues)).Count -eq 0
}

function Test-ExactValue {
  param($Left, $Right)
  if ($null -eq $Left -and $null -eq $Right) { return $true }
  if ($null -eq $Left -or $null -eq $Right) { return $false }
  return ([string]$Left) -ceq ([string]$Right)
}

function Get-AppwriteRestHeaders {
  $headers = @{
    'X-Appwrite-Project' = $ProjectId
    'Accept' = 'application/json'
  }

  if ($ApiKey) {
    $headers['X-Appwrite-Key'] = $ApiKey
    return $headers
  }

  # Reuse the authenticated Appwrite CLI session without logging or copying it
  # into the repository. A CLI read immediately precedes each permission write,
  # so an OAuth access token has already been refreshed when necessary.
  $prefsPath = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.appwrite\prefs.json'
  if (-not (Test-Path -LiteralPath $prefsPath)) {
    throw "Appwrite CLI credentials were not found. Run 'appwrite login' or set APPWRITE_API_KEY."
  }

  try {
    $prefs = Get-Content -Raw -LiteralPath $prefsPath | ConvertFrom-Json
    $current = [string](Get-PropertyValue -Object $prefs -Name 'current')
    $session = if ($current) { Get-PropertyValue -Object $prefs -Name $current } else { $null }
  } catch {
    throw 'Appwrite CLI credentials could not be read.'
  }
  if ($null -eq $session) { throw "Appwrite CLI session is missing. Run 'appwrite login'." }

  $accessToken = [string](Get-PropertyValue -Object $session -Name 'accessToken')
  $cookie = [string](Get-PropertyValue -Object $session -Name 'cookie')
  $storedKey = [string](Get-PropertyValue -Object $session -Name 'key')
  if ($accessToken) {
    $headers['Authorization'] = "Bearer $accessToken"
    $headers['X-Appwrite-Mode'] = 'admin'
  } elseif ($cookie) {
    $headers['Cookie'] = $cookie
    $headers['X-Appwrite-Mode'] = 'admin'
  } elseif ($storedKey) {
    $headers['X-Appwrite-Key'] = $storedKey
  } else {
    throw "Appwrite CLI session has no usable credential. Run 'appwrite login'."
  }
  return $headers
}

function Invoke-AppwriteRestMutation {
  param(
    [Parameter(Mandatory)][ValidateSet('Put', 'Patch')][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)]$Body,
    [Parameter(Mandatory)][string]$Context
  )

  $uri = $Endpoint.TrimEnd('/') + $Path
  $json = $Body | ConvertTo-Json -Depth 8 -Compress
  $status = 0
  $handler = $null
  $client = $null
  $request = $null
  $response = $null
  try {
    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.UseCookies = $false
    $client = New-Object System.Net.Http.HttpClient($handler)
    foreach ($entry in (Get-AppwriteRestHeaders).GetEnumerator()) {
      $null = $client.DefaultRequestHeaders.TryAddWithoutValidation([string]$entry.Key, [string]$entry.Value)
    }
    $request = New-Object System.Net.Http.HttpRequestMessage
    $request.Method = New-Object System.Net.Http.HttpMethod($Method.ToUpperInvariant())
    $request.RequestUri = [uri]$uri
    $request.Content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, 'application/json')
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $status = [int]$response.StatusCode
    if (-not $response.IsSuccessStatusCode) {
      throw 'Appwrite rejected the REST mutation.'
    }
  } catch {
    throw "$Context failed (HTTP $status). Appwrite response was withheld to prevent private data disclosure."
  } finally {
    if ($null -ne $response) { $response.Dispose() }
    if ($null -ne $request) { $request.Dispose() }
    if ($null -ne $client) { $client.Dispose() }
    if ($null -ne $handler) { $handler.Dispose() }
  }
}

function Wait-ForCondition {
  param(
    [Parameter(Mandatory)][scriptblock]$Condition,
    [Parameter(Mandatory)][string]$FailureMessage
  )
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (& $Condition) { return }
    Start-Sleep -Seconds 2
  }
  throw $FailureMessage
}

function Get-Tables {
  $response = Invoke-AppwriteJson -Context 'List Appwrite tables' -CliArgs @(
    'tables-db', 'list-tables', '--database-id', $DatabaseId, '--limit', '100', '--total', 'false'
  )
  return @($response.tables)
}

function Get-Table {
  param([Parameter(Mandatory)][string]$TableId)
  return Invoke-AppwriteJson -Context "Read $TableId table metadata" -CliArgs @(
    'tables-db', 'get-table', '--database-id', $DatabaseId, '--table-id', $TableId
  )
}

function Get-Columns {
  param([Parameter(Mandatory)][string]$TableId)
  $response = Invoke-AppwriteJson -Context "List $TableId columns" -CliArgs @(
    'tables-db', 'list-columns', '--database-id', $DatabaseId, '--table-id', $TableId,
    '--limit', '100', '--total', 'false'
  )
  return @($response.columns)
}

function Get-Indexes {
  param([Parameter(Mandatory)][string]$TableId)
  $response = Invoke-AppwriteJson -Context "List $TableId indexes" -CliArgs @(
    'tables-db', 'list-indexes', '--database-id', $DatabaseId, '--table-id', $TableId,
    '--limit', '100', '--total', 'false'
  )
  return @($response.indexes)
}

function Get-Index {
  param([Parameter(Mandatory)][string]$TableId, [Parameter(Mandatory)][string]$Key)
  return Invoke-AppwriteJson -Context "Read $TableId index metadata" -CliArgs @(
    'tables-db', 'get-index', '--database-id', $DatabaseId, '--table-id', $TableId, '--key', $Key
  )
}

function Get-AllRows {
  param([Parameter(Mandatory)][string]$TableId)

  $rows = New-Object 'System.Collections.Generic.List[object]'
  $cursor = $null
  do {
    $arguments = @(
      'tables-db', 'list-rows', '--database-id', $DatabaseId, '--table-id', $TableId,
      '--limit', [string]$PageSize, '--total', 'false', '--ttl', '0'
    )
    if ($cursor) { $arguments += @('--cursor-after', $cursor) }
    $response = Invoke-AppwriteJson -Context "List $TableId rows" -CliArgs $arguments
    $page = @($response.rows)
    foreach ($row in $page) { $rows.Add($row) }
    if ($page.Count -gt 0) { $cursor = [string](Get-PropertyValue -Object $page[-1] -Name '$id') }
  } while ($page.Count -eq $PageSize)

  return $rows.ToArray()
}

function Get-Row {
  param([Parameter(Mandatory)][string]$TableId, [Parameter(Mandatory)][string]$RowId)
  return Invoke-AppwriteJson -Context "Read one $TableId row" -CliArgs @(
    'tables-db', 'get-row', '--database-id', $DatabaseId, '--table-id', $TableId, '--row-id', $RowId
  )
}

function New-RowMap {
  param([object[]]$Rows)
  $map = New-Object 'System.Collections.Generic.Dictionary[string,object]'
  foreach ($row in @($Rows)) {
    $rowId = [string](Get-PropertyValue -Object $row -Name '$id')
    if (-not $rowId) { throw 'Appwrite returned a row without an ID.' }
    $map.Add($rowId, $row)
  }
  return $map
}

function Set-TablePermissions {
  param(
    [Parameter(Mandatory)][string]$TableId,
    [Parameter(Mandatory)][AllowEmptyCollection()][string[]]$Permissions
  )
  # The CLI's variadic --permissions option cannot represent an empty array,
  # so use the authenticated TablesDB REST endpoint for exact replacement.
  $path = '/tablesdb/' + [uri]::EscapeDataString($DatabaseId) + '/tables/' + [uri]::EscapeDataString($TableId)
  Invoke-AppwriteRestMutation -Method Put -Path $path -Context "Secure $TableId table permissions" -Body ([ordered]@{
    permissions = @($Permissions)
    rowSecurity = $true
    purge = $true
  })

  Wait-ForCondition -FailureMessage "$TableId permissions did not settle before the timeout." -Condition {
    $table = Get-Table -TableId $TableId
    $actual = @((Get-PropertyValue -Object $table -Name '$permissions'))
    return [bool]$table.rowSecurity -and (Test-StringSetEqual -Left $actual -Right $Permissions)
  }
}

function Ensure-PrivateTable {
  $tables = Get-Tables
  if (@($tables | Where-Object { (Get-PropertyValue -Object $_ -Name '$id') -eq $PrivateTableId }).Count -eq 0) {
    Invoke-AppwriteMutation -Context "Create $PrivateTableId" -CliArgs @(
      'tables-db', 'create-table', '--database-id', $DatabaseId, '--table-id', $PrivateTableId,
      '--name', 'Private profiles', '--row-security', 'true'
    )
    Wait-ForCondition -FailureMessage "$PrivateTableId was not created before the timeout." -Condition {
      return @((Get-Tables) | Where-Object { (Get-PropertyValue -Object $_ -Name '$id') -eq $PrivateTableId }).Count -eq 1
    }
  }

  # Apply this unconditionally. Besides enforcing the exact fail-closed table
  # state, it validates the authenticated REST permission path before any
  # private rows are backfilled.
  Set-TablePermissions -TableId $PrivateTableId -Permissions @()
}

function Ensure-VarcharColumn {
  param([string]$Key, [int]$Size, [bool]$Required)
  $columns = Get-Columns -TableId $PrivateTableId
  $column = @($columns | Where-Object key -eq $Key) | Select-Object -First 1
  if ($null -eq $column) {
    Invoke-AppwriteMutation -Context "Create $PrivateTableId.$Key" -CliArgs @(
      'tables-db', 'create-varchar-column', '--database-id', $DatabaseId, '--table-id', $PrivateTableId,
      '--key', $Key, '--size', [string]$Size, '--required', $Required.ToString().ToLowerInvariant(),
      '--array', 'false', '--encrypt', 'false'
    )
  }

  Wait-ForCondition -FailureMessage "$PrivateTableId.$Key did not become available." -Condition {
    $current = @((Get-Columns -TableId $PrivateTableId) | Where-Object key -eq $Key) | Select-Object -First 1
    return $null -ne $current -and $current.status -eq 'available'
  }

  $column = @((Get-Columns -TableId $PrivateTableId) | Where-Object key -eq $Key) | Select-Object -First 1
  if ($column.type -ne 'varchar' -or [int]$column.size -ne $Size -or [bool]$column.required -ne $Required) {
    throw "$PrivateTableId.$Key exists with an incompatible definition."
  }
}

function Ensure-EmailColumn {
  $columns = Get-Columns -TableId $PrivateTableId
  $column = @($columns | Where-Object key -eq 'email') | Select-Object -First 1
  if ($null -eq $column) {
    Invoke-AppwriteMutation -Context "Create $PrivateTableId.email" -CliArgs @(
      'tables-db', 'create-email-column', '--database-id', $DatabaseId, '--table-id', $PrivateTableId,
      '--key', 'email', '--required', 'true', '--array', 'false'
    )
  }

  Wait-ForCondition -FailureMessage "$PrivateTableId.email did not become available." -Condition {
    $current = @((Get-Columns -TableId $PrivateTableId) | Where-Object key -eq 'email') | Select-Object -First 1
    return $null -ne $current -and $current.status -eq 'available'
  }

  $column = @((Get-Columns -TableId $PrivateTableId) | Where-Object key -eq 'email') | Select-Object -First 1
  if ($column.format -ne 'email' -or -not [bool]$column.required) {
    throw "$PrivateTableId.email exists with an incompatible definition."
  }
}

function Ensure-PrivateIndex {
  param([string]$Key, [string]$Column)
  $indexes = Get-Indexes -TableId $PrivateTableId
  $listed = @($indexes | Where-Object key -eq $Key) | Select-Object -First 1
  if ($null -eq $listed) {
    Invoke-AppwriteMutation -Context "Create $PrivateTableId.$Key" -CliArgs @(
      'tables-db', 'create-index', '--database-id', $DatabaseId, '--table-id', $PrivateTableId,
      '--key', $Key, '--type', 'unique', '--columns', $Column
    )
  }

  Wait-ForCondition -FailureMessage "$PrivateTableId.$Key did not become available." -Condition {
    $current = @((Get-Indexes -TableId $PrivateTableId) | Where-Object key -eq $Key) | Select-Object -First 1
    return $null -ne $current -and $current.status -eq 'available'
  }

  $index = Get-Index -TableId $PrivateTableId -Key $Key
  if ($index.type -ne 'unique' -or -not (Test-StringSetEqual -Left @($index.columns) -Right @($Column))) {
    throw "$PrivateTableId.$Key exists with an incompatible definition."
  }
}

function Ensure-PrivateSchema {
  Ensure-PrivateTable
  Ensure-VarcharColumn -Key 'profileId' -Size 64 -Required $true
  Ensure-VarcharColumn -Key 'accountId' -Size 64 -Required $true
  Ensure-EmailColumn
  Ensure-VarcharColumn -Key 'universityId' -Size 64 -Required $false
  Ensure-VarcharColumn -Key 'phone' -Size 32 -Required $false

  Ensure-PrivateIndex -Key 'profileId_unique' -Column 'profileId'
  Ensure-PrivateIndex -Key 'accountId_unique' -Column 'accountId'
  Ensure-PrivateIndex -Key 'email_unique' -Column 'email'
  Ensure-PrivateIndex -Key 'universityId_unique' -Column 'universityId'
  Ensure-PrivateIndex -Key 'phone_unique' -Column 'phone'
}

function Make-PublicSourceColumnsOptional {
  $columns = Get-Columns -TableId $PublicTableId
  $accountId = @($columns | Where-Object key -eq 'accountId') | Select-Object -First 1
  if ($null -ne $accountId -and [bool]$accountId.required) {
    $path = '/tablesdb/' + [uri]::EscapeDataString($DatabaseId) + '/tables/' +
      [uri]::EscapeDataString($PublicTableId) + '/columns/varchar/accountId'
    Invoke-AppwriteRestMutation -Method Patch -Path $path -Context 'Make profiles.accountId optional' -Body ([ordered]@{
      required = $false
      default = $null
    })
  }

  $email = @($columns | Where-Object key -eq 'email') | Select-Object -First 1
  if ($null -ne $email -and [bool]$email.required) {
    $path = '/tablesdb/' + [uri]::EscapeDataString($DatabaseId) + '/tables/' +
      [uri]::EscapeDataString($PublicTableId) + '/columns/email/email'
    Invoke-AppwriteRestMutation -Method Patch -Path $path -Context 'Make profiles.email optional' -Body ([ordered]@{
      required = $false
      default = $null
    })
  }

  foreach ($key in @('accountId', 'email')) {
    if (@($columns | Where-Object key -eq $key).Count -eq 0) { continue }
    Wait-ForCondition -FailureMessage "profiles.$key did not become optional." -Condition {
      $current = @((Get-Columns -TableId $PublicTableId) | Where-Object key -eq $key) | Select-Object -First 1
      return $null -eq $current -or ($current.status -eq 'available' -and -not [bool]$current.required)
    }
  }
}

function Get-OwnerReadPermission {
  param([Parameter(Mandatory)][string]$AccountId)
  return 'read("user:' + $AccountId + '")'
}

function Set-RowPermissions {
  param(
    [Parameter(Mandatory)][string]$TableId,
    [Parameter(Mandatory)][string]$RowId,
    [Parameter(Mandatory)][AllowEmptyCollection()][string[]]$Permissions
  )
  $path = '/tablesdb/' + [uri]::EscapeDataString($DatabaseId) + '/tables/' +
    [uri]::EscapeDataString($TableId) + '/rows/' + [uri]::EscapeDataString($RowId)
  Invoke-AppwriteRestMutation -Method Patch -Path $path -Context "Update $TableId row permissions" -Body ([ordered]@{
    data = [ordered]@{}
    permissions = @($Permissions)
  })
}

function Sync-PrivateRows {
  param([object[]]$PublicRows)

  $privateMap = New-RowMap -Rows (Get-AllRows -TableId $PrivateTableId)
  $created = 0
  $secured = 0

  foreach ($publicRow in @($PublicRows)) {
    $rowId = [string](Get-PropertyValue -Object $publicRow -Name '$id')
    if ($privateMap.ContainsKey($rowId)) {
      $privateRow = $privateMap[$rowId]
      foreach ($key in $PublicPrivateFieldKeys) {
        $publicValue = Get-PropertyValue -Object $publicRow -Name $key
        $privateValue = Get-PropertyValue -Object $privateRow -Name $key
        if ($null -ne $publicValue -and -not (Test-ExactValue -Left $publicValue -Right $privateValue)) {
          throw 'A non-empty public identity value differs from its private copy. No values were changed.'
        }
      }

      $accountId = [string](Get-PropertyValue -Object $privateRow -Name 'accountId')
      $email = [string](Get-PropertyValue -Object $privateRow -Name 'email')
      if (-not $accountId -or -not $email) {
        throw 'An existing private profile is missing required identity data.'
      }
      $expectedPermissions = @(Get-OwnerReadPermission -AccountId $accountId)
      $actualPermissions = @((Get-PropertyValue -Object (Get-Row -TableId $PrivateTableId -RowId $rowId) -Name '$permissions'))
      if (-not (Test-StringSetEqual -Left $actualPermissions -Right $expectedPermissions)) {
        Set-RowPermissions -TableId $PrivateTableId -RowId $rowId -Permissions $expectedPermissions
        $secured++
      }
      continue
    }

    $accountId = [string](Get-PropertyValue -Object $publicRow -Name 'accountId')
    $email = [string](Get-PropertyValue -Object $publicRow -Name 'email')
    if (-not $accountId -or -not $email) {
      throw 'A public profile has no private row and lacks required backfill data.'
    }

    $data = [ordered]@{
      profileId = $rowId
      accountId = $accountId
      email = $email
      universityId = Get-PropertyValue -Object $publicRow -Name 'universityId'
      phone = Get-PropertyValue -Object $publicRow -Name 'phone'
    }
    $permission = Get-OwnerReadPermission -AccountId $accountId
    $path = '/tablesdb/' + [uri]::EscapeDataString($DatabaseId) + '/tables/' +
      [uri]::EscapeDataString($PrivateTableId) + '/rows/' + [uri]::EscapeDataString($rowId)
    Invoke-AppwriteRestMutation -Method Put -Path $path -Context "Backfill one $PrivateTableId row" -Body ([ordered]@{
      data = $data
      permissions = @($permission)
    })
    $created++
  }

  Write-Host "Private profile backfill checked $($PublicRows.Count) row(s); created $created and corrected $secured permission set(s)."
}

function Assert-PrivateCopies {
  param([object[]]$PublicRows, [switch]$AllowPublicNull)

  $privateRows = Get-AllRows -TableId $PrivateTableId
  if ($privateRows.Count -ne $PublicRows.Count) {
    throw 'Public and private profile row counts differ.'
  }
  $privateMap = New-RowMap -Rows $privateRows
  $privateCanonicalValues = 0

  foreach ($publicRow in @($PublicRows)) {
    $rowId = [string](Get-PropertyValue -Object $publicRow -Name '$id')
    if (-not $privateMap.ContainsKey($rowId)) {
      throw 'A public profile has no deterministic private row.'
    }
    $privateRow = $privateMap[$rowId]
    if (-not (Test-ExactValue -Left $rowId -Right (Get-PropertyValue -Object $privateRow -Name 'profileId'))) {
      throw 'A private profile ID does not match its row ID.'
    }

    $accountId = [string](Get-PropertyValue -Object $privateRow -Name 'accountId')
    $email = [string](Get-PropertyValue -Object $privateRow -Name 'email')
    if (-not $accountId -or -not $email) {
      throw 'A private profile is missing required identity data.'
    }

    foreach ($key in $PublicPrivateFieldKeys) {
      $publicValue = Get-PropertyValue -Object $publicRow -Name $key
      $privateValue = Get-PropertyValue -Object $privateRow -Name $key
      if (Test-ExactValue -Left $publicValue -Right $privateValue) { continue }
      if ($AllowPublicNull -and $null -eq $publicValue -and $null -ne $privateValue) {
        $privateCanonicalValues++
        continue
      }
      throw 'Private profile copy verification failed. No values were printed.'
    }

    $expectedPermissions = @(Get-OwnerReadPermission -AccountId $accountId)
    $actualPermissions = @((Get-PropertyValue -Object (Get-Row -TableId $PrivateTableId -RowId $rowId) -Name '$permissions'))
    if (-not (Test-StringSetEqual -Left $actualPermissions -Right $expectedPermissions) -or $actualPermissions.Count -ne 1) {
      throw 'A private profile does not have exactly one owner-read permission.'
    }
  }

  if ($privateCanonicalValues -eq 0) {
    Write-Host "Verified $($PublicRows.Count) exact public-to-private profile copy pair(s)."
  } else {
    Write-Host "Verified $($PublicRows.Count) private profile pair(s); $privateCanonicalValues value(s) were already private-only."
  }
}

function Set-CanonicalPublicTablePermissions {
  Set-TablePermissions -TableId $PublicTableId -Permissions $CanonicalPublicTablePermissions
}

function Remove-PublicRowWritePermissions {
  param([object[]]$PublicRows)
  $changed = 0
  foreach ($listedRow in @($PublicRows)) {
    $rowId = [string](Get-PropertyValue -Object $listedRow -Name '$id')
    $row = Get-Row -TableId $PublicTableId -RowId $rowId
    $permissions = @((Get-PropertyValue -Object $row -Name '$permissions'))
    $reads = @($permissions | Where-Object { $_ -match '^read\("[^\"]+"\)$' } | Select-Object -Unique)
    if (-not (Test-StringSetEqual -Left $permissions -Right $reads) -or $permissions.Count -ne $reads.Count) {
      Set-RowPermissions -TableId $PublicTableId -RowId $rowId -Permissions $reads
      $changed++
    }
    $verified = @((Get-PropertyValue -Object (Get-Row -TableId $PublicTableId -RowId $rowId) -Name '$permissions'))
    if (-not (Test-StringSetEqual -Left $verified -Right $reads) -or @($verified | Where-Object { $_ -notmatch '^read\(' }).Count -ne 0) {
      throw 'A public profile row still has a client write permission.'
    }
  }
  Write-Host "Verified read-only permissions on $($PublicRows.Count) public profile row(s); changed $changed."
}

function Scrub-PublicPrivateFields {
  $columns = Get-Columns -TableId $PublicTableId
  $presentKeys = @($PublicPrivateFieldKeys | Where-Object { $columns.key -contains $_ })
  if ($presentKeys.Count -eq 0) { return }

  Make-PublicSourceColumnsOptional
  $rows = Get-AllRows -TableId $PublicTableId
  foreach ($row in @($rows)) {
    $data = [ordered]@{}
    foreach ($key in $presentKeys) { $data[$key] = $null }
    $rowId = [string](Get-PropertyValue -Object $row -Name '$id')
    $path = '/tablesdb/' + [uri]::EscapeDataString($DatabaseId) + '/tables/' +
      [uri]::EscapeDataString($PublicTableId) + '/rows/' + [uri]::EscapeDataString($rowId)
    Invoke-AppwriteRestMutation -Method Patch -Path $path -Context 'Scrub one public profile row' -Body ([ordered]@{
      data = $data
    })
  }

  foreach ($row in @(Get-AllRows -TableId $PublicTableId)) {
    foreach ($key in $presentKeys) {
      if ($null -ne (Get-PropertyValue -Object $row -Name $key)) {
        throw 'A public private-data field was not scrubbed.'
      }
    }
  }
  Write-Host "Scrubbed private values from $($rows.Count) public profile row(s)."
}

function Remove-PublicPrivateIndexes {
  $removed = 0
  foreach ($listed in @(Get-Indexes -TableId $PublicTableId)) {
    $index = Get-Index -TableId $PublicTableId -Key $listed.key
    $affected = @($index.columns | Where-Object { $PublicPrivateFieldKeys -contains $_ }).Count -gt 0
    if (-not $affected) { continue }
    if ($index.status -ne 'deleting') {
      Invoke-AppwriteMutation -Context 'Remove a public private-data index' -CliArgs @(
        'tables-db', 'delete-index', '--database-id', $DatabaseId, '--table-id', $PublicTableId,
        '--key', $index.key
      )
      $removed++
    }
  }

  Wait-ForCondition -FailureMessage 'Public private-data indexes were not removed before the timeout.' -Condition {
    foreach ($listed in @(Get-Indexes -TableId $PublicTableId)) {
      $index = Get-Index -TableId $PublicTableId -Key $listed.key
      if (@($index.columns | Where-Object { $PublicPrivateFieldKeys -contains $_ }).Count -gt 0) { return $false }
    }
    return $true
  }
  Write-Host "Removed $removed public private-data index(es)."
}

function Remove-PublicPrivateColumns {
  $columns = Get-Columns -TableId $PublicTableId
  $removed = 0
  foreach ($key in $PublicPrivateFieldKeys) {
    $column = @($columns | Where-Object key -eq $key) | Select-Object -First 1
    if ($null -eq $column) { continue }
    if ($column.status -ne 'deleting') {
      Invoke-AppwriteMutation -Context "Remove profiles.$key" -CliArgs @(
        'tables-db', 'delete-column', '--database-id', $DatabaseId, '--table-id', $PublicTableId,
        '--key', $key
      )
      $removed++
    }
  }

  Wait-ForCondition -FailureMessage 'Public private-data columns were not removed before the timeout.' -Condition {
    $remaining = (Get-Columns -TableId $PublicTableId).key
    return @($PublicPrivateFieldKeys | Where-Object { $remaining -contains $_ }).Count -eq 0
  }
  Write-Host "Removed $removed public private-data column(s)."
}

function Assert-AnonymousPublicRowsAreSafe {
  $offset = 0
  $checked = 0
  do {
    $queries = @(
      @{ method = 'limit'; values = @($PageSize) },
      @{ method = 'offset'; values = @($offset) }
    )
    $queryParts = @($queries | ForEach-Object {
      'queries%5B%5D=' + [uri]::EscapeDataString(($_ | ConvertTo-Json -Depth 3 -Compress))
    })
    $uri = $Endpoint.TrimEnd('/') + '/databases/' + [uri]::EscapeDataString($DatabaseId) +
      '/collections/' + [uri]::EscapeDataString($PublicTableId) + '/documents?' +
      ($queryParts -join '&') + '&ttl=0'
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $uri -Headers @{
        'X-Appwrite-Project' = $ProjectId
        'Accept' = 'application/json'
      }
      $body = $response.Content | ConvertFrom-Json
    } catch {
      throw 'Anonymous public profile verification request failed. Response was withheld.'
    }

    if ([int]$response.StatusCode -ne 200) {
      throw 'Anonymous public profile verification did not return HTTP 200.'
    }
    $page = @($body.documents)
    foreach ($row in $page) {
      foreach ($key in $PublicPrivateFieldKeys) {
        if ($null -ne $row.PSObject.Properties[$key]) {
          throw 'An anonymous public profile response still contains a private field.'
        }
      }
    }
    $checked += $page.Count
    $offset += $page.Count
    $total = [int]$body.total
  } while ($page.Count -gt 0 -and $checked -lt $total)

  Write-Host "Verified $checked anonymous public profile response row(s) contain no private fields."
}

function Assert-FinalTableState {
  $publicTable = Get-Table -TableId $PublicTableId
  $publicPermissions = @((Get-PropertyValue -Object $publicTable -Name '$permissions'))
  if (-not [bool]$publicTable.rowSecurity -or
      -not (Test-StringSetEqual -Left $publicPermissions -Right $CanonicalPublicTablePermissions)) {
    throw 'Public profile table permissions are not in the final state.'
  }

  $privateTable = Get-Table -TableId $PrivateTableId
  $privatePermissions = @((Get-PropertyValue -Object $privateTable -Name '$permissions'))
  if (-not [bool]$privateTable.rowSecurity -or $privatePermissions.Count -ne 0) {
    throw 'Private profile table permissions are not in the final state.'
  }

  $remaining = (Get-Columns -TableId $PublicTableId).key
  if (@($PublicPrivateFieldKeys | Where-Object { $remaining -contains $_ }).Count -ne 0) {
    throw 'Public profile private-data columns still exist.'
  }
}

function Invoke-ProfilePrivacyMigration {
  if ($ApiKey) {
    $null = Invoke-AppwriteRaw -Context 'Configure Appwrite API-key client' -CliArgs @(
      'client', '--endpoint', $Endpoint, '--project-id', $ProjectId, '--key', $ApiKey
    )
  }

  $null = Get-Table -TableId $PublicTableId
  Ensure-PrivateSchema
  Make-PublicSourceColumnsOptional

  $publicRows = Get-AllRows -TableId $PublicTableId
  Sync-PrivateRows -PublicRows $publicRows
  Assert-PrivateCopies -PublicRows $publicRows -AllowPublicNull

  if (-not $FinalizePublicFields) {
    Write-Host 'Profile privacy stage 1 is complete. No private values or row IDs were printed.'
    Write-Host 'Deploy and verify all updated clients and Functions before running with -FinalizePublicFields.'
    return
  }

  # Re-read and re-verify immediately before the first destructive change.
  $publicRows = Get-AllRows -TableId $PublicTableId
  Assert-PrivateCopies -PublicRows $publicRows -AllowPublicNull

  Set-CanonicalPublicTablePermissions
  # Close the direct-create race, then include and verify any row that arrived
  # between the pre-final check and the table permission switch.
  $publicRows = Get-AllRows -TableId $PublicTableId
  Sync-PrivateRows -PublicRows $publicRows
  Assert-PrivateCopies -PublicRows $publicRows -AllowPublicNull
  Remove-PublicRowWritePermissions -PublicRows $publicRows
  Scrub-PublicPrivateFields
  Remove-PublicPrivateIndexes
  Remove-PublicPrivateColumns

  Assert-FinalTableState
  $finalPublicRows = Get-AllRows -TableId $PublicTableId
  Assert-PrivateCopies -PublicRows $finalPublicRows -AllowPublicNull
  Remove-PublicRowWritePermissions -PublicRows $finalPublicRows
  Assert-AnonymousPublicRowsAreSafe

  Write-Host 'Profile privacy finalization is complete. No private values or row IDs were printed.'
}

Invoke-ProfilePrivacyMigration
