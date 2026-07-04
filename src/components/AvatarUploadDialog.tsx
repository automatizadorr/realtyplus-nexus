import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, ImageUp, Loader2, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCroppedSquareBlob } from "@/lib/cropImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AvatarUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Se llama con la nueva URL pública tras subir (por si el padre quiere reflejarla). */
  onUploaded?: (url: string) => void;
}

export function AvatarUploadDialog({ open, onOpenChange, userId, onUploaded }: AvatarUploadDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen supera los 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    // permite volver a elegir el mismo archivo
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!imageSrc || !area) return;
    setSaving(true);
    try {
      const blob = await getCroppedSquareBlob(imageSrc, area, 400);
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-buster: el path es fijo (upsert), forzamos recarga de la nueva imagen
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (updErr) throw updErr;

      toast.success("Foto de perfil actualizada.");
      onUploaded?.(url);
      onOpenChange(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("No se pudo subir la foto: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Foto de perfil
          </DialogTitle>
          <DialogDescription>
            Sube una imagen, ajústala en el cuadro y posiciónala arrastrando o con el zoom.
          </DialogDescription>
        </DialogHeader>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {!imageSrc ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <ImageUp className="h-8 w-8" />
            <span className="text-sm font-medium">Haz clic para elegir una imagen</span>
            <span className="text-xs">JPG o PNG · hasta 8 MB</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="relative h-64 w-full overflow-hidden rounded-xl bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setArea(areaPixels)}
              />
            </div>
            <div className="flex items-center gap-3">
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.01}
                onValueChange={(v) => setZoom(v[0])}
                aria-label="Zoom"
              />
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={saving}>
                Cambiar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!imageSrc || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
