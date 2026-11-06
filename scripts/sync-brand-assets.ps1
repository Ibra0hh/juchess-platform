# Regenerate the logo renditions checked into the client source directories.
# Run on Windows; this uses System.Drawing and installs no image packages.
param([switch]$Check)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repo = Split-Path -Parent $PSScriptRoot
$mark = [System.Drawing.Image]::FromFile((Join-Path $repo 'branding/juchess-rook-mark.png'))
$ivory = [System.Drawing.ColorTranslator]::FromHtml('#FFFCF4')
$cache = @{}
$mismatches = [System.Collections.Generic.List[string]]::new()
$written = 0

function Get-LogoPng([int]$Size, [string]$Style) {
  $key = "$Size/$Style"
  if ($cache.ContainsKey($key)) { return ,$cache[$key] }

  $format = if ($Style -eq 'icon') {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  } else {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  }
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, $format)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
  $buffer = [System.IO.MemoryStream]::new()
  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)

    $heightRatio = switch ($Style) {
      'icon' { $graphics.Clear($ivory); 0.68 }
      'badge' {
        $brush = [System.Drawing.SolidBrush]::new($ivory)
        try { $graphics.FillEllipse($brush, 1, 1, ($Size - 2), ($Size - 2)) }
        finally { $brush.Dispose() }
        0.76
      }
      'light' {
        $tint = [System.Drawing.Imaging.ColorMatrix]::new()
        $tint.Matrix00 = $tint.Matrix11 = $tint.Matrix22 = 0
        $tint.Matrix40 = $ivory.R / 255.0
        $tint.Matrix41 = $ivory.G / 255.0
        $tint.Matrix42 = $ivory.B / 255.0
        $attributes.SetColorMatrix($tint)
        0.88
      }
      'splash' { 0.76 }
      'mark' { 0.88 }
      default { throw "Unknown logo rendition: $Style" }
    }
    $height = [int][Math]::Round($Size * $heightRatio)
    $width = [int][Math]::Round($height * $mark.Width / $mark.Height)
    $rect = [System.Drawing.Rectangle]::new(
      [int][Math]::Floor(($Size - $width) / 2),
      [int][Math]::Floor(($Size - $height) / 2),
      $width,
      $height
    )
    $graphics.DrawImage($mark, $rect, 0, 0, $mark.Width, $mark.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
    $bitmap.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
    $cache[$key] = $buffer.ToArray()
    return ,$cache[$key]
  } finally {
    $buffer.Dispose()
    $attributes.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Write-BrandAsset([string]$RelativePath, [byte[]]$Bytes) {
  $destination = Join-Path $repo $RelativePath
  if ([System.IO.File]::Exists($destination) -and
      [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($destination)) -eq [Convert]::ToBase64String($Bytes)) { return }
  if ($Check) {
    $mismatches.Add($RelativePath)
    return
  }
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination)) | Out-Null
  [System.IO.File]::WriteAllBytes($destination, $Bytes)
  $script:written++
}

try {
  $web = 'apps/web/public'
  $admin = 'apps/admin/public'
  $mobile = 'apps/mobile'
  $compact = Get-LogoPng 144 'mark'
  Write-BrandAsset "$web/email/juchess-rook.png" $compact
  Write-BrandAsset "$web/email/juchess-rook-light.png" (Get-LogoPng 144 'light')
  # This existing URL also appears in previously delivered emails with dark headers.
  Write-BrandAsset "$web/email/juchess-email-logo.png" (Get-LogoPng 144 'badge')
  Write-BrandAsset "$admin/juchess-rook.png" $compact

  foreach ($size in @(32, 180, 192, 512)) {
    Write-BrandAsset "$web/brand/juchess-rook-$size.png" (Get-LogoPng $size 'icon')
    if ($size -in @(32, 180)) {
      Write-BrandAsset "$admin/brand/juchess-rook-$size.png" (Get-LogoPng $size 'icon')
    }
  }
  # Keep the historical favicon URLs useful for cached pages and direct links.
  $favicon = [Convert]::ToBase64String((Get-LogoPng 64 'icon'))
  $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,' + $favicon + '"/></svg>' + "`n"
  foreach ($root in @($web, $admin)) {
    Write-BrandAsset "$root/favicon.svg" ([System.Text.Encoding]::UTF8.GetBytes($svg))
  }

  $badge = Get-LogoPng 512 'badge'
  foreach ($path in @(
    "$web/juchess-logo.png", "$web/prototype/assets/crest.png",
    "$admin/juchess-logo.png", "$admin/prototype/assets/juchess-logo.png", "$admin/prototype/assets/chessju-logo.png",
    'docs/prototypes/web/assets/crest.png',
    'docs/prototypes/admin/assets/juchess-logo.png', 'docs/prototypes/admin/assets/chessju-logo.png',
    'docs/prototypes/mobile/assets/juchess-logo.png', 'docs/prototypes/mobile/assets/chessju-logo.png'
  )) { Write-BrandAsset $path $badge }

  Write-BrandAsset "$mobile/assets/juchess-logo.png" (Get-LogoPng 384 'mark')
  $android = "$mobile/android/app/src/main/res"
  $densities = [ordered]@{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
  foreach ($density in $densities.Keys) {
    $size = $densities[$density]
    Write-BrandAsset "$android/mipmap-$density/ic_launcher.png" (Get-LogoPng $size 'icon')
    Write-BrandAsset "$android/mipmap-$density/launch_image.png" (Get-LogoPng ($size * 3) 'splash')
  }

  foreach ($platform in @('ios', 'macos')) {
    $catalog = "$mobile/$platform/Runner/Assets.xcassets/AppIcon.appiconset"
    $icons = Get-Content -LiteralPath (Join-Path $repo "$catalog/Contents.json") -Raw | ConvertFrom-Json
    foreach ($icon in $icons.images) {
      $points = [double]::Parse(($icon.size -split 'x')[0], [System.Globalization.CultureInfo]::InvariantCulture)
      $size = [int]($points * [int]$icon.scale.TrimEnd('x'))
      Write-BrandAsset "$catalog/$($icon.filename)" (Get-LogoPng $size 'icon')
    }
  }
  $launch = "$mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset"
  Write-BrandAsset "$launch/LaunchImage.png" (Get-LogoPng 144 'splash')
  Write-BrandAsset "$launch/LaunchImage@2x.png" (Get-LogoPng 288 'splash')
  Write-BrandAsset "$launch/LaunchImage@3x.png" (Get-LogoPng 432 'splash')

  Write-BrandAsset "$mobile/web/favicon.png" (Get-LogoPng 32 'icon')
  foreach ($size in @(192, 512)) {
    $png = Get-LogoPng $size 'icon'
    Write-BrandAsset "$mobile/web/icons/Icon-$size.png" $png
    Write-BrandAsset "$mobile/web/icons/Icon-maskable-$size.png" $png
  }

  # ICO directory followed by PNG frames; the 256px size is encoded as zero.
  $sizes = @(16, 24, 32, 48, 64, 256)
  $frames = foreach ($size in $sizes) { ,(Get-LogoPng $size 'badge') }
  $ico = [System.IO.MemoryStream]::new()
  $writer = [System.IO.BinaryWriter]::new($ico)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
      $size = [byte]($sizes[$i] % 256)
      $writer.Write($size)
      $writer.Write($size)
      $writer.Write([uint16]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$frames[$i].Length)
      $writer.Write([uint32]$offset)
      $offset += $frames[$i].Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
    Write-BrandAsset "$mobile/windows/runner/resources/app_icon.ico" ($ico.ToArray())
  } finally { $writer.Dispose() }
} finally { $mark.Dispose() }

if ($mismatches.Count) { throw "Logo renditions need regeneration: $($mismatches -join ', ')" }
if ($Check) { Write-Output 'All logo renditions match the master artwork.' }
else { Write-Output "Updated $written logo renditions." }
