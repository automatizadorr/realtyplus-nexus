# Regenera el video de la fase 3 desde video-fase3.html.
#
# Las 8 escenas son capturas de Chrome, no una animacion: asi el texto sale
# nitido y se puede corregir una linea sin rehacer el video. El movimiento lo
# pone ffmpeg con zoompan y las transiciones con xfade.
param(
  [string]$Salida = "$PSScriptRoot\video-fase3.mp4",
  [double]$Dur = 3.2,
  [double]$Trans = 0.6,
  [int]$Fps = 25
)
$tmp = Join-Path $env:TEMP "calentamiento-video"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$html = ($PSScriptRoot -replace '\','/') + "/video-fase3.html"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$n = 8

foreach ($i in 1..$n) {
  $out = "{0}\escena{1:d2}.png" -f $tmp, $i
  & $chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --window-size=1080,1080 "--screenshot=$out" "file:///$html`?escena=$i" 2>&1 | Out-Null
}

$frames = [int]($Dur * $Fps)
$partes = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $n; $i++) {
  # Se escala a 1620 ANTES del zoompan; al reves el texto tiembla.
  $z = if ($i % 2 -eq 0) { "min(zoom+0.00055,1.09)" } else { "if(lte(zoom,1.0),1.09,max(1.001,zoom-0.00055))" }
  $partes.Add("[$($i):v]scale=1620:1620,zoompan=z='$z':d=$frames" + ":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1080:fps=$Fps,setsar=1[v$i]")
}
$prev = "v0"; $off = $Dur - $Trans
for ($i = 1; $i -lt $n; $i++) {
  $lbl = if ($i -eq ($n-1)) { "vout" } else { "x$i" }
  $partes.Add("[$prev][v$i]xfade=transition=fade:duration=$Trans" + ":offset=" + [math]::Round($off,2) + "[$lbl]")
  $prev = $lbl; $off = $off + ($Dur - $Trans)
}
[System.IO.File]::WriteAllText("$tmp\filtro.txt", ($partes -join ";"))

$ff = New-Object System.Collections.Generic.List[string]
# SIN -loop: el demuxer de imagen entrega un solo frame y zoompan genera los
# que corresponden. Con -loop, zoompan multiplica y el video dura 13x mas.
foreach ($i in 1..$n) { $ff.Add("-i"); $ff.Add(("{0}\escena{1:d2}.png" -f $tmp,$i)) }
$ff.AddRange([string[]]@("-f","lavfi","-i","anullsrc=r=44100:cl=stereo",
  "-filter_complex_script","$tmp\filtro.txt","-map","[vout]","-map","$($n):a",
  "-c:v","libx264","-preset","veryfast","-crf","23","-pix_fmt","yuv420p","-r","$Fps",
  "-c:a","aac","-b:a","64k","-shortest","-movflags","+faststart","-y",$Salida))
& ffmpeg -hide_banner -loglevel error @ff
"Listo: $Salida"
