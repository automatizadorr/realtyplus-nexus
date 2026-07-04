// Recorta una imagen a un cuadrado a partir del área que devuelve react-easy-crop
// (croppedAreaPixels) y la exporta como Blob JPEG listo para subir a Storage.

export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = src;
  });
}

/**
 * Devuelve un Blob cuadrado (JPEG) del área recortada, escalado a `size`×`size`.
 * @param imageSrc  dataURL / objectURL de la imagen original
 * @param area      área en píxeles (croppedAreaPixels de react-easy-crop)
 * @param size      lado del cuadrado de salida (px)
 */
export async function getCroppedSquareBlob(
  imageSrc: string,
  area: PixelArea,
  size = 400,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height, // recorte del origen
    0, 0, size, size,                        // destino cuadrado
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))),
      "image/jpeg",
      0.9,
    );
  });
}
