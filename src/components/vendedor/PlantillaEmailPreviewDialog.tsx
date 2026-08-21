import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { PlantillaEmail } from "@/components/vendedor/types";

// Preview de solo lectura del correo tal cual se vería (HTML renderizado en
// un iframe con sandbox, sin permitir scripts, aunque el contenido lo haya
// escrito un vendedor de confianza). Desde acá se puede saltar a editar.
export default function PlantillaEmailPreviewDialog({
  open, onOpenChange, plantilla, onEditar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantilla: PlantillaEmail | null;
  onEditar: () => void;
}) {
  if (!plantilla) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate">{plantilla.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asunto: </span>
            {plantilla.asunto}
          </p>
          <div className="overflow-hidden rounded-lg border bg-white">
            <iframe
              title={`Preview ${plantilla.nombre}`}
              sandbox=""
              srcDoc={plantilla.cuerpo_html || `<pre style="white-space:pre-wrap;font-family:inherit;padding:12px">${plantilla.cuerpo_text ?? ""}</pre>`}
              className="h-[360px] w-full"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button type="button" onClick={onEditar} className="gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
