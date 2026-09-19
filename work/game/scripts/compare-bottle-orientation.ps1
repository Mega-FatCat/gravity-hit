$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$workRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$qaRoot = Join-Path $workRoot 'qa\recovery'
$beforeRoot = Join-Path $qaRoot 'bottle-orientation-before'
$afterRoot = Join-Path $qaRoot 'bottle-orientation-after'

function New-ComparisonSheet {
  param(
    [string]$FileName,
    [string]$CaptureMode,
    [string[]]$Views,
    [System.Drawing.Rectangle]$SourceCrop,
    [double]$Scale
  )

  $target = Join-Path $qaRoot $FileName
  if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite existing comparison: $target" }

  $margin = 18
  $rowLabelWidth = 78
  $columnHeaderHeight = 44
  $rowGap = 14
  $cellWidth = [int]($SourceCrop.Width * $Scale)
  $cellHeight = [int]($SourceCrop.Height * $Scale)
  $rowHeight = $cellHeight + 30
  $width = $margin * 2 + $rowLabelWidth + 2 * $cellWidth + 12
  $height = $columnHeaderHeight + $margin + $Views.Count * $rowHeight + ($Views.Count - 1) * $rowGap + $margin

  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(19, 29, 23))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $font = [System.Drawing.Font]::new('Arial', 13, [System.Drawing.FontStyle]::Bold)
  $smallFont = [System.Drawing.Font]::new('Arial', 10, [System.Drawing.FontStyle]::Regular)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(230, 232, 219))
  $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(172, 184, 164))
  $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(91, 112, 93), 1)

  $xBefore = $margin + $rowLabelWidth
  $xAfter = $xBefore + $cellWidth + 12
  $graphics.DrawString('BEFORE', $font, $brush, $xBefore, 12)
  $graphics.DrawString('AFTER', $font, $brush, $xAfter, 12)
  $graphics.DrawString('Matched camera yaw; crop centered on bottle.', $smallFont, $mutedBrush, $xBefore + 105, 15)

  for ($i = 0; $i -lt $Views.Count; $i++) {
    $view = $Views[$i]
    $y = $columnHeaderHeight + $margin + $i * ($rowHeight + $rowGap)
    $graphics.DrawString($view.ToUpperInvariant(), $smallFont, $mutedBrush, $margin, $y + 7)

    foreach ($side in @(@{Name='before'; Root=$beforeRoot; X=$xBefore}, @{Name='after'; Root=$afterRoot; X=$xAfter})) {
      $sourcePath = Join-Path $side.Root "$CaptureMode-$view.png"
      $source = [System.Drawing.Bitmap]::new($sourcePath)
      try {
        $destination = [System.Drawing.Rectangle]::new($side.X, $y, $cellWidth, $cellHeight)
        $graphics.DrawImage($source, $destination, $SourceCrop, [System.Drawing.GraphicsUnit]::Pixel)
        $graphics.DrawRectangle($border, $destination)
      } finally {
        $source.Dispose()
      }
    }
  }

  try {
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $font.Dispose()
    $smallFont.Dispose()
    $brush.Dispose()
    $mutedBrush.Dispose()
    $border.Dispose()
  }
  Write-Output $target
}

New-ComparisonSheet -FileName 'bottle-orientation-held-before-after.jpg' -CaptureMode 'held' -Views @('center', 'left', 'right') -SourceCrop ([System.Drawing.Rectangle]::new(380, 300, 420, 430)) -Scale 1.15
New-ComparisonSheet -FileName 'bottle-orientation-fill-before-after.jpg' -CaptureMode 'fill' -Views @('center', 'left', 'right') -SourceCrop ([System.Drawing.Rectangle]::new(500, 285, 340, 260)) -Scale 1.35
