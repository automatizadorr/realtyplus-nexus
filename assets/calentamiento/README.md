# Piezas de calentamiento

Las imágenes se generan con **HTML + CSS renderizado por Chrome headless**, no
con Canva ni Figma: así el diseño queda versionado y se puede corregir una coma
sin rehacer la pieza.

## Regenerar

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --window-size=1080,1080 `
  "--screenshot=infografia-fase2.png" "file:///<ruta>/infografia-fase2.html"
```

Chrome no puede escribir el PNG si se lo invoca desde Git Bash ("Acceso
denegado"); hay que llamarlo desde PowerShell con la ruta absoluta.

## Publicar

WhatsApp necesita una **URL pública HTTPS** para el `media_url`; no sirve un
archivo local ni un bucket privado. Se sube al bucket `email-assets`, que ya es
público:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://owykkhwqpnumvgdeugmj.supabase.co/storage/v1/object/email-assets/calentamiento/infografia-fase2.png" `
  -Headers @{ Authorization = "Bearer <service_role>"; "x-upsert" = "true" } `
  -Body ([System.IO.File]::ReadAllBytes($path)) -ContentType "image/png"
```

El bucket `whatsapp-media` es privado a propósito — ahí caen los archivos que
mandan los leads — y no hay que hacerlo público para esto.

Después se enlaza en la pieza:

```sql
UPDATE public.calentamiento_piezas
SET media_url = 'https://.../email-assets/calentamiento/infografia-fase2.png'
WHERE fase = 2;
```

## Criterios de diseño

- **1080×1080.** Cuadrado: WhatsApp lo muestra completo en la previsualización
  del chat, sin recortes.
- **Texto grande.** La imagen se ve primero como miniatura; si el titular no se
  lee ahí, la pieza no existe.
- **Sin estadísticas inventadas.** La comparación es una escena concreta —dos
  líneas de tiempo, la misma hora— y no un porcentaje que nadie puede
  respaldar.

## El video de la fase 3

`video-fase3.html` tiene las **8 escenas** de la historia; se elige cuál
renderizar con `?escena=N`. Son capturas fijas, no una animación CSS: así el
texto sale nítido, cada escena se corrige por separado, y no hay que capturar
cientos de frames. El movimiento lo pone ffmpeg.

Regenerar todo:

```powershell
.
ender-video.ps1
```

Dos trampas que ya están resueltas en el script:

- **`zoompan` cuenta sus frames por cada frame de entrada.** Si la imagen se
  lee con `-loop 1 -t 3.2`, entran 80 frames y salen 6.400: el video dura 274
  segundos en vez de 21. Hay que leer la imagen sin `-loop`, para que el
  demuxer entregue un solo frame.
- **Escalar a 1620 antes del zoompan.** Si se hace al revés, el texto tiembla
  al ampliarse.

Resultado: 1080×1080, 21,4 s, ~1,4 MB. WhatsApp corta en 16 MB, así que sobra
margen.

## La versión de Instagram

`video-fase3-ig.html` es la misma historia en **9:16 (1080×1920)** para Reels.
Se regenera con:

```powershell
.ender-video.ps1 -Ig
```

No es solo recortar el cuadrado. Reels tiene **zonas muertas**: unos 250 px
arriba se los lleva el encabezado y unos 420 px abajo el nombre de usuario, el
texto del post y los botones. Todo el contenido vive entre esas dos franjas, y
por eso las escenas se rediseñaron en vez de reescalarse — el texto es más
grande, hay menos palabras por pantalla y las frases se cortan distinto.

Ritmo más rápido que la versión de WhatsApp: escenas de 2,8 s en vez de 3,2 y
30 fps en vez de 25. Total 18,9 s.

**Falta el audio.** El video sale con una pista silenciosa, y un Reel mudo
rinde mal: el alcance depende en buena parte del audio. Lo correcto es poner
un audio en tendencia **desde la app de Instagram al publicar**, que además es
lo que premia el algoritmo. No conviene incrustarle música acá.
