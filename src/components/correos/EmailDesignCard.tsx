import { Palette, Type, MousePointerClick, Link2, Image, AlignLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DesignMode = "texto" | "pro";

type Props = {
  designMode: DesignMode;
  setDesignMode: (m: DesignMode) => void;
  titulo: string; setTitulo: (v: string) => void;
  ctaText: string; setCtaText: (v: string) => void;
  ctaUrl: string; setCtaUrl: (v: string) => void;
  brandColor: string; setBrandColor: (v: string) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  footerText: string; setFooterText: (v: string) => void;
};

const modeBtn = (active: boolean) =>
  `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
    active ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"
  }`;

export default function EmailDesignCard(p: Props) {
  const pro = p.designMode === "pro";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4 text-[#003DA5]" /> Diseño del correo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <button type="button" className={modeBtn(!pro)} onClick={() => p.setDesignMode("texto")}>
            Texto simple
          </button>
          <button type="button" className={modeBtn(pro)} onClick={() => p.setDesignMode("pro")}>
            Diseño profesional (HTML)
          </button>
        </div>

        {pro ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Correo con encabezado, botón de acción y pie, responsivo y compatible con Gmail/Outlook.
              El <strong>cuerpo</strong> (paso 3) se usa como contenido; las variables <code className="rounded bg-muted px-1">{"{{empresa}}"}</code> siguen funcionando.
            </p>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs"><Type className="h-3.5 w-3.5" /> Título (encabezado grande)</Label>
              <Input value={p.titulo} onChange={(e) => p.setTitulo(e.target.value)} placeholder="Que ningún lead de {{empresa}} se vuelva a escapar" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><MousePointerClick className="h-3.5 w-3.5" /> Texto del botón</Label>
                <Input value={p.ctaText} onChange={(e) => p.setCtaText(e.target.value)} placeholder="Agendar 10 minutos" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> Enlace del botón</Label>
                <Input value={p.ctaUrl} onChange={(e) => p.setCtaUrl(e.target.value)} placeholder="https://wa.me/569… o link de calendario" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Palette className="h-3.5 w-3.5" /> Color de marca</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={p.brandColor} onChange={(e) => p.setBrandColor(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5" />
                  <Input value={p.brandColor} onChange={(e) => p.setBrandColor(e.target.value)} className="font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Image className="h-3.5 w-3.5" /> Logo (URL pública, opcional)</Label>
                <Input value={p.logoUrl} onChange={(e) => p.setLogoUrl(e.target.value)} placeholder="https://…/logo.png (si vacío, usa el nombre)" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs"><AlignLeft className="h-3.5 w-3.5" /> Texto del pie</Label>
              <Input value={p.footerText} onChange={(e) => p.setFooterText(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Envío en texto con formato simple (párrafos y listas). Cambia a <strong>Diseño profesional</strong> para una plantilla con encabezado, botón y pie.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
