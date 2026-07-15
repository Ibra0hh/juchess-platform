param(
  [string]$DatabaseId = 'juchess'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$TournamentId = 'showcase_swiss_online_6'
$PublicRead = 'read("any")'
$StartedAt = '2026-07-12T18:00:00.000Z'
$FinishedAt = '2026-07-12T21:35:00.000Z'
$AppwriteCli = Join-Path (Split-Path (Get-Command appwrite).Source) 'node_modules\appwrite-cli\dist\cli.cjs'

if (-not (Test-Path -LiteralPath $AppwriteCli)) {
  throw "Appwrite CLI entrypoint was not found at $AppwriteCli"
}

function Upsert-Row {
  param(
    [Parameter(Mandatory)][string]$TableId,
    [Parameter(Mandatory)][string]$RowId,
    [Parameter(Mandatory)][hashtable]$Data,
    [string[]]$Permissions = @($PublicRead)
  )

  $json = $Data | ConvertTo-Json -Depth 12 -Compress
  # Calling the CLI entrypoint directly preserves JSON quotes on Windows.
  $output = & node $AppwriteCli tables-db upsert-row `
    --database-id $DatabaseId `
    --table-id $TableId `
    --row-id $RowId `
    --data $json `
    --permissions $Permissions `
    --json 2>&1

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to upsert $TableId/$RowId`n$($output -join "`n")"
  }

  Write-Host "upserted $TableId/$RowId"
}

function New-Pgn {
  param(
    [Parameter(Mandatory)][string]$White,
    [Parameter(Mandatory)][string]$Black,
    [Parameter(Mandatory)][int]$Round,
    [Parameter(Mandatory)][string]$Result,
    [Parameter(Mandatory)][string]$Moves
  )

  return @"
[Event "Swiss"]
[Site "JuChess"]
[Date "2026.07.12"]
[Round "$Round"]
[White "$White"]
[Black "$Black"]
[Result "$Result"]
[TimeControl "300+3"]

$Moves $Result
"@
}

$players = @(
  @{ Id = 'showcase_player_01'; Name = 'Ibrahim Ahmad'; Rating = 1810; UniversityId = 'SHOWCASE-001'; Email = 'ibrahim.showcase@juchess.test' },
  @{ Id = 'showcase_player_02'; Name = 'Omar Saleh'; Rating = 1740; UniversityId = 'SHOWCASE-002'; Email = 'omar.showcase@juchess.test' },
  @{ Id = 'showcase_player_03'; Name = 'Leen Haddad'; Rating = 1685; UniversityId = 'SHOWCASE-003'; Email = 'leen.showcase@juchess.test' },
  @{ Id = 'showcase_player_04'; Name = 'Yazan Khaled'; Rating = 1602; UniversityId = 'SHOWCASE-004'; Email = 'yazan.showcase@juchess.test' },
  @{ Id = 'showcase_player_05'; Name = 'Sara Nasser'; Rating = 1550; UniversityId = 'SHOWCASE-005'; Email = 'sara.showcase@juchess.test' },
  @{ Id = 'showcase_player_06'; Name = 'Mohammad Al-Khatib'; Rating = 1490; UniversityId = 'SHOWCASE-006'; Email = 'mohammad.showcase@juchess.test' }
)

foreach ($player in $players) {
  $accountId = "$($player.Id)_account"
  Upsert-Row -TableId 'profiles' -RowId $player.Id -Data @{
    displayName = $player.Name
    university = 'University of Jordan'
    rating = $player.Rating
    role = 'member'
    status = 'active'
  }
  Upsert-Row -TableId 'profile_private' -RowId $player.Id -Data @{
    profileId = $player.Id
    accountId = $accountId
    email = $player.Email
    universityId = $player.UniversityId
  } -Permissions @("read(`"user:$accountId`")")
}

Upsert-Row -TableId 'tournaments' -RowId $TournamentId -Data @{
  slug = 'swiss-online-six-player-showcase'
  name = 'Swiss'
  status = 'completed'
  format = 'Swiss'
  timeControl = '5+3 Blitz'
  roundsTotal = 4
  currentRound = 4
  startsAt = $StartedAt
  endsAt = $FinishedAt
  registrationDeadline = '2026-07-12T17:45:00.000Z'
  playMode = 'online'
  onlinePlatform = 'juchess'
  location = 'JuChess'
  capacity = 6
  description = 'Six-player JuChess online Swiss showcase with four completed rounds, playable PGNs and final standings.'
  physicalBoards = 3
  firstMoveGraceSeconds = 60
  disconnectGraceSeconds = 90
  chatPolicy = 'full'
  fairPlayMode = 'standard'
  createdByProfileId = 'showcase_player_01'
}

for ($index = 0; $index -lt $players.Count; $index += 1) {
  $number = $index + 1
  Upsert-Row -TableId 'registrations' -RowId ('showcase_reg_{0:d2}' -f $number) -Data @{
    tournamentId = $TournamentId
    profileId = $players[$index].Id
    status = 'confirmed'
    seed = $number
    checkedIn = $false
  }
}

$openings = @(
  '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3',
  '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6',
  '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 b5',
  '1. c4 e5 2. Nc3 Nf6 3. g3 d5 4. cxd5 Nxd5 5. Bg2 Nb6 6. Nf3 Nc6 7. O-O',
  '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O',
  '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3',
  '1. Nf3 d5 2. g3 Nf6 3. Bg2 g6 4. O-O Bg7 5. d3 O-O 6. Nbd2 c5',
  '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6',
  '1. d4 f5 2. g3 Nf6 3. Bg2 g6 4. Nf3 Bg7 5. O-O O-O 6. c4 d6',
  '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. d4 Nf6 5. Nf3 c6 6. Bc4',
  '1. c4 c5 2. Nc3 Nc6 3. Nf3 Nf6 4. g3 g6 5. Bg2 Bg7 6. O-O O-O',
  '1. d4 d5 2. Nf3 Nf6 3. c4 c6 4. Nc3 e6 5. e3 Nbd7 6. Bd3'
)

$games = @(
  @{ Round = 1; Board = 1; White = 1; Black = 4; Result = '1-0' },
  @{ Round = 1; Board = 2; White = 5; Black = 2; Result = '1/2-1/2' },
  @{ Round = 1; Board = 3; White = 3; Black = 6; Result = '1-0' },
  @{ Round = 2; Board = 1; White = 3; Black = 1; Result = '1/2-1/2' },
  @{ Round = 2; Board = 2; White = 2; Black = 4; Result = '1-0' },
  @{ Round = 2; Board = 3; White = 6; Black = 5; Result = '0-1' },
  @{ Round = 3; Board = 1; White = 1; Black = 2; Result = '1-0' },
  @{ Round = 3; Board = 2; White = 5; Black = 3; Result = '0-1' },
  @{ Round = 3; Board = 3; White = 4; Black = 6; Result = '1/2-1/2' },
  @{ Round = 4; Board = 1; White = 6; Black = 1; Result = '0-1' },
  @{ Round = 4; Board = 2; White = 3; Black = 2; Result = '1-0' },
  @{ Round = 4; Board = 3; White = 5; Black = 4; Result = '1/2-1/2' }
)

$roundStartTimes = @(
  '2026-07-12T18:00:00.000Z',
  '2026-07-12T18:50:00.000Z',
  '2026-07-12T19:40:00.000Z',
  '2026-07-12T20:30:00.000Z'
)
$roundFinishTimes = @(
  '2026-07-12T18:34:00.000Z',
  '2026-07-12T19:23:00.000Z',
  '2026-07-12T20:16:00.000Z',
  '2026-07-12T21:05:00.000Z'
)

for ($index = 0; $index -lt $games.Count; $index += 1) {
  $game = $games[$index]
  $white = $players[$game.White - 1]
  $black = $players[$game.Black - 1]
  $rowId = 'showcase_g_r{0}_b{1}' -f $game.Round, $game.Board
  $pgn = New-Pgn -White $white.Name -Black $black.Name -Round $game.Round -Result $game.Result -Moves $openings[$index]

  Upsert-Row -TableId 'games' -RowId $rowId -Data @{
    tournamentId = $TournamentId
    round = $game.Round
    board = $game.Board
    whiteProfileId = $white.Id
    blackProfileId = $black.Id
    status = 'completed'
    result = $game.Result
    pgn = $pgn
    startedAt = $roundStartTimes[$game.Round - 1]
    finishedAt = $roundFinishTimes[$game.Round - 1]
    moveVersion = 14
    whiteTimeMs = 0
    blackTimeMs = 0
    lastMoveAt = $roundFinishTimes[$game.Round - 1]
  }
}

$standings = @(
  @{ Player = 3; Rank = 1; Points = 3.5; TieBreak = 7.5; Wins = 3; Draws = 1; Losses = 0 },
  @{ Player = 1; Rank = 2; Points = 3.5; TieBreak = 6.5; Wins = 3; Draws = 1; Losses = 0 },
  @{ Player = 5; Rank = 3; Points = 2.0; TieBreak = 6.5; Wins = 1; Draws = 2; Losses = 1 },
  @{ Player = 2; Rank = 4; Points = 1.5; TieBreak = 10.0; Wins = 1; Draws = 1; Losses = 2 },
  @{ Player = 4; Rank = 5; Points = 1.0; TieBreak = 7.5; Wins = 0; Draws = 2; Losses = 2 },
  @{ Player = 6; Rank = 6; Points = 0.5; TieBreak = 10.0; Wins = 0; Draws = 1; Losses = 3 }
)

foreach ($standing in $standings) {
  $profile = $players[$standing.Player - 1]
  Upsert-Row -TableId 'standings' -RowId ('showcase_std_{0:d2}' -f $standing.Rank) -Data @{
    tournamentId = $TournamentId
    profileId = $profile.Id
    rank = $standing.Rank
    points = $standing.Points
    tieBreak = $standing.TieBreak
    played = 4
    wins = $standing.Wins
    draws = $standing.Draws
    losses = $standing.Losses
  }
}

Write-Host ''
Write-Host 'Online Swiss showcase is ready.'
Write-Host "Tournament ID: $TournamentId"
Write-Host 'Public route: /web/tournaments/swiss-online-six-player-showcase'
