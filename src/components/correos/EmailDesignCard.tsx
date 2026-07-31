import { useRef, useState } from "react";
import { Palette, Type, MousePointerClick, Link2, Image, AlignLeft, Upload, Loader2, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type DesignMode = "texto" | "pro";

type Props = {
  designMode: DesignMode;
  setDesignMode: (m: DesignMode) => void;
  titulo: string; setTitulo: (v: string) => void;
  ctaText: string; setCtaText: (v: string) => void;
  ctaUrl: string; setCtaUrl: (v: string) => void;
  brandColor: string; setBrandColor: (v: string) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  avatarUrl: string; setAvatarUrl: (v: string) => void;
  footerText: string; setFooterText: (v: string) => void;
  userId?: string;
};

const modeBtn = (active: boolean) =>
  `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
    active ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"
  }`;

export default function EmailDesignCard(p: Props) {
  const pro = p.designMode === "pro";
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Sube una imagen a email-assets y devuelve su URL pública (reutilizable: logo y avatar).
  const uploadImage = async (
    file: File, prefix: string, setUrl: (u: string) => void, setBusy: (b: boolean) => void, ref: React.RefObject<HTMLInputElement>, okMsg: string,
  ) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo no válido", description: "Sube una imagen (PNG, JPG o WEBP).", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagen muy pesada", description: "Máximo 2 MB. Comprime la imagen e inténtalo de nuevo.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${p.userId || "shared"}/${prefix}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("email-assets")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("email-assets").getPublicUrl(path);
      setUrl(pub.publicUrl);
      toast({ title: okMsg });
    } catch (e) {
      toast({ title: "No se pudo subir", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

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
                <Label className="flex items-center gap-1.5 text-xs"><Image className="h-3.5 w-3.5" /> Logo (opcional)</Label>
                <div className="flex items-center gap-2">
                  {p.logoUrl && (
                    <span className="grid h-9 w-14 shrink-0 place-items-center overflow-hidden rounded border border-input bg-[#0f1e3a] px-1">
                      <img src={p.logoUrl} alt="logo" className="max-h-7 max-w-full object-contain" />
                    </span>
                  )}
                  <Input value={p.logoUrl} onChange={(e) => p.setLogoUrl(e.target.value)} placeholder="Pega una URL o sube una imagen →" />
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "logo", p.setLogoUrl, setUploading, fileRef, "Logo subido"); }} />
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir
                  </Button>
                  {p.logoUrl && (
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => p.setLogoUrl("")}>
                      Quitar
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">PNG/JPG/WEBP, máx 2 MB. Si lo dejas vacío, el encabezado usa el nombre del remitente.</p>
              </div>
            </div>

            {/* Foto de perfil del remitente (firma con foto) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs"><UserCircle className="h-3.5 w-3.5" /> Foto de perfil del remitente (firma en el correo)</Label>
              <div className="flex items-center gap-2">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-input bg-muted">
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    : <UserCircle className="h-6 w-6 text-muted-foreground" />}
                </span>
                <Input value={p.avatarUrl} onChange={(e) => p.setAvatarUrl(e.target.value)} placeholder="Pega una URL o sube tu foto →" />
                <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "avatar", p.setAvatarUrl, setUploadingAvatar, avatarRef, "Foto subida"); }} />
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={uploadingAvatar} onClick={() => avatarRef.current?.click()}>
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir
                </Button>
                {p.avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => p.setAvatarUrl("")}>
                    Quitar
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Aparece como firma (foto redonda + tu nombre) al final del mensaje. Opcional.</p>
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
