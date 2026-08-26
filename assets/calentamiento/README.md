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
