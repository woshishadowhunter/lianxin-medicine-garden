$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$iconRoot = Join-Path $root 'miniprogram/images/ui-icons'
$tabRoot = Join-Path $root 'miniprogram/images'

$tones = @{
  brand = '#1f6b4b'
  ink = '#1c2a22'
  muted = '#95a096'
  accent = '#b98b45'
  warning = '#d8922f'
  danger = '#c95045'
  info = '#3d739c'
  white = '#ffffff'
}

function Convert-HexColor([string]$hex) {
  $value = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    255,
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
  )
}

function New-RoundPen($color, [float]$width) {
  $pen = New-Object System.Drawing.Pen($color, $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function New-RoundRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Stroke-RoundRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-RoundRectPath $x $y $w $h $r
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

function Fill-RoundRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-RoundRectPath $x $y $w $h $r
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-Polyline($g, $pen, [float[]]$points) {
  for ($i = 0; $i -lt $points.Length - 2; $i += 2) {
    $g.DrawLine($pen, $points[$i], $points[$i + 1], $points[$i + 2], $points[$i + 3])
  }
}

$draws = @{}

$draws['herb'] = {
  param($g, $p, $thin, $b)
  $g.DrawLine($p, 48, 76, 48, 30)
  $g.DrawBezier($p, 48, 52, 27, 32, 20, 53, 43, 59)
  $g.DrawBezier($p, 48, 44, 70, 22, 79, 46, 52, 54)
  $g.DrawBezier($thin, 48, 64, 32, 58, 27, 70, 16, 78)
  $g.DrawBezier($thin, 48, 64, 66, 58, 70, 70, 82, 78)
}

$draws['home'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(17,46,48,20,79,46)
  Stroke-RoundRect $g $p 27 45 42 34 5
  $g.DrawLine($thin, 43, 79, 43, 60)
  $g.DrawLine($thin, 53, 60, 53, 79)
}

$draws['family'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 37, 18, 22, 22)
  $g.DrawArc($p, 28, 47, 40, 32, 205, 130)
  $g.DrawEllipse($thin, 17, 31, 18, 18)
  $g.DrawArc($thin, 10, 55, 32, 22, 205, 130)
  $g.DrawEllipse($thin, 61, 31, 18, 18)
  $g.DrawArc($thin, 54, 55, 32, 22, 205, 130)
}

$draws['profile'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 36, 20, 24, 24)
  $g.DrawArc($p, 25, 54, 46, 28, 202, 136)
}

$draws['location'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($thin, 39, 30, 18, 18)
  $g.DrawBezier($p, 48, 78, 24, 50, 31, 19, 48, 19)
  $g.DrawBezier($p, 48, 78, 72, 50, 65, 19, 48, 19)
}

$draws['calendar'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 20 24 56 54 7
  $g.DrawLine($p, 20, 40, 76, 40)
  $g.DrawLine($thin, 34, 18, 34, 30)
  $g.DrawLine($thin, 62, 18, 62, 30)
  $g.DrawLine($thin, 34, 54, 62, 54)
  $g.DrawLine($thin, 34, 66, 51, 66)
}

$draws['bell'] = {
  param($g, $p, $thin, $b)
  $g.DrawBezier($p, 30, 60, 31, 42, 32, 28, 48, 28)
  $g.DrawBezier($p, 66, 60, 65, 42, 64, 28, 48, 28)
  $g.DrawLine($p, 26, 60, 70, 60)
  $g.DrawArc($thin, 40, 64, 16, 12, 0, 180)
}

$draws['add'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($thin, 20, 20, 56, 56)
  $g.DrawLine($p, 48, 33, 48, 63)
  $g.DrawLine($p, 33, 48, 63, 48)
}

$draws['record'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 25 18 46 60 6
  Draw-Polyline $g $thin @(55,18,55,34,71,34)
  $g.DrawLine($thin, 35, 47, 61, 47)
  $g.DrawLine($thin, 35, 58, 61, 58)
  $g.DrawLine($thin, 35, 69, 51, 69)
}

$draws['list'] = {
  param($g, $p, $thin, $b)
  foreach ($y in @(30,48,66)) {
    $g.DrawEllipse($p, 22, $y - 3, 6, 6)
    $g.DrawLine($p, 38, $y, 74, $y)
  }
}

$draws['grid'] = {
  param($g, $p, $thin, $b)
  foreach ($x in @(22,52)) {
    foreach ($y in @(22,52)) {
      Stroke-RoundRect $g $p $x $y 22 22 5
    }
  }
}

$draws['garden'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $thin 18 58 60 16 7
  $g.DrawLine($p, 48, 58, 48, 32)
  $g.DrawBezier($p, 47, 43, 27, 27, 24, 45, 45, 50)
  $g.DrawBezier($p, 49, 38, 69, 22, 75, 42, 51, 48)
}

$draws['archive'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 22 22 38 56 5
  $g.DrawLine($p, 60, 30, 74, 30)
  $g.DrawLine($p, 60, 46, 74, 46)
  $g.DrawLine($p, 60, 62, 74, 62)
  $g.DrawLine($thin, 33, 35, 49, 35)
  $g.DrawLine($thin, 33, 49, 49, 49)
}

$draws['chart'] = {
  param($g, $p, $thin, $b)
  $g.DrawLine($p, 22, 74, 76, 74)
  $g.DrawLine($p, 22, 74, 22, 24)
  $g.DrawLine($p, 36, 64, 36, 49)
  $g.DrawLine($p, 50, 64, 50, 34)
  $g.DrawLine($p, 64, 64, 64, 42)
}

$draws['pie'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 22, 22, 52, 52)
  $g.DrawLine($p, 48, 48, 48, 22)
  $g.DrawLine($p, 48, 48, 72, 48)
}

$draws['upload'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(32,43,48,27,64,43)
  $g.DrawLine($p, 48, 28, 48, 61)
  Draw-Polyline $g $thin @(24,63,24,75,72,75,72,63)
}

$draws['download'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(32,51,48,67,64,51)
  $g.DrawLine($p, 48, 29, 48, 66)
  Draw-Polyline $g $thin @(24,72,24,80,72,80,72,72)
}

$draws['offline'] = {
  param($g, $p, $thin, $b)
  $g.DrawArc($p, 20, 39, 28, 22, 190, 200)
  $g.DrawArc($p, 36, 26, 30, 30, 205, 170)
  $g.DrawArc($p, 56, 41, 22, 18, 210, 150)
  $g.DrawLine($p, 24, 64, 70, 64)
  $g.DrawLine($thin, 24, 24, 72, 72)
}

$draws['sync'] = {
  param($g, $p, $thin, $b)
  $g.DrawArc($p, 25, 25, 46, 46, 205, 205)
  Draw-Polyline $g $p @(64,22,72,38,55,36)
  $g.DrawArc($p, 25, 25, 46, 46, 25, 205)
  Draw-Polyline $g $p @(32,74,24,58,41,60)
}

$draws['camera'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 19 30 58 40 7
  Draw-Polyline $g $thin @(35,30,40,22,56,22,61,30)
  $g.DrawEllipse($p, 38, 39, 20, 20)
}

$draws['image'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 20 24 56 48 6
  $g.DrawEllipse($thin, 58, 34, 7, 7)
  Draw-Polyline $g $p @(25,66,39,52,49,61,58,49,72,66)
}

$draws['water'] = {
  param($g, $p, $thin, $b)
  $g.DrawBezier($p, 48, 18, 28, 42, 28, 55, 48, 75)
  $g.DrawBezier($p, 48, 18, 68, 42, 68, 55, 48, 75)
}

$draws['weed'] = {
  param($g, $p, $thin, $b)
  $g.DrawLine($p, 48, 75, 48, 32)
  $g.DrawBezier($p, 48, 57, 32, 38, 24, 54, 43, 63)
  $g.DrawBezier($p, 48, 48, 64, 30, 75, 47, 53, 56)
  $g.DrawBezier($thin, 48, 69, 34, 63, 26, 72, 18, 78)
  $g.DrawBezier($thin, 48, 69, 62, 63, 70, 72, 78, 78)
}

$draws['fertilize'] = {
  param($g, $p, $thin, $b)
  $g.DrawLine($p, 31, 22, 58, 49)
  Stroke-RoundRect $g $thin 53 46 18 24 4
  $g.DrawLine($thin, 25, 58, 72, 58)
  foreach ($x in @(35,46,58)) { $g.DrawLine($thin, $x, 70, $x + 4, 74) }
}

$draws['pest'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 35, 32, 26, 34)
  $g.DrawEllipse($thin, 39, 20, 18, 16)
  $g.DrawLine($thin, 35, 44, 23, 36)
  $g.DrawLine($thin, 61, 44, 73, 36)
  $g.DrawLine($thin, 35, 55, 22, 61)
  $g.DrawLine($thin, 61, 55, 74, 61)
  $g.DrawLine($thin, 48, 34, 48, 64)
}

$draws['growth'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $thin @(22,74,22,26,74,26)
  Draw-Polyline $g $p @(28,65,42,52,54,57,72,37)
  Draw-Polyline $g $p @(62,37,72,37,72,47)
}

$draws['check'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($thin, 20, 20, 56, 56)
  Draw-Polyline $g $p @(33,50,44,61,65,37)
}

$draws['close'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($thin, 20, 20, 56, 56)
  $g.DrawLine($p, 36, 36, 60, 60)
  $g.DrawLine($p, 60, 36, 36, 60)
}

$draws['warning'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(48,18,78,74,18,74,48,18)
  $g.DrawLine($p, 48, 38, 48, 56)
  $g.DrawEllipse($p, 45, 64, 6, 6)
}

$draws['admin'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(48,18,72,28,69,55,48,78,27,55,24,28,48,18)
  Draw-Polyline $g $thin @(36,49,45,58,61,40)
}

$draws['key'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 22, 37, 22, 22)
  $g.DrawLine($p, 42, 48, 76, 48)
  $g.DrawLine($thin, 63, 48, 63, 59)
  $g.DrawLine($thin, 72, 48, 72, 56)
}

$draws['help'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($thin, 20, 20, 56, 56)
  $g.DrawArc($p, 38, 31, 20, 19, 205, 245)
  $g.DrawLine($p, 48, 50, 48, 58)
  $g.DrawEllipse($p, 45, 66, 6, 6)
}

$draws['info'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($thin, 20, 20, 56, 56)
  $g.DrawLine($p, 48, 43, 48, 65)
  $g.DrawEllipse($p, 45, 30, 6, 6)
}

$draws['phone'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 32 16 32 64 7
  $g.DrawLine($thin, 43, 68, 53, 68)
}

$draws['search'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 23, 23, 34, 34)
  $g.DrawLine($p, 51, 51, 73, 73)
}

$draws['trophy'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 34 22 28 30 5
  $g.DrawArc($thin, 19, 26, 22, 22, 270, 180)
  $g.DrawArc($thin, 55, 26, 22, 22, 90, 180)
  $g.DrawLine($p, 48, 52, 48, 68)
  $g.DrawLine($p, 34, 76, 62, 76)
}

$draws['medal'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $thin @(34,18,43,36,48,28,53,36,62,18)
  $g.DrawEllipse($p, 32, 38, 32, 32)
  Draw-Polyline $g $thin @(48,47,52,56,61,56,54,61,57,70,48,64,39,70,42,61,35,56,44,56,48,47)
}

$draws['star'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(48,19,56,39,78,40,61,54,67,76,48,64,29,76,35,54,18,40,40,39,48,19)
}

$draws['export'] = $draws['download']

$draws['clock'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 20, 20, 56, 56)
  $g.DrawLine($p, 48, 34, 48, 50)
  $g.DrawLine($p, 48, 50, 61, 58)
}

$draws['weather'] = {
  param($g, $p, $thin, $b)
  $g.DrawEllipse($p, 24, 22, 24, 24)
  $g.DrawArc($p, 30, 49, 24, 18, 180, 180)
  $g.DrawArc($p, 47, 42, 24, 24, 190, 190)
  $g.DrawLine($p, 30, 67, 74, 67)
}

$draws['community'] = {
  param($g, $p, $thin, $b)
  Stroke-RoundRect $g $p 18 38 22 36 3
  Stroke-RoundRect $g $p 48 24 30 50 4
  $g.DrawLine($thin, 26, 49, 32, 49)
  $g.DrawLine($thin, 26, 60, 32, 60)
  $g.DrawLine($thin, 58, 36, 68, 36)
  $g.DrawLine($thin, 58, 49, 68, 49)
  $g.DrawLine($thin, 58, 62, 68, 62)
}

$draws['arrow-right'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(34,22,60,48,34,74)
}

$draws['arrow-left'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(62,22,36,48,62,74)
}

$draws['chevron-down'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(28,38,48,58,68,38)
}

$draws['chevron-up'] = {
  param($g, $p, $thin, $b)
  Draw-Polyline $g $p @(28,58,48,38,68,58)
}

function New-IconPng([string]$name, [string]$path, [string]$hex, [int]$size = 96) {
  $dir = Split-Path $path -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

  $color = Convert-HexColor $hex
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $scale = $size / 96
  $g.ScaleTransform($scale, $scale)

  $pen = New-RoundPen $color 6
  $thin = New-RoundPen $color 4
  $brush = New-Object System.Drawing.SolidBrush($color)
  & $draws[$name] $g $pen $thin $brush

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose()
  $thin.Dispose()
  $pen.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

foreach ($tone in $tones.Keys) {
  foreach ($name in $draws.Keys) {
    New-IconPng $name (Join-Path $iconRoot "$tone/$name.png") $tones[$tone] 96
  }
}

$tabs = @{
  home = 'home'
  records = 'record'
  submit = 'add'
  garden = 'garden'
  profile = 'profile'
}

foreach ($tab in $tabs.Keys) {
  New-IconPng $tabs[$tab] (Join-Path $tabRoot "tab-$tab.png") $tones['muted'] 96
  New-IconPng $tabs[$tab] (Join-Path $tabRoot "tab-$tab-active.png") $tones['brand'] 96
}

Write-Host "Generated $($draws.Keys.Count) icons across $($tones.Keys.Count) tones."
